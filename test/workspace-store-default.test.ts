import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const originalEnv = {
  MAW_HOME: process.env.MAW_HOME,
  MAW_CONFIG_DIR: process.env.MAW_CONFIG_DIR,
};

function restoreEnv(): void {
  if (originalEnv.MAW_HOME === undefined) delete process.env.MAW_HOME;
  else process.env.MAW_HOME = originalEnv.MAW_HOME;
  if (originalEnv.MAW_CONFIG_DIR === undefined) delete process.env.MAW_CONFIG_DIR;
  else process.env.MAW_CONFIG_DIR = originalEnv.MAW_CONFIG_DIR;
}

afterEach(() => {
  restoreEnv();
});

describe("workspace-store XDG config paths", () => {
  test("uses shared config resolver for MAW_HOME and MAW_CONFIG_DIR", async () => {
    const root = mkdtempSync(join(tmpdir(), "maw-workspace-store-default-"));
    try {
      const store = await import("../src/commands/shared/workspace-store.ts?workspace-store-default");

      process.env.MAW_HOME = join(root, "instance");
      process.env.MAW_CONFIG_DIR = join(root, "ignored-config");
      expect(store.workspacesDir()).toBe(join(root, "instance", "config", "workspaces"));
      expect(store.configPath("ws-home")).toBe(join(root, "instance", "config", "workspaces", "ws-home.json"));

      delete process.env.MAW_HOME;
      process.env.MAW_CONFIG_DIR = join(root, "config");
      expect(store.workspacesDir()).toBe(join(root, "config", "workspaces"));

      store.saveWorkspace({
        id: "ws-config",
        name: "Config Workspace",
        hubUrl: "https://hub.example",
        sharedAgents: ["mawjs"],
        joinedAt: "2026-05-20T16:15:00.000Z",
      });

      const path = join(root, "config", "workspaces", "ws-config.json");
      expect(existsSync(path)).toBe(true);
      expect(JSON.parse(readFileSync(path, "utf-8")).name).toBe("Config Workspace");
      expect(store.loadWorkspace("ws-config")?.sharedAgents).toEqual(["mawjs"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
