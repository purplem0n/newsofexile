import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { NewsFetch } from "./endpoints/newsFetch";
import { createDb } from "./db";
import { runCronJobs } from "./crons";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all origins (allow frontend to call API)
app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	})
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/news", NewsFetch);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app with scheduled cron handler
export default {
	fetch: app.fetch,
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		console.log(`[Scheduled] Cron triggered: ${controller.cron}`);

		// Only run on our configured cron schedule (every minute)
		if (controller.cron === "* * * * *") {
			try {
				// Initialize database connection
				const db = createDb(env.DATABASE_URL);

				// Run the unified news scraper (pass POE cookie and Redis config)
				const results = await runCronJobs(
					db,
					env.POE_COOKIE,
					env.UPSTASH_REDIS_REST_URL,
					env.UPSTASH_REDIS_REST_TOKEN,
				);

				console.log("[Scheduled] Cron job completed:", results);
			} catch (error) {
				console.error("[Scheduled] Error running cron job:", error);
			}
		} else {
			console.log(`[Scheduled] Unrecognized cron pattern: ${controller.cron}`);
		}
	},
};
