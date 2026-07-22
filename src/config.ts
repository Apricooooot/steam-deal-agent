export type AgentConfig = {
  steamApiKey?: string;
  itadApiKey?: string;
  defaultRegion: string;
  defaultProfile?: string;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  return {
    steamApiKey: clean(env.STEAM_API_KEY),
    itadApiKey: clean(env.ITAD_API_KEY),
    defaultRegion: clean(env.DEFAULT_REGION)?.toUpperCase() || "CN",
    defaultProfile: clean(env.STEAM_PROFILE),
  };
}

function clean(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function requireKey(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured. Set it in the environment that launches Codex; never paste it into chat.`);
  return value;
}
