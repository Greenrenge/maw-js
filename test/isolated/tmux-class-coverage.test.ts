import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mockConfigModule } from "../helpers/mock-config";
import { mockSshModule } from "../helpers/mock-ssh";

let hostExecCalls: Array<{ cmd: string; host?: string }> = [];
let hostExecResult = "";
let hostExecError: Error | null = null;

const hostExecMock = async (cmd: string, host?: string) => {
  hostExecCalls.push({ cmd, host });
  if (hostExecError) throw hostExecError;
  return hostExecResult;
};

mock.module("../../src/config", () => mockConfigModule(() => ({
  host: "white.local",
  tmuxSocket: "/tmp/maw socket.sock",
})));
mock.module("../../src/core/transport/ssh", () => mockSshModule({
  hostExec: hostExecMock,
  ssh: hostExecMock,
}));

const { Tmux } = await import("../../src/core/transport/tmux-class.ts?tmux-class-coverage");

const realSetTimeout = globalThis.setTimeout;
const immediateSetTimeout = ((fn: TimerHandler, _ms?: number, ...args: unknown[]) => {
  if (typeof fn === "function") fn(...args);
  return 0 as unknown as ReturnType<typeof setTimeout>;
}) as typeof setTimeout;

class ScriptedTmux extends Tmux {
  calls: string[] = [];
  captureScript: Array<string | Error> = [];
  private captureIdx = 0;

  constructor() {
    super(undefined, "");
  }

  async capture(_target: string, lines = 80): Promise<string> {
    this.calls.push(`capture:${lines}`);
    const next = this.captureScript[this.captureIdx] ?? this.captureScript.at(-1) ?? "";
    this.captureIdx++;
    if (next instanceof Error) throw next;
    return next;
  }

  async sendKeys(_target: string, ...keys: string[]): Promise<void> {
    this.calls.push(`sendKeys:${keys.join(",")}`);
  }

  async sendKeysLiteral(_target: string, text: string): Promise<void> {
    this.calls.push(`sendKeysLiteral:${text}`);
  }

  async loadBuffer(text: string): Promise<void> {
    this.calls.push(`loadBuffer:${text.length}`);
  }

  async pasteBuffer(_target: string): Promise<void> {
    this.calls.push("pasteBuffer");
  }

  async exitModeIfNeeded(target: string): Promise<boolean> {
    this.calls.push(`exitModeIfNeeded:${target}`);
    return false;
  }
}

describe("tmux-class isolated coverage", () => {
  beforeEach(() => {
    hostExecCalls = [];
    hostExecResult = "";
    hostExecError = null;
    globalThis.setTimeout = immediateSetTimeout;
  });

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  test("run/loadBuffer/capture use quoted socket commands and preserve host", async () => {
    const t = new Tmux("remote-box");

    await t.run("list-panes", "-t", "sess:oracle.0", "-F", "#{pane_id}");
    await t.capture("sess:oracle.0", 12);
    await t.loadBuffer("it's ready");

    expect(hostExecCalls).toEqual([
      {
        cmd: "tmux -S '/tmp/maw socket.sock' list-panes -t sess:oracle.0 -F '#{pane_id}'",
        host: "remote-box",
      },
      {
        cmd: "tmux -S '/tmp/maw socket.sock' capture-pane -t sess:oracle.0 -e -p 2>/dev/null | tail -12",
        host: "remote-box",
      },
      {
        cmd: "printf '%s' 'it'\\''s ready' | tmux -S '/tmp/maw socket.sock' load-buffer -",
        host: "remote-box",
      },
    ]);
  });

  test("sendText retries from ANSI-colored pending input and stops once the prompt clears", async () => {
    const t = new ScriptedTmux();
    t.captureScript = [
      "\x1b[32m❯\x1b[0m deploy now\r",
      "\x1b[32m❯\x1b[0m \r",
    ];

    await t.sendText("sess:oracle.0", "deploy now");

    expect(t.calls).toEqual([
      "exitModeIfNeeded:sess:oracle.0",
      "sendKeysLiteral:deploy now",
      "sendKeys:Enter",
      "capture:5",
      "sendKeys:Enter",
      "capture:5",
    ]);
  });

  test("sendText uses the buffer path for long single-line payloads", async () => {
    const t = new ScriptedTmux();
    const longText = "x".repeat(501);
    t.captureScript = ["$ \r"];

    await t.sendText("sess:oracle.0", longText);

    expect(t.calls).toEqual([
      "exitModeIfNeeded:sess:oracle.0",
      `loadBuffer:${longText.length}`,
      "pasteBuffer",
      "sendKeys:Enter",
      "capture:5",
    ]);
  });
});
