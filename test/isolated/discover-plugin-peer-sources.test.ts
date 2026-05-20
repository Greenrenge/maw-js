import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockConfigModule } from "../helpers/mock-config";
import type { DiscoveryError, DiscoveryResponse } from "../../src/vendor/mpr-plugins/peers/discovered";

const configPath = import.meta.resolve("../../src/config");
const discoveredPath = import.meta.resolve("../../src/vendor/mpr-plugins/peers/discovered");
const sshPath = import.meta.resolve("../../src/core/transport/ssh");

let configValue: Record<string, unknown> = {};
let discoveryResult: DiscoveryResponse | DiscoveryError;
let fetchCalls: Array<Record<string, unknown> | undefined> = [];
let sessions: Array<{
  name: string;
  windows: Array<{ index: number; name: string; active: boolean }>;
}> = [];
let sessionsError: Error | null = null;

mock.module(configPath, () => ({
  ...mockConfigModule(() => configValue as never),
}));

mock.module(discoveredPath, () => ({
  fetchDiscoveries: async (opts?: Record<string, unknown>) => {
    fetchCalls.push(opts);
    return discoveryResult;
  },
}));

mock.module(sshPath, () => ({
  listSessions: async () => {
    if (sessionsError) throw sessionsError;
    return sessions;
  },
}));

const { command, default: handler } = await import("../../src/commands/plugins/discover/index.ts?discover-plugin-peer-sources");

function discovery(url: string, node = "scout-node"): DiscoveryResponse {
  return {
    ok: true,
    total: 1,
    shown: 1,
    filtered: false,
    peers: [{
      zid: "z1",
      node,
      oracle: "mawjs",
      host: "scout-host",
      locators: [url],
      capabilities: ["send"],
      oracles: ["mawjs"],
      firstSeen: "2026-05-20T00:00:00.000Z",
      lastSeen: "2026-05-20T00:00:01.000Z",
      seenRel: "now",
      paired: false,
    }],
  };
}

beforeEach(() => {
  configValue = {
    peers: ["http://config:3456"],
    namedPeers: [{ name: "named", url: "http://named:3456" }],
  };
  discoveryResult = discovery("http://scout:3456");
  fetchCalls = [];
  sessions = [];
  sessionsError = null;
});

describe("discover plugin peer-source integration (#1808)", () => {
  test("exports command metadata", () => {
    expect(command).toEqual({
      name: "discover",
      description: "List configured and discovered federation peers.",
    });
  });

  test("rejects invalid peer-source mode before loading peers", async () => {
    const result = await handler({ source: "cli", args: ["--peers", "bogus"] } as any);

    expect(result).toEqual({
      ok: false,
      error: "invalid_peer_source",
      output: "usage: maw discover [--peers config|scout|both] [--json] [--tree] [--awake]",
    });
    expect(fetchCalls).toEqual([]);
  });

  test("renders text output for inline scout mode", async () => {
    const result = await handler({ source: "cli", args: ["--peers=scout"] } as any);

    expect(fetchCalls).toEqual([{ all: true }]);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("scout-node");
    expect(result.output).toContain("http://scout:3456");
  });

  test("renders config-only JSON without calling scout", async () => {
    const result = await handler({ source: "cli", args: ["--peers", "config", "--json"] } as any);

    expect(fetchCalls).toEqual([]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.mode).toBe("config");
    expect(parsed.total).toBe(2);
    expect(parsed.peers.map((peer: { url: string }) => peer.url)).toEqual(["http://config:3456", "http://named:3456"]);
  });

  test("API source writes JSON and defaults to both mode", async () => {
    const writes: string[] = [];

    const result = await handler({
      source: "api",
      args: { json: true },
      writer: (...args: unknown[]) => writes.push(args.map(String).join(" ")),
    } as any);

    expect(result).toEqual({ ok: true, output: undefined });
    expect(fetchCalls).toEqual([{ all: true }]);
    const parsed = JSON.parse(writes[0]);
    expect(parsed.mode).toBe("both");
    expect(parsed.total).toBe(3);
  });

  test("API source accepts string false json and renders warnings in text", async () => {
    const writes: string[] = [];
    discoveryResult = {
      ok: false,
      error: "daemon_unreachable",
      hint: "is maw serve running?",
    };

    const result = await handler({
      source: "api",
      args: { peers: "both", json: "off" },
      writer: (...args: unknown[]) => writes.push(args.map(String).join(" ")),
    } as any);

    expect(result).toEqual({ ok: true, output: undefined });
    expect(writes.join("\n")).toContain("warning: scout unavailable");
  });

  test("renders discover tree with tmux live-state in JSON", async () => {
    sessions = [{
      name: "50-mawjs",
      windows: [
        { index: 1, name: "mawjs-oracle", active: true },
        { index: 2, name: "mawjs-codex", active: false },
      ],
    }];

    const result = await handler({
      source: "cli",
      args: ["--peers", "both", "--json", "--tree", "--awake"],
    } as any);

    expect(fetchCalls).toEqual([{ all: true }]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.mode).toBe("both");
    expect(parsed.awakeOnly).toBe(true);
    expect(parsed.total).toBe(4);
    expect(parsed.live).toEqual({
      source: "tmux",
      total: 1,
      sessions: [{
        source: "tmux",
        name: "50-mawjs",
        awake: true,
        windowCount: 2,
        windows: [
          { index: 1, name: "mawjs-oracle", active: true, target: "50-mawjs:1" },
          { index: 2, name: "mawjs-codex", active: false, target: "50-mawjs:2" },
        ],
      }],
    });
    expect(parsed.tree.live[0].name).toBe("50-mawjs");
    expect(parsed.tree.peers.map((peer: { url: string }) => peer.url)).toEqual([
      "http://config:3456",
      "http://named:3456",
      "http://scout:3456",
    ]);
  });

  test("renders awake-only text from tmux sessions", async () => {
    sessions = [{
      name: "23-discord-admin",
      windows: [{ index: 1, name: "discord-oracle", active: true }],
    }];

    const result = await handler({ source: "cli", args: ["--awake"] } as any);

    expect(result.ok).toBe(true);
    expect(fetchCalls).toEqual([]);
    expect(result.output).toContain("session");
    expect(result.output).toContain("23-discord-admin");
    expect(result.output).not.toContain("http://config:3456");
  });

  test("renders awake JSON with tmux warning when live-state is unavailable", async () => {
    sessionsError = new Error("tmux missing");

    const result = await handler({ source: "cli", args: ["--awake", "--json"] } as any);

    expect(result.ok).toBe(true);
    expect(fetchCalls).toEqual([]);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.live.total).toBe(0);
    expect(parsed.live.sessions).toEqual([]);
    expect(parsed.warnings).toEqual(["tmux unavailable (tmux missing)"]);
  });
});
