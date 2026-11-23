import { describe, expect, it } from "vitest";
import { intentNonce, type Intent } from "../src/intent";

describe("intentNonce", () => {
  it("matches the Solidity golden vector (test_logGoldenNonce)", () => {
    const it_: Intent = {
      token: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amount: 50_000_000n,
      fee: 20_000n,
      action: 0,
      minOkbOut: 0n,
      validBefore: 1_800_000_600n,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000007",
    };
    expect(intentNonce(it_, 196n, "0x1d1499e622D69689cdf9004d05Ec547d650Ff211")).toBe(
      "0x9a62ff65fbde989650df5bd8638e882e33b89aabdcb6fd4f2b2aeca64677b3de",
    );
  });
});
