import { Database } from "../db";
import {
	runNewsScraper,
	ensureNewsDataFresh,
	isNewsDataStale,
	STALE_THRESHOLD_MS,
	type NewsScraperResult,
} from "./newsScraper";

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
	newsScraper: NewsScraperResult;
}> {
	console.log("[CronManager] Starting scheduled cron job");

	const newsScraper = await runNewsScraper(db, kv, poeCookie, {
		includeUpdateChecks: true,
	});

	console.log("[CronManager] Completed cron job", {
		newsScraper,
	});

	return {
		newsScraper,
	};
}

export {
	runNewsScraper,
	ensureNewsDataFresh,
	isNewsDataStale,
	STALE_THRESHOLD_MS,
};
