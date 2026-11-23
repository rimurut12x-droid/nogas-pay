import { describe, expect, it } from "vitest";
import { normalizeKey } from "../src/key";

const HEX = "ab".repeat(32);

describe("normalizeKey", () => {
  it("keeps a 0x-prefixed key", () => expect(normalizeKey(`0x${HEX}`)).toBe(`0x${HEX}`));
  it("adds a missing 0x prefix", () => expect(normalizeKey(HEX)).toBe(`0x${HEX}`));
  it("strips whitespace and quotes", () => expect(normalizeKey(` "0x${HEX}"\n`)).toBe(`0x${HEX}`));
  it("rejects an empty key without echoing it", () => expect(() => normalizeKey("")).toThrow("RELAYER_KEY is not set"));
  it("rejects a malformed key without echoing it", () => {
    expect(() => normalizeKey("0x1234secret")).toThrow("RELAYER_KEY must be 64 hex characters");
    expect(() => normalizeKey("0x1234secret")).not.toThrow(/secret/);
  });
});
