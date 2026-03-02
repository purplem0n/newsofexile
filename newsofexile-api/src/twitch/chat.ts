import type { Database } from "../db";
import { forceRefreshAccessToken } from "./auth";

// Set to true to disable all Twitch chat messages (prevents API flagging)
const DISABLE_TWITCH_CHAT = true;

const RATE_LIMIT_INTERVAL_MS = 1500; // 20 msg / 30 sec = 1 per 1500ms
const RATE_LIMIT_MARGIN_MS = 15;

export interface SendChatMessageOptions {
	broadcasterId: string;
	message: string;
	accessToken: string;
	clientId: string;
	senderId: string;
	db: Database;
	env: Env;
	allowRetry?: boolean; // Set to false on retry to prevent infinite loops
}

/**
 * Send a chat message to a Twitch channel.
 * If a 401 Unauthorized error occurs, attempts to refresh the token and retry once.
 * Returns the latency in ms for rate limit calculation.
 */
export async function sendChatMessage(
	options: SendChatMessageOptions,
): Promise<{ success: boolean; latencyMs: number }> {
	const { broadcasterId, message, accessToken, clientId, senderId, db, env, allowRetry = true } = options;
	const startTime = Date.now();

	// Skip sending if chat is disabled (prevents API flagging)
	if (DISABLE_TWITCH_CHAT) {
		console.warn(`[Twitch] Chat sending disabled. Would have sent to ${broadcasterId}: "${message}"`);
		return { success: false, latencyMs: 0 };
	}

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

		if (response.status === 401 && allowRetry) {
			// Token expired - try to refresh and retry once
			console.log(`[Twitch] Received 401 for broadcaster ${broadcasterId}, attempting token refresh`);
			const newToken = await forceRefreshAccessToken(db, env);
			if (newToken) {
				// Retry with new token
				return sendChatMessage({
					...options,
					accessToken: newToken,
					allowRetry: false, // Prevent infinite retry loops
				});
			}
		}

		if (!response.ok) {
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
