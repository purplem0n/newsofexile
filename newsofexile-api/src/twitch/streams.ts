import type { Database } from "../db";
import { forceRefreshAccessToken } from "./auth";

export interface TwitchStream {
	user_id: string;
	user_login: string;
	user_name: string;
}

export interface GetLiveChannelsOptions {
	gameId: string;
	accessToken: string;
	clientId: string;
	db: Database;
	env: Env;
	allowRetry?: boolean;
}

/**
 * Fetch all live channels for a given game (paginated).
 * If a 401 Unauthorized error occurs, attempts to refresh the token and retry once.
 */
export async function getLiveChannels(
	options: GetLiveChannelsOptions,
): Promise<TwitchStream[]> {
	const { gameId, accessToken, clientId, db, env, allowRetry = true } = options;
	const streams: TwitchStream[] = [];
	let cursor: string | undefined;

	do {
		const url = new URL("https://api.twitch.tv/helix/streams");
		url.searchParams.set("first", "100");
		url.searchParams.set("language", "en");
		url.searchParams.set("type", "live");
		url.searchParams.set("game_id", gameId);
		if (cursor) {
			url.searchParams.set("after", cursor);
		}

		const response = await fetch(url.toString(), {
			headers: {
				"Client-Id": clientId,
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (response.status === 401 && allowRetry) {
			// Token expired - try to refresh and retry once
			console.log("[Twitch] Received 401 while fetching streams, attempting token refresh");
			const newToken = await forceRefreshAccessToken(db, env);
			if (newToken) {
				// Retry with new token
				return getLiveChannels({
					...options,
					accessToken: newToken,
					allowRetry: false, // Prevent infinite retry loops
				});
			}
		}

		if (!response.ok) {
			console.error(
				"[Twitch] Failed to fetch streams:",
				response.status,
				await response.text(),
			);
			break;
		}

		const data = (await response.json()) as {
			data: Array<{
				user_id: string;
				user_login: string;
				user_name: string;
			}>;
			pagination?: { cursor?: string };
		};

		for (const s of data.data) {
			streams.push({
				user_id: s.user_id,
				user_login: s.user_login,
				user_name: s.user_name,
			});
		}

		cursor = data.pagination?.cursor;
	} while (cursor);

	console.log(`[Twitch] Fetched ${streams.length} live channels for game_id=${gameId}`);
	return streams;
}
