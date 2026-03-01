import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { NewsFetch } from "./endpoints/newsFetch";
import { createDb } from "./db";
import { runCronJobs } from "./crons";
import { refreshTwitchTokenCron } from "./twitch/auth";

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

		if (controller.cron === "* * * * *") {
			// News scraper: every minute
			try {
				const db = createDb(env.DB);
				const results = await runCronJobs(
					db,
					env.CACHE,
					env.POE_COOKIE,
					env,
				);
				console.log("[Scheduled] News scraper completed:", results);
			} catch (error) {
				console.error("[Scheduled] News scraper error:", error);
			}
		} else if (controller.cron === "0 0 * * *") {
			// Twitch token refresh: daily at midnight UTC
			try {
				const db = createDb(env.DB);
				const ok = await refreshTwitchTokenCron(db, env);
				console.log("[Scheduled] Twitch token refresh:", ok ? "success" : "failed");
			} catch (error) {
				console.error("[Scheduled] Twitch token refresh error:", error);
			}
		} else {
			console.log(`[Scheduled] Unrecognized cron pattern: ${controller.cron}`);
		}
	},
};
