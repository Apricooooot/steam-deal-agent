# Historical-low policy

The comparison window begins at the later of:

- the game's release date; or
- 730 days before the current check.

This creates two evidence-backed labels:

- `TWO_YEAR_LOW`: the current minor-unit price is no higher than every Steam price observed in a complete 730-day window.
- `RELEASE_LOW`: the same rule, but the game was released less than 730 days ago, so the window covers its release lifetime.

Additional labels:

- `NEAR_LOW`: current price is within 5% of the reference low, rounded upward to whole minor units.
- `NOT_LOW`: current price is more than 5% above the reference low.
- `INCOMPLETE_HISTORY`: the earliest observation is missing or occurs more than seven days after the required window start. Never market this as a low.

Calculations use integer minor units to avoid floating-point price errors. Report the reference price, reference timestamp, window start, and record count so the user can audit the conclusion.
