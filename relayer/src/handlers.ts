import { getAddress, isAddress, isHex, type Hex } from "viem";
import type { Intent } from "./intent";

export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit = 10, private windowMs = 60_000) {}

  /** Records a hit; true when the key is over its limit. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length > this.limit;
  }
}

export function parseIntent(x: any): Intent {
  for (const k of ["token", "from", "to"]) if (!isAddress(x?.[k])) throw new Error(`bad ${k}`);
  if (!isHex(x.salt) || x.salt.length !== 66) throw new Error("bad salt");
  return {
    token: getAddress(x.token),
    from: getAddress(x.from),
    to: getAddress(x.to),
    amount: BigInt(x.amount),
    fee: BigInt(x.fee),
    action: Number(x.action),
    minOkbOut: BigInt(x.minOkbOut),
    validBefore: BigInt(x.validBefore),
    salt: x.salt as Hex,
  };
}

const limiter = new RateLimiter();

export type Reply = { status: number; body: unknown };

/** Transport-independent handlers used by the Node server and the Vercel functions. */
export async function handleQuote(b: any, ip: string): Promise<Reply> {
  const { quote } = await import("./chain");
  if (!isAddress(b?.user) || !isAddress(b?.token)) return { status: 400, body: { error: "bad address" } };
  if (limiter.hit(`ip:${ip}`)) return { status: 429, body: { error: "rate limited" } };
  return { status: 200, body: await quote({ user: b.user, token: b.token, amount: BigInt(b.amount), action: Number(b.action) }) };
}

export async function handleRelay(b: any, ip: string): Promise<Reply> {
  const { relay } = await import("./chain");
  const it = parseIntent(b?.intent);
  if (limiter.hit(`ip:${ip}`) || limiter.hit(`from:${it.from}`)) return { status: 429, body: { error: "rate limited" } };
  const txHash = await relay(it, Number(b.v), b.r as Hex, b.s as Hex);
  return { status: 200, body: { txHash } };
}

export const toJson = (body: unknown) => JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v));
