import type { Address, Hex } from "viem";
import type { Intent } from "../../relayer/src/intent";
import { RELAYER_URL } from "./config";

export type Quote = { allow: boolean; tier: number; fee: bigint; validBefore: bigint; minOkbOut: bigint };

const enc = (b: unknown) => JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v));

async function post(path: string, body: unknown) {
  const r = await fetch(RELAYER_URL + path, { method: "POST", headers: { "content-type": "application/json" }, body: enc(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Relayer returned ${r.status}`);
  return j;
}

export async function getQuote(user: Address, token: Address, amount: bigint, action: number): Promise<Quote> {
  const j = await post("/quote", { user, token, amount, action });
  return { allow: j.allow, tier: j.tier, fee: BigInt(j.fee), validBefore: BigInt(j.validBefore), minOkbOut: BigInt(j.minOkbOut) };
}

export async function submit(intent: Intent, v: number, r: Hex, s: Hex): Promise<Hex> {
  const j = await post("/relay", { intent, v, r, s });
  return j.txHash as Hex;
}
