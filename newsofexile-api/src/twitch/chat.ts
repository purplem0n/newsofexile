const RATE_LIMIT_INTERVAL_MS = 1500; // 20 msg / 30 sec = 1 per 1500ms
const RATE_LIMIT_MARGIN_MS = 15;

/**
 * Send a chat message to a Twitch channel.
 * Returns the latency in ms for rate limit calculation.
 */
export async function sendChatMessage(
	broadcasterId: string,
	message: string,
	accessToken: string,
	clientId: string,
	senderId: string,
): Promise<{ success: boolean; latencyMs: number }> {
	const startTime = Date.now();

	try {
		const response = await fetch("https://api.twitch.tv/helix/chat/messages", {
			method: "POST",
			headers: {
				"Client-Id": clientId,
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				broadcaster_id: broadcasterId,
				sender_id: senderId,
				message,
			}),
		});

		const latencyMs = Date.now() - startTime;

		if (!response.ok) {
			// Ignore errors per plan - don't break the loop
			console.warn(
				`[Twitch] Chat send failed for broadcaster ${broadcasterId}:`,
				response.status,
				await response.text(),
			);
			return { success: false, latencyMs };
		}

		return { success: true, latencyMs };
	} catch (error) {
		const latencyMs = Date.now() - startTime;
		console.warn(`[Twitch] Chat send error for broadcaster ${broadcasterId}:`, error);
		return { success: false, latencyMs };
	}
}

/**
 * Wait for the remaining rate limit period.
 * waitMs = 1500 - latencyMs + 15 (margin)
 */
export function getRateLimitWaitMs(latencyMs: number): number {
	const waitMs = RATE_LIMIT_INTERVAL_MS - latencyMs + RATE_LIMIT_MARGIN_MS;
	return Math.max(0, waitMs);
}
