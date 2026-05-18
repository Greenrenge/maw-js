import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { _setDirs } from "../../src/vendor/mpr-plugins/cleanup/internal/team-helpers";
import type { TmuxPane } from "../../src/core/transport/tmux-class";

type CleanupModule = typeof import("../../src/vendor/mpr-plugins/cleanup/internal/team-cleanup-zombies");

const pane = (id: string, target: string, command = "claude", title = id): TmuxPane => ({
  id,
  target,
  command,
  title,
  session: target.split(":")[0] ?? "",
  window: target.split(":")[1]?.split(".")[0] ?? "",
});

describe("cleanup zombie pane classifier coverage", () => {
  const originalHome = process.env.HOME;
  let dir: string;
  let teamsDir: string;
  let cleanupModule: CleanupModule;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "maw-cleanup-zombies-"));
    teamsDir = join(dir, "teams");
    process.env.HOME = dir;
    _setDirs(teamsDir, join(dir, "tasks"));
    cleanupModule = await import("../../src/vendor/mpr-plugins/cleanup/internal/team-cleanup-zombies");
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    rmSync(dir, { recursive: true, force: true });
  });

  test("excludes team panes, view panes, primary panes, and linked safe pane ids", () => {
    mkdirSync(join(teamsDir, "live"), { recursive: true });
    writeFileSync(join(teamsDir, "live", "config.json"), JSON.stringify({
      name: "live",
      members: [
        { name: "kept", tmuxPaneId: "%team" },
        { name: "inline", tmuxPaneId: "in-process" },
        { name: "blank", tmuxPaneId: "" },
      ],
    }));
    mkdirSync(join(teamsDir, "broken"), { recursive: true });
    writeFileSync(join(teamsDir, "broken", "config.json"), "{not-json");

    mkdirSync(join(dir, ".config", "maw"), { recursive: true });
    writeFileSync(join(dir, ".config", "maw", "oracles.json"), JSON.stringify({
      oracles: [{ name: "registered" }, { name: "" }, { nope: "ignored" }],
    }));

    const { findZombiePanes } = cleanupModule;
    const zombies = findZombiePanes([
      pane("%team", "deleted-team:2.1", "claude", "known team pane"),
      pane("%view", "mawjs-view:1.0", "claude", "view pane"),
      pane("%linked", "other-view:2.0", "claude", "linked safe view"),
      pane("%linked", "deleted:2.0", "claude", "same linked pane id"),
      pane("%registry", "28-registered:4.1", "claude", "registered oracle"),
      pane("%primary-index", "random:1.0", "claude", "primary index"),
      pane("%primary-name", "random:some-oracle.0", "claude", "primary named"),
      pane("%shell", "random:2.2", "zsh", "not claude"),
      pane("%zombie", "deleted:2.3", "claude", "this is an orphaned agent pane with a long title that gets clipped"),
    ]);

    expect(zombies).toEqual([
      {
        paneId: "%registry",
        teamName: "unknown",
        info: '28-registered:4.1  "registered oracle"',
      },
      {
        paneId: "%zombie",
        teamName: "unknown",
        info: 'deleted:2.3  "this is an orphaned agent pane with a long title t"',
      },
    ]);
  });

  test("falls back cleanly when team and oracle registries are absent", () => {
    const { findZombiePanes } = cleanupModule;
    const zombies = findZombiePanes([
      pane("%view", "scratch-view:2.0"),
      pane("%primary", "scratch:1.0"),
      pane("%candidate", "scratch:3.1", "claude --dangerously-skip-permissions", "candidate"),
    ]);

    expect(zombies.map((z) => z.paneId)).toEqual(["%candidate"]);
    expect(zombies[0]?.info).toContain("candidate");
  });
});
