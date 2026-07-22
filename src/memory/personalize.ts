import type { LowStatus } from "../domain/historical-low.js";
import type { DealResult } from "../services/deals.js";
import type { UserMemory } from "./store.js";

const stringList = (value: unknown): string[] | undefined => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

export function memorySearchDefaults(memory: UserMemory) {
  const budget = memory.preferences.budgetMax;
  const discount = memory.preferences.minimumDiscount;
  return {
    budgetMax: typeof budget === "number" ? budget : undefined,
    minimumDiscount: typeof discount === "number" ? discount : undefined,
    genres: stringList(memory.preferences.likedGenres),
    lowStatuses: stringList(memory.preferences.lowStatuses) as LowStatus[] | undefined,
  };
}

export function personalizeDeals(deals: DealResult[], memory: UserMemory): DealResult[] {
  const liked = (stringList(memory.preferences.likedGenres) ?? []).map((value) => value.toLowerCase());
  const disliked = (stringList(memory.preferences.dislikedGenres) ?? []).map((value) => value.toLowerCase());
  const recent = memory.recentInterests.map((item) => ({ ...item, topic: item.topic.toLowerCase() }));
  const excludeDismissed = memory.preferences.excludeDismissed !== false;

  return deals
    .filter((deal) => !excludeDismissed || memory.gameFeedback[String(deal.steamAppId)]?.status !== "dismissed")
    .map((deal) => ({ deal, score: score(deal) }))
    .sort((a, b) => b.score - a.score || b.deal.discountPercent - a.deal.discountPercent)
    .map(({ deal }) => deal);

  function score(deal: DealResult): number {
    const haystack = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
    let value = liked.filter((genre) => haystack.includes(genre)).length * 10;
    value -= disliked.filter((genre) => haystack.includes(genre)).length * 20;
    value += recent.filter((interest) => haystack.includes(interest.topic)).reduce((sum, interest) => sum + interest.weight * 10, 0);
    const feedback = memory.gameFeedback[String(deal.steamAppId)]?.status;
    if (feedback === "interested" || feedback === "wishlist") value += 20;
    return value;
  }
}
