# Steam Deal Agent

An evidence-backed Steam deal agent that runs locally as a Codex Plugin. It combines a conversational Skill with deterministic MCP tools for regional deals, public-library filtering, and historical-low verification.

This is a BYOK portfolio project: every user clones the repository and supplies their own Steam and IsThereAnyDeal credentials locally. It never needs—or accepts—a ChatGPT login token.

## What it does

- Finds active Steam deals for a country such as China (`CN` / CNY).
- Accepts a SteamID64, vanity name, or Steam Community profile URL.
- Excludes games already present in a public Steam library.
- Resolves ITAD records to Steam App IDs and rejects DLC, bundles, and ambiguous packages.
- Labels prices as a two-year low, release-lifetime low, near-low, not-low, or incomplete history.
- Returns auditable evidence: comparison window, reference price/date, record count, expiry, and Steam URL.
- Remembers consented preferences and recent interests locally, then applies them to later searches.

## Prerequisites

- Node.js 22 or newer
- Codex desktop or CLI with local plugin support
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)
- An [IsThereAnyDeal API key](https://isthereanydeal.com/apps/)

## Local setup (PowerShell)

```powershell
git clone https://github.com/Apricooooot/steam-deal-agent.git
Set-Location .\steam-deal-agent
npm.cmd install
npm.cmd run build

$env:STEAM_API_KEY = Read-Host "Steam API Key"
$env:ITAD_API_KEY = Read-Host "ITAD API Key"
$env:DEFAULT_REGION = "CN"
$env:STEAM_PROFILE = "your-vanity-name-or-steamid64"
# Optional custom memory directory:
# $env:STEAM_DEAL_AGENT_DATA_DIR = "$HOME\AppData\Local\steam-deal-agent"
```

Launch Codex from the same PowerShell session so the plugin inherits those variables. Install the repository as a local plugin, then try:

> Use $steam-deal-agent to find unowned Steam games under ¥50 that are at a two-year or release low.

Do not commit a `.env` file or paste API keys into a conversation. The included `.env.example` contains names only.

## Conversation and memory logic

The agent uses local structured memory rather than treating the entire chat transcript as memory.

### Explicit memory

When the user directly asks it to remember something, the agent saves it immediately and reports exactly what changed:

```text
User: 记住我一般只买 50 元以内的游戏，而且喜欢 Roguelike。
Agent: 已记住长期偏好：预算上限 ¥50，喜欢的类型包括 Roguelike。
```

### Inferred recent interest

The agent does not silently turn one conversation into a permanent preference. It proposes an expiring memory first:

```text
User: 我最近一直在找合作生存游戏。
Agent: 要把“合作生存”保存为未来 30 天的近期兴趣吗？
User: 可以。
Agent: 已保存近期兴趣“合作生存”，30 天后自动过期。
```

### Recommendation precedence

For each search, preferences are combined in this order:

1. The user's current message, which always has highest priority.
2. Active recent interests, which expire automatically.
3. Long-term preferences such as budget, genres, minimum discount, and low-price policy.
4. Project defaults such as region `CN`.

The agent can use liked genres and recent interests for ranking, exclude explicitly dismissed App IDs, and apply remembered search defaults. A one-time request overrides memory without changing it.

### Inspecting and deleting memory

Users remain in control:

```text
User: 你记得我什么？
Agent: [reads and summarizes local structured memory]

User: 忘掉我喜欢 Roguelike。
Agent: [deletes only that preference and confirms]

User: 清除所有记忆。
Agent: 这会删除全部本地偏好、近期兴趣和游戏反馈。确定吗？
```

Clearing all memory requires a fresh explicit confirmation. The agent never stores API keys, ChatGPT credentials, payment information, sensitive personal data, or raw conversation transcripts.

Memory is stored outside the repository at `~/.steam-deal-agent/memory.json` by default. Set `STEAM_DEAL_AGENT_DATA_DIR` to use another local directory.

## Development

```powershell
npm.cmd test
npm.cmd run build
```

The MCP server communicates over stdio. Its tools are:

- `get_configuration_status`
- `resolve_steam_profile`
- `get_owned_games`
- `search_steam_deals`
- `check_price_history`
- `get_user_preferences`
- `remember_preference`
- `record_game_feedback`
- `forget_preference`
- `clear_user_memory`

## Architecture

```text
User → Codex Skill → local MCP tools → Steam Web/Store APIs
                              └──────→ IsThereAnyDeal API
                    deterministic evidence → conversational answer
```

The model decides what to ask and how to explain results. Code—not the model—resolves identifiers, compares integer prices, checks ownership, and assigns low-price status.

## Privacy and limitations

- API keys remain in the user's local process environment.
- Steam library filtering requires public game details.
- ITAD history is a price-change log, not a daily snapshot. The agent conservatively refuses a historical-low claim when window coverage is insufficient.
- Steam Store endpoints used for metadata are unofficial and may change.

## License

MIT
