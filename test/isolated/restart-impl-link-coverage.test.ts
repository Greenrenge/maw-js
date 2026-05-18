/** Isolated SDK-link branch coverage for src/vendor/mpr-plugins/restart/impl.ts. */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let execCalls: string[] = [];
let sleepCalls = 0;
let wakeCalls = 0;
let logs: string[] = [];
let homeDir = "";
const originalHome = process.env.HOME;

class MockTmux {
  async killSession(_name: string) {}
}

mock.module("maw-js/sdk", () => ({
  listSessions: async () => [],
  Tmux: MockTmux,
}));

mock.module("maw-js/commands/shared/fleet", () => ({
  cmdSleep: async () => { sleepCalls += 1; },
  cmdWakeAll: async () => { wakeCalls += 1; },
}));

mock.module("child_process", () => ({
  execSync: (cmd: string) => {
    execCalls.push(cmd);
    if (cmd === "maw --version") return "v9.9.9-linked\n";
    return "";
  },
}));

mock.module("maw-js/core/ghq", () => ({
  ghqFindSync: () => "/tmp/maw-js-checkout",
}));

const { cmdRestart } = await import("../../src/vendor/mpr-plugins/restart/impl.ts?restart-impl-link-coverage");

beforeEach(() => {
  execCalls = [];
  sleepCalls = 0;
  wakeCalls = 0;
  logs = [];
  homeDir = mkdtempSync(join(tmpdir(), "restart-link-home-"));
  process.env.HOME = homeDir;
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (homeDir) rmSync(homeDir, { recursive: true, force: true });
});

describe("restart impl SDK link branch", () => {
  test("links local maw checkout into oracle plugin dir after update", async () => {
    await cmdRestart({ ref: "alpha" });

    expect(execCalls.slice(0, 3)).toEqual([
      "bun add -g github:Soul-Brews-Studio/maw-js#alpha",
      "maw --version",
      "cd /tmp/maw-js-checkout && bun link",
    ]);
    expect(execCalls[3]).toMatch(/^cd .*\/.oracle && bun link maw$/);
    expect(logs.join("\n")).toContain("SDK linked");
    expect(sleepCalls).toBe(1);
    expect(wakeCalls).toBe(1);
  });
});
