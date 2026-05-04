# Docker Runbook — `maw serve` in a Container

Step-by-step to deploy `maw serve` via docker-compose. Validated end-to-end on
2026-05-05 during the /loop session that produced this feature.

## Prerequisites

- Docker 20.10+ (tested with 29.4.1)
- maw-js installed locally (`bun link`)

## 1. Generate compose

```bash
cd ~/Code/github.com/Soul-Brews-Studio/maw-js
maw fleet compose --output docker-compose.yml --port 3456
```

Output: 33-line `docker-compose.yml` with one `maw-serve` service.

## 2. Validate (optional but recommended)

```bash
maw fleet compose --validate
```

Runs `docker compose config --quiet` against generated YAML.
Expected: `✓ generated YAML validates with docker compose`.

## 3. Build + Start

```bash
docker compose up -d
```

First build: ~60s (downloads `oven/bun:1.3-alpine`, clones `maw-plugin-registry`,
installs `bun install`).

## 4. Verify

```bash
curl -s http://localhost:3456/api/health
```

Expected JSON output:
```json
{
  "ok": true,
  "output": "
    ● tmux server     running
    ● maw server      online (:3456, ...)
    ● disk /tmp       <free>
    ● memory          <available>MB available
    ● pm2 maw         pm2 not available
    ○ peers           none configured
"
}
```

## 5. Tear down

```bash
docker compose down
```

Volumes (`claude-config`, `maw-config`, `code-repos`, `maw-plugins`) persist
unless you add `-v`.

## What's in the image

Built from `Dockerfile.serve`:
- `oven/bun:1.3-alpine` base
- tmux + git + curl + gnupg + pass + openssh-client
- Pre-cloned `maw-plugin-registry` → 78 plugins available
- `node_modules/maw-js` → `/app` symlink (so plugins can `import "maw-js/config"`)
- Healthcheck on `/api/health` every 15s

## Volumes

| Volume | Mount | Purpose |
|---|---|---|
| `claude-config` | `/root/.claude` | Claude Code state, project sessions |
| `maw-config` | `/root/.config/maw` | maw config + fleet/*.json |
| `maw-plugins` | `/root/.maw` | Plugin install state |
| `code-repos` | `/root/Code` | Source repos (ghq) |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Docker-in-docker for child container ops |

## Known limitations

1. **Symlinks to host paths dangle in container** — fixed via build-time clone
   of maw-plugin-registry (#1123). Don't bind-mount `~/.maw` from host.

2. **`pm2 maw` shows "pm2 not available"** — alpine base doesn't ship pm2.
   Use `docker compose up -d` for daemon mode instead.

3. **No tmux sessions in container by default** — `maw serve` runs but doesn't
   spawn oracles. Use the API to create them or exec into container.

## Origin

Created during /loop autonomous session 2026-05-04 → 2026-05-05:
- Iteration 14: build unblocked (`--external @eclipse-zenoh/zenoh-ts`)
- Iteration 15: `.dockerignore` + Dockerfile fixes
- Iteration 16: plugin loader works in container (#1123)
- Iteration 17: full chain proven end-to-end
- Iteration 21: `--validate` flag for CI
- Iteration 22: CI workflow extended

See: `ψ/memory/retrospectives/2026-05/05/loop-session-22-iterations.md`.
