/** @maw-test-isolate @maw-test-isolate-cwd-neutral */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

const CONFIG_DIR = mkdtempSync(join(tmpdir(), "maw-lib-oracle-members-"));
process.env.MAW_CONFIG_DIR = CONFIG_DIR;

const { filterMembers, getOracleMembers, loadOracleRegistry } = await import(
  "../../src/lib/oracle-members.ts?lib-oracle-members-coverage"
);

function registryPath(team: string): string {
  return join(CONFIG_DIR, "teams", team, "oracle-members.json");
}

function writeRegistry(team: string, body: unknown): void {
  const path = registryPath(team);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

beforeEach(() => {
  rmSync(join(CONFIG_DIR, "teams"), { recursive: true, force: true });
});

afterAll(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true });
  delete process.env.MAW_CONFIG_DIR;
});

describe("lib oracle-members coverage", () => {
  test("loadOracleRegistry is fail-soft for absent and malformed registries", () => {
    expect(loadOracleRegistry("missing")).toBeNull();

    writeRegistry("broken", "{not-json");

    expect(loadOracleRegistry("broken")).toBeNull();
    expect(getOracleMembers("broken", "lead")).toEqual([]);
  });

  test("getOracleMembers loads members and filters current sender by default", () => {
    writeRegistry("alchemy", {
      name: "alchemy",
      createdAt: "2026-05-18T00:00:00.000Z",
      members: [
        { oracle: "lead", role: "lead", addedAt: "2026-05-18T00:00:00.000Z" },
        { oracle: "builder", role: "builder", addedAt: "2026-05-18T00:00:00.000Z" },
      ],
    });

    expect(loadOracleRegistry("alchemy")?.name).toBe("alchemy");
    expect(getOracleMembers("alchemy")).toEqual(["lead", "builder"]);
    expect(getOracleMembers("alchemy", "lead")).toEqual(["builder"]);
  });

  test("filterMembers honors explicit include-self and no-current-oracle branches", () => {
    const members = [
      { oracle: "lead", role: "lead", addedAt: "2026-05-18T00:00:00.000Z" },
      { oracle: "reviewer", role: "reviewer", addedAt: "2026-05-18T00:00:00.000Z" },
    ];

    expect(filterMembers(members, true, "lead")).toEqual(["reviewer"]);
    expect(filterMembers(members, undefined, "lead")).toEqual(["reviewer"]);
    expect(filterMembers(members, false, "lead")).toEqual(["lead", "reviewer"]);
    expect(filterMembers(members, undefined)).toEqual(["lead", "reviewer"]);
  });

  test("registry excludeSelf=false keeps the sender in fan-out results", () => {
    writeRegistry("inclusive", {
      name: "inclusive",
      createdAt: "2026-05-18T00:00:00.000Z",
      excludeSelf: false,
      members: [
        { oracle: "lead", role: "lead", addedAt: "2026-05-18T00:00:00.000Z" },
        { oracle: "reviewer", role: "reviewer", addedAt: "2026-05-18T00:00:00.000Z" },
      ],
    });

    expect(getOracleMembers("inclusive", "lead")).toEqual(["lead", "reviewer"]);
  });
});
