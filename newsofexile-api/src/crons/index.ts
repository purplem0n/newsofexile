import { Database } from "../db";
import { runNewsScraper } from "./newsScraper";

/**
 * Run the unified news scraper cron job
 * This single job:
 * 1. Scrapes index pages from all 4 POE forums
 * 2. For each new item, immediately fetches preview + word count
 * 3. Inserts with all data in one statement
 * 4. Invalidates KV cache when new items are detected
 */
export async function runCronJobs(
	db: Database,
	kv?: KVNamespace,
	poeCookie?: string,
	env?: Env,
): Promise<{
	newsScraper: {
		success: boolean;
		scraped: number;
		newItems: number;
		error?: string;
	};
}> {
	console.log("[CronManager] Starting scheduled cron job");

	// Run the unified news scraper
	const newsScraper = await runNewsScraper(db, kv, poeCookie);

	console.log("[CronManager] Completed cron job", {
		newsScraper,
	});

	return {
		newsScraper,
	};
}

export { runNewsScraper };
