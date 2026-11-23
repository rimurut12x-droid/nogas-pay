import type { Address, Hex } from "viem";
import { intentNonce, receiveWithAuthorizationTypes, type Intent } from "../../relayer/src/intent";

export type TokenInfo = { address: Address; name: string; version: string; decimals: number };

/** EIP-3009 ReceiveWithAuthorization for amount + fee, payable only to Bensin, nonce bound to the intent. */
export function buildAuthorization(t: TokenInfo, it: Intent, bensin: Address, chainId: number) {
  return {
    domain: { name: t.name, version: t.version, chainId, verifyingContract: t.address },
    types: receiveWithAuthorizationTypes,
    primaryType: "ReceiveWithAuthorization" as const,
    message: {
      from: it.from,
      to: bensin,
      value: it.amount + it.fee,
      validAfter: 0n,
      validBefore: it.validBefore,
      nonce: intentNonce(it, BigInt(chainId), bensin),
    },
  };
}

export function splitSig(sig: Hex): { r: Hex; s: Hex; v: number } {
  const r = `0x${sig.slice(2, 66)}` as Hex;
  const s = `0x${sig.slice(66, 130)}` as Hex;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;
  return { r, s, v };
}
