import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  __dreamImplCoverageHooks,
  extractSection,
  extractTitle,
  shareKeywords,
} from "../../src/vendor/mpr-plugins/dream/impl";

const originalCwd = process.cwd();
let tempDir = "";
let logs: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "maw-dream-hooks-"));
  process.chdir(tempDir);
  logs = [];
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
});

afterEach(() => {
  console.log = originalLog;
  process.chdir(originalCwd);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("coverage-100 vendor-a dream hooks", () => {
  test("renderDream covers focused/all detail, overflows, connections, and insights", () => {
    const pain = { category: "pain", title: "cache rebuild failure loop", detail: "long failure detail", source: "a", project: "alpha", confidence: "high", daysAgo: 0, action: "maw workon alpha" } as any;
    const plan = { category: "plan", title: "cache rebuild failure fix", detail: "plan detail", source: "b", project: "alpha", confidence: "medium", daysAgo: 5, action: "maw wake alpha" } as any;
    const gain = { category: "gain", title: "faster coverage runs", detail: "gain detail", source: "c", project: "beta", confidence: "low", daysAgo: 30 } as any;
    const many = Array.from({ length: 9 }, (_, index) => ({ ...pain, title: `cache rebuild failure loop ${index}`, daysAgo: index + 2 }));

    __dreamImplCoverageHooks.renderDream([...many, plan, gain], [{ from: pain, to: plan, relation: "has fix planned" }], ["Active: 2 repos"], { all: true, pain: true, plan: true, gain: true } as any);

    const rendered = logs.join("\n");
    expect(rendered).toContain("PAIN — blocking or broken");
    expect(rendered).toContain("PLAN — next steps from retros");
    expect(rendered).toContain("GAIN — shipped this period");
    expect(rendered).toContain("… 1 more");
    expect(rendered).toContain("Connections");
    expect(rendered).toContain("has fix planned");
    expect(rendered).toContain("Insights");
    expect(rendered).toContain("Active: 2 repos");
  });

  test("saveDream writes forgotten, warning, category, connection, and insight sections", () => {
    const item = { category: "plan", title: "Ship deterministic vendor tests", detail: "cover uncovered vendor branches", source: "s", project: "maw-js", confidence: "high", daysAgo: 1, action: "bun test" } as any;
    const path = __dreamImplCoverageHooks.saveDream(
      [item],
      [{ from: item, to: { ...item, title: "Coverage reaches target" }, relation: "unblocks" }],
      ["Coverage: vendor gaps reduced"],
      3,
      true,
      [{ text: "old next step", project: "legacy", daysAgo: 42, source: "x" }],
      [{ text: "active repo matches old warning", project: "maw-js", source: "y", daysAgo: 2 }],
    );

    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("Oracle KB**: connected");
    expect(content).toContain("## Forgotten");
    expect(content).toContain("old next step");
    expect(content).toContain("## Warnings");
    expect(content).toContain("active repo matches old warning");
    expect(content).toContain("## PLAN — next steps from retros");
    expect(content).toContain("Ship deterministic vendor tests");
    expect(content).toContain("## Connections");
    expect(content).toContain("unblocks");
    expect(content).toContain("## Insights");
  });

  test("pure extractors cover inline sections, generated titles, and keyword thresholds", () => {
    expect(extractSection("## Next Steps: finish the deterministic coverage tests now\n## Other\nignored", "Next Steps")).toContain("finish the deterministic");
    expect(extractTitle("short\nSummary: deterministic vendor coverage now passes", "/tmp/github.com/org/maw-js/2026-05-19_vendor-gap.md")).toBe("deterministic vendor coverage now passes");
    expect(shareKeywords("cache rebuild failure loop", "failure cache rebuild plan", 3)).toBe(true);
    expect(shareKeywords("cache rebuild", "different topic", 2)).toBe(false);
  });
});
