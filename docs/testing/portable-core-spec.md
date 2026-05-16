# Portable core behavioral specs

Issue: #1612

maw-js is currently TypeScript/Bun, but several subsystems are pure logic and can be specified with data fixtures that another implementation language can consume. The portable spec shape is:

1. Store behavior as JSON fixtures under `test/spec/*.fixtures.json`.
2. Keep each fixture to input data and expected output only; no Bun mocks, tmux handles, filesystem paths, or TypeScript-only object identity.
3. Run the fixtures from TypeScript tests today, and reuse the same JSON from a Rust/Go/etc. port later.

## Phase 2 portable-core map

| Candidate | Current status | Fixture suitability | Notes |
| --- | --- | --- | --- |
| `src/core/matcher/resolve-target.ts` | Pure logic | Ready | First fixture set added in `test/spec/matcher-resolve-target.fixtures.json`. Covers exact, suffix, prefix/middle, substring hints, numeric fleet-session guard, and worktree behavior. |
| `src/core/matcher/normalize-target.ts` | Pure logic | Ready | Small next candidate; can be fixture-backed without platform dependencies. |
| `scripts/calver.ts` | Mostly pure version arithmetic plus git/tag IO | Extract first | Move/calibrate pure HHMM/version arithmetic behind fixtureable helpers before port validation. |
| Plugin tier/default-active policy | Pure policy tables plus profile IO | Ready for policy fixtures | `src/plugin/default-active.ts` and `src/plugin/tier.ts` are good candidates; profile migration tests stay platform-specific. |
| Routing aliases (`src/core/routing.ts`) | Mixed pure resolver + config/tmux adapters | Extract first | Fixture the input graph (`localNode`, sessions, peers, agents) and expected route/error once IO adapters are separated. |
| Worktree scan (`src/core/fleet/worktrees-scan.ts`) | Mixed classification + `hostExec`/filesystem | Extract first | The #1553 matching rule is portable; shell/git discovery is platform layer. |
| Transport router (`src/core/transport/transport.ts`) | Pure orchestration over transport interface | Ready-ish | Fixtures can cover route selection/failover if represented as deterministic transport outcomes. |

## First spec: matcher resolve-target

The first committed portable spec is the matcher fixture set:

- Fixture data: `test/spec/matcher-resolve-target.fixtures.json`
- TS runner: `test/spec/matcher-resolve-target.fixtures.test.ts`
- Script: `bun run test:spec`

The JSON intentionally records only string item names and simple expected shapes:

```json
{
  "name": "session numeric-prefix guard blocks middle-segment false match",
  "mode": "session",
  "input": { "target": "mawjs", "items": ["114-mawjs-no2"] },
  "expected": { "kind": "none", "hints": ["114-mawjs-no2"] }
}
```

A non-TypeScript port should implement the same resolver contract and assert the same JSON produces the same portable result shape.

## Boundaries

Portable fixtures are **not** a replacement for integration tests. They should define behavior for modules whose decisions can be expressed as stable input/output data. Tmux, Bun.serve, filesystem, network, GitHub, and plugin process lifecycle remain platform-layer tests.
