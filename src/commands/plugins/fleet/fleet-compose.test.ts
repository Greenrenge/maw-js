import { describe, expect, test } from "bun:test";
import { generateServeCompose } from "./fleet-compose";

describe("fleet compose generator", () => {
  test("default port 3456 + tls 3457", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("3456:3456");
    expect(yaml).toContain("3457:3457");
    expect(yaml).toContain("MAW_PORT: \"3456\"");
  });

  test("custom port shifts both", () => {
    const { yaml } = generateServeCompose({ port: 4000 });
    expect(yaml).toContain("4000:4000");
    expect(yaml).toContain("4001:4001");
    expect(yaml).toContain("MAW_PORT: \"4000\"");
  });

  test("uses bun src/cli.ts (not bare maw)", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("bun src/cli.ts serve");
    expect(yaml).not.toContain("command: maw serve");
  });

  test("includes maw-plugins volume (#1123)", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("maw-plugins:/root/.maw");
    expect(yaml).toContain("maw-plugins:");
  });

  test("includes claude-config + maw-config + code-repos volumes", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("claude-config:/root/.claude");
    expect(yaml).toContain("maw-config:/root/.config/maw");
    expect(yaml).toContain("code-repos:/root/Code");
  });

  test("includes docker socket mount", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("/var/run/docker.sock:/var/run/docker.sock");
  });

  test("healthcheck hits /api/health", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("/api/health");
    expect(yaml).toContain("healthcheck:");
  });

  test("MAW_HOST set to 0.0.0.0 (#1115 follow-up)", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("MAW_HOST: \"0.0.0.0\"");
  });

  test("restart policy unless-stopped", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("restart: unless-stopped");
  });

  test("uses build context (Dockerfile.serve)", () => {
    const { yaml } = generateServeCompose();
    expect(yaml).toContain("dockerfile: Dockerfile.serve");
  });

  test("yaml is a single service (not per-oracle sidecars)", () => {
    const { yaml } = generateServeCompose();
    // Extract services section only (between 'services:' and 'volumes:')
    const servicesBlock = yaml.split(/^volumes:/m)[0]!.replace(/^services:\n/m, "");
    const serviceCount = (servicesBlock.match(/^  [a-z][a-z0-9-]+:$/gm) || []).length;
    expect(serviceCount).toBe(1);
  });

  test("yaml is concise (~30-40 lines)", () => {
    const { yaml } = generateServeCompose();
    const lines = yaml.split("\n").length;
    expect(lines).toBeGreaterThan(20);
    expect(lines).toBeLessThan(50);
  });
});
