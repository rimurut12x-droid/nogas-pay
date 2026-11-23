import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { normalizeKey } from "./key.js";
import { BENSIN, POOL_WOKB_USDG, RPC_URL, bensinAbi, poolAbi, xlayer } from "./config.js";
import type { Intent } from "./intent.js";
import { computeQuote, type Quote } from "./quote.js";

export const publicClient = createPublicClient({ chain: xlayer, transport: http(RPC_URL) });

const GAS = { 0: 250_000n, 1: 450_000n } as Record<number, bigint>;

/** USD per OKB from the WOKB/USDG pool (token0 = USDG 6 dec, token1 = WOKB 18 dec). */
export async function usdPerOkb(): Promise<number> {
  const [sqrtPriceX96] = await publicClient.readContract({ address: POOL_WOKB_USDG, abi: poolAbi, functionName: "slot0" });
  const p = Number(sqrtPriceX96) / 2 ** 96;
  const wokbPerUsdg = p * p * 1e6 / 1e18;
  return 1 / wokbPerUsdg;
}

export async function quote(req: { user: Address; token: Address; amount: bigint; action: number }): Promise<Quote> {
  const [allow, tier, minFee] = await publicClient.readContract({
    address: BENSIN,
    abi: bensinAbi,
    functionName: "quoteTier",
    args: [req.user, req.token, req.amount, req.action],
  });
  const [gasPrice, price, block] = await Promise.all([
    publicClient.getGasPrice(),
    usdPerOkb(),
    publicClient.getBlock(),
  ]);
  return computeQuote({
    amount: req.amount,
    action: req.action,
    tier: { allow, tier, minFee },
    gasCostOkbWei: gasPrice * (GAS[req.action] ?? GAS[0]),
    usdPerOkb: price,
    now: block.timestamp,
  });
}

export async function relay(it: Intent, v: number, r: Hex, s: Hex): Promise<Hex> {
  const account = privateKeyToAccount(normalizeKey(process.env.RELAYER_KEY));
  const { request } = await publicClient.simulateContract({
    account,
    address: BENSIN,
    abi: bensinAbi,
    functionName: "relay",
    args: [it, v, r, s],
  });
  const wallet = createWalletClient({ account, chain: xlayer, transport: http(RPC_URL) });
  return wallet.writeContract(request);
}
