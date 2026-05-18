import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  DEFAULT_STALE_TTL_MS,
  clearStaleTmp,
  emptyStore,
  getStaleTtlMs,
  isStale,
  loadPeers,
  mutatePeers,
  peersPath,
  savePeers,
  staleAgeMs,
} from "../../src/vendor/mpr-plugins/peers/store";

describe("vendor peers store coverage", () => {
  const originalPeersFile = process.env.PEERS_FILE;
  const originalTtl = process.env.MAW_PEER_STALE_TTL_MS;
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "maw-vendor-peers-store-"));
    file = join(dir, "nested", "peers.json");
    process.env.PEERS_FILE = file;
    delete process.env.MAW_PEER_STALE_TTL_MS;
  });

  afterEach(() => {
    if (originalPeersFile === undefined) delete process.env.PEERS_FILE;
    else process.env.PEERS_FILE = originalPeersFile;

    if (originalTtl === undefined) delete process.env.MAW_PEER_STALE_TTL_MS;
    else process.env.MAW_PEER_STALE_TTL_MS = originalTtl;

    rmSync(dir, { recursive: true, force: true });
  });

  test("path, empty store, stale tmp cleanup, save, and load round-trip", () => {
    expect(peersPath()).toBe(file);
    expect(emptyStore()).toEqual({ version: 1, peers: {} });
    expect(loadPeers()).toEqual({ version: 1, peers: {} });

    savePeers({
      version: 1,
      peers: {
        alpha: {
          url: "http://alpha.local:3210",
          node: "alpha-node",
          addedAt: "2026-05-18T00:00:00.000Z",
          lastSeen: null,
          nickname: "Alpha",
          identity: { oracle: "alpha", node: "alpha-node" },
        },
      },
    });
    writeFileSync(`${file}.tmp`, "stale partial write");

    expect(existsSync(`${file}.tmp`)).toBe(true);
    expect(loadPeers().peers.alpha).toMatchObject({ node: "alpha-node", nickname: "Alpha" });
    expect(existsSync(`${file}.tmp`)).toBe(false);
    expect(readFileSync(file, "utf-8")).toContain("alpha-node");
  });

  test("invalid JSON and invalid shapes are moved aside while callers get an empty store", () => {
    savePeers({ version: 1, peers: {} });
    writeFileSync(file, "{not-json");
    expect(loadPeers()).toEqual({ version: 1, peers: {} });
    expect(existsSync(file)).toBe(false);
    expect(loadPeers()).toEqual({ version: 1, peers: {} });

    savePeers({ version: 1, peers: {} });
    writeFileSync(file, JSON.stringify({ version: 1, peers: [] }));
    expect(loadPeers()).toEqual({ version: 1, peers: {} });
    expect(existsSync(file)).toBe(false);
  });

  test("mutatePeers reads inside the lock and tolerates malformed existing contents", () => {
    savePeers({ version: 1, peers: { before: { url: "http://before", node: null, addedAt: "bad", lastSeen: null } } });

    const first = mutatePeers((data) => {
      data.peers.after = {
        url: "http://after",
        node: "after-node",
        addedAt: "2026-05-18T00:00:00.000Z",
        lastSeen: "2026-05-18T01:00:00.000Z",
      };
    });
    expect(Object.keys(first.peers).sort()).toEqual(["after", "before"]);
    expect(loadPeers().peers.after.node).toBe("after-node");

    writeFileSync(file, JSON.stringify({ peers: [] }));
    const recovered = mutatePeers((data) => {
      data.peers.recovered = { url: "http://recovered", node: null, addedAt: "x", lastSeen: null };
    });
    expect(Object.keys(recovered.peers)).toEqual(["recovered"]);
    expect(loadPeers().peers.recovered.url).toBe("http://recovered");
  });

  test("TTL helpers cover env parsing, timestamp selection, clamping, and invalid provenance", () => {
    expect(getStaleTtlMs()).toBe(DEFAULT_STALE_TTL_MS);
    process.env.MAW_PEER_STALE_TTL_MS = "1234";
    expect(getStaleTtlMs()).toBe(1234);
    process.env.MAW_PEER_STALE_TTL_MS = "0";
    expect(getStaleTtlMs()).toBe(DEFAULT_STALE_TTL_MS);
    process.env.MAW_PEER_STALE_TTL_MS = "not-a-number";
    expect(getStaleTtlMs()).toBe(DEFAULT_STALE_TTL_MS);

    const now = Date.parse("2026-05-18T12:00:00.000Z");
    expect(staleAgeMs({ url: "u", node: null, addedAt: "2026-05-18T11:59:50.000Z", lastSeen: null }, now)).toBe(10_000);
    expect(staleAgeMs({ url: "u", node: null, addedAt: "2026-05-18T00:00:00.000Z", lastSeen: "2026-05-18T12:00:05.000Z" }, now)).toBe(0);
    expect(staleAgeMs({ url: "u", node: null, addedAt: "not-date", lastSeen: null }, now)).toBeNull();

    expect(isStale({ url: "u", node: null, addedAt: "2026-05-18T11:59:50.000Z", lastSeen: null }, 9_999, now)).toBe(true);
    expect(isStale({ url: "u", node: null, addedAt: "2026-05-18T11:59:50.000Z", lastSeen: null }, 10_000, now)).toBe(false);
    expect(isStale({ url: "u", node: null, addedAt: "not-date", lastSeen: null }, 10_000, now)).toBe(true);
  });

  test("explicit stale cleanup ignores missing and unlink-hostile tmp files", () => {
    expect(() => clearStaleTmp()).not.toThrow();
    savePeers({ version: 1, peers: {} });
    writeFileSync(`${file}.tmp`, "leftover");
    expect(() => clearStaleTmp()).not.toThrow();
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});
