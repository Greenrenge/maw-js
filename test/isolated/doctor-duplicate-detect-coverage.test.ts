/** Isolated coverage for src/vendor/mpr-plugins/doctor/internal/duplicate-detect.ts. */
import { afterEach, describe, expect, test } from "bun:test";

const { findDuplicateIdentities, formatDuplicate, warnDuplicatesAtBoot } = await import(
  "../../src/vendor/mpr-plugins/doctor/internal/duplicate-detect.ts?doctor-duplicate-detect-coverage"
);

const originalWarn = console.warn;

afterEach(() => {
  console.warn = originalWarn;
});

describe("doctor duplicate identity detection", () => {
  test("skips legacy identities, groups duplicates, includes local claims, and sorts by key", () => {
    const duplicates = findDuplicateIdentities({
      legacy: { url: "http://legacy", node: null, addedAt: "x", lastSeen: null },
      missingOracle: { url: "http://missing-oracle", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "", node: "m5" } },
      missingNode: { url: "http://missing-node", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "mawjs", node: "" } },
      zTwo: { url: "http://z-2", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "zed", node: "node" } },
      aTwo: { url: "http://a-2", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "alpha", node: "node" } },
      zThree: { url: "http://z-3", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "zed", node: "node" } },
    }, { oracle: "alpha", node: "node" });

    expect(duplicates).toEqual([
      {
        key: "alpha:node",
        claimants: [
          { alias: "<local>" },
          { alias: "aTwo", url: "http://a-2" },
        ],
      },
      {
        key: "zed:node",
        claimants: [
          { alias: "zTwo", url: "http://z-2" },
          { alias: "zThree", url: "http://z-3" },
        ],
      },
    ]);
    expect(formatDuplicate(duplicates[0]!)).toBe('duplicate <oracle>:<node> claim "alpha:node" — <local>, aTwo (http://a-2)');
  });

  test("warnDuplicatesAtBoot uses console.warn by default and returns duplicate list", () => {
    const warnings: string[] = [];
    console.warn = (msg?: unknown) => { warnings.push(String(msg)); };

    const duplicates = warnDuplicatesAtBoot({
      peers: {
        self: { url: "http://self", node: null, addedAt: "x", lastSeen: null, identity: { oracle: "mawjs", node: "m5" } },
      },
      local: { oracle: "mawjs", node: "m5" },
    });

    expect(duplicates).toHaveLength(1);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("duplicate <oracle>:<node> claim");
    expect(warnings[1]).toContain("maw peers remove <alias>");
  });
});
