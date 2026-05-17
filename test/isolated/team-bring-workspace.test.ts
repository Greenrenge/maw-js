import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tmp = mkdtempSync(join(tmpdir(), "maw-team-bring-"));
const configDir = join(tmp, "config");
process.env.MAW_CONFIG_DIR = configDir;

let wakeCalls: Array<{ oracle: string; opts: any }> = [];
let layoutCalls: Array<{ target: string; layout: string }> = [];

mock.module("maw-js/core/paths", () => ({
  CONFIG_DIR: configDir,
  CONFIG_FILE: join(configDir, "maw.config.json"),
  FLEET_DIR: join(configDir, "fleet"),
  MAW_ROOT: "/repo/maw-js",
  resolveHome: () => tmp,
}));

mock.module("maw-js/sdk", () => ({
  tmux: {
    hasSession: async (name: string) => name === "project" || name === "myteam",
    run: async () => "54-mawjs",
    selectLayout: async (target: string, layout: string) => {
      layoutCalls.push({ target, layout });
    },
  },
}));

mock.module("maw-js/commands/shared/wake", () => ({
  cmdWake: async (oracle: string, opts: any) => {
    wakeCalls.push({ oracle, opts });
    return `${opts.session}:${oracle}`;
  },
}));

const registryDir = join(process.env.MAW_CONFIG_DIR!, "teams", "myteam");
mkdirSync(registryDir, { recursive: true });
writeFileSync(join(registryDir, "oracle-members.json"), JSON.stringify({
  name: "myteam",
  createdAt: new Date().toISOString(),
  members: [
    { oracle: "volt", role: "builder", addedAt: new Date().toISOString() },
    { oracle: "odin", role: "reviewer", addedAt: new Date().toISOString() },
  ],
}, null, 2));

const { cmdTeamBring } = await import("../../src/vendor/mpr-plugins/team/team-workspace");

beforeEach(() => {
  wakeCalls = [];
  layoutCalls = [];
});

describe("cmdTeamBring", () => {
  test("dry-run previews each oracle in the target workspace session", async () => {
    const targets = await cmdTeamBring("myteam", { session: "project", dryRun: true });

    expect(targets).toEqual(["project:volt", "project:odin"]);
    expect(wakeCalls).toEqual([]);
    expect(layoutCalls).toEqual([]);
  });

  test("prefers an existing team-named workspace over the current tmux session", async () => {
    const targets = await cmdTeamBring("myteam", { dryRun: true });

    expect(targets).toEqual(["myteam:volt", "myteam:odin"]);
    expect(wakeCalls).toEqual([]);
    expect(layoutCalls).toEqual([]);
  });

  test("wakes each oracle with --session semantics and applies layout", async () => {
    const targets = await cmdTeamBring("myteam", { session: "project", engine: "codex", split: true });

    expect(targets).toEqual(["project:volt", "project:odin"]);
    expect(wakeCalls).toEqual([
      { oracle: "volt", opts: { session: "project", noRehydrate: true, engine: "codex", split: true } },
      { oracle: "odin", opts: { session: "project", noRehydrate: true, engine: "codex", split: true } },
    ]);
    expect(layoutCalls).toEqual([{ target: "project:lead", layout: "main-vertical" }]);
  });
});
