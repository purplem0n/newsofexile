import * as cheerio from "cheerio";
import { eq, sql } from "drizzle-orm";
import { Database, kvCache } from "../db";
import { newsItems, systemState } from "../db/schema";

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
 * Fetch content (preview + word count) for a single news item
 */
async function fetchContent(
	url: string,
	poeCookie?: string,
): Promise<{ preview: string; wordCount: number } | null> {
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

		return { preview, wordCount };
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
 * Invalidate news list cache for specific source types
 * Always invalidates the "all" cache, plus caches for source types that had new items
 */
async function invalidateNewsCache(
	kv: KVNamespace,
	sourceTypesWithNewItems: Set<string>,
): Promise<void> {
	const keysToDelete: string[] = [];

	// Always invalidate the "all" cache (no sourceType filter)
	keysToDelete.push("news:list");

	// Invalidate caches for specific source types that had new items
	for (const sourceType of sourceTypesWithNewItems) {
		keysToDelete.push(`news:list:source:${sourceType}`);
	}

	// Delete all collected keys using KV
	await kvCache.deleteMany(kv, keysToDelete);

	console.log(`[${JOB_NAME}] Cache invalidated: ${keysToDelete.length} keys deleted`, {
		sourceTypes: Array.from(sourceTypesWithNewItems),
	});
}

/**
 * Main job: Scrape index, check for new items, fetch content, insert with preview
 */
export async function runNewsScraper(
	db: Database,
	kv?: KVNamespace,
	poeCookie?: string,
): Promise<{
	success: boolean;
	scraped: number;
	newItems: number;
	error?: string;
}> {
	console.log(`[${JOB_NAME}] Starting news scraper job`);

	const hasLock = await acquireLock(db);
	if (!hasLock) {
		console.log(`[${JOB_NAME}] Job already running, skipping`);
		return { success: true, scraped: 0, newItems: 0 };
	}

	let totalScraped = 0;
	let totalNew = 0;
	let jobError: Error | null = null;

	// Track which source types had new items (for targeted cache invalidation)
	const sourceTypesWithNewItems = new Set<string>();

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

				// Insert with all data including preview and word count
				await db.insert(newsItems).values({
					sourceId: item.sourceId,
					sourceType: source.type,
					title: item.title,
					url: item.url,
					author: item.author,
					postedAt: item.postedAt?.toISOString() || null,
					scrapedAt: new Date().toISOString(),
					preview: content?.preview || null,
					wordCount: content?.wordCount || 0,
					contentFetchedAt: new Date().toISOString(),
					isActive: true,
				});

				totalNew++;
				console.log(`[${JOB_NAME}] Inserted: ${item.title} (${content?.wordCount || 0} words)`);

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

		console.log(`[${JOB_NAME}] Completed: ${totalScraped} scraped, ${totalNew} new items inserted`);

		// Invalidate cache if new items were added
		if (totalNew > 0 && kv) {
			await invalidateNewsCache(kv, sourceTypesWithNewItems);
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
		error: jobError?.message,
	};
}
