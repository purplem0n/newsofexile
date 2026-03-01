import type { Database } from "../db";
import { getAccessToken } from "./auth";
import { sendChatMessage, getRateLimitWaitMs } from "./chat";
import { getLiveChannels } from "./streams";

export interface NewsAlert {
	title: string;
	url: string;
	sourceType: string;
	updateDate?: string;
}

const MAX_MESSAGE_LENGTH = 500;

function buildMessage(alert: NewsAlert): string {
	let message: string;
	if (alert.updateDate) {
		// Patch update format: New update added for Patch "Title" [Updates for date] url
		message = `New update added for Patch "${alert.title}" [Updates for ${alert.updateDate}] ${alert.url}`;
	} else {
		// News item format: Title url
		message = `${alert.title} (NEW) ${alert.url}`;
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		message = message.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
	}
	return message;
}

/**
 * Send Twitch chat alerts for new news/patch items.
 * When DRY_RUN_MODE=1, only sends to TWITCH_DRY_RUN_CHANNEL_ID.
 */
export async function notifyTwitch(
	db: Database,
	env: Env,
	alerts: NewsAlert[],
): Promise<void> {
	if (alerts.length === 0) return;

	const dryRun = env.DRY_RUN_MODE === "1" || env.DRY_RUN_MODE === "true";
	console.log(`[Twitch] notifyTwitch: ${alerts.length} alert(s), dryRun=${dryRun}`);

	let accessToken: string;
	try {
		accessToken = await getAccessToken(db, env);
	} catch (error) {
		console.error("[Twitch] Failed to get access token:", error);
		return;
	}

	// Group alerts by game (poe1 vs poe2) to batch channel fetches
	const poe1Alerts = alerts.filter((a) => a.sourceType.includes("poe1"));
	const poe2Alerts = alerts.filter((a) => a.sourceType.includes("poe2"));

	const channelsToNotify: Array<{ broadcasterId: string; message: string }> = [];

	if (dryRun) {
		// Dry run: only send to the test channel, one message per alert
		for (const alert of alerts) {
			channelsToNotify.push({
				broadcasterId: env.TWITCH_DRY_RUN_CHANNEL_ID,
				message: buildMessage(alert),
			});
		}
	} else {
		// Real mode: fetch live channels once per game, send each alert to all
		if (poe1Alerts.length > 0) {
			const channels = await getLiveChannels({
				gameId: env.POE1_TWITCH_ID,
				accessToken,
				clientId: env.TWITCH_CLIENT_ID,
				db,
				env,
			});
			for (const alert of poe1Alerts) {
				const message = buildMessage(alert);
				for (const ch of channels) {
					channelsToNotify.push({
						broadcasterId: ch.user_id,
						message,
					});
				}
			}
		}
		if (poe2Alerts.length > 0) {
			const channels = await getLiveChannels({
				gameId: env.POE2_TWITCH_ID,
				accessToken,
				clientId: env.TWITCH_CLIENT_ID,
				db,
				env,
			});
			for (const alert of poe2Alerts) {
				const message = buildMessage(alert);
				for (const ch of channels) {
					channelsToNotify.push({
						broadcasterId: ch.user_id,
						message,
					});
				}
			}
		}
	}

	// Dedupe by broadcasterId + message
	const seen = new Set<string>();
	const deduped = channelsToNotify.filter(({ broadcasterId, message }) => {
		const key = `${broadcasterId}:${message}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	if (channelsToNotify.length !== deduped.length) {
		console.log(`[Twitch] Deduped ${channelsToNotify.length} -> ${deduped.length} messages`);
	}

	for (const { broadcasterId, message } of deduped) {
		const { latencyMs } = await sendChatMessage({
			broadcasterId,
			message,
			accessToken,
			clientId: env.TWITCH_CLIENT_ID,
			senderId: env.TWITCH_SENDER_ID,
			db,
			env,
		});

		// Rate limit: wait before next send
		const waitMs = getRateLimitWaitMs(latencyMs);
		if (waitMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}

	if (deduped.length > 0) {
		console.log(
			`[Twitch] Sent ${deduped.length} chat message(s) (dryRun=${dryRun})`,
		);
	}
}
