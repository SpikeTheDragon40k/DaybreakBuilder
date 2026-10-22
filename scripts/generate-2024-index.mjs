#!/usr/bin/env node
/**
 * Build content/indexes/aurora-legacy-2024.index: the community AuroraLegacy
 * index reduced to the 2024 rules (D&D 5.5e).
 *
 *   node scripts/generate-2024-index.mjs [--local <checkout of AuroraLegacy/elements>]
 *
 * The result only lists links: every file stays hosted by AuroraLegacy, and
 * nothing from it is copied into this repository. Kept:
 *   - the edition-neutral files listed directly in core.index (internal.xml,
 *     ALE.xml), which every book relies on;
 *   - each book index whose Source element says "D&D 5.5e", was released on or
 *     after the 2024 Player's Handbook (2024-09-17), or is a book written for
 *     the 2024 rules (REVISED_BOOKS), even if its source doesn't say so.
 * Rerun it when AuroraLegacy adds books.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "content", "indexes", "aurora-legacy-2024.index");
const UPSTREAM = "https://raw.githubusercontent.com/AuroraLegacy/elements/master/";
const ROOT_INDEX = `${UPSTREAM}AuroraLegacy.index`;
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
  "World of Warcraft",
];
/** Lower case, no accents or apostrophes: "Heroes of Faerûn" → "heroes of faerun". */
const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'‘`]/g, "")
    .toLowerCase();
const listedBook = (name) => REVISED_BOOKS.find((b) => fold(name).includes(fold(b)));
/** Where this file is published, so the index can update itself (Aurora reads <update>). */
const SELF_URL = "https://raw.githubusercontent.com/SpikeTheDragon40k/dndbuilderclaude/main/content/indexes/aurora-legacy-2024.index";

const args = process.argv.slice(2);
const local = args[0] === "--local" ? args[1] : undefined;

async function fetchText(url) {
  if (local && url.startsWith(UPSTREAM)) return readFileSync(join(local, decodeURIComponent(url.slice(UPSTREAM.length))), "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The <file> entries of an index. */
function filesOf(indexXml) {
  const files = indexXml.match(/<files>([\s\S]*?)<\/files>/)?.[1] ?? "";
  // Skip commented-out entries.
  return [...files.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<file\s+name="([^"]*)"\s+url="([^"]*)"\s*\/>/g)].map((m) => ({
    name: decode(m[1]),
    url: decode(m[2]),
  }));
}

/** The book's Source element (name, release date, edition note), read from its source file. */
async function bookSource(bookIndexUrl) {
  const files = filesOf(await fetchText(bookIndexUrl));
  const candidates = files.filter((f) => /source/i.test(f.name) && f.name.endsWith(".xml"));
  for (const f of candidates.length ? candidates : files.filter((f) => f.name.endsWith(".xml"))) {
    const xml = await fetchText(f.url);
    const m = xml.match(/<element\s+name="([^"]*)"\s+type="Source"[\s\S]*?<\/element>/);
    if (!m) continue;
    const release = parseInt(m[0].match(/<set name="release">(\d+)</)?.[1] ?? "", 10);
    const info = decode(m[0].match(/<set name="information">([^<]*)</)?.[1] ?? "");
    return { name: decode(m[1]), release, info };
  }
  return undefined;
}

const isRevised = (src) =>
  !!src && (/5\.5e?\b/i.test(src.info) || src.release >= REVISED_RELEASE || /\(20(2[4-9]|[3-9]\d)\)/.test(src.name) || !!listedBook(src.name));

const kept = { neutral: [], books: [] };
const skipped = [];

for (const group of filesOf(await fetchText(ROOT_INDEX))) {
  if (!group.url.endsWith(".index")) continue;
  const isCore = group.name === "core.index";
  for (const f of filesOf(await fetchText(group.url))) {
    if (!f.url.endsWith(".index")) {
      // Files listed directly in core.index are shared by every edition.
      if (isCore) kept.neutral.push(f);
      continue;
    }
    const src = await bookSource(f.url);
    if (isRevised(src)) kept.books.push({ ...f, source: src.name });
    else skipped.push(src?.name ?? f.name);
  }
}

if (kept.books.length === 0) throw new Error("No 2024 books found; is the upstream layout unchanged?");

const line = (f) => `\t\t<file name="${escape(f.name)}" url="${escape(f.url)}" />`;
const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-2024-index.mjs from ${ROOT_INDEX}; rerun it instead of editing. -->
<!-- Lists links only: the files are hosted by the AuroraLegacy project (https://github.com/AuroraLegacy/elements). -->
<index>
	<info>
		<name>Aurora Legacy (2024 rules)</name>
		<description>The AuroraLegacy community content limited to the 2024 rules (D&amp;D 5.5e): ${kept.books.map((b) => escape(b.source)).join(", ")}.</description>
		<author url="https://github.com/AuroraLegacy/elements">Aurora Legacy Team</author>
		<update version="1.0.0">
			<file name="aurora-legacy-2024.index" url="${SELF_URL}" />
		</update>
	</info>
	<files>
		<!-- Shared by every edition -->
${kept.neutral.map(line).join("\n")}

		<!-- 2024 rules (D&D 5.5e) -->
${kept.books.map(line).join("\n")}
	</files>
</index>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, xml);
console.log(`wrote ${OUT.slice(root.length + 1)}: ${kept.neutral.length} shared file(s), ${kept.books.length} book(s)`);
for (const b of kept.books) console.log(`  + ${b.source}`);
console.log(`  (left out ${skipped.length} books for the 2014 rules)`);
const missing = REVISED_BOOKS.filter((b) => !kept.books.some((k) => listedBook(k.source) === b));
if (missing.length) console.log(`Not in AuroraLegacy yet: ${missing.join(", ")}`);
