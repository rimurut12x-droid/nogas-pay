import type { Hex } from "viem";

/** Accepts the relayer key as pasted into an env var: tolerates quotes, whitespace and a missing 0x. Never echoes the key. */
export function normalizeKey(raw: string | undefined): Hex {
  const s = (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (s === "") throw new Error("RELAYER_KEY is not set");
  const hex = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("RELAYER_KEY must be 64 hex characters");
  return `0x${hex}`;
}
