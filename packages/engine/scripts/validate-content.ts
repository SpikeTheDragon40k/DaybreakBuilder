/**
 * Check content files before loading them into dndbuilder.
 *
 *   npm run validate-content -- <file or folder>... [options]
 *
 * Options:
 *   --base <file or folder>  extra content the files depend on (repeatable)
 *   --no-srd                 don't load the bundled SRD pack as base content
 *   --no-build               skip the test characters
 *   --strict                 exit with an error on warnings too
 *   --json                   print issues as JSON
 *
 * The bundled core and SRD content are always the base (like in the app), so
 * files can refer to SRD elements and may override them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { validateContent, type ContentFile, type ValidationIssue } from "../src/validate.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
// npm runs scripts from the repository root; resolve user paths against where they ran npm.
const cwd = process.env.INIT_CWD ?? process.cwd();

function usage(code: number): never {
  console.log(readFileSync(import.meta.filename, "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1].replace(/^ \* ?/gm, "").trim());
  process.exit(code);
}

const targets: string[] = [];
const bases: string[] = [];
let srd = true;
let build = true;
let strict = false;
let json = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--base") bases.push(args[++i] ?? usage(2));
  else if (a === "--no-srd") srd = false;
  else if (a === "--no-build") build = false;
  else if (a === "--strict") strict = true;
  else if (a === "--json") json = true;
  else if (a === "-h" || a === "--help") usage(0);
  else if (a.startsWith("-")) {
    console.error(`Unknown option ${a}`);
    usage(2);
  } else targets.push(a);
}
if (targets.length === 0) usage(2);

function collect(path: string, display: (p: string) => string): ContentFile[] {
  const abs = isAbsolute(path) ? path : resolve(cwd, path);
  if (!existsSync(abs)) {
    console.error(`Not found: ${path}`);
    process.exit(2);
  }
  const out: ContentFile[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p).sort()) walk(join(p, name));
    } else if (p.toLowerCase().endsWith(".xml")) {
      out.push({ path: display(p), xml: readFileSync(p, "utf8") });
    }
  };
  walk(abs);
  return out;
}

const fromRepo = (p: string) => relative(repoRoot, p).replace(/\\/g, "/");
const fromCwd = (p: string) => {
  const rel = relative(cwd, p);
  return (rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : p).replace(/\\/g, "/");
};

const base = [
  ...collect(join(repoRoot, "content", "core"), fromRepo),
  ...(srd ? collect(join(repoRoot, "content", "srd"), fromRepo) : []),
  ...bases.flatMap((b) => collect(b, fromCwd)),
];
const files = targets.flatMap((t) => collect(t, fromCwd));
if (files.length === 0) {
  console.error("No .xml files found.");
  process.exit(2);
}

const result = validateContent(base, files, { build });
const counts = { error: 0, warning: 0, info: 0 };
for (const i of result.issues) counts[i.severity]++;

if (json) {
  console.log(JSON.stringify({ ...result, counts }, null, 2));
} else {
  const order = { error: 0, warning: 1, info: 2 };
  const byFile = new Map<string, ValidationIssue[]>();
  for (const i of result.issues) {
    const key = i.file ?? "(general)";
    byFile.set(key, [...(byFile.get(key) ?? []), i]);
  }
  const colour = process.stdout.isTTY && !process.env.NO_COLOR;
  const paint = (sev: ValidationIssue["severity"]) => {
    const text = sev.padEnd(7);
    if (!colour) return text;
    return `\x1b[${sev === "error" ? 31 : sev === "warning" ? 33 : 36}m${text}\x1b[0m`;
  };
  for (const [file, list] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(file);
    list.sort((a, b) => order[a.severity] - order[b.severity] || (a.line ?? 0) - (b.line ?? 0));
    for (const i of list) {
      const where = [i.line ? `line ${i.line}` : "", i.element ?? ""].filter(Boolean).join(" ");
      console.log(`  ${paint(i.severity)} ${where ? where + ": " : ""}${i.message}`);
    }
    console.log();
  }
  console.log(
    `${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} note(s) — ` +
      `${result.elements} element(s) in ${files.length} file(s), ${result.builds} test character(s) built`,
  );
}

process.exit(counts.error > 0 || (strict && counts.warning > 0) ? 1 : 0);
