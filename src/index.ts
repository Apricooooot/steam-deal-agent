import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig, requireKey } from "./config.js";
import { classifyHistoricalLow, type LowStatus } from "./domain/historical-low.js";
import { memorySearchDefaults, personalizeDeals } from "./memory/personalize.js";
import { MemoryStore, publicMemory, type JsonValue } from "./memory/store.js";
import { getHistory } from "./providers/itad.js";
import { getOwnedGames, resolveSteamProfile } from "./providers/steam.js";
import { searchDeals } from "./services/deals.js";

const server = new McpServer({ name: "steam-deal-agent", version: "0.1.0" });
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const memoryStore = new MemoryStore();

server.registerTool("get_configuration_status", {
  title: "Get configuration status",
  description: "Check which local API credentials and defaults are configured. Never returns secret values.",
  inputSchema: {},
}, async () => {
  const config = getConfig();
  return json({ steamApiKeyConfigured: Boolean(config.steamApiKey), itadApiKeyConfigured: Boolean(config.itadApiKey), defaultRegion: config.defaultRegion, defaultProfileConfigured: Boolean(config.defaultProfile) });
});

server.registerTool("resolve_steam_profile", {
  title: "Resolve Steam profile",
  description: "Resolve a SteamID64, vanity name, or Steam Community profile URL to SteamID64.",
  inputSchema: { profile: z.string().min(1) },
}, async ({ profile }) => {
  const config = getConfig();
  return json({ steamId: await resolveSteamProfile(profile, requireKey(config.steamApiKey, "STEAM_API_KEY")) });
});

server.registerTool("get_owned_games", {
  title: "Get owned Steam games",
  description: "Read a public Steam library for ownership filtering.",
  inputSchema: { profile: z.string().min(1).optional(), limit: z.number().int().min(1).max(1000).default(100) },
}, async ({ profile, limit }) => {
  const config = getConfig();
  const selected = profile ?? config.defaultProfile;
  if (!selected) throw new Error("Provide profile or configure STEAM_PROFILE.");
  const key = requireKey(config.steamApiKey, "STEAM_API_KEY");
  const steamId = await resolveSteamProfile(selected, key);
  const games = await getOwnedGames(steamId, key);
  return json({ steamId, total: games.length, games: games.sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, limit) });
});

server.registerTool("get_user_preferences", {
  title: "Get remembered preferences",
  description: "Read the user's local, structured Steam preferences, recent interests, and game feedback.",
  inputSchema: {},
}, async () => json(publicMemory(await memoryStore.get())));

server.registerTool("remember_preference", {
  title: "Remember a Steam preference",
  description: "Persist a preference or time-limited recent interest after the user explicitly asks or confirms. Never store secrets or raw chat transcripts.",
  inputSchema: {
    scope: z.enum(["long_term", "recent"]),
    key: z.string().min(1).optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    expiresInDays: z.number().int().min(1).max(365).default(30),
    weight: z.number().min(0).max(1).default(0.7),
  },
}, async ({ scope, key, value, expiresInDays, weight }) => {
  if (scope === "recent") {
    if (typeof value !== "string") throw new Error("A recent interest must be a text topic.");
    return json(publicMemory(await memoryStore.rememberRecentInterest(value, expiresInDays, weight)));
  }
  if (!key) throw new Error("key is required for a long-term preference.");
  return json(publicMemory(await memoryStore.rememberPreference(key, value as JsonValue)));
});

server.registerTool("record_game_feedback", {
  title: "Record game feedback",
  description: "Remember that the user is interested in, dismissed, or wishlisted a Steam game, with an optional reason.",
  inputSchema: { appId: z.number().int().positive(), status: z.enum(["interested", "dismissed", "wishlist"]), reason: z.string().max(500).optional() },
}, async ({ appId, status, reason }) => json(publicMemory(await memoryStore.recordGameFeedback(appId, status, reason))));

server.registerTool("forget_preference", {
  title: "Forget remembered Steam information",
  description: "Delete one preference, recent-interest topic, or game-feedback entry from local memory.",
  inputSchema: { kind: z.enum(["preference", "recent_interest", "game_feedback"]), target: z.string().min(1) },
}, async ({ kind, target }) => json(publicMemory(await memoryStore.forget(kind, target))));

server.registerTool("clear_user_memory", {
  title: "Clear all Steam Deal Agent memory",
  description: "Delete every locally remembered preference and feedback item. Requires explicit user confirmation.",
  inputSchema: { confirmed: z.literal(true) },
}, async () => json(publicMemory(await memoryStore.clear())));

server.registerTool("check_price_history", {
  title: "Check Steam price history",
  description: "Deterministically classify a current Steam price against the last two years, or release lifetime for newer games.",
  inputSchema: {
    itadGameId: z.string().uuid(), currentPriceMinor: z.number().int().nonnegative(), releaseDate: z.string().min(1), country: z.string().length(2).optional(),
  },
}, async ({ itadGameId, currentPriceMinor, releaseDate, country }) => {
  const config = getConfig();
  const now = new Date();
  const release = new Date(releaseDate);
  if (!Number.isFinite(release.getTime())) throw new Error("releaseDate must be a parseable date.");
  const since = release > new Date(now.getTime() - 730 * 86_400_000) ? release : new Date(now.getTime() - 730 * 86_400_000);
  const rows = await getHistory(requireKey(config.itadApiKey, "ITAD_API_KEY"), itadGameId, (country ?? config.defaultRegion).toUpperCase(), since);
  return json(classifyHistoricalLow({ currentPriceMinor, releaseDate, now, observations: rows.map((row) => ({ timestamp: row.timestamp, priceMinor: row.deal?.price?.amountInt ?? Math.round((row.deal?.price?.amount ?? 0) * 100) })) }));
});

server.registerTool("search_steam_deals", {
  title: "Search evidence-backed Steam deals",
  description: "Find active regional Steam deals and enrich them with ownership, metadata, and historical-low evidence.",
  inputSchema: {
    country: z.string().length(2).optional(), profile: z.string().optional(), budgetMax: z.number().nonnegative().optional(),
    minimumDiscount: z.number().min(0).max(100).optional(), genres: z.array(z.string()).optional(),
    lowStatuses: z.array(z.enum(["TWO_YEAR_LOW", "RELEASE_LOW", "NEAR_LOW", "NOT_LOW", "INCOMPLETE_HISTORY"])).optional(),
    limit: z.number().int().min(1).max(20).default(10),
  },
}, async (input) => {
  const config = getConfig();
  const memory = await memoryStore.get();
  const defaults = memorySearchDefaults(memory);
  const results = await searchDeals({
    ...input,
    country: (input.country ?? config.defaultRegion).toUpperCase(),
    profile: input.profile ?? config.defaultProfile,
    budgetMax: input.budgetMax ?? defaults.budgetMax,
    minimumDiscount: input.minimumDiscount ?? defaults.minimumDiscount,
    genres: input.genres ?? defaults.genres,
    itadKey: requireKey(config.itadApiKey, "ITAD_API_KEY"),
    steamKey: config.steamApiKey,
    lowStatuses: (input.lowStatuses as LowStatus[] | undefined) ?? defaults.lowStatuses,
  });
  const personalized = personalizeDeals(results, memory);
  return json({ count: personalized.length, memoryApplied: true, results: personalized });
});

await server.connect(new StdioServerTransport());
