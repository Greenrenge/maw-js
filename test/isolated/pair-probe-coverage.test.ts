import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

let lookupImpl: (host: string) => Promise<unknown> = async () => ({ address: "127.0.0.1" });
let fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let fetchCalls: string[] = [];

const originalFetch = globalThis.fetch;

mock.module("dns/promises", () => ({
  lookup: (host: string) => lookupImpl(host),
}));

const {
  PROBE_EXIT_CODES,
  classifyProbeError,
  formatProbeError,
  isValidMawHandshake,
  pickHint,
  probePeer,
} = await import("../../src/vendor/mpr-plugins/pair/internal/probe.ts?pair-probe-coverage");

beforeEach(() => {
  lookupImpl = async () => ({ address: "127.0.0.1" });
  fetchCalls = [];
  fetchImpl = async () => new Response(JSON.stringify({ maw: true, node: "m5" }));
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push(String(input));
    return fetchImpl(input, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("pair probe classifiers and formatting", () => {
  test("classifies HTTP, DNS, refused, timeout, TLS, and unknown failures", () => {
    expect(classifyProbeError(new Response("nope", { status: 404 }))).toBe("HTTP_4XX");
    expect(classifyProbeError(new Response("boom", { status: 503 }))).toBe("HTTP_5XX");
    expect(classifyProbeError({ cause: { code: "EAI_AGAIN" } })).toBe("DNS");
    expect(classifyProbeError({ code: "ConnectionRefused" })).toBe("REFUSED");
    expect(classifyProbeError({ name: "AbortError" })).toBe("TIMEOUT");
    expect(classifyProbeError({ code: "CERT_HAS_EXPIRED" })).toBe("TLS");
    expect(classifyProbeError("wat")).toBe("UNKNOWN");
    expect(PROBE_EXIT_CODES.TIMEOUT).toBe(5);
  });

  test("validates handshake shapes and formats actionable hints", () => {
    expect(isValidMawHandshake(true)).toBe(true);
    expect(isValidMawHandshake({ schema: "1" })).toBe(true);
    expect(isValidMawHandshake({})).toBe(false);
    expect(isValidMawHandshake("yes")).toBe(false);

    const mdns = { code: "DNS" as const, message: "query ENOTIMP white.local", at: "now" };
    expect(pickHint(mdns)).toContain("avahi-daemon");
    const formatted = formatProbeError(mdns, "http://white.local:3456/base", "white");
    expect(formatted).toContain("peer handshake failed");
    expect(formatted).toContain("host: white.local:3456");
    expect(formatted).toContain("retry: maw peers probe white");
  });
});

describe("probePeer", () => {
  test("returns node/name fallback, nullable nickname, pubkey, and default-oracle identity on success", async () => {
    fetchImpl = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/info") {
        return Response.json({ maw: { schema: "1" }, name: "peer-node", nickname: "" });
      }
      if (path === "/api/identity") {
        return Response.json({ pubkey: "pub-123", node: "peer-node" });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await probePeer("http://127.0.0.1:3456", 25);

    expect(result).toEqual({
      node: "peer-node",
      nickname: null,
      pubkey: "pub-123",
      identity: { oracle: "mawjs", node: "peer-node" },
    });
    expect(fetchCalls.map(u => new URL(u).pathname)).toEqual(["/info", "/api/identity"]);
  });

  test("keeps successful /info probe when identity endpoint is absent or malformed", async () => {
    fetchImpl = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/info") return Response.json({ maw: true, node: "legacy", nickname: "Legacy Peer" });
      return new Response("missing", { status: 404 });
    };
    expect(await probePeer("http://127.0.0.1:3456", 25)).toEqual({ node: "legacy", nickname: "Legacy Peer" });

    fetchImpl = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/info") return Response.json({ maw: true, node: "legacy" });
      return new Response("not-json");
    };
    expect(await probePeer("http://127.0.0.1:3456", 25)).toEqual({ node: "legacy", nickname: null });
  });

  test("returns structured failures for DNS, HTTP, invalid JSON, missing maw, and missing node", async () => {
    lookupImpl = async () => {
      const err = new Error("getaddrinfo ENOTFOUND missing.local") as Error & { code: string };
      err.code = "ENOTFOUND";
      throw err;
    };
    const dns = await probePeer("http://missing.local:3456", 25);
    expect(dns.node).toBeNull();
    expect(dns.error?.code).toBe("DNS");
    expect(fetchCalls).toEqual([]);

    lookupImpl = async () => ({ address: "127.0.0.1" });
    fetchImpl = async () => new Response("server down", { status: 503 });
    const http = await probePeer("http://127.0.0.1:3456", 25);
    expect(http).toMatchObject({ node: null, error: { code: "HTTP_5XX", message: "HTTP 503 from http://127.0.0.1:3456/info" } });

    fetchImpl = async () => new Response("not-json");
    const invalidJson = await probePeer("http://127.0.0.1:3456", 25);
    expect(invalidJson).toMatchObject({ node: null, error: { code: "BAD_BODY", message: "/info body was not valid JSON" } });

    fetchImpl = async () => Response.json({ node: "not-maw" });
    const missingMaw = await probePeer("http://127.0.0.1:3456", 25);
    expect(missingMaw).toMatchObject({ node: null, error: { code: "BAD_BODY", message: '/info response missing valid "maw" handshake field' } });

    fetchImpl = async () => Response.json({ maw: true, nickname: "nameless" });
    const missingNode = await probePeer("http://127.0.0.1:3456", 25);
    expect(missingNode).toMatchObject({ node: null, error: { code: "BAD_BODY", message: '/info response had neither "node" nor "name" string' } });
  });

  test("classifies fetch throws with message fallback and timeout names", async () => {
    fetchImpl = async () => {
      const err = new Error("connect ECONNREFUSED") as Error & { cause: { code: string } };
      err.cause = { code: "ECONNREFUSED" };
      throw err;
    };
    const refused = await probePeer("http://127.0.0.1:3456", 25);
    expect(refused).toMatchObject({ node: null, error: { code: "REFUSED", message: "connect ECONNREFUSED" } });

    fetchImpl = async () => {
      const err = new Error("deadline") as Error & { name: string };
      err.name = "TimeoutError";
      throw err;
    };
    const timeout = await probePeer("http://127.0.0.1:3456", 25);
    expect(timeout.error?.code).toBe("TIMEOUT");
  });
});
