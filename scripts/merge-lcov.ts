#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type FileRecord = {
  source: string;
  lines: Map<number, number>;
  funcsFound: number;
  funcsHit: number;
  branchesFound: number;
  branchesHit: number;
};

function usage(): never {
  throw new Error("usage: bun scripts/merge-lcov.ts --out <path> (--manifest <file> | <lcov...>)");
}

function parseArgs(argv: string[]) {
  let outPath = "";
  let manifestPath = "";
  const inputs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") outPath = argv[++i] || "";
    else if (arg === "--manifest") manifestPath = argv[++i] || "";
    else if (arg.startsWith("-")) usage();
    else inputs.push(arg);
  }

  if (!outPath) usage();
  if (manifestPath && inputs.length) usage();

  const files = manifestPath
    ? readFileSync(manifestPath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : inputs;
  if (!files.length) throw new Error("no LCOV inputs provided");
  return { outPath, files };
}

function getOrInit(records: Map<string, FileRecord>, source: string): FileRecord {
  let record = records.get(source);
  if (!record) {
    record = { source, lines: new Map(), funcsFound: 0, funcsHit: 0, branchesFound: 0, branchesHit: 0 };
    records.set(source, record);
  }
  return record;
}

function parseLcovFile(path: string, records: Map<string, FileRecord>) {
  const text = readFileSync(path, "utf8");
  for (const rawRecord of text.split("end_of_record")) {
    const lines = rawRecord.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const sourceLine = lines.find((line) => line.startsWith("SF:"));
    if (!sourceLine) continue;
    const source = sourceLine.slice(3);
    const record = getOrInit(records, source);

    for (const line of lines) {
      if (line.startsWith("DA:")) {
        const [lineNoRaw, hitsRaw] = line.slice(3).split(",");
        const lineNo = Number(lineNoRaw);
        const hits = Number(hitsRaw);
        if (!Number.isFinite(lineNo) || !Number.isFinite(hits)) continue;
        record.lines.set(lineNo, (record.lines.get(lineNo) || 0) + hits);
      } else if (line.startsWith("FNF:")) record.funcsFound = Math.max(record.funcsFound, Number(line.slice(4)) || 0);
      else if (line.startsWith("FNH:")) record.funcsHit = Math.max(record.funcsHit, Number(line.slice(4)) || 0);
      else if (line.startsWith("BRF:")) record.branchesFound = Math.max(record.branchesFound, Number(line.slice(4)) || 0);
      else if (line.startsWith("BRH:")) record.branchesHit = Math.max(record.branchesHit, Number(line.slice(4)) || 0);
    }
  }
}

function render(records: Map<string, FileRecord>): string {
  const out: string[] = [];
  for (const record of [...records.values()].sort((a, b) => a.source.localeCompare(b.source))) {
    const daEntries = [...record.lines.entries()].sort((a, b) => a[0] - b[0]);
    const linesFound = daEntries.length;
    const linesHit = daEntries.filter(([, hits]) => hits > 0).length;

    out.push("TN:");
    out.push(`SF:${record.source}`);
    if (record.funcsFound > 0 || record.funcsHit > 0) {
      out.push(`FNF:${record.funcsFound}`);
      out.push(`FNH:${Math.min(record.funcsFound, record.funcsHit)}`);
    }
    for (const [lineNo, hits] of daEntries) out.push(`DA:${lineNo},${hits}`);
    out.push(`LF:${linesFound}`);
    out.push(`LH:${linesHit}`);
    if (record.branchesFound > 0 || record.branchesHit > 0) {
      out.push(`BRF:${record.branchesFound}`);
      out.push(`BRH:${Math.min(record.branchesFound, record.branchesHit)}`);
    }
    out.push("end_of_record");
  }
  return `${out.join("\n")}\n`;
}

const { outPath, files } = parseArgs(process.argv.slice(2));
const records = new Map<string, FileRecord>();
for (const file of files) parseLcovFile(file, records);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, render(records));
console.log(`merged ${files.length} LCOV input(s) into ${outPath}`);
