import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import * as budStore from "../../src/vendor/mpr-plugins/bud/internal/peers-store";
import * as pairStore from "../../src/vendor/mpr-plugins/pair/internal/store";

const stores = [
  ["bud peers", budStore],
  ["pair peers", pairStore],
] as const;

describe.each(stores)("%s duplicate vendor store coverage", (_label, store) => {
  const originalPeersFile = process.env.PEERS_FILE;
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "maw-vendor-peer-store-extra-"));
    file = join(dir, "nested", "peers.json");
    process.env.PEERS_FILE = file;
  });

  afterEach(() => {
    if (originalPeersFile === undefined) delete process.env.PEERS_FILE;
    else process.env.PEERS_FILE = originalPeersFile;
    rmSync(dir, { recursive: true, force: true });
  });

  test("empty path, save/load, stale tmp cleanup, and mutate round-trip", () => {
    expect(store.peersPath()).toBe(file);
    expect(store.emptyStore()).toEqual({ version: 1, peers: {} });
    expect(store.loadPeers()).toEqual({ version: 1, peers: {} });

    store.savePeers({
      version: 1,
      peers: {
        alpha: { url: "http://alpha", node: "node-a", addedAt: "2026-05-18T00:00:00.000Z", lastSeen: null },
      },
    });
    writeFileSync(`${file}.tmp`, "stale", "utf-8");
    expect(store.loadPeers().peers.alpha.node).toBe("node-a");
    expect(existsSync(`${file}.tmp`)).toBe(false);

    const mutated = store.mutatePeers((data) => {
      data.peers.beta = { url: "http://beta", node: null, addedAt: "2026-05-18T01:00:00.000Z", lastSeen: null };
    });
    expect(Object.keys(mutated.peers).sort()).toEqual(["alpha", "beta"]);
    expect(readFileSync(file, "utf-8")).toContain("http://beta");
  });

  test("corrupt files and invalid shapes are moved aside or recovered from inside mutate", () => {
    store.savePeers({ version: 1, peers: {} });
    writeFileSync(file, "{not-json", "utf-8");
    expect(store.loadPeers()).toEqual({ version: 1, peers: {} });
    expect(existsSync(file)).toBe(false);

    store.savePeers({ version: 1, peers: {} });
    writeFileSync(file, JSON.stringify({ version: 1, peers: [] }), "utf-8");
    expect(store.loadPeers()).toEqual({ version: 1, peers: {} });
    expect(existsSync(file)).toBe(false);

    store.savePeers({ version: 1, peers: {} });
    writeFileSync(file, "not-json", "utf-8");
    const recovered = store.mutatePeers((data) => {
      data.peers.recovered = { url: "http://recovered", node: null, addedAt: "x", lastSeen: null };
    });
    expect(Object.keys(recovered.peers)).toEqual(["recovered"]);
    expect(store.loadPeers().peers.recovered.url).toBe("http://recovered");
  });

  test("clearStaleTmp is best-effort", () => {
    expect(() => store.clearStaleTmp()).not.toThrow();
    store.savePeers({ version: 1, peers: {} });
    writeFileSync(`${file}.tmp`, "leftover", "utf-8");
    expect(() => store.clearStaleTmp()).not.toThrow();
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});
