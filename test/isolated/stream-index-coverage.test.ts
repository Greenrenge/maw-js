import { describe, expect, mock, test } from "bun:test";

const streamCalls: Array<{ target: string; opts: Record<string, unknown> }> = [];

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/stream/impl"), () => ({
  STREAM_USAGE: "usage: maw stream <pane> [--since=<dur>] [--json] [--grep <pattern>] [--quit-on-idle=<dur>]",
  cmdStream: async (target: string, opts: Record<string, unknown>) => {
    streamCalls.push({ target, opts });
    if (target === "explode") throw new Error("stream exploded");
  },
}));

const { command, default: handler } = await import("../../src/vendor/mpr-plugins/stream/index.ts?stream-index-coverage");

function ctx(source: "cli" | "api", args: unknown) {
  return { source, args } as never;
}

describe("maw stream plugin index", () => {
  test("exports metadata and routes CLI flags into cmdStream", async () => {
    expect(command).toEqual({
      name: "stream",
      description: "Follow live pane output through the PTY websocket bridge.",
    });

    const result = await handler(ctx("cli", [
      "50-mawjs:1.0",
      "--since",
      "5m",
      "--json",
      "--grep",
      "ready",
      "--quit-on-idle",
      "10s",
    ]));

    expect(result).toEqual({ ok: true });
    expect(streamCalls.at(-1)).toEqual({
      target: "50-mawjs:1.0",
      opts: { since: "5m", json: true, grep: "ready", quitOnIdle: "10s" },
    });
  });

  test("rejects CLI help and flag-shaped targets with usage", async () => {
    await expect(handler(ctx("cli", []))).resolves.toMatchObject({ ok: false, error: expect.stringContaining("usage: maw stream") });
    await expect(handler(ctx("cli", ["--help"]))).resolves.toMatchObject({ ok: false, error: expect.stringContaining("usage: maw stream") });
    await expect(handler(ctx("cli", ["--bad-target"]))).resolves.toMatchObject({ ok: false, error: expect.stringContaining("usage: maw stream") });
  });

  test("routes API args and reports handler errors", async () => {
    await expect(handler(ctx("api", {
      target: "api-pane",
      since: "1m",
      json: true,
      grep: "tick",
      quitOnIdle: "2s",
    }))).resolves.toEqual({ ok: true });
    expect(streamCalls.at(-1)).toEqual({
      target: "api-pane",
      opts: { since: "1m", json: true, grep: "tick", quitOnIdle: "2s" },
    });

    await expect(handler(ctx("api", {}))).resolves.toEqual({ ok: false, error: "target is required" });
    await expect(handler(ctx("cli", ["explode"]))).resolves.toEqual({ ok: false, error: "stream exploded" });
  });
});
