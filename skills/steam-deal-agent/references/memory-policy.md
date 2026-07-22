# Memory policy

## Stored data

Store only structured gaming preferences:

- stable values such as genres, play styles, budget, minimum discount, and acceptable low statuses;
- recent interest topics with a learning time, weight, and expiry;
- App-ID feedback: `interested`, `dismissed`, or `wishlist`, plus an optional short reason.

Never store API keys, authentication material, payment data, sensitive personal data, or raw chat transcripts.

## Consent

An imperative such as “记住我喜欢 Roguelike” is direct consent. Save it and acknowledge the exact field. A statement such as “我最近看了很多 Roguelike” is evidence of possible interest, not durable consent; offer a specific recent-interest memory and wait for confirmation.

Do not repeatedly ask after the user declines. The current message overrides remembered defaults without automatically rewriting them.

## Conflicts and corrections

When a new explicit preference conflicts with an existing one, replace the relevant key and report the replacement. Keep stable and recent preferences distinct: a temporary interest does not erase a long-term preference.

## User control

- Inspect: return the structured memory in plain language.
- Forget one item: identify the kind and exact key, topic, or App ID, then delete it.
- Clear all: explain the scope and obtain explicit confirmation immediately before deletion.
- Expiry: recent interests expire automatically; mention the expiry when saving them.
