#!/usr/bin/env node
/**
 * Compares the schema fingerprint of the merged database with the fingerprints of
 * the databases it replaces (ADR-0005). Every fact must equal the reference of the
 * side that owns it; anything else is reported.
 *
 * Usage:
 *   node scripts/db/compare-fingerprints.mjs --merged <file> --content <file> [--user <file>]
 *     [--ownership scripts/db/merge-ownership.json] [--allowed scripts/db/merge-allowed-differences.json]
 * Without --user, every fact must equal the content reference.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** "kind|object|detail" lines -> Map("kind|object" -> detail). */
export function parseFingerprint(text) {
  const facts = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const first = line.indexOf("|");
    const second = line.indexOf("|", first + 1);
    if (first < 0 || second < 0) throw new Error(`Malformed fingerprint line: ${line}`);
    facts.set(line.slice(0, second), line.slice(second + 1));
  }
  return facts;
}

/** Table or function a fact belongs to: "column|profiles.id" -> "profiles". */
export function subjectOf(key) {
  const object = key.slice(key.indexOf("|") + 1);
  return object.split(/[.(]/, 1)[0];
}

function ownerResolver(ownership, user, content) {
  const contentSubjects = new Set([...content.keys()].map(subjectOf));
  const userSubjects = new Set([...user.keys()].map(subjectOf));
  return (key) => {
    const subject = subjectOf(key);
    if (ownership.user.includes(subject)) return "user";
    if (ownership.content.includes(subject)) return "content";
    if (userSubjects.has(subject) && !contentSubjects.has(subject)) return "user";
    return "content";
  };
}

/**
 * @param {{
 *   merged: Map<string, string>,
 *   content: Map<string, string>,
 *   user?: Map<string, string>,
 *   ownership?: { user: string[], content: string[] },
 *   allowed?: Record<string, string>,
 * }} input
 * @returns {Array<{ type: "missing" | "changed" | "unexpected", key: string, expected?: string, actual?: string }>}
 */
export function compareFingerprints({ merged, content, user = new Map(), ownership = { user: [], content: [] }, allowed = {} }) {
  const owner = ownerResolver(user.size ? ownership : { user: [], content: [] }, user, content);
  const expected = new Map();
  for (const [key, detail] of content) if (owner(key) === "content") expected.set(key, detail);
  for (const [key, detail] of user) if (owner(key) === "user") expected.set(key, detail);

  const problems = [];
  for (const [key, detail] of expected) {
    if (!merged.has(key)) problems.push({ type: "missing", key, expected: detail });
    else if (merged.get(key) !== detail) problems.push({ type: "changed", key, expected: detail, actual: merged.get(key) });
  }
  for (const [key, detail] of merged) {
    if (!expected.has(key)) problems.push({ type: "unexpected", key, actual: detail });
  }
  return problems.filter((p) => !Object.prototype.hasOwnProperty.call(allowed, p.key));
}

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = readArgs(process.argv.slice(2));
  if (!args.merged || !args.content) {
    console.error("Usage: compare-fingerprints.mjs --merged <file> --content <file> [--user <file>]");
    process.exit(2);
  }
  const read = (file) => parseFingerprint(fs.readFileSync(file, "utf8"));
  const readJson = (file, fallback) => (file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
  const problems = compareFingerprints({
    merged: read(args.merged),
    content: read(args.content),
    user: args.user ? read(args.user) : new Map(),
    ownership: readJson(args.ownership ?? "scripts/db/merge-ownership.json", { user: [], content: [] }),
    allowed: readJson(args.allowed ?? "scripts/db/merge-allowed-differences.json", {}),
  });
  for (const p of problems) {
    console.log(`${p.type.toUpperCase()} ${p.key}`);
    if (p.expected !== undefined) console.log(`    expected: ${p.expected}`);
    if (p.actual !== undefined) console.log(`    actual:   ${p.actual}`);
  }
  console.log(problems.length ? `\n${problems.length} difference(s)` : "Fingerprints match.");
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
