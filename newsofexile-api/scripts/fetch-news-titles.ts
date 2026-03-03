import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Independent script to fetch news titles from POE forums
 * Fetches up to 10 pages from each source and writes titles to a .txt file
 *
 * Usage:
 *   npx tsx scripts/fetch-news-titles.ts
 *
 * Output:
 *   news-titles.txt - Contains all fetched news titles, one per line
 */

// Forum sources to scrape (News only, no Patch Notes)
const SOURCES = [
	{
		url: "https://www.pathofexile.com/forum/view-forum/news/page/",
		type: "poe1-news" as const,
		name: "POE1 News",
	},
	{
		url: "https://www.pathofexile.com/forum/view-forum/2211/page/",
		type: "poe2-news" as const,
		name: "POE2 News",
	},
];

const MAX_PAGES = 10;
const REQUEST_DELAY_MS = 1000; // 1 second delay between requests

interface NewsItem {
	title: string;
	url: string;
	author: string | null;
	postedAt: Date | null;
	page: number;
}

/**
 * Parse forum HTML to extract news items
 */
function parseForumHtml(
	html: string,
	page: number,
): Array<{
	title: string;
	url: string;
	author: string | null;
	postedAt: Date | null;
	page: number;
}> {
	const items: NewsItem[] = [];
	const $ = cheerio.load(html);

	// Find rows that have the thread content
	const rows = $("tr").filter((_, tr) => {
		return $(tr).find('td.thread .title a[href*="/forum/view-thread/"]').length > 0;
	});

	rows.each((_, element) => {
		const $row = $(element);

		const titleLink = $row
			.find('td.thread .title a[href*="/forum/view-thread/"]')
			.first();
		if (!titleLink.length) return;

		const title = titleLink.text().trim();
		const href = titleLink.attr("href");
		if (!title || !href) return;

		const url = href.startsWith("http") ? href : `https://www.pathofexile.com${href}`;

		const authorLink = $row
			.find(
				"td.thread .postBy .profile-link a, td.thread .postBy .post_by_account a",
			)
			.first();
		let author: string | null = null;
		if (authorLink.length) {
			author = authorLink.text().trim().replace(/#\d+$/, "");
		}

		let postedAt: Date | null = null;
		const dateEl = $row.find("td.thread .postBy .post_date").first();
		if (dateEl.length) {
			postedAt = parsePoeDate(dateEl.text().trim());
		}

		items.push({
			title,
			url,
			author,
			postedAt,
			page,
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

	const cleaned = trimmed.replace(/^,\s*/, "");

	try {
		const parsed = new Date(cleaned);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	} catch {}

	const monthDateMatch = cleaned.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?/);
	if (monthDateMatch) {
		const monthNames = [
			"jan",
			"feb",
			"mar",
			"apr",
			"may",
			"jun",
			"jul",
			"aug",
			"sep",
			"oct",
			"nov",
			"dec",
		];
		const monthIdx = monthNames.findIndex(
			(m) => m === monthDateMatch[1].toLowerCase().substring(0, 3),
		);
		if (monthIdx !== -1) {
			const year = monthDateMatch[3]
				? Number.parseInt(monthDateMatch[3])
				: new Date().getFullYear();
			const day = Number.parseInt(monthDateMatch[2]);
			return new Date(year, monthIdx, day);
		}
	}

	return null;
}

/**
 * Fetch and parse a single page
 */
async function fetchPage(
	source: (typeof SOURCES)[number],
	page: number,
): Promise<NewsItem[]> {
	const url = `${source.url}${page}`;

	console.log(`[${source.name}] Fetching page ${page}: ${url}`);

	const headers: Record<string, string> = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
	};

	const response = await fetch(url, { headers });

	if (!response.ok) {
		if (response.status === 404) {
			console.log(`[${source.name}] Page ${page} not found (404) - stopping`);
			return [];
		}
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();
	const items = parseForumHtml(html, page);

	console.log(`[${source.name}] Page ${page}: Found ${items.length} items`);

	return items.map((item) => ({
		title: item.title,
		url: item.url,
		author: item.author,
		postedAt: item.postedAt,
		page: item.page,
	}));
}

/**
 * Fetch all pages for a source up to MAX_PAGES
 */
async function fetchSource(
	source: (typeof SOURCES)[number],
): Promise<NewsItem[]> {
	const allItems: NewsItem[] = [];

	for (let page = 1; page <= MAX_PAGES; page++) {
		try {
			const items = await fetchPage(source, page);

			// If no items found, stop fetching more pages
			if (items.length === 0) {
				console.log(
					`[${source.name}] No items on page ${page}, stopping pagination`,
				);
				break;
			}

			allItems.push(...items);

			// Add delay between requests to be polite
			if (page < MAX_PAGES) {
				await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
			}
		} catch (error) {
			console.error(`[${source.name}] Error fetching page ${page}:`, error);
			break;
		}
	}

	console.log(
		`[${source.name}] Total items fetched: ${allItems.length}`,
	);

	return allItems;
}

/**
 * Main function
 */
async function main() {
	console.log("=== POE News Title Fetcher ===");
	console.log(`Fetching up to ${MAX_PAGES} pages from each source...\n`);

	const allTitles: string[] = [];
	const stats: Record<string, number> = {};

	// Fetch from each source sequentially
	for (const source of SOURCES) {
		const items = await fetchSource(source);

		stats[source.name] = items.length;

		for (const item of items) {
			allTitles.push(item.title);
		}

		// Add delay between sources
		if (source !== SOURCES[SOURCES.length - 1]) {
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
		}
	}

	console.log("\n=== Summary ===");
	for (const [name, count] of Object.entries(stats)) {
		console.log(`${name}: ${count} titles`);
	}
	console.log(`\nTotal unique titles: ${allTitles.length}`);

	// Write to file
	const outputPath = path.resolve(process.cwd(), "news-titles.txt");
	const content = allTitles.join("\n");

	await fs.writeFile(outputPath, content, "utf-8");

	console.log(`\nOutput written to: ${outputPath}`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
