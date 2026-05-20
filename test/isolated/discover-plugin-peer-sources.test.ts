import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockConfigModule } from "../helpers/mock-config";
import type { DiscoveryError, DiscoveryResponse } from "../../src/vendor/mpr-plugins/peers/discovered";
import type { LoadedPlugin } from "../../src/plugin/types";
import type { FleetEntry } from "../../src/commands/shared/fleet-load";
import type { OracleManifestEntry } from "../../src/lib/oracle-manifest";

const configPath = import.meta.resolve("../../src/config");
const discoveredPath = import.meta.resolve("../../src/vendor/mpr-plugins/peers/discovered");
const sshPath = import.meta.resolve("../../src/core/transport/ssh");
const registryPath = import.meta.resolve("../../src/plugin/registry");
const repoDiscoveryPath = import.meta.resolve("../../src/core/repo-discovery");
const fleetLoadPath = import.meta.resolve("../../src/commands/shared/fleet-load");
const oracleManifestPath = import.meta.resolve("../../src/lib/oracle-manifest");

let configValue: Record<string, unknown> = {};
let discoveryResult: DiscoveryResponse | DiscoveryError;
let fetchCalls: Array<Record<string, unknown> | undefined> = [];
let pluginRows: LoadedPlugin[] = [];
let pluginError: Error | null = null;
let ghqPaths: string[] = [];
let ghqError: Error | null = null;
let fleetEntries: FleetEntry[] = [];
let fleetError: Error | null = null;
let manifestRows: OracleManifestEntry[] = [];
let manifestError: Error | null = null;
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

mock.module(registryPath, () => ({
  discoverPackages: () => {
    if (pluginError) throw pluginError;
    return pluginRows;
  },
}));

mock.module(repoDiscoveryPath, () => ({
  getRepos: () => ({
    name: "ghq",
    list: async () => {
      if (ghqError) throw ghqError;
      return ghqPaths;
    },
    listSync: () => ghqPaths,
    findBySuffix: async () => null,
    findBySuffixSync: () => null,
  }),
}));

mock.module(fleetLoadPath, () => ({
  loadFleetEntries: () => {
    if (fleetError) throw fleetError;
    return fleetEntries;
  },
}));

mock.module(oracleManifestPath, () => ({
  loadManifestCached: () => {
    if (manifestError) throw manifestError;
    return manifestRows;
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

function plugin(name: string, overrides: Partial<LoadedPlugin> = {}): LoadedPlugin {
  return {
    manifest: {
      name,
      version: "1.2.3",
      sdk: "^1.0.0",
      tier: "standard",
      weight: 12,
      cli: { command: name, aliases: [`${name}-alias`] },
      capabilities: ["sdk:identity"],
      dependencies: { plugins: ["base"] },
    },
    dir: `/plugins/${name}`,
    wasmPath: "",
    entryPath: `/plugins/${name}/index.ts`,
    kind: "ts",
    ...overrides,
  };
}

function fleetEntry(name: string, windows: FleetEntry["session"]["windows"], overrides: Partial<FleetEntry> = {}): FleetEntry {
  return {
    file: `50-${name}.json`,
    num: 50,
    groupName: name,
    session: {
      name: `50-${name}`,
      windows,
    },
    ...overrides,
  };
}

function oracle(name: string, overrides: Partial<OracleManifestEntry> = {}): OracleManifestEntry {
  return {
    name,
    sources: ["oracles-json"],
    repo: `Soul-Brews-Studio/${name}-oracle`,
    localPath: `/opt/Code/github.com/Soul-Brews-Studio/${name}-oracle`,
    hasPsi: true,
    hasFleetConfig: false,
    isLive: false,
    ...overrides,
  };
}

beforeEach(() => {
  configValue = {
    peers: ["http://config:3456"],
    namedPeers: [{ name: "named", url: "http://named:3456" }],
  };
  discoveryResult = discovery("http://scout:3456");
  fetchCalls = [];
  pluginRows = [];
  pluginError = null;
  ghqPaths = [];
  ghqError = null;
  fleetEntries = [];
  fleetError = null;
  manifestRows = [];
  manifestError = null;
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
    expect(parsed.plugins).toEqual({
      source: "plugin-registry",
      total: 0,
      records: [],
    });
    expect(parsed.fleet).toEqual({
      source: "fleet-config",
      total: 0,
      records: [],
    });
    expect(parsed.oracles).toEqual({
      source: "oracle-manifest",
      total: 0,
      records: [],
    });
    expect(parsed.ghq).toEqual({
      source: "ghq",
      total: 0,
      repos: [],
    });
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

  test("includes registered plugins in JSON output without changing peer totals", async () => {
    pluginRows = [plugin("buddy")];

    const result = await handler({ source: "cli", args: ["--peers", "config", "--json"] } as any);

    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.plugins.records).toEqual([{
      source: "plugin-registry",
      type: "plugin",
      name: "buddy",
      version: "1.2.3",
      kind: "ts",
      tier: "standard",
      weight: 12,
      disabled: false,
      dir: "/plugins/buddy",
      command: "buddy",
      aliases: ["buddy-alias"],
      capabilities: ["sdk:identity"],
      dependencies: ["base"],
    }]);
  });

  test("includes deduped fleet config workspaces in JSON and tree output", async () => {
    configValue = {
      namedPeers: [
        { name: "m5", url: "http://m5:3456" },
        { name: "white", url: "http://white:3456" },
      ],
      agents: {
        "mawjs-oracle": "m5",
        "white-oracle": "white",
      },
      node: "m5",
    };
    fleetEntries = [
      fleetEntry("mawjs", [
        { name: "mawjs-oracle", repo: "Soul-Brews-Studio/maw-js" },
        { name: "white-oracle", repo: "Soul-Brews-Studio/white-oracle" },
      ]),
      fleetEntry("mawjs-dupe", [
        { name: "mawjs-oracle", repo: "Soul-Brews-Studio/maw-js" },
      ], { file: "51-mawjs-dupe.json", num: 51, groupName: "mawjs-dupe" }),
    ];

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree", "--json"] } as any);

    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.fleet.total).toBe(2);
    expect(parsed.fleet.records).toEqual([
      {
        source: "fleet-config",
        type: "workspace",
        file: "50-mawjs.json",
        slot: 50,
        groupName: "mawjs",
        session: "50-mawjs",
        name: "mawjs-oracle",
        repo: "Soul-Brews-Studio/maw-js",
        node: "m5",
        endpoint: "http://m5:3456",
        peerMatched: true,
      },
      {
        source: "fleet-config",
        type: "workspace",
        file: "50-mawjs.json",
        slot: 50,
        groupName: "mawjs",
        session: "50-mawjs",
        name: "white-oracle",
        repo: "Soul-Brews-Studio/white-oracle",
        node: "white",
        endpoint: "http://white:3456",
        peerMatched: true,
      },
    ]);
    expect(parsed.tree.fleet.map((record: { name: string }) => record.name)).toEqual(["mawjs-oracle", "white-oracle"]);
  });

  test("renders fleet config text with configured-but-offline workspaces", async () => {
    configValue = {
      peers: [],
      namedPeers: [],
      agents: { "offline-oracle": "white" },
    };
    fleetEntries = [fleetEntry("offline", [{ name: "offline-oracle", repo: "Soul-Brews-Studio/offline-oracle" }])];

    const result = await handler({ source: "cli", args: ["--peers=config"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("fleet config");
    expect(result.output).toContain("offline-oracle");
    expect(result.output).toContain("offline");
  });

  test("includes registered oracle inventory joined with ghq, fleet, and peers", async () => {
    configValue = {
      namedPeers: [{ name: "mawjs", url: "http://m5:3456" }],
      agents: { "mawjs-oracle": "m5" },
    };
    ghqPaths = ["/opt/Code/github.com/Soul-Brews-Studio/maw-js"];
    fleetEntries = [fleetEntry("mawjs", [{ name: "mawjs-oracle", repo: "Soul-Brews-Studio/maw-js" }])];
    manifestRows = [
      oracle("mawjs", {
        sources: ["fleet", "agent", "oracles-json"],
        node: "m5",
        session: "50-mawjs",
        window: "mawjs-oracle",
        repo: "Soul-Brews-Studio/maw-js",
        localPath: "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
        hasFleetConfig: true,
      }),
    ];

    const result = await handler({ source: "cli", args: ["--peers", "config", "--json"] } as any);

    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.oracles.total).toBe(1);
    expect(parsed.oracles.records).toEqual([{
      source: "oracle-manifest",
      type: "oracle",
      name: "mawjs",
      sources: ["fleet", "agent", "oracles-json"],
      node: "m5",
      session: "50-mawjs",
      window: "mawjs-oracle",
      repo: "Soul-Brews-Studio/maw-js",
      localPath: "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
      hasPsi: true,
      hasFleetConfig: true,
      awake: false,
      ghqPath: "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
      worktree: false,
      fleetMatched: true,
      peerUrls: ["http://m5:3456"],
    }]);
  });

  test("dedupes duplicate registered oracle rows and joins tmux evidence in tree output", async () => {
    manifestRows = [
      oracle("mawjs", { sources: ["oracles-json"], window: "mawjs-oracle" }),
      oracle("mawjs", { sources: ["fleet"], window: "mawjs-oracle" }),
    ];
    sessions = [{
      name: "50-mawjs",
      windows: [{ index: 1, name: "mawjs-oracle", active: true }],
    }];

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree", "--json"] } as any);

    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.oracles.total).toBe(1);
    expect(parsed.tree.oracles).toHaveLength(1);
    expect(parsed.tree.oracles[0].awake).toBe(true);
  });

  test("renders registered oracle inventory in text output", async () => {
    manifestRows = [oracle("mother")];

    const result = await handler({ source: "cli", args: ["--peers=config"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("registered oracles");
    expect(result.output).toContain("mother");
    expect(result.output).toContain("oracles-json");
  });

  test("renders plugin registry in text output", async () => {
    pluginRows = [plugin("handover", { disabled: true })];

    const result = await handler({ source: "cli", args: ["--peers=config"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("plugin registry");
    expect(result.output).toContain("handover");
    expect(result.output).toContain("disabled");
  });

  test("includes deduped ghq repos in JSON and tree output", async () => {
    ghqPaths = [
      "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
      "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
      "/opt/Code/github.com/Soul-Brews-Studio/maw-js.wt-features",
    ];

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree", "--json"] } as any);

    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.output ?? "{}");
    expect(parsed.ghq.total).toBe(2);
    expect(parsed.ghq.repos).toEqual([
      {
        source: "ghq",
        type: "repo",
        path: "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
        name: "maw-js",
        owner: "Soul-Brews-Studio",
        host: "github.com",
        oracleLike: false,
        worktree: false,
      },
      {
        source: "ghq",
        type: "repo",
        path: "/opt/Code/github.com/Soul-Brews-Studio/maw-js.wt-features",
        name: "maw-js.wt-features",
        owner: "Soul-Brews-Studio",
        host: "github.com",
        oracleLike: false,
        worktree: true,
      },
    ]);
    expect(parsed.tree.ghq.map((repo: { path: string }) => repo.path)).toEqual([
      "/opt/Code/github.com/Soul-Brews-Studio/maw-js",
      "/opt/Code/github.com/Soul-Brews-Studio/maw-js.wt-features",
    ]);
  });

  test("renders ghq repos in text output", async () => {
    ghqPaths = ["/opt/Code/github.com/Soul-Brews-Studio/mother-oracle"];

    const result = await handler({ source: "cli", args: ["--peers=config"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("ghq repos");
    expect(result.output).toContain("mother-oracle");
    expect(result.output).toContain("yes");
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
    expect(parsed.plugins).toEqual({
      source: "plugin-registry",
      total: 0,
      records: [],
    });
    expect(parsed.fleet).toEqual({
      source: "fleet-config",
      total: 0,
      records: [],
    });
    expect(parsed.oracles).toEqual({
      source: "oracle-manifest",
      total: 0,
      records: [],
    });
    expect(parsed.ghq).toEqual({
      source: "ghq",
      total: 0,
      repos: [],
    });
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

  test("renders plugin registry warnings in tree output without crashing", async () => {
    pluginError = new Error("bad registry");

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("plugins (0 registered)");
    expect(result.output).toContain("warning: plugin registry unavailable (bad registry)");
  });

  test("renders fleet config warnings in tree output without crashing", async () => {
    fleetError = new Error("fleet missing");

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("fleet config (0 configured)");
    expect(result.output).toContain("warning: fleet config unavailable (fleet missing)");
  });

  test("renders oracle registry warnings in tree output without crashing", async () => {
    manifestError = new Error("manifest missing");

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("registered oracles (0)");
    expect(result.output).toContain("warning: oracle registry unavailable (manifest missing)");
  });

  test("renders ghq warnings in tree output without crashing", async () => {
    ghqError = new Error("ghq missing");

    const result = await handler({ source: "cli", args: ["--peers", "config", "--tree"] } as any);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("ghq (0 repos)");
    expect(result.output).toContain("warning: ghq unavailable (ghq missing)");
  });
});
