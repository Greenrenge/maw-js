import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "path";

let sessions = new Set<string>();
let newSessionCalls: Array<{ name: string; opts: any }> = [];
let attached: string[] = [];

mock.module(join(import.meta.dir, "../../src/sdk"), () => ({
  tmux: {
    hasSession: async (name: string) => sessions.has(name),
    newSession: async (name: string, opts: any = {}) => {
      sessions.add(name);
      newSessionCalls.push({ name, opts });
    },
  },
}));

mock.module(join(import.meta.dir, "../../src/commands/shared/wake-session"), () => ({
  attachToSession: async (name: string) => { attached.push(name); },
}));

const { cmdNew } = await import("../../src/cli/cmd-new");

beforeEach(() => {
  sessions = new Set<string>();
  newSessionCalls = [];
  attached = [];
});

describe("cmdNew workspace session factory", () => {
  test("creates a detached tmux session with a lead shell window", async () => {
    await cmdNew(["my-project", "--no-attach"]);

    expect(newSessionCalls).toEqual([
      { name: "my-project", opts: { window: "lead", cwd: process.cwd() } },
    ]);
    expect(attached).toEqual([]);
  });

  test("reuses an existing workspace session and can attach", async () => {
    sessions.add("my-project");

    await cmdNew(["my-project", "--attach"]);

    expect(newSessionCalls).toEqual([]);
    expect(attached).toEqual(["my-project"]);
  });
});
