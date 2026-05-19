import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_CONFIG_DIR = mkdtempSync(join(tmpdir(), "maw-manifest-default-scan-"));
mkdirSync(join(TEST_CONFIG_DIR, "fleet"), { recursive: true });
process.env.MAW_CONFIG_DIR = TEST_CONFIG_DIR;
process.env.MAW_TEST_MODE = "1";
delete process.env.MAW_HOME;

const srcRoot = join(import.meta.dir, "../..");
let shouldThrow = false;
let scanCalls = 0;

mock.module(join(srcRoot, "src/core/fleet/worktrees-scan"), () => ({
  scanWorktrees: async () => {
    scanCalls++;
    if (shouldThrow) throw new Error("scan unavailable");
    return [{
      path: "/tmp/ghq/Soul-Brews-Studio/defaultscan-oracle",
      mainRepo: "Soul-Brews-Studio/defaultscan-oracle",
    }];
  },
}));

const config = await import("../../src/config");
const { invalidateManifest, loadManifestAsync } = await import("../../src/lib/oracle-manifest.ts?default-scan-coverage");

afterAll(() => {
  rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  shouldThrow = false;
  scanCalls = 0;
  config.resetConfig();
  invalidateManifest();
});

describe("oracle manifest default scan coverage", () => {
  test("loadManifestAsync lazily imports the default worktree scanner", async () => {
    const manifest = await loadManifestAsync();
    expect(scanCalls).toBe(1);
    expect(manifest).toEqual([{
      name: "defaultscan",
      sources: ["worktree"],
      isLive: false,
      localPath: "/tmp/ghq/Soul-Brews-Studio/defaultscan-oracle",
    }]);
  });

  test("loadManifestAsync falls back to the sync manifest when default scan throws", async () => {
    shouldThrow = true;
    await expect(loadManifestAsync()).resolves.toEqual([]);
    expect(scanCalls).toBe(1);
  });
});
