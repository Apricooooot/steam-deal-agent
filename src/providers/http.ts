export async function fetchJson<T>(url: URL | string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { "user-agent": "steam-deal-agent/0.1", ...init.headers } });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`HTTP ${response.status} from ${new URL(response.url).host}: ${detail || response.statusText}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
