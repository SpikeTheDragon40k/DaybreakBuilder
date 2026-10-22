#!/usr/bin/env node
/**
 * Build content/indexes/aurora-legacy-2024.index: the community AuroraLegacy
 * index reduced to the 2024 rules (D&D 5.5e), plus 2024 books that are still
 * waiting in open AuroraLegacy pull requests.
 *
 *   node scripts/generate-2024-index.mjs [--local <git checkout of AuroraLegacy/elements>]
 *
 * Without --local the repository is cloned (without file contents up front)
 * into a temporary folder. Everything is read with git, so no GitHub API
 * access is needed.
 *
 * The result only lists links: every file stays hosted by AuroraLegacy, and
 * nothing from it is copied into this repository. Kept:
 *   - the edition-neutral files listed directly in core.index (internal.xml,
 *     ALE.xml), which every book relies on;
 *   - each book whose Source element says "D&D 5.5e", was released on or after
 *     the 2024 Player's Handbook (2024-09-17), or is a book written for the
 *     2024 rules (REVISED_BOOKS), even if its source doesn't say so;
 *   - from each pull request in PULL_REQUESTS that is still open: the 2024
 *     books it adds, and its changes to files kept above (for example new
 *     internal elements), linked at the pull request's latest commit. Files are
 *     listed after the ones they change; the app keeps the last definition of
 *     an element, so a pull request's version wins.
 * Rerun it when AuroraLegacy adds books or merges one of the pull requests.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "content", "indexes", "aurora-legacy-2024.index");
const REPO = "https://github.com/AuroraLegacy/elements";
const RAW = "https://raw.githubusercontent.com/AuroraLegacy/elements/";
/** Where this file is published, so the index can update itself (Aurora reads <update>). */
const SELF_URL = "https://raw.githubusercontent.com/SpikeTheDragon40k/dndbuilderclaude/main/content/indexes/aurora-legacy-2024.index";
const REVISED_RELEASE = 20240917;

/** Books written for the 2024 rules, by (part of) their title. */
const REVISED_BOOKS = [
  "Player's Handbook (2024)",
  "Dungeon Master's Guide (2024)",
  "Monster Manual (2025)",
  "Astarion's Book of Hungers",
  "Arcana Unleashed",
  "D&D Beyond Drops",
  "Dragon Delves",
  "Eberron: Forge of the Artificer",
  "Forgotten Realms: Adventures in Faerun",
  "Forgotten Realms: Heroes of Faerun",
  "Lorwyn: First Light",
  "Netheril's Fall",
  "Ravenloft: The Horrors Within",
  "World of Warcraft",
];

/** Open AuroraLegacy pull requests that upload 2024 books (until they're merged). */
const PULL_REQUESTS = [
  { number: 334, title: "[ABH][NF] Full Book Content Upload" },
  { number: 335, title: "[FRHOF][FRAIF] Full Book Content Upload" },
  { number: 340, title: "[LFL] Full Book Content Upload" },
  { number: 341, title: "[EFOTA] Full Book Content Upload" },
  { number: 354, title: "[AU][AUD] Full Book Content Upload" },
  { number: 355, title: "[RHW] Full Book Content Upload" },
];

// ---------------------------------------------------------------------------
// Git access

const args = process.argv.slice(2);
let repoDir = args[0] === "--local" ? args[1] : undefined;
if (!repoDir) {
  repoDir = mkdtempSync(join(tmpdir(), "aurora-legacy-"));
  console.log(`cloning ${REPO} into ${repoDir}`);
  execFileSync("git", ["clone", "-q", "--filter=blob:none", "--no-checkout", REPO, repoDir], { stdio: "inherit" });
}
if (!existsSync(join(repoDir, ".git"))) throw new Error(`${repoDir} is not a git checkout of ${REPO}`);

const git = (...a) => execFileSync("git", ["-C", repoDir, ...a], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const succeeds = (...a) => {
  try {
    execFileSync("git", ["-C", repoDir, ...a], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const refspecs = ["+refs/heads/master:refs/remotes/origin/master", ...PULL_REQUESTS.map((p) => `+refs/pull/${p.number}/head:refs/remotes/pr/${p.number}`)];
git("fetch", "-q", REPO, ...refspecs);
const MASTER = git("rev-parse", "refs/remotes/origin/master").trim();

const read = (rev, path) => git("show", `${rev}:${path}`);
const exists = (rev, path) => succeeds("cat-file", "-e", `${rev}:${path}`);

/** Repository path of an upstream raw URL (any branch or commit). */
const pathOf = (url) => {
  if (!url.startsWith(RAW)) throw new Error(`not an AuroraLegacy file: ${url}`);
  return decodeURIComponent(url.slice(RAW.length).replace(/^[^/]+\//, ""));
};
const urlAt = (rev, path) => `${RAW}${rev}/${path.split("/").map(encodeURIComponent).join("/")}`;

// ---------------------------------------------------------------------------
// Index files and sources

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The <file> entries of an index, skipping commented-out ones. */
function filesOf(indexXml) {
  const files = indexXml.match(/<files>([\s\S]*?)<\/files>/)?.[1] ?? "";
  return [...files.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<file\s+name="([^"]*)"\s+url="([^"]*)"\s*\/>/g)].map((m) => ({
    name: decode(m[1]),
    path: pathOf(decode(m[2])),
  }));
}

/** The book's Source element (name, release date, edition note), read from its source file. */
function bookSource(rev, indexPath) {
  const xmls = filesOf(read(rev, indexPath)).filter((f) => f.path.endsWith(".xml") && exists(rev, f.path));
  const preferred = xmls.filter((f) => /source/i.test(f.name));
  for (const f of preferred.length ? preferred : xmls) {
    const m = read(rev, f.path).match(/<element\s+name="([^"]*)"\s+type="Source"[\s\S]*?<\/element>/);
    if (!m) continue;
    const release = parseInt(m[0].match(/<set name="release">(\d+)</)?.[1] ?? "", 10);
    const info = decode(m[0].match(/<set name="information">([^<]*)</)?.[1] ?? "");
    return { name: decode(m[1]), release, info };
  }
  return undefined;
}

/** Lower case, no accents or apostrophes: "Heroes of Faerûn" → "heroes of faerun". */
const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'‘`]/g, "")
    .toLowerCase();
const listedBook = (name) => REVISED_BOOKS.find((b) => fold(name).includes(fold(b)));
const isRevised = (src) =>
  !!src && (/5\.5e?\b/i.test(src.info) || src.release >= REVISED_RELEASE || /\(20(2[4-9]|[3-9]\d)\)/.test(src.name) || !!listedBook(src.name));

// ---------------------------------------------------------------------------
// Released content (master)

const neutral = [];
const books = [];
const skipped = [];
for (const group of filesOf(read(MASTER, "AuroraLegacy.index"))) {
  if (!group.path.endsWith(".index")) continue;
  const isCore = group.name === "core.index";
  for (const f of filesOf(read(MASTER, group.path))) {
    if (!f.path.endsWith(".index")) {
      // Files listed directly in core.index are shared by every edition.
      if (isCore) neutral.push(f);
      continue;
    }
    const src = bookSource(MASTER, f.path);
    if (isRevised(src)) books.push({ ...f, source: src.name });
    else skipped.push(src?.name ?? f.name);
  }
}
if (books.length === 0) throw new Error("No 2024 books found; is the upstream layout unchanged?");

/** Files a pull request may update: the shared files and anything in a kept book's folder. */
const keptDirs = books.map((b) => b.path.replace(/\.index$/, "/"));
const keptPaths = new Set(neutral.map((f) => f.path));
const isKeptFile = (path) => keptPaths.has(path) || keptDirs.some((d) => path.startsWith(d));

// ---------------------------------------------------------------------------
// Pull requests

const pulls = [];
for (const pr of PULL_REQUESTS) {
  const sha = git("rev-parse", `refs/remotes/pr/${pr.number}`).trim();
  if (succeeds("merge-base", "--is-ancestor", sha, MASTER)) {
    console.log(`  #${pr.number} is merged; its books come from master`);
    continue;
  }
  const changes = git("diff", "--name-status", "--no-renames", `${MASTER}...${sha}`)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"))
    .filter(([status]) => status === "A" || status === "M")
    .map(([status, path]) => ({ status, path }));

  // New book indexes (not the group indexes such as supplements.index).
  const added = [];
  const bookDirs = [];
  for (const c of changes) {
    if (c.status !== "A" || !c.path.endsWith(".index") || !c.path.includes("/")) continue;
    if (books.some((b) => b.path === c.path)) continue; // already released
    const src = bookSource(sha, c.path);
    if (!isRevised(src)) continue;
    const files = filesOf(read(sha, c.path)).filter((f) => f.path.endsWith(".xml") && exists(sha, f.path));
    added.push({ source: src.name, files });
    bookDirs.push(c.path.replace(/\.index$/, "/"));
  }
  // Changes to released files that are kept (shared internals, 2024 core books).
  const updates = changes.filter((c) => c.path.endsWith(".xml") && isKeptFile(c.path) && !bookDirs.some((d) => c.path.startsWith(d)));
  if (added.length || updates.length) pulls.push({ ...pr, sha, added, updates });
}

// ---------------------------------------------------------------------------
// Output

const line = (name, url) => `\t\t<file name="${escape(name)}" url="${escape(url)}" />`;
const base = (p) => p.slice(p.lastIndexOf("/") + 1);
const sections = [
  "\t\t<!-- Shared by every edition -->",
  ...neutral.map((f) => line(f.name, urlAt("master", f.path))),
  "",
  "\t\t<!-- 2024 rules (D&D 5.5e) -->",
  ...books.map((b) => line(b.name, urlAt("master", b.path))),
];
for (const pr of pulls) {
  sections.push("", `\t\t<!-- Pull request #${pr.number}, not merged yet: ${escape(pr.title)} (${REPO}/pull/${pr.number}, commit ${pr.sha.slice(0, 7)}) -->`);
  for (const b of pr.added) sections.push(`\t\t<!-- ${escape(b.source)} -->`, ...b.files.map((f) => line(f.name, urlAt(pr.sha, f.path))));
  if (pr.updates.length) sections.push("\t\t<!-- Its changes to files listed above -->", ...pr.updates.map((u) => line(base(u.path), urlAt(pr.sha, u.path))));
}

const allBooks = [...books.map((b) => b.source), ...pulls.flatMap((p) => p.added.map((b) => `${b.source} (pull request #${p.number})`))];
const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-2024-index.mjs from ${REPO} (master ${MASTER.slice(0, 7)}); rerun it instead of editing. -->
<!-- Lists links only: the files are hosted by the AuroraLegacy project. -->
<index>
	<info>
		<name>Aurora Legacy (2024 rules)</name>
		<description>The AuroraLegacy community content limited to the 2024 rules (D&amp;D 5.5e): ${escape(allBooks.join(", "))}.${pulls.length ? " Books from pull requests haven't been reviewed by the AuroraLegacy team yet." : ""}</description>
		<author url="${REPO}">Aurora Legacy Team and contributors</author>
		<update version="1.1.0">
			<file name="aurora-legacy-2024.index" url="${SELF_URL}" />
		</update>
	</info>
	<files>
${sections.join("\n")}
	</files>
</index>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, xml);
console.log(`wrote ${OUT.slice(root.length + 1)} (AuroraLegacy master ${MASTER.slice(0, 7)})`);
console.log(`  ${neutral.length} shared file(s); ${books.length} released 2024 book(s); ${skipped.length} 2014 book(s) left out`);
for (const b of books) console.log(`  + ${b.source}`);
for (const p of pulls) {
  for (const b of p.added) console.log(`  + ${b.source}  (pull request #${p.number}, ${b.files.length} files)`);
  if (p.updates.length) console.log(`    #${p.number} also updates: ${p.updates.map((u) => u.path).join(", ")}`);
}
const covered = allBooks.map((n) => listedBook(n)).filter(Boolean);
const missing = REVISED_BOOKS.filter((b) => !covered.includes(b));
if (missing.length) console.log(`Not in AuroraLegacy yet: ${missing.join(", ")}`);
