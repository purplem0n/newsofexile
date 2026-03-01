export interface TwitchStream {
	user_id: string;
	user_login: string;
	user_name: string;
}

/**
 * Fetch all live channels for a given game (paginated)
 */
export async function getLiveChannels(
	gameId: string,
	accessToken: string,
	clientId: string,
): Promise<TwitchStream[]> {
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
