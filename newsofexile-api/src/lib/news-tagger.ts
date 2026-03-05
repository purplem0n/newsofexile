/**
 * News Tagger - Classifies POE news titles by content type
 *
 * Tags news based on what the content is about, not which game version.
 * Supports multiple tags per title since content can fit multiple categories.
 */

export type ContentTag =
	| "teaser"
	| "twitch-drops"
	| "launch"
	| "competition"
	| "sale"
	| "concept-art"
	| "interview"
	| "build-showcase"
	| "faq"
	| "patch-update"
	| "event"
	| "community"
	| "development"
	| "announcement"
	| "maintenance"
	| "content-update" // New/changed gems, uniques, skills, ascendancies
	| "rewards" // Challenge rewards, league rewards
	| "soundtrack" // Music, OST
	| "recap" // Event recaps, convention recaps
	| "livestream" // GGG Live, livestream announcements
	| "timeline" // Expansion timeline, league timeline
	| "league-end" // League ending announcements
	| "cosmetics" // Supporter packs, cosmetics, microtransactions
	| "stash-tab-sale" // Stash tab sales
	| "hotfix" // Hotfixes
	| "restart-fix" // Restart fixes
	| "other";

export interface TagResult {
	tags: ContentTag[];
	primaryTag: ContentTag;
	confidence: number;
}

// ============================================================================
// TAG PATTERNS - Each pattern maps to a specific content tag
// ============================================================================

const TAG_PATTERNS: Record<ContentTag, RegExp[]> = {
	teaser: [
		/teaser/i,
		/new teasers/i,
		/announcement teaser/i,
		/teaser thread/i,
	],

	"twitch-drops": [
		/twitch drop/i,
		/twitch highlight/i,
		/discord quest/i,
	],

	launch: [
		/launch.*live update/i,
		/live update.*launch/i,
		/launches soon/i,
		/launch.*date/i,
		/launch on /i,
		/launch.*console/i,
		/pre-download/i,
		/starts soon/i,
		/starts on /i,
		/now available/i,
		/available now/i,
	],

	competition: [
		/talent competition/i,
		/fan art competition/i,
		/art competition/i,
		/competition winner/i,
		/competition runner/i,
		/competition highlight/i,
		/build of the week/i,
		/boss vs boss/i,
	],

	sale: [
		/weekend sale/i,
		/point sale/i,
		/free.*when you spend/i,
		/supporter packs.*end soon/i,
		/packs.*leaving.*store/i,
		/bundle.*available/i,
	],

	"concept-art": [
		/concept art/i,
		/environment art/i,
		/monster art/i,
		/unique item art/i,
		/boss wallpaper/i,
	],

	interview: [
		/interview/i,
		/podcast/i,
		/tavern talk/i,
		/developer.*interview/i,
		/interviews.*developer/i,
	],

	"build-showcase": [
		/build showcase/i,
		/build of the week/i,
		/submit your build/i,
		/honourable mentions/i,
		/honorable mentions/i,
	],

	faq: [
		/faq/i,
		/frequently asked/i,
		/recently asked question/i,
		/q&a/i,
		/clarification/i,
	],

	"patch-update": [
		/patch.*note/i,
		/patch.*preview/i,
		/patch.*summary/i,
		/patch.*live/i,
		/content update/i,
		/upcoming change/i,
		/upcoming plan/i,
		/further change/i,
		/improvement/i,
		/what we're working on/i,
		/additional secret/i,
	],

	event: [
		/race event/i,
		/boss kill event/i,
		/boss rush event/i,
		/gauntlet/i,
		/class gauntlet/i,
		/private league/i,
		/end-of-league/i,
		/invite-only event/i,
		/community event/i,
		/play.*at.*show/i,
		/free weekend/i,
		/boss.*kill.*race/i,
		/kill event winner/i,
		/play the.*event/i,
		/event update/i,
		/additional information/i,
		/more information/i,
		/play.*for free/i,
		/at tokyo/i,
		/at gamescom/i,
		/at pax/i,
	],


	community: [
		/community showcase/i,
		/community.*event/i,
		/hideout showcase/i,
		/twitch highlight/i,
		/content creator/i,
	],

	development: [
		/we're hiring/i,
		/now hiring/i,
		/development stor/i,
		/who is the /i,
		/creating.*lore/i,
		/skill sound design/i,
		/boss design/i,
		/talent interview/i,
		/developer.*- /i,
		/developers working/i,
		/brazilian developer/i,
	],

	announcement: [
		/announcing /i,
		/announcement/i,
		/announc/i,
		/delayed/i,
		/what you need to know/i,
	],

	maintenance: [
		/server issue/i,
		/incident report/i,
		/data breach/i,
		/account moderation/i,
		/phishing/i,
		/support email/i,
		/migrated to/i,
		/compromised account/i,
		/economic abuse/i,
		/account system/i,
		/changes to.*account/i,
	],

	"content-update": [
		/new and changed gem/i,
		/new and changed scarab/i,
		/new foulborn unique/i,
		/chase unique/i,
		/item change/i,
		/ascendancy class/i,
		/new.*ascendancy/i,
		/crafting socketable/i,
		/endgame change/i,
		/act 3 area/i,
		/item filter/i,
		/new microtransaction:/i,
		/respec.*ascendancy/i,
		/asynchronous trade/i,
		/currency exchange/i,
		/renown/i,
		/endgame specialisation/i,
		/breach encounter/i,
		/monster in map/i,
		/gameplay walkthrough/i,
		/couch co-op/i,
		/console.*early access/i,
		/new class reveal/i,
		/ascendancy.*respec/i,
		/lore roundup/i,
		/preview/i,
		/disciple of /i,
		/witch gameplay/i,
		/xbox game share/i,
		/forum avatar/i,
		/digital comic/i,
	],

	rewards: [
		/challenge reward/i,
		/uber boss kill.*winner/i,
		/boss kill event winner/i,
		/race event winner/i,
	],

	soundtrack: [
		/original soundtrack/i,
		/soundtrack/i,
		/lofi/i,
		/music/i,
	],

	recap: [
		/recap/i,
		/launch highlight/i,
		/event highlight/i,
		/gamescom/i,
		/pax/i,
		/tokyo game show/i,
		/brasil game show/i,
		/exilecon/i,
		/stats snapshot/i,
		/statistics/i,
		/how.*launch went/i,
		/marketing blooper/i,
		/vod/i,
		/update on path of exile/i,
		/a message to.*players/i,
	],

	livestream: [
		/watch ggg live/i,
		/ggg live/i,
		/livestream/i,
		/live on /i,
		/live.*announcement/i,
		/announcement coming soon/i,
		/live update/i,
		/everything you need to know/i,
	],

	timeline: [
		/expansion timeline/i,
		/\d+\.\d+.*timeline/i,
		/update on.*timeline/i,
		/an update on.*expansion/i,
	],

	"league-end": [
		/what will happen when.*league ends/i,
		/what happens when.*league ends/i,
		/league.*ends soon/i,
		/end of.*league/i,
		/league end/i,
	],

	cosmetics: [
		/supporter pack/i,
		/vault pass/i,
		/kirac['']?s vault/i,
		/mystery box/i,
		/microtransaction/i,
		/cosmetic/i,
		/pet.*sale/i,
		/weapon.*sale/i,
		/armor.*sale/i,
		/footprint effect/i,
		/portal effect/i,
		/back attachment/i,
		/skill effect/i,
		/weapon effect/i,
		/character effect/i,
		/get a free/i,
	],

	"stash-tab-sale": [
		/stash tab sale/i,
		/weekend.*stash tab/i,
	],

	hotfix: [
		/hotfix/i,
		/\d+\.\d+\.\d+ hotfix/i,
		/\d+\.\d+ hotfix/i,
		/\d+\.\d+[a-z] restart fix/i,
		/\d+\.\d+[a-z] crash fix/i,
		/\d+\.\d+[a-z] stability fix/i,
		/\d+\.\d+[a-z] fix/i,
		/restart fix/i,
		/crash fix/i,
		/stability fix/i,
		/emergency fix/i,
		/critical fix/i,
		/server restart/i,
		/unplanned restart/i,
	],

	"restart-fix": [
		/\d+\.\d+[a-z] restart fix/i,
		/restart fix/i,
		/server restart/i,
		/unplanned restart/i,
		/restart required/i,
		/forced restart/i,
	],

	other: [],
};

// ============================================================================
// PRIORITY ORDER - For determining primary tag when multiple match
// ============================================================================

const TAG_PRIORITY: ContentTag[] = [
	"maintenance", // Server issues are highest priority
	"hotfix", // Hotfixes are high priority
	"restart-fix", // Restart fixes are high priority
	"timeline", // Expansion timelines
	"league-end", // League ending info is important
	"patch-update",
	"event",
	"launch",
	"teaser",
	"announcement",
	"twitch-drops",
	"competition",
	"livestream",
	"stash-tab-sale", // Stash tab sales
	"cosmetics", // Cosmetics, supporter packs, microtransactions
	"sale",
	"faq",
	"interview",
	"build-showcase",
	"concept-art",
	"content-update",
	"rewards",
	"soundtrack",
	"recap",
	"community",
	"development",
	"other",
];

// ============================================================================
// CLASSIFIER
// ============================================================================

/**
 * Classify a news title by content type
 * Returns multiple tags since content can fit multiple categories
 */
export function classifyNews(title: string): TagResult {
	if (!title || typeof title !== "string") {
		return { tags: ["other"], primaryTag: "other", confidence: 0 };
	}

	const normalizedTitle = title.trim();
	const matchedTags: ContentTag[] = [];

	// Check each tag's patterns
	for (const [tag, patterns] of Object.entries(TAG_PATTERNS)) {
		for (const pattern of patterns) {
			if (pattern.test(normalizedTitle)) {
				matchedTags.push(tag as ContentTag);
				break; // Only count each tag once per title
			}
		}
	}

	// If no tags matched, mark as other
	if (matchedTags.length === 0) {
		matchedTags.push("other");
	}

	// Determine primary tag based on priority
	let primaryTag: ContentTag = "other";
	for (const priorityTag of TAG_PRIORITY) {
		if (matchedTags.includes(priorityTag)) {
			primaryTag = priorityTag;
			break;
		}
	}

	// Calculate confidence based on number of matching tags
	// More specific matches = higher confidence
	const confidence = Math.min(0.95, 0.5 + matchedTags.length * 0.15);

	return {
		tags: matchedTags,
		primaryTag,
		confidence,
	};
}

/**
 * Batch classify multiple titles
 */
export function classifyBatch(titles: string[]): TagResult[] {
	return titles.map((title) => classifyNews(title));
}

/**
 * Get statistics for a batch of classifications
 */
export function getClassificationStats(results: TagResult[]) {
	const stats: Record<ContentTag, number> = {
		teaser: 0,
		"twitch-drops": 0,
		launch: 0,
		competition: 0,
		sale: 0,
		"concept-art": 0,
		interview: 0,
		"build-showcase": 0,
		faq: 0,
		"patch-update": 0,
		event: 0,
		community: 0,
		development: 0,
		announcement: 0,
		maintenance: 0,
		"content-update": 0,
		rewards: 0,
		soundtrack: 0,
		recap: 0,
		livestream: 0,
		timeline: 0,
		"league-end": 0,
		cosmetics: 0,
		"stash-tab-sale": 0,
		hotfix: 0,
		"restart-fix": 0,
		other: 0,
	};

	let totalConfidence = 0;

	for (const result of results) {
		// Count primary tags
		stats[result.primaryTag]++;
		totalConfidence += result.confidence;
	}

	return {
		primaryTagCounts: stats,
		total: results.length,
		averageConfidence: totalConfidence / results.length,
	};
}

/**
 * Get all unique tags used across results
 */
export function getAllTags(results: TagResult[]): Map<ContentTag, number> {
	const tagCounts = new Map<ContentTag, number>();

	for (const result of results) {
		for (const tag of result.tags) {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
		}
	}

	return tagCounts;
}
