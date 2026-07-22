import { fetchJson } from "./http.js";

export type OwnedGame = { appid: number; name: string; playtime_forever: number };

export function parseSteamProfile(profile: string): { steamId?: string; vanity?: string } {
  const value = profile.trim().replace(/\/$/, "");
  if (/^\d{17}$/.test(value)) return { steamId: value };
  const profileMatch = value.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return { steamId: profileMatch[1] };
  const vanityMatch = value.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  return { vanity: decodeURIComponent(vanityMatch?.[1] ?? value) };
}

export async function resolveSteamProfile(profile: string, key: string): Promise<string> {
  const parsed = parseSteamProfile(profile);
  if (parsed.steamId) return parsed.steamId;
  const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  url.search = new URLSearchParams({ key, vanityurl: parsed.vanity! }).toString();
  const data = await fetchJson<{ response: { success: number; steamid?: string; message?: string } }>(url);
  if (data.response.success !== 1 || !data.response.steamid) throw new Error(data.response.message || "Steam vanity profile was not found.");
  return data.response.steamid;
}

export async function getOwnedGames(steamId: string, key: string): Promise<OwnedGame[]> {
  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
  url.search = new URLSearchParams({ key, steamid: steamId, include_appinfo: "true", include_played_free_games: "true" }).toString();
  const data = await fetchJson<{ response: { games?: OwnedGame[] } }>(url);
  return data.response.games ?? [];
}

export async function getAppDetails(appId: number, country: string): Promise<any | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.search = new URLSearchParams({ appids: String(appId), cc: country.toLowerCase(), l: "english" }).toString();
  const data = await fetchJson<Record<string, { success: boolean; data?: any }>>(url);
  const entry = data[String(appId)];
  return entry?.success ? entry.data : null;
}

export async function resolvePackageApp(packageId: number, country: string): Promise<number | null> {
  const url = new URL("https://store.steampowered.com/api/packagedetails");
  url.search = new URLSearchParams({ packageids: String(packageId), cc: country.toLowerCase(), l: "english" }).toString();
  const data = await fetchJson<Record<string, { success: boolean; data?: { apps?: { id: number }[] } }>>(url);
  const apps = data[String(packageId)]?.data?.apps ?? [];
  return apps.length === 1 ? apps[0].id : null;
}
