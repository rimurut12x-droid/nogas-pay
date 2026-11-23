import type { Address } from "viem";

/** EIP-712 domains verified against each token's DOMAIN_SEPARATOR on X Layer (chain 196). */
export const TOKENS = {
  USDT0: { address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", name: "USD₮0", version: "1", decimals: 6 },
  USDC: { address: "0xB6CEceAB302E2E4948951eE7843FC24E92933061", name: "USDC", version: "2", decimals: 6 },
  USDG: { address: "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8", name: "Global Dollar", version: "1", decimals: 6 },
} as const satisfies Record<string, { address: Address; name: string; version: string; decimals: number }>;
