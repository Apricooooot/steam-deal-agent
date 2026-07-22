# Tool guide

## Configuration

`get_configuration_status` returns only presence flags and defaults. `ITAD_API_KEY` is required for deal and price-history searches. `STEAM_API_KEY` is required for vanity-name resolution and public-library filtering. `STEAM_PROFILE` and `DEFAULT_REGION` are optional defaults.

## Profiles and libraries

`resolve_steam_profile` accepts a SteamID64, vanity name, or Steam Community URL. `get_owned_games` works only when the profile's game details are public. A private library is not evidence that the user owns no games.

## Deal search

`search_steam_deals` queries the chosen country's active Steam offers, resolves ITAD game IDs to Steam products, rejects non-base-game items, and checks price history. A profile can add ownership status. Prices use integer minor units in structured results.

## Local memory

`get_user_preferences` reads structured memory. `remember_preference` writes either a long-term key/value or an expiring recent-interest topic. `record_game_feedback` stores App-ID feedback. `forget_preference` deletes one item. `clear_user_memory` requires `confirmed: true` and clears everything.

Memory defaults to the user's `.steam-deal-agent/memory.json`; `STEAM_DEAL_AGENT_DATA_DIR` can relocate it. Writes are atomic and the file is created with owner-only permissions where supported. Search arguments supplied in the current conversation override remembered defaults.

## Failure handling

- Missing key: explain which environment variable is needed; do not request its value in chat.
- Steam library inaccessible: continue without ownership filtering and label ownership unknown.
- Mapping or metadata failure: omit that candidate rather than guessing an App ID.
- History incomplete: return `INCOMPLETE_HISTORY`; do not infer a low.
- Upstream rate limit: reduce result count and suggest retrying later.
