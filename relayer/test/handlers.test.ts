import { describe, expect, it } from "vitest";
import { parseIntent, RateLimiter } from "../src/handlers";

const good = {
  token: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  amount: "5000000", fee: "0", action: 0, minOkbOut: "0", validBefore: "1800000600",
  salt: "0x" + "07".padStart(64, "0"),
};

describe("parseIntent", () => {
  it("accepts a well-formed intent", () => {
    expect(parseIntent(good).amount).toBe(5_000_000n);
  });
  it("rejects a bad address", () => {
    expect(() => parseIntent({ ...good, to: "0x123" })).toThrow("bad to");
  });
  it("rejects a short salt", () => {
    expect(() => parseIntent({ ...good, salt: "0x07" })).toThrow("bad salt");
  });
  it("rejects a non-numeric amount", () => {
    expect(() => parseIntent({ ...good, amount: "lots" })).toThrow();
  });
});

describe("RateLimiter", () => {
  it("allows 10 per minute per key, then limits", () => {
    const rl = new RateLimiter(10, 60_000);
    for (let i = 0; i < 10; i++) expect(rl.hit("a", 0)).toBe(false);
    expect(rl.hit("a", 1)).toBe(true);
    expect(rl.hit("b", 1)).toBe(false);
    expect(rl.hit("a", 61_000)).toBe(false);
  });
});
