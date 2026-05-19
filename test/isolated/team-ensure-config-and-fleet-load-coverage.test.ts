import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const sdkPath = import.meta.resolve("../../src/sdk/index.ts");

const root = mkdtempSync(join(tmpdir(), "maw-ensure-fleet-coverage-"));
const fleetDir = join(root, "fleet");
let tmuxOutput = "";
let tmuxError: Error | null = null;
let tmuxCalls: string[][] = [];

mock.module(sdkPath, () => ({
  FLEET_DIR: fleetDir,
  tmux: {
    run: async (...args: string[]) => {
      tmuxCalls.push(args);
      if (tmuxError) throw tmuxError;
      return tmuxOutput;
    },
  },
}));

const teamHelpers = await import("../../src/commands/plugins/team/team-helpers");
const { ensureTeamConfig } = await import("../../src/commands/plugins/team/ensure-config");
const fleetLoad = await import("../../src/commands/shared/fleet-load");

let teamsDir = "";
let tasksDir = "";

function resetDir(path: string) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

beforeEach(() => {
  teamsDir = join(root, `teams-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tasksDir = join(root, `tasks-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  teamHelpers._setDirs(teamsDir, tasksDir);
  resetDir(fleetDir);
  tmuxOutput = "";
  tmuxError = null;
  tmuxCalls = [];
});

afterEach(() => {
  rmSync(teamsDir, { recursive: true, force: true });
  rmSync(tasksDir, { recursive: true, force: true });
  resetDir(fleetDir);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("ensureTeamConfig coverage", () => {
  test("creates a missing team config with explicit description", () => {
    const created = ensureTeamConfig("alpha-team", "Focused alpha coverage team");

    expect(created).toBe(true);
    const configPath = join(teamsDir, "alpha-team", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config).toMatchObject({
      name: "alpha-team",
      description: "Focused alpha coverage team",
      members: [],
    });
    expect(typeof config.createdAt).toBe("number");
  });

  test("returns false without rewriting an existing config", () => {
    const configDir = join(teamsDir, "existing-team");
    const configPath = join(configDir, "config.json");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ name: "existing-team", members: ["keep"] }));

    expect(ensureTeamConfig("existing-team")).toBe(false);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual({
      name: "existing-team",
      members: ["keep"],
    });
  });

  test("uses the default auto-created description when omitted", () => {
    expect(ensureTeamConfig("auto-team")).toBe(true);
    const config = JSON.parse(readFileSync(join(teamsDir, "auto-team", "config.json"), "utf8"));

    expect(config.description).toBe("Auto-created team for session auto-team");
  });
});

describe("fleet-load coverage", () => {
  test("loadFleet reads sorted active json sessions and ignores disabled files", () => {
    writeFileSync(join(fleetDir, "20-later.json"), JSON.stringify({ name: "later", windows: [] }));
    writeFileSync(join(fleetDir, "10-first.json"), JSON.stringify({ name: "first", windows: [{ name: "neo", repo: "org/neo" }] }));
    writeFileSync(join(fleetDir, "30-disabled.json.disabled"), JSON.stringify({ name: "disabled", windows: [] }));

    expect(fleetLoad.loadFleet()).toEqual([
      { name: "first", windows: [{ name: "neo", repo: "org/neo" }] },
      { name: "later", windows: [] },
    ]);
  });

  test("loadFleetEntries parses numeric prefixes and falls back for unnumbered files", () => {
    writeFileSync(join(fleetDir, "007-bond.json"), JSON.stringify({ name: "bond", windows: [] }));
    writeFileSync(join(fleetDir, "loose.json"), JSON.stringify({ name: "loose", windows: [{ name: "loose-oracle" }] }));
    writeFileSync(join(fleetDir, "skip.json.disabled"), JSON.stringify({ name: "skip", windows: [] }));

    expect(fleetLoad.loadFleetEntries()).toEqual([
      {
        file: "007-bond.json",
        num: 7,
        groupName: "bond",
        session: { name: "bond", windows: [] },
      },
      {
        file: "loose.json",
        num: 0,
        groupName: "loose",
        session: { name: "loose", windows: [{ name: "loose-oracle" }] },
      },
    ]);
  });

  test("getSessionNames returns trimmed tmux session names and [] on tmux errors", async () => {
    tmuxOutput = "alpha\n\nbeta\n";

    expect(await fleetLoad.getSessionNames()).toEqual(["alpha", "beta"]);
    expect(tmuxCalls).toEqual([["list-sessions", "-F", "#{session_name}"]]);

    tmuxError = new Error("tmux unavailable");
    expect(await fleetLoad.getSessionNames()).toEqual([]);
  });
});
