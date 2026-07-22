import { fetchJson } from "./http.js";

export const STEAM_SHOP_ID = 61;
export type ItadDeal = { id: string; title: string; type?: string; deal: { price: { amount: number; amountInt?: number; currency: string }; regular: { amount: number }; cut: number; expiry?: string } };

const headers = (key: string) => ({ "ITAD-API-Key": key });

export async function getDeals(key: string, country: string, limit: number): Promise<ItadDeal[]> {
  const url = new URL("https://api.isthereanydeal.com/deals/v2");
  url.search = new URLSearchParams({ country, shops: String(STEAM_SHOP_ID), limit: String(limit) }).toString();
  const data = await fetchJson<any>(url, { headers: headers(key) });
  return Array.isArray(data) ? data : data.list ?? data.deals ?? [];
}

export async function mapShopProducts(key: string, ids: string[]): Promise<Record<string, string[]>> {
  const url = `https://api.isthereanydeal.com/lookup/shop/${STEAM_SHOP_ID}/id/v1`;
  return fetchJson<Record<string, string[]>>(url, { method: "POST", headers: { ...headers(key), "content-type": "application/json" }, body: JSON.stringify(ids) });
}

export async function getHistory(key: string, id: string, country: string, since: Date): Promise<any[]> {
  const url = new URL("https://api.isthereanydeal.com/games/history/v2");
  url.search = new URLSearchParams({ id, country, shops: String(STEAM_SHOP_ID), since: since.toISOString().replace(/\.\d{3}Z$/, "Z") }).toString();
  const data = await fetchJson<any>(url, { headers: headers(key) });
  return Array.isArray(data) ? data : data.list ?? [];
}
