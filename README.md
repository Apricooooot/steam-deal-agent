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
```

Launch Codex from the same PowerShell session so the plugin inherits those variables. Install the repository as a local plugin, then try:

> Use $steam-deal-agent to find unowned Steam games under ¥50 that are at a two-year or release low.

Do not commit a `.env` file or paste API keys into a conversation. The included `.env.example` contains names only.

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
