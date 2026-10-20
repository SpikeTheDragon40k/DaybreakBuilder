/** Helpers for generating Aurora-format element XML from JavaScript data. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");

export const stat = (o) => `<stat${attrs(o)} />`;
export const grant = (o) => `<grant${attrs(o)} />`;
export const select = (o) => `<select${attrs(o)} />`;

/** Turn plain text paragraphs (separated by blank lines) into <p> HTML. */
export function paras(text) {
  if (!text) return "";
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p.trim().replace(/\s*\n\s*/g, " "))}</p>`)
    .join("");
}

/**
 * Build one <element>. `description` is HTML; `text` is plain text converted
 * with paras(). `sheet` may be false (hidden), a string (sheet text) or an
 * array of {text, level, usage, action}.
 */
export function element({
  name,
  type,
  id,
  source,
  supports,
  requirements,
  prerequisite,
  description,
  text,
  sheet,
  sheetAlt,
  setters,
  rules,
  body,
  compendium,
}) {
  const lines = [`\t<element${attrs({ name, type, source, id })}>`];
  if (compendium === false) lines.push(`\t\t<compendium display="false" />`);
  if (supports && supports.length) lines.push(`\t\t<supports>${esc(Array.isArray(supports) ? supports.join(", ") : supports)}</supports>`);
  if (prerequisite) lines.push(`\t\t<prerequisite>${esc(prerequisite)}</prerequisite>`);
  if (requirements) lines.push(`\t\t<requirements>${esc(requirements)}</requirements>`);
  const desc = description ?? paras(text);
  if (desc) lines.push(`\t\t<description>${desc}</description>`);
  if (sheet === false) lines.push(`\t\t<sheet display="false" />`);
  else if (typeof sheet === "string") lines.push(`\t\t<sheet${attrs({ alt: sheetAlt })}><description>${esc(sheet)}</description></sheet>`);
  else if (Array.isArray(sheet)) {
    lines.push(`\t\t<sheet${attrs({ alt: sheetAlt })}>`);
    for (const d of sheet) lines.push(`\t\t\t<description${attrs({ level: d.level, usage: d.usage, action: d.action })}>${esc(d.text)}</description>`);
    lines.push(`\t\t</sheet>`);
  }
  if (setters && setters.length) {
    lines.push(`\t\t<setters>`);
    for (const s of setters) {
      const [n, v, extra] = s;
      lines.push(`\t\t\t<set name="${esc(n)}"${attrs(extra ?? {})}>${esc(v)}</set>`);
    }
    lines.push(`\t\t</setters>`);
  }
  if (body) lines.push(body);
  if (rules && rules.length) {
    lines.push(`\t\t<rules>`);
    for (const r of rules) if (r) lines.push(`\t\t\t${r}`);
    lines.push(`\t\t</rules>`);
  }
  lines.push(`\t</element>`);
  return lines.join("\n");
}

export function writeElementsFile(path, { title, description, author, authorUrl, license }, elements) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated file; edit the generator in scripts/, not this file. -->${license ? `\n<!-- ${license} -->` : ""}
<elements>
\t<info>
\t\t<name>${esc(title)}</name>
\t\t<description>${esc(description)}</description>
\t\t<author${attrs({ url: authorUrl })}>${esc(author)}</author>
\t</info>

${elements.join("\n\n")}
</elements>
`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, xml);
  console.log(`wrote ${path.replace(repoRoot + "/", "")} (${elements.length} elements)`);
}

/** "Fire Bolt" -> "FIRE_BOLT" */
export const idPart = (name) =>
  name
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
