export type TierInfo = { allow: boolean; tier: number; minFee: bigint };

export type QuoteInput = {
  amount: bigint; // token units (6 decimals, ~micro-USD)
  action: number;
  tier: TierInfo;
  gasCostOkbWei: bigint; // estimated gas * gas price
  usdPerOkb: number;
  now: bigint; // unix seconds
};

export type Quote = {
  allow: boolean;
  tier: number;
  fee: bigint;
  validBefore: bigint;
  minOkbOut: bigint;
};

const GAS_MARGIN_BPS = 12_000n; // charge gas cost + 20%
const POOL_FEES_BPS = 9_994n; // 0.01% + 0.05% hops
const SLIPPAGE_PCT = 98n;
export const VALIDITY_SECONDS = 600n;

/** Pure fee/limit computation; the network-facing part only supplies its inputs. */
export function computeQuote(q: QuoteInput): Quote {
  const microUsdPerOkb = BigInt(Math.round(q.usdPerOkb * 1e6));
  const gasInToken = (q.gasCostOkbWei * microUsdPerOkb) / 10n ** 18n;
  const gasFee = (gasInToken * GAS_MARGIN_BPS) / 10_000n;
  const fee = q.tier.tier === 0 ? 0n : gasFee > q.tier.minFee ? gasFee : q.tier.minFee;
  let minOkbOut = 0n;
  if (q.action === 1) {
    const expected = (q.amount * 10n ** 18n) / microUsdPerOkb;
    minOkbOut = (((expected * POOL_FEES_BPS) / 10_000n) * SLIPPAGE_PCT) / 100n;
  }
  return { allow: q.tier.allow, tier: q.tier.tier, fee, validBefore: q.now + VALIDITY_SECONDS, minOkbOut };
}
