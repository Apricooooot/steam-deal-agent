import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type JsonValue = string | number | boolean | string[];
export type RecentInterest = { topic: string; weight: number; learnedAt: string; expiresAt: string };
export type GameFeedback = { status: "interested" | "dismissed" | "wishlist"; reason?: string; updatedAt: string };
export type UserMemory = {
  version: 1;
  preferences: Record<string, JsonValue>;
  recentInterests: RecentInterest[];
  gameFeedback: Record<string, GameFeedback>;
  updatedAt: string | null;
};

const emptyMemory = (): UserMemory => ({ version: 1, preferences: {}, recentInterests: [], gameFeedback: {}, updatedAt: null });

export function memoryPath(env: NodeJS.ProcessEnv = process.env): string {
  const dataDir = env.STEAM_DEAL_AGENT_DATA_DIR?.trim() || join(homedir(), ".steam-deal-agent");
  return join(dataDir, "memory.json");
}

export class MemoryStore {
  private readonly path: string;

  constructor(path = memoryPath()) {
    this.path = path;
  }

  async get(now = new Date()): Promise<UserMemory> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as UserMemory;
      return this.prune({ ...emptyMemory(), ...parsed }, now);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyMemory();
      throw new Error(`Could not read local memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async rememberPreference(key: string, value: JsonValue): Promise<UserMemory> {
    return this.update((memory) => { memory.preferences[key] = value; });
  }

  async rememberRecentInterest(topic: string, expiresInDays = 30, weight = 0.7): Promise<UserMemory> {
    const now = new Date();
    return this.update((memory) => {
      memory.recentInterests = memory.recentInterests.filter((item) => item.topic.toLowerCase() !== topic.toLowerCase());
      memory.recentInterests.push({ topic, weight, learnedAt: now.toISOString(), expiresAt: new Date(now.getTime() + expiresInDays * 86_400_000).toISOString() });
    }, now);
  }

  async recordGameFeedback(appId: number, status: GameFeedback["status"], reason?: string): Promise<UserMemory> {
    return this.update((memory) => { memory.gameFeedback[String(appId)] = { status, reason: reason?.trim() || undefined, updatedAt: new Date().toISOString() }; });
  }

  async forget(kind: "preference" | "recent_interest" | "game_feedback", target: string): Promise<UserMemory> {
    return this.update((memory) => {
      if (kind === "preference") delete memory.preferences[target];
      if (kind === "recent_interest") memory.recentInterests = memory.recentInterests.filter((item) => item.topic.toLowerCase() !== target.toLowerCase());
      if (kind === "game_feedback") delete memory.gameFeedback[target];
    });
  }

  async clear(): Promise<UserMemory> {
    const memory = emptyMemory();
    await this.write(memory);
    return memory;
  }

  private prune(memory: UserMemory, now: Date): UserMemory {
    memory.recentInterests = memory.recentInterests.filter((item) => new Date(item.expiresAt) > now);
    return memory;
  }

  private async update(change: (memory: UserMemory) => void, now = new Date()): Promise<UserMemory> {
    const memory = await this.get(now);
    change(memory);
    memory.updatedAt = now.toISOString();
    await this.write(memory);
    return memory;
  }

  private async write(memory: UserMemory): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(memory, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.path);
  }
}

export function publicMemory(memory: UserMemory) {
  return {
    ...memory,
    recentInterests: memory.recentInterests.map(({ topic, weight, learnedAt, expiresAt }) => ({ topic, weight, learnedAt, expiresAt })),
  };
}
