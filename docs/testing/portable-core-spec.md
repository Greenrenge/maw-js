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
| `src/core/matcher/normalize-target.ts` | Pure logic | Ready | Fixture set added in `test/spec/normalize-target.fixtures.json`. Covers whitespace trimming, trailing slash cleanup, trailing `/.git` cleanup, and non-normalized interior/case behavior. |
| `scripts/calver.ts` | Pure version arithmetic plus git/tag/package IO | Ready | Fixture set added in `test/spec/calver.fixtures.json`. Covers date base, HHMM stamp, tag/package suffix parsing, effective base, ghost-date guard, next-calendar base, and full `computeVersion` outcomes; git/package IO stays platform-layer. |
| Plugin tier/default-active policy | Pure policy tables plus profile IO | Ready | Fixture set added in `test/spec/plugin-policy.fixtures.json`. Covers tier constants, weight boundaries, default-active groups, and migration keys; profile migration tests stay platform-specific. |
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

## Second spec: matcher normalize-target

The second portable spec covers the target-name cleanup helper:

- Fixture data: `test/spec/normalize-target.fixtures.json`
- TS runner: `test/spec/normalize-target.fixtures.test.ts`
- Script: `bun run test:spec`

The JSON records only raw user input strings and normalized output strings:

```json
{
  "name": "trailing .git directory followed by slash is stripped",
  "input": "token-oracle/.git/",
  "expected": "token-oracle"
}
```

A port should preserve the same limited scope: trim surrounding whitespace,
strip trailing slashes and terminal `/.git`, but do not lowercase, parse URLs,
or mutate interior characters.


## Third spec: plugin policy

The third portable spec covers pure plugin policy used by the loader and profile
migrations:

- Fixture data: `test/spec/plugin-policy.fixtures.json`
- TS runner: `test/spec/plugin-policy.fixtures.test.ts`
- Script: `bun run test:spec`

The JSON records tier constants, `weightToTier` thresholds, and default-active
plugin groups with their migration keys:

```json
{
  "name": "standard threshold starts at ten",
  "weight": 10,
  "expected": "standard"
}
```

A port should preserve the same tier boundaries (`<10`, `<50`, `>=50`) and the
same explicit default-active plugin policy. Filesystem-backed profile migration
and plugin discovery remain platform-layer tests.


## Fourth spec: calver arithmetic

The fourth portable spec captures the pure CalVer behavior behind alpha/beta
suffixes and anti-downgrade rules:

- Fixture data: `test/spec/calver.fixtures.json`
- TS runner: `test/spec/calver.fixtures.test.ts`
- Script: `bun run test:spec`

The JSON represents dates as local-naive parts so another language can construct
an equivalent wall-clock timestamp without inheriting JavaScript object details:

```json
{
  "name": "post-midnight package downgrade rolls base forward",
  "args": { "stable": false, "now": { "year": 2026, "month": 5, "day": 16, "hour": 0, "minute": 27 } },
  "packageVersion": "26.5.16-alpha.2356",
  "expected": "26.5.17-alpha.27"
}
```

A port should preserve the HHMM invariant: suffixes are wall-clock stamps between
`0` and `2359`; when a same-base suffix would downgrade after midnight, roll the
CalVer base forward instead of emitting monotonic values such as `2360`.

## Boundaries

Portable fixtures are **not** a replacement for integration tests. They should define behavior for modules whose decisions can be expressed as stable input/output data. Tmux, Bun.serve, filesystem, network, GitHub, and plugin process lifecycle remain platform-layer tests.
