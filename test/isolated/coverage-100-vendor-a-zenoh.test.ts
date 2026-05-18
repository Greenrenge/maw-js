import { describe, expect, test } from "bun:test";
import {
  discoveryKey,
  readZenohScoutConfig,
  runZenohScout,
  type ZenohApi,
} from "../../src/vendor/mpr-plugins/zenoh-scout/impl";

class FakeConfig {
  constructor(public locator: string, public timeoutMs?: number) {}
}

class FakeKeyExpr {
  constructor(public key: string) {}
  toString() { return this.key; }
}

function replyFor(key: string) {
  return { result: () => ({ keyexpr: () => ({ toString: () => key }) }) };
}

describe("coverage-100 vendor-a zenoh scout gaps", () => {
  test("Session.open path advertises, filters local peers, sorts remotes, and always cleans up", async () => {
    const local = readZenohScoutConfig({ node: "m5", oracle: "codex", port: 3456, zenoh: { scout: { enabled: true, timeoutMs: 25 } } } as any);
    const beta = readZenohScoutConfig({ node: "beta", oracle: "zed", port: 4444, zenoh: { scout: { enabled: true } } } as any);
    const alpha = readZenohScoutConfig({ node: "alpha", oracle: "aaa", port: 5555, zenoh: { scout: { enabled: true } } } as any);
    const calls: string[] = [];
    const session = {
      liveliness() {
        return {
          async declareToken(key: FakeKeyExpr) {
            calls.push(`declare:${key}`);
            return { async undeclare() { calls.push("undeclare"); } };
          },
          async get(key: FakeKeyExpr, opts: Record<string, unknown>) {
            calls.push(`get:${key}:${opts.timeout}`);
            return (async function* () {
              yield replyFor(discoveryKey(local));
              yield replyFor(discoveryKey(beta));
              yield { result: () => "not-a-sample" };
              yield replyFor(discoveryKey(alpha));
            })();
          },
        };
      },
      async close() { calls.push("close"); },
    };
    const api: ZenohApi = {
      Config: FakeConfig,
      KeyExpr: FakeKeyExpr,
      Duration: { milliseconds: { of: (ms: number) => `duration:${ms}` } },
      Session: { open: async () => { calls.push("session-open"); return session as any; } },
    };

    const result = await runZenohScout(local, {
      importZenoh: async () => api,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.peers.map((p) => `${p.node}/${p.oracle}`)).toEqual(["alpha/aaa", "beta/zed"]);
    expect(calls).toEqual([
      "session-open",
      `declare:${discoveryKey(local)}`,
      "get:maw/discovery/v1/**:duration:25",
      "undeclare",
      "close",
    ]);
  });

  test("failed imports classify module and wasm failures while swallowing cleanup absence", async () => {
    const config = readZenohScoutConfig({ node: "m5", oracle: "codex", zenoh: { scout: { enabled: true } } } as any);

    const missing = await runZenohScout(config, { importZenoh: async () => { throw new Error("Cannot find module '@eclipse-zenoh/zenoh-ts'"); } });
    expect(missing).toMatchObject({ ok: false, error: "zenoh_unavailable", total: 0, peers: [] });
    expect(missing.hint).toContain("install @eclipse-zenoh/zenoh-ts");

    const wasm = await runZenohScout(config, { importZenoh: async () => { throw new Error("WebAssembly __wbindgen failed"); } });
    expect(wasm.error).toBe("zenoh_runtime_unsupported");
    expect(wasm.hint).toContain("failed to initialize");
  });
});
