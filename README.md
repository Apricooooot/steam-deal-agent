# Steam Deal Agent

An evidence-backed Steam deal recommendation agent built with a Model + Harness architecture. Codex provides reasoning and tool orchestration; a local TypeScript harness provides typed tools, persistent memory, deterministic price verification, safety rules, and external API integrations.

This is a local-first BYOK portfolio project. Each user clones the repository and supplies their own Steam and IsThereAnyDeal credentials. The project never needs or accepts a ChatGPT login token, browser cookie, or session credential.

## Features

- Finds active Steam deals for a region such as China (`CN` / CNY).
- Accepts a SteamID64, vanity name, or Steam Community profile URL.
- Filters games already present in a public Steam library.
- Resolves IsThereAnyDeal records to Steam App IDs.
- Rejects DLC, soundtracks, bundles, and ambiguous multi-app packages.
- Verifies two-year lows or release-lifetime lows with auditable evidence.
- Stores consented preferences and recent interests locally.
- Applies remembered budget, genre, discount, and low-price preferences to later searches.
- Keeps API access, price calculations, memory writes, and safety checks outside the model.

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
# $env:STEAM_DEAL_AGENT_DATA_DIR = "$env:LOCALAPPDATA\steam-deal-agent"
```

Launch Codex from the same PowerShell session so the plugin inherits these variables. Install this repository as a local plugin, then try:

> Use $steam-deal-agent to find unowned Steam games under CNY 50 that are at a two-year or release-lifetime low.

Do not commit a `.env` file or paste API keys into a conversation. `.env.example` contains variable names only.

## Model + Harness architecture

The agent is deliberately split into two layers. The model handles language and judgment. The harness handles data access, state, validation, and deterministic operations.

```text
                              MODEL
                    +-----------------------+
User conversation ->| Codex reasoning       |
                    | intent interpretation |
                    | planning              |
                    | tool selection        |
                    | answer composition    |
                    +-----------+-----------+
                                |
                         typed tool calls
                                |
                              HARNESS
        +-----------------------+-----------------------+
        | Skill policy and conversation workflow       |
        | MCP tool registry and input validation       |
        | consent-based persistent memory              |
        | deterministic price and ownership logic      |
        | safety guardrails and evidence requirements  |
        | tests and conversational evaluation cases    |
        +-----------+--------------------+--------------+
                    |                    |
             Steam APIs          IsThereAnyDeal API
                    |                    |
                    +---------+----------+
                              |
                    structured evidence
                              |
                    conversational answer
```

### Responsibility boundary

The model is responsible for:

- understanding what the user wants;
- deciding which tools to call and in what order;
- resolving conversational ambiguity;
- asking for memory consent when required;
- ranking or explaining results in natural language;
- clearly communicating uncertainty.

The harness is responsible for:

- resolving Steam profiles and App IDs;
- reading public Steam libraries;
- retrieving regional prices and active deal expiry times;
- mapping IsThereAnyDeal game IDs to Steam products;
- calculating historical-low status with integer minor units;
- applying structured preferences and game feedback;
- enforcing memory, privacy, and evidence policies;
- returning typed, inspectable results to the model.

This boundary prevents the model from inventing prices, ownership, historical lows, or remembered preferences.

### Harness components

| Component | Location | Purpose |
| --- | --- | --- |
| Plugin manifest | `.codex-plugin/plugin.json` | Declares the local Codex Plugin and its capabilities. |
| Agent Skill | `skills/steam-deal-agent/SKILL.md` | Defines conversation workflow, memory consent, evidence rules, and guardrails. |
| MCP server | `src/index.ts` | Registers typed tools and connects the model to deterministic services. |
| Steam provider | `src/providers/steam.ts` | Resolves profiles, libraries, apps, and packages. |
| ITAD provider | `src/providers/itad.ts` | Retrieves current deals, product mappings, and price history. |
| Deal service | `src/services/deals.ts` | Joins providers and produces evidence-backed deal records. |
| Price policy | `src/domain/historical-low.ts` | Classifies two-year, release-lifetime, near-low, and incomplete-history cases. |
| Memory store | `src/memory/store.ts` | Persists structured local preferences with atomic writes. |
| Personalization | `src/memory/personalize.ts` | Applies remembered defaults, feedback filters, and ranking signals. |
| Tests and evals | `tests/`, `evals/` | Checks deterministic behavior and expected conversation policies. |

### Request lifecycle

A typical personalized search follows this sequence:

1. The model interprets the user's request.
2. The Skill instructs it to check configuration and remembered preferences.
3. Current request parameters override recent interests and long-term defaults.
4. The model calls `search_steam_deals` with typed arguments.
5. The harness retrieves regional Steam deals from IsThereAnyDeal.
6. Product mappings are resolved to valid Steam base-game App IDs.
7. Optional Steam library data adds ownership status.
8. Steam metadata supplies release dates and genres.
9. Historical observations are evaluated by deterministic price code.
10. Memory-based filtering and ranking are applied.
11. Structured evidence is returned to the model.
12. The model explains the recommendations and their uncertainty.

### Deterministic historical-low policy

The comparison window starts at the later of:

- 730 days before the current check; or
- the game's release date.

Prices are compared in integer minor units to avoid floating-point errors. The harness returns one of these statuses:

- `TWO_YEAR_LOW`: the current price is no higher than the reference low in a complete 730-day window.
- `RELEASE_LOW`: the game is newer than two years and the current price is no higher than the release-lifetime reference low.
- `NEAR_LOW`: the current price is within 5 percent of the reference low.
- `NOT_LOW`: the current price is more than 5 percent above the reference low.
- `INCOMPLETE_HISTORY`: the available observations do not cover the required window closely enough to support a low-price claim.

The model may explain these labels, but it does not calculate or assign them.

## Conversation and memory logic

The agent uses local structured memory instead of treating the full conversation transcript as durable memory.

### Explicit memory

When the user directly asks the agent to remember something, the agent stores the specified fields and reports exactly what changed:

```text
User: Remember that I usually spend no more than CNY 50 and I like roguelikes.
Agent: I saved two long-term preferences: a CNY 50 budget limit and Roguelike as a liked genre.
```

### Inferred recent interest

The agent does not silently convert one conversation into a permanent preference. It proposes a time-limited memory and waits for confirmation:

```text
User: I have been looking at a lot of co-op survival games recently.
Agent: Would you like me to remember "co-op survival" as a recent interest for 30 days?
User: Yes.
Agent: Saved "co-op survival" as a recent interest. It will expire in 30 days.
```

### Preference precedence

Search inputs are combined in this order:

1. The current user message, with the highest priority.
2. Active recent interests, which expire automatically.
3. Long-term preferences such as budget, genres, minimum discount, and low-price policy.
4. Project defaults such as region `CN`.

A one-time request overrides memory without modifying it. Explicitly dismissed App IDs can be removed from future results, while interested or wishlisted games receive a ranking boost.

### Inspecting and deleting memory

Users remain in control:

```text
User: What do you remember about me?
Agent: [Reads and summarizes the local structured memory.]

User: Forget that I like roguelikes.
Agent: [Deletes only that preference and confirms the change.]

User: Clear everything you remember.
Agent: This will delete all local preferences, recent interests, and game feedback. Do you want to continue?
```

Clearing all memory requires fresh explicit confirmation. The agent never stores API keys, ChatGPT credentials, payment information, sensitive personal data, or raw conversation transcripts.

Memory is stored outside the repository at `~/.steam-deal-agent/memory.json` by default. Set `STEAM_DEAL_AGENT_DATA_DIR` to use another local directory.

## MCP tools

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

The MCP server communicates with Codex over stdio. Tool inputs are validated before provider or memory operations run.

## Development

```powershell
npm.cmd test
npm.cmd run build
```

The project includes unit tests for price classification, memory persistence, expiration, deletion, search defaults, feedback filtering, and personalized ranking. `evals/cases.json` contains conversation-level expectations for credential safety, historical evidence, memory consent, and deletion confirmation.

## Privacy and limitations

- API keys remain in the user's local process environment.
- Steam library filtering requires public game details.
- Memory is local, structured, inspectable, and deletable.
- IsThereAnyDeal history is a price-change log, not a daily snapshot.
- The agent refuses a historical-low claim when coverage is insufficient.
- Steam Store metadata endpoints used by this project are unofficial and may change.
- The project depends on Codex as the model runtime; it does not implement a standalone LLM runtime.

## Resume summary

> Built a local-first Steam deal recommendation agent using a Model + Harness architecture, combining Codex reasoning with typed MCP tools, consent-based persistent memory, deterministic historical-price verification, safety guardrails, and conversational evaluation scenarios.

## License

MIT

