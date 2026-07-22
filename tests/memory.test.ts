import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { memorySearchDefaults, personalizeDeals } from "../src/memory/personalize.ts";
import { MemoryStore } from "../src/memory/store.ts";

test("persists, expires, forgets, and clears structured memory", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "steam-deal-agent-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(join(directory, "memory.json"));

  await store.rememberPreference("budgetMax", 50);
  await store.rememberPreference("likedGenres", ["Roguelike"]);
  await store.rememberRecentInterest("co-op survival", 30, 0.8);
  await store.recordGameFeedback(123, "dismissed", "turn-based");

  const memory = await store.get();
  assert.equal(memory.preferences.budgetMax, 50);
  assert.equal(memory.recentInterests[0].topic, "co-op survival");
  assert.equal(memory.gameFeedback["123"].reason, "turn-based");

  await store.forget("preference", "budgetMax");
  assert.equal((await store.get()).preferences.budgetMax, undefined);
  assert.equal((await store.clear()).recentInterests.length, 0);
});

test("turns remembered fields into search defaults", () => {
  const defaults = memorySearchDefaults({ version: 1, preferences: { budgetMax: 60, likedGenres: ["RPG"], minimumDiscount: 40 }, recentInterests: [], gameFeedback: {}, updatedAt: null });
  assert.deepEqual(defaults, { budgetMax: 60, genres: ["RPG"], lowStatuses: undefined, minimumDiscount: 40 });
});

test("filters dismissed games and ranks matching interests", () => {
  const base = { steamUrl: "", currentPriceMinor: 100, currency: "CNY", regularPrice: 2, discountPercent: 50, expiry: null, owned: false, releaseDate: "2025-01-01", lowStatus: "RELEASE_LOW" as const, referencePriceMinor: 100, referenceDate: "2025-01-01", historyRecords: 2, windowStart: "2025-01-01" };
  const deals = [
    { ...base, title: "Sports Game", steamAppId: 1, genres: ["Sports"] },
    { ...base, title: "Deep Rogue", steamAppId: 2, genres: ["Roguelike"] },
    { ...base, title: "Dismissed Rogue", steamAppId: 3, genres: ["Roguelike"] },
  ];
  const memory = { version: 1 as const, preferences: { likedGenres: ["Roguelike"] }, recentInterests: [], gameFeedback: { "3": { status: "dismissed" as const, updatedAt: "2026-01-01" } }, updatedAt: null };
  assert.deepEqual(personalizeDeals(deals, memory).map((deal) => deal.steamAppId), [2, 1]);
});
