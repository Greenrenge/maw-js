import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { MawConfig } from "../src/config";
import type { Session } from "../src/core/runtime/find-window";

// Keep these default-suite cases hermetic: routing.ts imports resolveFleetSession(),
// which reads FLEET_DIR at module-load time via MAW_CONFIG_DIR.
const previousMawConfigDir = process.env.MAW_CONFIG_DIR;
const configDir = mkdtempSync(join(tmpdir(), "maw-routing-default-"));
const fleetDir = join(configDir, "fleet");
mkdirSync(fleetDir, { recursive: true });
process.env.MAW_CONFIG_DIR = configDir;

const fleetSession = {
  name: "72-starlight",
  windows: [
    { name: "starlight-oracle" },
  ],
};
writeFileSync(join(fleetDir, "starlight.json"), JSON.stringify(fleetSession));

const { resolveTarget } = await import("../src/core/routing");

afterAll(() => {
  if (previousMawConfigDir === undefined) {
    delete process.env.MAW_CONFIG_DIR;
  } else {
    process.env.MAW_CONFIG_DIR = previousMawConfigDir;
  }
  rmSync(configDir, { recursive: true, force: true });
});

const BASE_CONFIG: MawConfig = {
  host: "local",
  port: 3456,
  ghqRoot: "/tmp/ghq",
  oracleUrl: "http://localhost:47779",
  env: {},
  commands: { default: "claude" },
  sessions: {},
  node: "m5",
  namedPeers: [],
  agents: {},
  peers: [],
};

const win = (index: number, name: string) => ({ index, name, active: true });

function config(overrides: Partial<MawConfig> = {}): MawConfig {
  return { ...BASE_CONFIG, ...overrides };
}

describe("resolveTarget default routing branches", () => {
  test("fleet-known bare aliases route to the named oracle window instead of the first helper window", () => {
    const sessions: Session[] = [
      { name: "72-starlight", windows: [win(1, "starlight-issuer"), win(4, "starlight-oracle")] },
    ];

    expect(resolveTarget("starlight", BASE_CONFIG, sessions)).toEqual({
      type: "local",
      target: "72-starlight:4",
    });
  });

  test("self-node prefixes use the fleet window resolver before generic local matching", () => {
    const sessions: Session[] = [
      { name: "72-starlight", windows: [win(1, "starlight-issuer"), win(4, "starlight-oracle")] },
    ];

    expect(resolveTarget("m5:starlight", BASE_CONFIG, sessions)).toEqual({
      type: "self-node",
      target: "72-starlight:4",
    });
  });

  test("fleet-known single-window sessions keep the legacy one-window fallback", () => {
    const sessions: Session[] = [
      { name: "72-starlight", windows: [win(9, "starlight-shell")] },
    ];

    expect(resolveTarget("starlight", BASE_CONFIG, sessions)).toEqual({
      type: "local",
      target: "72-starlight:9",
    });
  });

  test("fleet-known multi-window sessions without an oracle window refuse first-window defaulting", () => {
    const sessions: Session[] = [
      { name: "72-starlight", windows: [win(1, "starlight-issuer"), win(2, "notes")] },
    ];

    const result = resolveTarget("starlight", BASE_CONFIG, sessions);
    expect(result).toMatchObject({
      type: "error",
      hint: "candidates: 72-starlight:1 (starlight-issuer), 72-starlight:2 (notes)",
    });
    if (result?.type === "error") {
      // In a full-suite run routing.ts may already be module-cached before this
      // file points MAW_CONFIG_DIR at its temp fleet fixture; both paths must
      // still refuse the unsafe first-window fallback. A fresh targeted run hits
      // the fleet_window_not_found branch covered by this file.
      expect(["fleet_window_not_found", "session_window_not_found"]).toContain(result.reason);
      expect(result.detail).toContain("'starlight-oracle'");
      expect(result.detail).toContain("refusing to default to the first window");
    }
  });

  test("missing config.node defaults self-node checks to local", () => {
    const { node: _node, ...withoutNode } = BASE_CONFIG;

    expect(resolveTarget("local:ghost", withoutNode, [])).toEqual({
      type: "error",
      reason: "self_not_running",
      detail: "'ghost' not found in local sessions on local",
      hint: "maw wake ghost",
    });
  });

  test("agents-map peer routing can use the legacy peers array when namedPeers is empty", () => {
    expect(resolveTarget("homekeeper", config({ agents: { homekeeper: "mba" }, peers: ["http://mba.wg:3457"] }), [])).toEqual({
      type: "peer",
      peerUrl: "http://mba.wg:3457",
      target: "homekeeper",
      node: "mba",
    });
  });
});
