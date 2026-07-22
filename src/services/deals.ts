import { classifyHistoricalLow, type LowStatus } from "../domain/historical-low.js";
import { getDeals, getHistory, mapShopProducts, type ItadDeal } from "../providers/itad.js";
import { getAppDetails, getOwnedGames, resolvePackageApp, resolveSteamProfile } from "../providers/steam.js";

export type DealResult = {
  title: string; steamAppId: number; steamUrl: string; currentPriceMinor: number; currency: string;
  regularPrice: number; discountPercent: number; expiry: string | null; owned: boolean | null;
  releaseDate: string; genres: string[]; lowStatus: LowStatus; referencePriceMinor: number | null;
  referenceDate: string | null; historyRecords: number; windowStart: string;
};

function minorUnits(deal: ItadDeal): number {
  return deal.deal.price.amountInt ?? Math.round(deal.deal.price.amount * 100);
}

async function resolveAppId(products: string[], country: string): Promise<number | null> {
  const app = products.find((value) => /^app\/\d+$/.test(value));
  if (app) return Number(app.slice(4));
  const sub = products.find((value) => /^sub\/\d+$/.test(value));
  return sub ? resolvePackageApp(Number(sub.slice(4)), country) : null;
}

export async function searchDeals(input: {
  itadKey: string; steamKey?: string; country: string; profile?: string; budgetMax?: number;
  minimumDiscount?: number; genres?: string[]; lowStatuses?: LowStatus[]; limit: number; now?: Date;
}): Promise<DealResult[]> {
  const now = input.now ?? new Date();
  const candidates = (await getDeals(input.itadKey, input.country, Math.min(100, Math.max(input.limit * 5, 20))))
    .filter((deal) => (deal.deal.cut ?? 0) >= (input.minimumDiscount ?? 0));
  const mappings = await mapShopProducts(input.itadKey, candidates.map((deal) => deal.id));
  let ownedIds: Set<number> | null = null;
  if (input.profile && input.steamKey) {
    const steamId = await resolveSteamProfile(input.profile, input.steamKey);
    ownedIds = new Set((await getOwnedGames(steamId, input.steamKey)).map((game) => game.appid));
  }

  const results: DealResult[] = [];
  for (const deal of candidates) {
    if (results.length >= input.limit) break;
    const currentPriceMinor = minorUnits(deal);
    if (input.budgetMax != null && currentPriceMinor > Math.round(input.budgetMax * 100)) continue;
    try {
      const appId = await resolveAppId(mappings[deal.id] ?? [], input.country);
      if (!appId) continue;
      const metadata = await getAppDetails(appId, input.country);
      if (!metadata || metadata.type !== "game" || metadata.is_free) continue;
      const releaseDateText = metadata.release_date?.date;
      const releaseDate = new Date(releaseDateText);
      if (!releaseDateText || !Number.isFinite(releaseDate.getTime())) continue;
      const genres = (metadata.genres ?? []).map((genre: { description: string }) => genre.description);
      if (input.genres?.length && !input.genres.some((wanted) => genres.some((actual: string) => actual.toLowerCase().includes(wanted.toLowerCase())))) continue;
      const twoYearsAgo = new Date(now.getTime() - 730 * 86_400_000);
      const historyStart = releaseDate > twoYearsAgo ? releaseDate : twoYearsAgo;
      const rawHistory = await getHistory(input.itadKey, deal.id, input.country, historyStart);
      const evidence = classifyHistoricalLow({
        currentPriceMinor,
        releaseDate: releaseDate.toISOString(),
        now,
        observations: rawHistory.map((row) => ({
          timestamp: row.timestamp,
          priceMinor: row.deal?.price?.amountInt ?? Math.round((row.deal?.price?.amount ?? 0) * 100),
        })),
      });
      if (input.lowStatuses?.length && !input.lowStatuses.includes(evidence.status)) continue;
      results.push({
        title: metadata.name ?? deal.title,
        steamAppId: appId,
        steamUrl: `https://store.steampowered.com/app/${appId}`,
        currentPriceMinor,
        currency: deal.deal.price.currency,
        regularPrice: deal.deal.regular.amount,
        discountPercent: deal.deal.cut,
        expiry: deal.deal.expiry ?? null,
        owned: ownedIds ? ownedIds.has(appId) : null,
        releaseDate: releaseDate.toISOString(),
        genres,
        lowStatus: evidence.status,
        referencePriceMinor: evidence.referencePriceMinor,
        referenceDate: evidence.referenceDate,
        historyRecords: evidence.recordCount,
        windowStart: evidence.windowStart,
      });
    } catch (error) {
      console.error(`Skipping ${deal.title}:`, error instanceof Error ? error.message : error);
    }
  }
  return results;
}
