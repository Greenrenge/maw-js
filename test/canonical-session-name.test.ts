import { describe, expect, test } from "bun:test";
import { canonicalSessionName } from "../src/core/fleet/session-name";

describe("canonicalSessionName guard rails", () => {
  test("rejects invalid slot values", () => {
    expect(() => canonicalSessionName({ oracle: "neo-oracle", slot: -1 })).toThrow("invalid fleet slot");
    expect(() => canonicalSessionName({ oracle: "neo-oracle", slot: 100 })).toThrow("invalid fleet slot");
  });
});
