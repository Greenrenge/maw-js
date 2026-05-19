import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  cmdAdd,
  cmdList,
  cmdRemove,
  formatList,
  loadTrust,
  saveTrust,
  trustPath,
} from "../../src/vendor/mpr-plugins/trust/impl";

describe("trust impl next coverage", () => {
  const originalMawHome = process.env.MAW_HOME;
  const originalConfigDir = process.env.MAW_CONFIG_DIR;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "maw-trust-impl-next-"));
    delete process.env.MAW_HOME;
    process.env.MAW_CONFIG_DIR = join(dir, "config");
  });

  afterEach(() => {
    if (originalMawHome === undefined) delete process.env.MAW_HOME;
    else process.env.MAW_HOME = originalMawHome;

    if (originalConfigDir === undefined) delete process.env.MAW_CONFIG_DIR;
    else process.env.MAW_CONFIG_DIR = originalConfigDir;

    rmSync(dir, { recursive: true, force: true });
  });

  test("validates add/remove inputs and resolves the live trust path", () => {
    expect(trustPath()).toBe(join(dir, "config", "trust.json"));
    expect(loadTrust()).toEqual([]);

    expect(() => cmdAdd("", "target")).toThrow("trust add: sender must be a non-empty string");
    expect(() => cmdAdd("sender", "")).toThrow("trust add: target must be a non-empty string");
    expect(() => cmdAdd("sender", "sender")).toThrow("refusing self-trust pair");

    expect(() => cmdRemove("", "target")).toThrow("trust remove: sender must be a non-empty string");
    expect(() => cmdRemove("sender", "")).toThrow("trust remove: target must be a non-empty string");
    expect(() => cmdRemove("missing", "pair")).toThrow('trust remove: no entry found for "missing↔pair"');
  });

  test("sorts, formats, dedupes, and removes symmetric pairs", () => {
    saveTrust([
      { sender: "zeta", target: "eta", addedAt: "2026-05-18T02:00:00.000Z" },
      { sender: "alpha", target: "beta", addedAt: "2026-05-18T01:00:00.000Z" },
    ]);

    expect(cmdList().map(entry => entry.sender)).toEqual(["alpha", "zeta"]);
    expect(formatList(cmdList())).toContain("sender  target  addedAt");

    const duplicate = cmdAdd("beta", "alpha");
    expect(duplicate.added).toBe(false);
    expect(duplicate.entry).toMatchObject({ sender: "alpha", target: "beta" });

    const added = cmdAdd("gamma", "delta");
    expect(added.added).toBe(true);
    expect(added.entry).toMatchObject({ sender: "gamma", target: "delta" });

    const removed = cmdRemove("delta", "gamma");
    expect(removed).toMatchObject({ sender: "gamma", target: "delta" });
    expect(loadTrust().some(entry => entry.sender === "gamma")).toBe(false);
  });
});
