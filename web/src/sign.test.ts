import { describe, expect, it } from "vitest";
import { hashDomain, hashTypedData } from "viem";
import { buildAuthorization, splitSig } from "./sign";
import { TOKENS } from "../../relayer/src/tokens";
import { intentNonce, type Intent } from "../../relayer/src/intent";

const BENSIN = "0x071f48e23715E364847D12EDd42012a3d95eDaD9";
const it_: Intent = {
  token: TOKENS.USDT0.address,
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  amount: 50_000_000n,
  fee: 20_000n,
  action: 0,
  minOkbOut: 0n,
  validBefore: 1_800_000_600n,
  salt: "0x0000000000000000000000000000000000000000000000000000000000000007",
};

describe("buildAuthorization", () => {
  it("uses the token's on-chain EIP-712 domain (USDT0)", () => {
    const td = buildAuthorization(TOKENS.USDT0, it_, BENSIN, 196);
    expect(hashDomain({ domain: { ...td.domain, chainId: BigInt(td.domain.chainId) }, types: { EIP712Domain: [
      { name: "name", type: "string" }, { name: "version", type: "string" },
      { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
    ] } })).toBe("0xd591d9baf744328d9400b923cb02c9474d367d591ca1ab24d8c4068be527599d");
  });

  it("authorizes amount + fee to Bensin with the intent nonce", () => {
    const td = buildAuthorization(TOKENS.USDT0, it_, BENSIN, 196);
    expect(td.message).toEqual({
      from: it_.from, to: BENSIN, value: 50_020_000n, validAfter: 0n,
      validBefore: it_.validBefore, nonce: intentNonce(it_, 196n, BENSIN),
    });
    expect(hashTypedData(td)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("splits a 65-byte signature", () => {
    const sig = ("0x" + "11".repeat(32) + "22".repeat(32) + "1b") as `0x${string}`;
    expect(splitSig(sig)).toEqual({ r: "0x" + "11".repeat(32), s: "0x" + "22".repeat(32), v: 27 });
  });
});
