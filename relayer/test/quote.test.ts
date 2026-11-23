import { describe, expect, it } from "vitest";
import { computeQuote } from "../src/quote";

const base = { amount: 50_000_000n, now: 1_800_000_000n, gasCostOkbWei: 6_000_000_000_000n, usdPerOkb: 48 };

describe("computeQuote", () => {
  it("never charges below the tier minimum", () => {
    const q = computeQuote({ ...base, action: 0, tier: { allow: true, tier: 1, minFee: 20_000n } });
    expect(q.fee).toBe(20_000n);
    expect(q.allow).toBe(true);
  });

  it("covers gas when gas costs more than the tier minimum", () => {
    const q = computeQuote({ ...base, gasCostOkbWei: 10n ** 16n, action: 0, tier: { allow: true, tier: 1, minFee: 20_000n } });
    // 0.01 OKB * $48 = $0.48 -> 480_000 units, plus 20% margin
    expect(q.fee).toBe(576_000n);
  });

  it("tier 0 (first-time promo) is free even when gas costs something", () => {
    const q = computeQuote({ ...base, gasCostOkbWei: 10n ** 16n, action: 0, tier: { allow: true, tier: 0, minFee: 0n } });
    expect(q.fee).toBe(0n);
  });

  it("passes a denial through", () => {
    const q = computeQuote({ ...base, action: 0, tier: { allow: false, tier: 1, minFee: 20_000n } });
    expect(q.allow).toBe(false);
  });

  it("refuel minOkbOut is 98% of the expected output after pool fees", () => {
    const q = computeQuote({ ...base, amount: 2_000_000n, action: 1, tier: { allow: true, tier: 1, minFee: 20_000n } });
    // $2 / $48 = 0.041666.. OKB, minus 0.06% pool fees, times 0.98
    const expected = (2_000_000n * 10n ** 12n * 10n ** 18n) / (48n * 10n ** 18n);
    const afterFees = (expected * 9994n) / 10_000n;
    expect(q.minOkbOut).toBe((afterFees * 98n) / 100n);
  });

  it("validBefore is ten minutes ahead", () => {
    const q = computeQuote({ ...base, action: 0, tier: { allow: true, tier: 1, minFee: 20_000n } });
    expect(q.validBefore).toBe(1_800_000_600n);
  });
});
