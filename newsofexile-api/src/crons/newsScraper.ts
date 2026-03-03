import * as cheerio from "cheerio";
import { eq, sql, and } from "drizzle-orm";
import { Database, kvCache } from "../db";
import { newsItems, systemState, patchNoteUpdates, teaserUpdates } from "../db/schema";
import { classifyNews } from "../lib/news-tagger";

// Forum sources to scrape
const SOURCES = [
	{
		url: "https://www.pathofexile.com/forum/view-forum/news/page/1",
		type: "poe1-news" as const,
		name: "POE1 News",
	},
	{
		url: "https://www.pathofexile.com/forum/view-forum/patch-notes/page/1",
		type: "poe1-patch" as const,
		name: "POE1 Patch Notes",
	},
	{
		url: "https://www.pathofexile.com/forum/view-forum/2211/page/1",
		type: "poe2-news" as const,
		name: "POE2 News",
	},
	{
		url: "https://www.pathofexile.com/forum/view-forum/2212/page/1",
		type: "poe2-patch" as const,
		name: "POE2 Patch Notes",
	},
];

const JOB_NAME = "news-scraper";
const PREVIEW_WORD_COUNT = 100;
const REQUEST_DELAY_MS = 1000; // 1 second delay between content fetches

/**
 * Extract text content from the MAIN/OP post only using Cheerio
 * POE forum structure varies:
 * - News posts: tr.newsPost
 * - Patch notes: tr.staff (first post only)
 * - Replies: tr (without .staff) > td.content-container
 */
function extractTextFromHtml(html: string): string {
	const $ = cheerio.load(html);

	// Remove script, style, and other non-content elements
	$('script, style, noscript, iframe, object, embed').remove();

	let contentText = '';

	// Try to find the main post - news posts use .newsPost, patch notes use .staff
	// The first post is always the OP
	let mainPostRow = $('tr.newsPost').first();

	// If no .newsPost, try .staff (for patch notes)
	if (!mainPostRow.length) {
		mainPostRow = $('tr.staff').first();
	}

	// If still nothing, try the first tr in the forum table
	if (!mainPostRow.length) {
		mainPostRow = $('.forumTable tr, .forumPostListTable tr').first();
	}

	if (mainPostRow.length) {
		// Get the content div inside the main post
		// Structure varies: td.content-container > div.content
		const postContent = mainPostRow.find('td.content-container div.content, div.content').first();
		if (postContent.length) {
			// Remove any quoted text from the content
			postContent.find('blockquote, .quote').remove();
			contentText = postContent.text();
		} else {
			// Fallback to the row text if no content div found
			contentText = mainPostRow.text();
		}
	} else {
		// Last resort: look for any content container
		const forumContent = $('.forum-post__content, .post-content, .post-body, .forum-post-content, td.content-container div.content').first();
		if (forumContent.length) {
			contentText = forumContent.text();
		}
	}

	// Clean up whitespace and remove non-content text patterns
	contentText = contentText
		.replace(/\r\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/\[\w+\]|#\d+|Avatar|Quote this Post|Posted by|on \w+ \d{1,2}, \d{4}|Grinding Gear Games/gi, '')
		.trim();

	return contentText;
}

/**
 * Get first N meaningful words from text
 */
function getFirstWords(text: string, wordCount: number): string {
	const words = text
		.split(/\s+/)
		.filter((w) => w.length >= 2 && /[a-zA-Z]/.test(w));
	return words.slice(0, wordCount).join(" ");
}

/**
 * Count total meaningful words in text
 */
function countWords(text: string): number {
	return text
		.split(/\s+/)
		.filter((w) => w.length >= 2 && /[a-zA-Z]/.test(w))
		.length;
}

/**
 * Fetch content (preview + word count + full text) for a single news item
 */
async function fetchContent(
	url: string,
	poeCookie?: string,
): Promise<{ preview: string; wordCount: number; fullText: string } | null> {
	try {
		const headers: Record<string, string> = {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		};

		if (poeCookie) {
			headers["Cookie"] = poeCookie;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			console.error(`[${JOB_NAME}] HTTP ${response.status} for ${url}`);
			return null;
		}

		const html = await response.text();
		const text = extractTextFromHtml(html);

		const preview = getFirstWords(text, PREVIEW_WORD_COUNT);
		const wordCount = countWords(text);

		return { preview, wordCount, fullText: text };
	} catch (error) {
		console.error(`[${JOB_NAME}] Error fetching content from ${url}:`, error);
		return null;
	}
}

/**
 * Parse forum HTML to extract news items
 */
function parseForumHtml(
	html: string,
): Array<{
	sourceId: string;
	title: string;
	url: string;
	author: string | null;
	postedAt: Date | null;
}> {
	const items: Array<{
		sourceId: string;
		title: string;
		url: string;
		author: string | null;
		postedAt: Date | null;
	}> = [];

	const $ = cheerio.load(html);

	// Find rows that have the thread content
	const rows = $('tr').filter((_, tr) => {
		return $(tr).find('td.thread .title a[href*="/forum/view-thread/"]').length > 0;
	});

	rows.each((_, element) => {
		const $row = $(element);

		const titleLink = $row.find('td.thread .title a[href*="/forum/view-thread/"]').first();
		if (!titleLink.length) return;

		const title = titleLink.text().trim();
		const href = titleLink.attr('href');
		if (!title || !href) return;

		const threadIdMatch = href.match(/\/forum\/view-thread\/(\d+)/);
		const threadId = threadIdMatch?.[1];
		if (!threadId) return;

		const url = href.startsWith('http')
			? href
			: `https://www.pathofexile.com${href}`;

		const authorLink = $row.find('td.thread .postBy .profile-link a, td.thread .postBy .post_by_account a').first();
		let author: string | null = null;
		if (authorLink.length) {
			author = authorLink.text().trim().replace(/#\d+$/, '');
		}

		let postedAt: Date | null = null;
		const dateEl = $row.find('td.thread .postBy .post_date').first();
		if (dateEl.length) {
			postedAt = parsePoeDate(dateEl.text().trim());
		}

		items.push({
			sourceId: threadId,
			title,
			url,
			author,
			postedAt,
		});
	});

	return items;
}

/**
 * Parse POE date format
 */
function parsePoeDate(dateText: string): Date | null {
	if (!dateText) return null;

	const trimmed = dateText.trim();

	const relativeMatch = trimmed.match(
		/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i,
	);
	if (relativeMatch) {
		const amount = Number.parseInt(relativeMatch[1], 10);
		const unit = relativeMatch[2].toLowerCase();
		const now = new Date();

		switch (unit) {
			case "second":
				return new Date(now.getTime() - amount * 1000);
			case "minute":
				return new Date(now.getTime() - amount * 60 * 1000);
			case "hour":
				return new Date(now.getTime() - amount * 60 * 60 * 1000);
			case "day":
				return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
			case "week":
				return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
			case "month":
				return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
			case "year":
				return new Date(now.getTime() - amount * 365 * 24 * 60 * 60 * 1000);
		}
	}

	const cleaned = trimmed.replace(/^,\s*/, '');

	try {
		const parsed = new Date(cleaned);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	} catch {}

	const monthDateMatch = cleaned.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?/);
	if (monthDateMatch) {
		const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
		const monthIdx = monthNames.findIndex(m => m === monthDateMatch[1].toLowerCase().substring(0, 3));
		if (monthIdx !== -1) {
			const year = monthDateMatch[3] ? Number.parseInt(monthDateMatch[3]) : new Date().getFullYear();
			const day = Number.parseInt(monthDateMatch[2]);
			return new Date(year, monthIdx, day);
		}
	}

	return null;
}

/**
 * Check if item already exists in database
 */
async function itemExists(
	db: Database,
	sourceId: string,
	sourceType: string,
): Promise<boolean> {
	const existing = await db
		.select({ id: newsItems.id })
		.from(newsItems)
		.where(
			sql`${newsItems.sourceId} = ${sourceId} AND ${newsItems.sourceType} = ${sourceType}`,
		)
		.limit(1);

	return existing.length > 0;
}

/**
 * Check if job is already running
 */
async function acquireLock(db: Database): Promise<boolean> {
	try {
		const existing = await db
			.select()
			.from(systemState)
			.where(eq(systemState.jobName, JOB_NAME))
			.limit(1);

		if (existing.length === 0) {
			await db.insert(systemState).values({
				jobName: JOB_NAME,
				isRunning: true,
				lastRunStartedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			return true;
		}

		const state = existing[0];

		if (state.isRunning && state.lastRunStartedAt) {
			const startedAt = new Date(state.lastRunStartedAt);
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
			
			if (startedAt.getTime() > fiveMinutesAgo.getTime()) {
				console.log(`[${JOB_NAME}] Job already running (started at ${startedAt.toISOString()})`);
				return false;
			}
			
			console.log(`[${JOB_NAME}] Found stale lock from ${startedAt.toISOString()}, resetting`);
			await db
				.update(systemState)
				.set({
					isRunning: false,
					lastError: 'Stale lock detected and reset',
					updatedAt: new Date().toISOString(),
				})
				.where(eq(systemState.jobName, JOB_NAME));
		}

		await db
			.update(systemState)
			.set({
				isRunning: true,
				lastRunStartedAt: new Date().toISOString(),
				lastError: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(systemState.jobName, JOB_NAME));

		return true;
	} catch (error) {
		console.error(`[${JOB_NAME}] Error acquiring lock:`, error);
		return false;
	}
}

/**
 * Release lock when job completes
 */
async function releaseLock(
	db: Database,
	error: Error | null = null,
): Promise<void> {
	try {
		await db
			.update(systemState)
			.set({
				isRunning: false,
				lastRunCompletedAt: error ? undefined : new Date().toISOString(),
				lastError: error?.message || null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(systemState.jobName, JOB_NAME));
	} catch (e) {
		console.error(`[${JOB_NAME}] Error releasing lock:`, e);
	}
}

/**
 * Scrape index page and return parsed items
 */
async function scrapeIndexPage(
	source: (typeof SOURCES)[number],
	poeCookie?: string,
): Promise<ReturnType<typeof parseForumHtml>> {
	try {
		console.log(`[${JOB_NAME}] Scraping ${source.name}`);

		const headers: Record<string, string> = {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		};

		if (poeCookie) {
			headers["Cookie"] = poeCookie;
		}

		const response = await fetch(source.url, { headers });

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const html = await response.text();
		const items = parseForumHtml(html);

		console.log(`[${JOB_NAME}] Found ${items.length} items from ${source.name}`);
		return items;
	} catch (error) {
		console.error(`[${JOB_NAME}] Error scraping ${source.name}:`, error);
		return [];
	}
}

/**
 * Represents a detected patch note update
 */
interface PatchUpdate {
	updateDate: string;
	contentHtml: string;
	contentText: string;
	isPoe1Format: boolean;
}

/**
 * Extract patch note updates from HTML content
 * Handles both POE1 and POE2 formats
 *
 * POE1 Format:
 *   <span style="text-decoration:underline"><strong>Updates for YYYY-MM-DD</strong></span>
 *   <div class="spoiler spoilerHidden">...</div>
 *
 * POE2 Format:
 *   <h3>Updates to Patch Notes</h3>
 *   <div class="spoiler spoilerHidden">
 *     <div class="spoilerTitle"><span>Updates for M-D-YYYY</span></div>
 *     <div class="spoilerContent">...</div>
 *   </div>
 */
export function extractPatchUpdates(html: string): PatchUpdate[] {
	const $ = cheerio.load(html);
	const updates: PatchUpdate[] = [];

	// Try POE1 format first: <span><strong>Updates for YYYY-MM-DD</strong></span>
	// followed by a spoiler div
	const poe1UpdateHeaders = $('span strong').filter((_, el) => {
		const text = $(el).text().trim();
		return /^Updates for\s+\d{4}-\d{2}-\d{2}$/i.test(text);
	});

	poe1UpdateHeaders.each((_, header) => {
		const headerText = $(header).text().trim();
		const dateMatch = headerText.match(/Updates for\s+(\d{4}-\d{2}-\d{2})/i);
		if (!dateMatch) return;

		const updateDate = dateMatch[1];

		// Find the next sibling spoiler div
		const spoilerDiv = $(header).closest('span').next('.spoiler, .spoilerHidden');
		if (!spoilerDiv.length) return;

		const spoilerContent = spoilerDiv.find('.spoilerContent');
		const contentHtml = spoilerContent.html() || spoilerDiv.html() || '';
		const contentText = spoilerContent.text() || spoilerDiv.text() || '';

		// Clean up the text
		const cleanText = contentText
			.replace(/\r\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();

		if (cleanText) {
			updates.push({
				updateDate,
				contentHtml: contentHtml.trim(),
				contentText: cleanText,
				isPoe1Format: true,
			});
		}
	});

	// If no POE1 format found, try POE2 format
	if (updates.length === 0) {
		// Look for "Updates to Patch Notes" heading
		const poe2Header = $('h3').filter((_, el) => {
			return /Updates to Patch Notes/i.test($(el).text().trim());
		});

		if (poe2Header.length) {
			// Find all spoiler divs that follow this header
			// Each spoiler contains one update date
			const container = poe2Header.parent();
			const spoilers = container.find('.spoiler, .spoilerHidden');

			spoilers.each((_, spoiler) => {
				const spoilerTitle = $(spoiler).find('.spoilerTitle span').text().trim();
				const dateMatch = spoilerTitle.match(/Updates for\s+(\d{1,2}-\d{1,2}-\d{4})/i);
				if (!dateMatch) return;

				const updateDate = dateMatch[1];
				const spoilerContent = $(spoiler).find('.spoilerContent');
				const contentHtml = spoilerContent.html() || $(spoiler).html() || '';
				const contentText = spoilerContent.text() || $(spoiler).text() || '';

				// Clean up the text
				const cleanText = contentText
					.replace(/\r\n/g, '\n')
					.replace(/\n{3,}/g, '\n\n')
					.trim();

				if (cleanText && cleanText !== 'Show') {
					updates.push({
						updateDate,
						contentHtml: contentHtml.trim(),
						contentText: cleanText,
						isPoe1Format: false,
					});
				}
			});
		}
	}

	return updates;
}

/**
 * Check if a news item is a "Content Update" patch note
 * These are the ones that receive updates from GGG
 */
function isContentUpdatePatch(title: string, sourceType: string): boolean {
	// Only check patch notes
	if (!sourceType.includes('patch')) {
		return false;
	}

	// Check if title contains "Content Update"
	return title.toLowerCase().includes('content update');
}

/**
 * Check if a patch note update already exists in the database
 */
async function patchUpdateExists(
	db: Database,
	newsItemId: number,
	updateDate: string,
): Promise<boolean> {
	const existing = await db
		.select({ id: patchNoteUpdates.id })
		.from(patchNoteUpdates)
		.where(
			and(
				eq(patchNoteUpdates.newsItemId, newsItemId),
				eq(patchNoteUpdates.updateDate, updateDate),
			),
		)
		.limit(1);

	return existing.length > 0;
}

/**
 * Store detected patch updates in the database
 * Returns count of stored updates
 */
async function storePatchUpdates(
	db: Database,
	newsItemId: number,
	updates: PatchUpdate[],
): Promise<{ count: number; storedUpdates: Array<{ updateDate: string }> }> {
	const storedUpdates: Array<{ updateDate: string }> = [];
	let hasNewUpdates = false;

	for (const update of updates) {
		const exists = await patchUpdateExists(db, newsItemId, update.updateDate);
		if (exists) {
			continue;
		}

		await db.insert(patchNoteUpdates).values({
			newsItemId,
			updateDate: update.updateDate,
			contentHtml: update.contentHtml,
			contentText: update.contentText,
			isPoe1Format: update.isPoe1Format,
			scrapedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		storedUpdates.push({ updateDate: update.updateDate });
		hasNewUpdates = true;
		console.log(
			`[${JOB_NAME}] Stored patch update for news item ${newsItemId}: ${update.updateDate} (${update.isPoe1Format ? 'POE1' : 'POE2'} format)`,
		);
	}

	// Update the parent news item's lastUpdatedAt to surface it
	if (hasNewUpdates) {
		await db
			.update(newsItems)
			.set({ lastUpdatedAt: new Date().toISOString() })
			.where(eq(newsItems.id, newsItemId));
	}

	return { count: storedUpdates.length, storedUpdates };
}

/**
 * Check if a news item is a "Teasers" post
 * These posts receive progressive updates from GGG with new content
 */
function isTeaserPost(title: string, sourceType: string): boolean {
	// Only check news posts (not patch notes)
	if (!sourceType.includes('news')) {
		return false;
	}

	// Check if title contains "teasers" (case insensitive)
	return /teasers/i.test(title);
}

/**
 * Generate a simple content hash for comparing teaser content
 */
function generateContentHash(text: string): string {
	// Simple hash function: sum of char codes * position, mod to keep within reasonable range
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text.charCodeAt(i);
		hash = ((hash << 5) - hash) + char + (i * 7);
		hash = hash & hash; // Convert to 32bit integer
	}
	// Return as positive hex string with word count appended for extra uniqueness
	return `${Math.abs(hash).toString(16)}-${text.split(/\s+/).length}`;
}

/**
 * Check if a teaser update already exists in the database
 */
async function teaserUpdateExists(
	db: Database,
	newsItemId: number,
	contentHash: string,
): Promise<boolean> {
	const existing = await db
		.select({ id: teaserUpdates.id })
		.from(teaserUpdates)
		.where(
			and(
				eq(teaserUpdates.newsItemId, newsItemId),
				eq(teaserUpdates.contentHash, contentHash),
			),
		)
		.limit(1);

	return existing.length > 0;
}

/**
 * Get the latest teaser update for a news item
 */
async function getLatestTeaserUpdate(
	db: Database,
	newsItemId: number,
): Promise<{ contentHash: string; wordCount: number } | null> {
	const result = await db
		.select({
			contentHash: teaserUpdates.contentHash,
			wordCount: teaserUpdates.wordCount,
		})
		.from(teaserUpdates)
		.where(eq(teaserUpdates.newsItemId, newsItemId))
		.orderBy(sql`${teaserUpdates.scrapedAt} DESC`)
		.limit(1);

	return result.length > 0 ? result[0] : null;
}

/**
 * Store a detected teaser update in the database
 * Returns true if a new update was stored, false if it already existed
 */
async function storeTeaserUpdate(
	db: Database,
	newsItemId: number,
	contentHash: string,
	wordCount: number,
	contentText: string,
): Promise<boolean> {
	const exists = await teaserUpdateExists(db, newsItemId, contentHash);
	if (exists) {
		return false;
	}

	await db.insert(teaserUpdates).values({
		newsItemId,
		contentHash,
		wordCount,
		contentText,
		scrapedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	});

	// Update the parent news item's lastUpdatedAt to surface it
	await db
		.update(newsItems)
		.set({ lastUpdatedAt: new Date().toISOString() })
		.where(eq(newsItems.id, newsItemId));

	console.log(
		`[${JOB_NAME}] Stored teaser update for news item ${newsItemId}: ${wordCount} words (hash: ${contentHash})`,
	);

	return true;
}

/**
 * Fetch and check for updates on existing Content Update patch notes
 * This runs after scraping new items to detect any updates GGG may have added
 */
async function checkExistingPatchNotesForUpdates(
	db: Database,
	poeCookie?: string,
): Promise<{ count: number }> {
	let totalUpdatesFound = 0;

	// Get all active Content Update patch notes from the last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const existingPatchNotes = await db
		.select({
			id: newsItems.id,
			title: newsItems.title,
			url: newsItems.url,
			sourceType: newsItems.sourceType,
		})
		.from(newsItems)
		.where(
			and(
				sql`${newsItems.sourceType} LIKE '%patch%'`,
				eq(newsItems.isActive, true),
				sql`${newsItems.postedAt} > ${thirtyDaysAgo.toISOString()}`,
			),
		)
		.limit(20);

	// Filter to only Content Update patches
	const contentUpdates = existingPatchNotes.filter((item) =>
		isContentUpdatePatch(item.title, item.sourceType),
	);

	console.log(
		`[${JOB_NAME}] Checking ${contentUpdates.length} Content Update patch notes for updates`,
	);

	for (const patchNote of contentUpdates) {
		try {
			console.log(`[${JOB_NAME}] Checking updates for: ${patchNote.title}`);

			// Fetch the full HTML content
			const headers: Record<string, string> = {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
			};

			if (poeCookie) {
				headers["Cookie"] = poeCookie;
			}

			const response = await fetch(patchNote.url, { headers });
			if (!response.ok) {
				console.error(
					`[${JOB_NAME}] Failed to fetch ${patchNote.url}: HTTP ${response.status}`,
				);
				continue;
			}

			const html = await response.text();

			// Extract patch updates from the HTML
			const updates = extractPatchUpdates(html);

			if (updates.length > 0) {
				console.log(
					`[${JOB_NAME}] Found ${updates.length} update(s) for ${patchNote.title}`,
				);

				// Store any new updates
				const { count, storedUpdates } = await storePatchUpdates(
					db,
					patchNote.id,
					updates,
				);
				totalUpdatesFound += count;
			} else {
				console.log(`[${JOB_NAME}] No updates found for ${patchNote.title}`);
			}

			// Delay between checks to be polite
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
		} catch (error) {
			console.error(
				`[${JOB_NAME}] Error checking updates for ${patchNote.title}:`,
				error,
			);
		}
	}

	return { count: totalUpdatesFound };
}

/**
 * Fetch and check for updates on existing Teaser posts
 * This runs after scraping new items to detect any new teaser content GGG may have added
 */
async function checkExistingTeasersForUpdates(
	db: Database,
	poeCookie?: string,
): Promise<{ count: number }> {
	let totalUpdatesFound = 0;

	// Get all active Teaser posts from the last 60 days (teasers stay relevant longer)
	const sixtyDaysAgo = new Date();
	sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

	const existingTeasers = await db
		.select({
			id: newsItems.id,
			title: newsItems.title,
			url: newsItems.url,
			sourceType: newsItems.sourceType,
		})
		.from(newsItems)
		.where(
			and(
				sql`${newsItems.sourceType} LIKE '%news%'`,
				eq(newsItems.isActive, true),
				sql`${newsItems.postedAt} > ${sixtyDaysAgo.toISOString()}`,
			),
		)
		.limit(30);

	// Filter to only Teaser posts
	const teaserPosts = existingTeasers.filter((item) =>
		isTeaserPost(item.title, item.sourceType),
	);

	console.log(
		`[${JOB_NAME}] Checking ${teaserPosts.length} Teaser posts for updates`,
	);

	for (const teaser of teaserPosts) {
		try {
			console.log(`[${JOB_NAME}] Checking updates for: ${teaser.title}`);

			// Fetch the full HTML content
			const headers: Record<string, string> = {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
			};

			if (poeCookie) {
				headers["Cookie"] = poeCookie;
			}

			const response = await fetch(teaser.url, { headers });
			if (!response.ok) {
				console.error(
					`[${JOB_NAME}] Failed to fetch ${teaser.url}: HTTP ${response.status}`,
				);
				continue;
			}

			const html = await response.text();

			// Extract text content from HTML
			const text = extractTextFromHtml(html);
			const wordCount = countWords(text);
			const contentHash = generateContentHash(text);

			// Check if this is a new update
			const isNewUpdate = await storeTeaserUpdate(
				db,
				teaser.id,
				contentHash,
				wordCount,
				text,
			);

			if (isNewUpdate) {
				totalUpdatesFound++;
			} else {
				console.log(`[${JOB_NAME}] No updates found for ${teaser.title}`);
			}

			// Delay between checks to be polite
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
		} catch (error) {
			console.error(
				`[${JOB_NAME}] Error checking updates for ${teaser.title}:`,
				error,
			);
		}
	}

	return { count: totalUpdatesFound };
}

/**
 * Invalidate news list cache for specific source types and tags
 * Always invalidates the "all" cache, plus caches for source types and tags that had new items
 * Also invalidates when patch updates or teaser updates are found (since they're included in the main response)
 */
async function invalidateNewsCache(
	kv: KVNamespace,
	sourceTypesWithNewItems: Set<string>,
	tagsWithNewItems: Set<string>,
	updatesFound: { patch: boolean; teaser: boolean } = { patch: false, teaser: false },
): Promise<void> {
	const keysToDelete: string[] = [];

	// Always invalidate the "all" cache (no sourceType filter)
	keysToDelete.push("news:list");

	// Invalidate caches for specific source types that had new items
	for (const sourceType of sourceTypesWithNewItems) {
		keysToDelete.push(`news:list:source:${sourceType}`);
	}

	// Invalidate caches for specific tags that had new items
	for (const tag of tagsWithNewItems) {
		keysToDelete.push(`news:list:tag:${tag}`);
		// Also invalidate combined source+tag caches
		for (const sourceType of sourceTypesWithNewItems) {
			keysToDelete.push(`news:list:source:${sourceType}:tag:${tag}`);
		}
	}

	// Delete all collected keys using KV
	await kvCache.deleteMany(kv, keysToDelete);

	console.log(`[${JOB_NAME}] Cache invalidated: ${keysToDelete.length} keys deleted`, {
		sourceTypes: Array.from(sourceTypesWithNewItems),
		tags: Array.from(tagsWithNewItems),
		updatesFound,
	});
}

/**
 * Main job: Scrape index, check for new items, fetch content, insert with preview
 * Also checks existing Content Update patch notes and Teaser posts for updates from GGG
 */
export async function runNewsScraper(
	db: Database,
	kv?: KVNamespace,
	poeCookie?: string,
): Promise<{
	success: boolean;
	scraped: number;
	newItems: number;
	newPatchUpdates: number;
	newTeaserUpdates: number;
	error?: string;
}> {
	console.log(`[${JOB_NAME}] Starting news scraper job`);

	const hasLock = await acquireLock(db);
	if (!hasLock) {
		console.log(`[${JOB_NAME}] Job already running, skipping`);
		return { success: true, scraped: 0, newItems: 0, newPatchUpdates: 0, newTeaserUpdates: 0 };
	}

	let totalScraped = 0;
	let totalNew = 0;
	let newPatchUpdates = 0;
	let newTeaserUpdates = 0;
	let jobError: Error | null = null;

	// Track which source types had new items (for targeted cache invalidation)
	const sourceTypesWithNewItems = new Set<string>();
	// Track which tags had new items (for tag-specific cache invalidation)
	const tagsWithNewItems = new Set<string>();
	// Track if patch or teaser updates were found (to invalidate cache since updates are in main response)
	const updatesFound = { patch: false, teaser: false };

	try {
		// Process each source
		for (const source of SOURCES) {
			const items = await scrapeIndexPage(source, poeCookie);
			totalScraped += items.length;

			// Track if this source had any new items
			let sourceHadNewItems = false;

			// Process each item from this source
			for (let i = 0; i < items.length; i++) {
				const item = items[i];

				// Check if item already exists
				const exists = await itemExists(db, item.sourceId, source.type);
				if (exists) {
					continue; // Skip existing items
				}

				console.log(`[${JOB_NAME}] New item found: ${item.title}`);
				sourceHadNewItems = true;

				// Fetch content (preview + word count) for this item
				console.log(`[${JOB_NAME}] Fetching content from ${item.url}`);
				const content = await fetchContent(item.url, poeCookie);

			// Check if this is a Content Update patch note and extract any updates
			let patchUpdates: PatchUpdate[] = [];
			let isTeaser = false;
			let teaserContent: { text: string; wordCount: number; hash: string } | null = null;

			if (isContentUpdatePatch(item.title, source.type)) {
				console.log(`[${JOB_NAME}] Detected Content Update patch note, checking for updates`);
				// Fetch the full HTML to check for updates
				const headers: Record<string, string> = {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.9",
				};
				if (poeCookie) {
					headers["Cookie"] = poeCookie;
				}
				const response = await fetch(item.url, { headers });
				if (response.ok) {
					const html = await response.text();
					patchUpdates = extractPatchUpdates(html);
				}
			}

			// Check if this is a Teaser post
			if (isTeaserPost(item.title, source.type)) {
				isTeaser = true;
				console.log(`[${JOB_NAME}] Detected Teaser post, storing initial content`);
				// Use the already fetched content
				const text = content?.fullText || '';
				const wordCount = content?.wordCount || 0;
				const hash = generateContentHash(text);
				teaserContent = { text, wordCount, hash };
			}

			// Classify the news item by content type
			const classification = classifyNews(item.title);

			// Track tags for cache invalidation
			for (const tag of classification.tags) {
				tagsWithNewItems.add(tag);
			}

// Insert with all data including preview, word count, and tags
			const now = new Date().toISOString();
			await db.insert(newsItems).values({
				sourceId: item.sourceId,
				sourceType: source.type,
				title: item.title,
				url: item.url,
				author: item.author,
				tags: JSON.stringify(classification.tags),
				primaryTag: classification.primaryTag,
				postedAt: item.postedAt?.toISOString() || null,
				scrapedAt: now,
				preview: content?.preview || null,
				wordCount: content?.wordCount || 0,
				contentFetchedAt: now,
				isActive: true,
				lastUpdatedAt: now,
			});

				totalNew++;
				console.log(`[${JOB_NAME}] Inserted: ${item.title} [${classification.primaryTag}] (${content?.wordCount || 0} words)`);


// Store any patch updates that were found for this new item
			if (patchUpdates.length > 0) {
				// Get the inserted item's ID
				const insertedItem = await db
					.select({ id: newsItems.id })
					.from(newsItems)
					.where(
						and(
							eq(newsItems.sourceId, item.sourceId),
							eq(newsItems.sourceType, source.type),
						),
					)
					.limit(1);

				if (insertedItem.length > 0) {
					const { count, storedUpdates } = await storePatchUpdates(
						db,
						insertedItem[0].id,
						patchUpdates,
					);
					newPatchUpdates += count;
					if (count > 0) {
						updatesFound.patch = true;
					}
				}
			}

			// Store initial teaser content for new teaser posts
			if (isTeaser && teaserContent) {
				// Get the inserted item's ID
				const insertedItem = await db
					.select({ id: newsItems.id })
					.from(newsItems)
					.where(
						and(
							eq(newsItems.sourceId, item.sourceId),
							eq(newsItems.sourceType, source.type),
						),
					)
					.limit(1);

				if (insertedItem.length > 0) {
					await storeTeaserUpdate(
						db,
						insertedItem[0].id,
						teaserContent.hash,
						teaserContent.wordCount,
						teaserContent.text,
					);
				}
			}

			// Delay between content fetches to be polite
				if (i < items.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
				}
			}

			// If this source had new items, add to the set for cache invalidation
			if (sourceHadNewItems) {
				sourceTypesWithNewItems.add(source.type);
			}
		}

		// Check existing Content Update patch notes for updates
		console.log(`[${JOB_NAME}] Checking existing Content Update patch notes for updates`);
		const { count: existingPatchCount } =
			await checkExistingPatchNotesForUpdates(db, poeCookie);
		newPatchUpdates += existingPatchCount;
		if (existingPatchCount > 0) {
			updatesFound.patch = true;
		}

		// Check existing Teaser posts for updates
		console.log(`[${JOB_NAME}] Checking existing Teaser posts for updates`);
		const { count: existingTeaserCount } =
			await checkExistingTeasersForUpdates(db, poeCookie);
		newTeaserUpdates += existingTeaserCount;
		if (existingTeaserCount > 0) {
			updatesFound.teaser = true;
		}

		console.log(`[${JOB_NAME}] Completed: ${totalScraped} scraped, ${totalNew} new items, ${newPatchUpdates} patch updates, ${newTeaserUpdates} teaser updates`);

		// Invalidate cache if new items were added or any updates were found
		// (updates are included in main response, so we need to invalidate)
		if (kv && (totalNew > 0 || updatesFound.patch || updatesFound.teaser)) {
			await invalidateNewsCache(kv, sourceTypesWithNewItems, tagsWithNewItems, updatesFound);
		}
	} catch (error) {
		jobError = error instanceof Error ? error : new Error(String(error));
		console.error(`[${JOB_NAME}] Job failed:`, jobError);
	} finally {
		await releaseLock(db, jobError);
	}

	return {
		success: jobError === null,
		scraped: totalScraped,
		newItems: totalNew,
		newPatchUpdates,
		newTeaserUpdates,
		error: jobError?.message,
	};
}
