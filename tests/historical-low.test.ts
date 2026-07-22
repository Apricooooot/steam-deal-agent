import assert from "node:assert/strict";
import test from "node:test";
import { classifyHistoricalLow } from "../src/domain/historical-low.ts";

const now = new Date("2026-07-22T00:00:00Z");

test("classifies a two-year low", () => {
  const result = classifyHistoricalLow({ currentPriceMinor: 1800, releaseDate: "2020-01-01T00:00:00Z", now, observations: [
    { timestamp: "2024-07-22T00:00:00Z", priceMinor: 2000 },
    { timestamp: "2025-01-01T00:00:00Z", priceMinor: 1800 },
  ] });
  assert.equal(result.status, "TWO_YEAR_LOW");
  assert.equal(result.referencePriceMinor, 1800);
});

test("uses release lifetime for a newer game", () => {
  const result = classifyHistoricalLow({ currentPriceMinor: 950, releaseDate: "2026-01-01T00:00:00Z", now, observations: [
    { timestamp: "2026-01-01T00:00:00Z", priceMinor: 1000 },
  ] });
  assert.equal(result.status, "RELEASE_LOW");
});

test("refuses to claim a low when early coverage is missing", () => {
  const result = classifyHistoricalLow({ currentPriceMinor: 500, releaseDate: "2020-01-01T00:00:00Z", now, observations: [
    { timestamp: "2025-07-01T00:00:00Z", priceMinor: 500 },
  ] });
  assert.equal(result.status, "INCOMPLETE_HISTORY");
});
