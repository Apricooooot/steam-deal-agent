export type PriceObservation = { timestamp: string; priceMinor: number };
export type LowStatus = "TWO_YEAR_LOW" | "RELEASE_LOW" | "NEAR_LOW" | "NOT_LOW" | "INCOMPLETE_HISTORY";

export type LowEvidence = {
  status: LowStatus;
  windowStart: string;
  referencePriceMinor: number | null;
  referenceDate: string | null;
  recordCount: number;
  coverageComplete: boolean;
};

const DAY_MS = 86_400_000;

export function classifyHistoricalLow(input: {
  currentPriceMinor: number;
  releaseDate: string;
  observations: PriceObservation[];
  now?: Date;
}): LowEvidence {
  const now = input.now ?? new Date();
  const release = new Date(input.releaseDate);
  if (!Number.isFinite(release.getTime())) throw new Error("Invalid releaseDate");
  const twoYearsAgo = new Date(now.getTime() - 730 * DAY_MS);
  const windowStart = release > twoYearsAgo ? release : twoYearsAgo;
  const rows = input.observations
    .filter((row) => Number.isInteger(row.priceMinor) && row.priceMinor >= 0)
    .map((row) => ({ ...row, date: new Date(row.timestamp) }))
    .filter((row) => Number.isFinite(row.date.getTime()) && row.date >= windowStart && row.date <= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const coverageComplete = rows.length > 0 && rows[0].date.getTime() <= windowStart.getTime() + 7 * DAY_MS;
  if (!coverageComplete) {
    return { status: "INCOMPLETE_HISTORY", windowStart: windowStart.toISOString(), referencePriceMinor: null, referenceDate: null, recordCount: rows.length, coverageComplete };
  }

  const reference = rows.reduce((best, row) => row.priceMinor < best.priceMinor ? row : best);
  const isReleaseWindow = release > twoYearsAgo;
  let status: LowStatus = "NOT_LOW";
  if (input.currentPriceMinor <= reference.priceMinor) status = isReleaseWindow ? "RELEASE_LOW" : "TWO_YEAR_LOW";
  else if (input.currentPriceMinor <= Math.ceil(reference.priceMinor * 1.05)) status = "NEAR_LOW";

  return {
    status,
    windowStart: windowStart.toISOString(),
    referencePriceMinor: reference.priceMinor,
    referenceDate: reference.date.toISOString(),
    recordCount: rows.length,
    coverageComplete,
  };
}
