import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AskFn } from "../../src/vendor/mpr-plugins/init/prompts";

let ttyMode: "success" | "fail" = "success";
let nextTtyAnswer = "";
let ttyPrompts: string[] = [];
let streamCalls: Array<{ path: string; fd: number }> = [];
let closeCount = 0;
let originalToken: string | undefined;

mock.module("fs", () => ({
  openSync: (path: string, flags: string) => {
    expect(path).toBe("/dev/tty");
    expect(flags).toBe("r+");
    if (ttyMode === "fail") throw new Error("no tty");
    return 777;
  },
  createReadStream: (path: string, opts: { fd: number }) => {
    streamCalls.push({ path, fd: opts.fd });
    return { path, fd: opts.fd };
  },
}));

mock.module("readline", () => ({
  createInterface: () => ({
    question: (prompt: string, cb: (answer: string) => void) => {
      ttyPrompts.push(prompt);
      cb(nextTtyAnswer);
    },
    close: () => {
      closeCount++;
    },
  }),
}));

const { runPromptLoop, ttyAsk } = await import("../../src/vendor/mpr-plugins/init/prompts.ts?init-prompts-next-coverage");

beforeEach(() => {
  originalToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  ttyMode = "success";
  nextTtyAnswer = "";
  ttyPrompts = [];
  streamCalls = [];
  closeCount = 0;
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  else process.env.CLAUDE_CODE_OAUTH_TOKEN = originalToken;
});

function scriptedAsk(answers: string[], calls: Array<{ question: string; defaultVal?: string }>): AskFn {
  return async (question: string, defaultVal = "") => {
    calls.push({ question, defaultVal });
    return answers.shift() ?? defaultVal;
  };
}

describe("init prompts next coverage", () => {
  test("ttyAsk reports missing /dev/tty as non-interactive guidance", async () => {
    ttyMode = "fail";

    await expect(ttyAsk("Node name")).rejects.toThrow("/dev/tty unavailable — use --non-interactive");
    expect(ttyPrompts).toEqual([]);
    expect(streamCalls).toEqual([]);
    expect(closeCount).toBe(0);
  });

  test("ttyAsk opens /dev/tty, renders both prompt shapes, trims answers, and falls back to defaults", async () => {
    nextTtyAnswer = "   ";
    await expect(ttyAsk("Node name", "white")).resolves.toBe("white");

    nextTtyAnswer = "  mba  ";
    await expect(ttyAsk("Peer name")).resolves.toBe("mba");

    expect(ttyPrompts).toEqual(["Node name [white]: ", "Peer name: "]);
    expect(streamCalls).toEqual([
      { path: "/dev/tty", fd: 777 },
      { path: "/dev/tty", fd: 777 },
    ]);
    expect(closeCount).toBe(2);
  });

  test("runPromptLoop accepts an explicit token and uppercase federation yes before stopping on a blank peer URL", async () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const calls: Array<{ question: string; defaultVal?: string }> = [];
    const writes: string[] = [];
    const ask = scriptedAsk(["white", "direct-token", "Y", ""], calls);

    const result = await runPromptLoop(ask, { node: "default-node" }, "/Users/tester", (msg) => writes.push(msg));

    expect(result).toEqual({ node: "white", token: "direct-token", federate: true, peers: [] });
    expect(calls.map((call) => `${call.question}=${call.defaultVal}`)).toEqual([
      "Node name (this machine's identity in the federation)=default-node",
      "Claude token (blank = use $CLAUDE_CODE_OAUTH_TOKEN or ~/.claude/credentials)=",
      "Federate with other machines? (y/N)=N",
      "Peer 1 URL=done",
    ]);
    expect(writes).toEqual([]);
  });
});
