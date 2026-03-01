import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { twitchTokens } from "../db/schema";

const TWITCH_TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get access token from DB, or from env if DB is empty.
 * Refresh if token is older than 24 hours.
 */
export async function getAccessToken(db: Database, env: Env): Promise<string> {
	const rows = await db.select().from(twitchTokens).limit(1);
	const now = Date.now();

	if (rows.length > 0) {
		const token = rows[0];
		const refreshedAt = new Date(token.refreshedAt).getTime();

		if (now - refreshedAt < TWITCH_TOKEN_REFRESH_INTERVAL_MS) {
			console.log("[Twitch] Using cached access token from DB");
			return token.accessToken;
		}

		// Refresh token (use DB refresh_token - Twitch may have issued a new one)
		console.log("[Twitch] Refreshing access token (expired >24h)");
		const refreshed = await refreshTwitchTokenWithToken(env, token.refreshToken);
		if (refreshed) {
			await db
				.update(twitchTokens)
				.set({
					accessToken: refreshed.access_token,
					refreshToken: refreshed.refresh_token,
					refreshedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.where(eq(twitchTokens.id, token.id));
			return refreshed.access_token;
		}
		console.log("[Twitch] Token refresh failed, using stale token");
		return token.accessToken;
	}

	// No token in DB - use env and save
	console.log("[Twitch] No token in DB, saving from env");
	const accessToken = env.ACCESS_TOKEN;
	const refreshToken = env.REFRESH_TOKEN;

	await db.insert(twitchTokens).values({
		accessToken,
		refreshToken,
		refreshedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	});

	return accessToken;
}

interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
}

export async function refreshTwitchTokenCron(db: Database, env: Env): Promise<boolean> {
	const rows = await db.select().from(twitchTokens).limit(1);
	const refreshToken = rows.length > 0 ? rows[0].refreshToken : env.REFRESH_TOKEN;

	const refreshed = await refreshTwitchTokenWithToken(env, refreshToken);
	if (!refreshed) {
		console.log("[Twitch] Token refresh cron: failed");
		return false;
	}

	if (rows.length > 0) {
		await db
			.update(twitchTokens)
			.set({
				accessToken: refreshed.access_token,
				refreshToken: refreshed.refresh_token,
				refreshedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(twitchTokens.id, rows[0].id));
	} else {
		await db.insert(twitchTokens).values({
			accessToken: refreshed.access_token,
			refreshToken: refreshed.refresh_token,
			refreshedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}
	console.log("[Twitch] Token refresh cron: success");
	return true;
}

async function refreshTwitchTokenWithToken(
	env: Env,
	refreshToken: string,
): Promise<TokenResponse | null> {
	try {
		const params = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET,
		});

		const response = await fetch("https://id.twitch.tv/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});

		if (!response.ok) {
			console.error("[Twitch] Token refresh failed:", await response.text());
			return null;
		}

		return (await response.json()) as TokenResponse;
	} catch (error) {
		console.error("[Twitch] Token refresh error:", error);
		return null;
	}
}
