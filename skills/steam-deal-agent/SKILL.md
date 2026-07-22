---
name: steam-deal-agent
description: Find, filter, and explain active Steam deals using local Steam and IsThereAnyDeal tools, including regional pricing, public-library ownership, and evidence-backed two-year or release-lifetime low classification. Use when the user asks for Steam deal recommendations, a personalized Steam sale search, owned-game exclusion, or verification that a Steam price is historically low.
---

# Steam Deal Agent

Recommend Steam deals from tool evidence, not memory or invented prices.

## Workflow

1. Call `get_configuration_status` before any deal search.
2. If ITAD is missing, explain how to set `ITAD_API_KEY` in the local environment. If library filtering is requested and Steam is missing, explain how to set `STEAM_API_KEY`. Never ask the user to paste a secret into chat.
3. Use the configured region and profile unless the user supplies another. Default to `CN` when no region is configured.
4. Translate the user's budget, genres, minimum discount, ownership preference, and acceptable low statuses into `search_steam_deals` arguments.
5. Exclude `owned: true` results when the user wants new games. If library access is private or unavailable, say that ownership could not be checked and continue with regional deals when useful.
6. Present a short ranked list. For every recommendation include current price and currency, discount, low status, reference low and date when available, expiry, ownership state, and Steam URL.
7. State uncertainty explicitly. Never describe `INCOMPLETE_HISTORY` as a historical low.

Read [deal-policy.md](references/deal-policy.md) when interpreting low statuses or explaining the price window. Read [tool-guide.md](references/tool-guide.md) when a tool fails or the user asks how the agent works.

## Guardrails

- Do not request, read, store, or transmit a ChatGPT session token, access token, or browser cookie.
- Do not reveal environment variable values. Configuration status may contain booleans only.
- Treat prices, expiries, ownership, and history as time-sensitive; use the tools for each new request.
- Do not claim daily price coverage: ITAD history is a price-change record.
- Do not purchase games or perform account write actions.
- Do not treat bundles, DLC, soundtracks, or ambiguous multi-app packages as base-game recommendations.
- Separate facts returned by tools from qualitative recommendations.
