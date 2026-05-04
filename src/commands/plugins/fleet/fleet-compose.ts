/**
 * fleet-compose.ts — Generate docker-compose.yml from fleet configs.
 *
 * Each oracle becomes a service with bun + tmux + claude CLI.
 * Central maw-serve container manages the API.
 *
 * Usage: maw fleet compose [--output <path>] [--include <names>]
 */

import { loadFleetEntries, type FleetEntry } from "../../shared/fleet-load";
import { getChannelPluginIds } from "../../shared/channel-loader";
import { writeFileSync } from "fs";

interface ComposeService {
  image: string;
  container_name: string;
  working_dir: string;
  volumes: string[];
  environment: Record<string, string>;
  command: string;
  depends_on?: string[];
  ports?: string[];
  restart: string;
}

interface ComposeFile {
  version: string;
  services: Record<string, ComposeService>;
  volumes: Record<string, { driver: string }>;
}

export function generateCompose(opts: { include?: string[] } = {}): { yaml: string; serviceCount: number } {
  const entries = loadFleetEntries();
  const filtered = opts.include?.length
    ? entries.filter(e => opts.include!.some(n => e.groupName.includes(n)))
    : entries;

  const compose: ComposeFile = {
    version: "3.8",
    services: {},
    volumes: {
      "claude-config": { driver: "local" },
      "maw-config": { driver: "local" },
      "code-repos": { driver: "local" },
    },
  };

  compose.services["maw-serve"] = {
    image: "maw-js:latest",
    container_name: "maw-serve",
    working_dir: "/root",
    command: "maw serve --host 0.0.0.0",
    ports: ["3456:3456", "3457:3457"],
    volumes: [
      "claude-config:/root/.claude",
      "maw-config:/root/.config/maw",
      "code-repos:/root/Code",
    ],
    environment: {
      MAW_HOST: "0.0.0.0",
      NODE_ENV: "production",
    },
    restart: "unless-stopped",
  };

  for (const entry of filtered) {
    const oracleName = entry.session.windows?.[0]?.name || entry.groupName;
    const repo = entry.session.windows?.[0]?.repo || "";
    const serviceName = entry.groupName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const channels = getChannelPluginIds(oracleName.replace(/-oracle$/, ""));
    const channelFlag = channels.length ? ` --channels ${channels.join(" ")}` : "";
    const skipPerms = channels.length ? " --dangerously-skip-permissions" : "";

    compose.services[serviceName] = {
      image: "claude-oracle:latest",
      container_name: serviceName,
      working_dir: `/root/Code/github.com/${repo}`,
      command: `bash -c "tmux new-session -d -s ${entry.session.name} && tmux send-keys -t ${entry.session.name} 'claude${skipPerms} --continue${channelFlag}' Enter && tail -f /dev/null"`,
      volumes: [
        "claude-config:/root/.claude",
        "maw-config:/root/.config/maw",
        "code-repos:/root/Code",
      ],
      environment: {
        ORACLE_NAME: oracleName,
        MAW_NODE: "docker",
        TMUX_TMPDIR: "/tmp/tmux",
      },
      depends_on: ["maw-serve"],
      restart: "unless-stopped",
    };
  }

  const yaml = toYaml(compose);
  return { yaml, serviceCount: filtered.length + 1 };
}

function toYaml(obj: ComposeFile): string {
  const lines: string[] = [`version: "${obj.version}"`, "", "services:"];

  for (const [name, svc] of Object.entries(obj.services)) {
    lines.push(`  ${name}:`);
    lines.push(`    image: ${svc.image}`);
    lines.push(`    container_name: ${svc.container_name}`);
    lines.push(`    working_dir: ${svc.working_dir}`);
    lines.push(`    command: ${svc.command}`);
    if (svc.ports?.length) {
      lines.push("    ports:");
      for (const p of svc.ports) lines.push(`      - "${p}"`);
    }
    lines.push("    volumes:");
    for (const v of svc.volumes) lines.push(`      - ${v}`);
    lines.push("    environment:");
    for (const [k, v] of Object.entries(svc.environment)) lines.push(`      ${k}: "${v}"`);
    if (svc.depends_on?.length) {
      lines.push("    depends_on:");
      for (const d of svc.depends_on) lines.push(`      - ${d}`);
    }
    lines.push(`    restart: ${svc.restart}`);
    lines.push("");
  }

  lines.push("volumes:");
  for (const [name, vol] of Object.entries(obj.volumes)) {
    lines.push(`  ${name}:`);
    lines.push(`    driver: ${vol.driver}`);
  }

  return lines.join("\n");
}

export async function cmdFleetCompose(args: string[]): Promise<void> {
  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
  const includeIdx = args.indexOf("--include");
  const include = includeIdx >= 0 ? args.slice(includeIdx + 1).filter(a => !a.startsWith("--")) : undefined;

  const { yaml, serviceCount } = generateCompose({ include });

  if (outputPath) {
    writeFileSync(outputPath, yaml);
    console.log(`\x1b[32m✓\x1b[0m docker-compose.yml written to ${outputPath} (${serviceCount} services)`);
  } else {
    console.log(yaml);
    console.log(`\n\x1b[90m# ${serviceCount} services — pipe to file: maw fleet compose > docker-compose.yml\x1b[0m`);
  }
}
