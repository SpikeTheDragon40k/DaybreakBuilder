#!/usr/bin/env node
/**
 * Keep every version field in the repository in sync.
 *
 *   node scripts/version.mjs              print the current version
 *   node scripts/version.mjs 0.2.0        set the version everywhere
 *   node scripts/version.mjs --check v0.2.0
 *                                         fail unless every file has this version
 *
 * Files: package.json (root, engine, desktop), package-lock.json,
 * apps/desktop/src-tauri/tauri.conf.json, Cargo.toml and Cargo.lock.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const path = (p) => join(root, p);
// Windows MSI installers only accept numeric pre-release identifiers (0.2.0-1, not 0.2.0-beta.1).
const SEMVER = /^\d+\.\d+\.\d+(-\d+)?$/;

const PACKAGES = ["package.json", "packages/engine/package.json", "apps/desktop/package.json"];
const TAURI_CONF = "apps/desktop/src-tauri/tauri.conf.json";
const CARGO_TOML = "apps/desktop/src-tauri/Cargo.toml";
const CARGO_LOCK = "apps/desktop/src-tauri/Cargo.lock";
const CRATE = "daybreakbuilder";

const readJson = (p) => JSON.parse(readFileSync(path(p), "utf8"));
const writeJson = (p, data) => writeFileSync(path(p), JSON.stringify(data, null, 2) + "\n");

function cargoTomlVersion(text) {
  const pkg = text.split(/^\[/m).find((s) => s.startsWith("package]"));
  return pkg?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
}

function cargoLockVersion(text) {
  return text.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${CRATE}"\\nversion = "([^"]+)"`))?.[1];
}

function currentVersions() {
  const found = {};
  for (const p of PACKAGES) found[p] = readJson(p).version;
  const lock = readJson("package-lock.json");
  found["package-lock.json"] = lock.version;
  for (const ws of ["packages/engine", "apps/desktop"]) found[`package-lock.json (${ws})`] = lock.packages?.[ws]?.version;
  found[TAURI_CONF] = readJson(TAURI_CONF).version;
  found[CARGO_TOML] = cargoTomlVersion(readFileSync(path(CARGO_TOML), "utf8"));
  try {
    found[CARGO_LOCK] = cargoLockVersion(readFileSync(path(CARGO_LOCK), "utf8"));
  } catch {
    /* lock file not generated yet */
  }
  return found;
}

function setVersion(version) {
  for (const p of PACKAGES) {
    const pkg = readJson(p);
    pkg.version = version;
    if (pkg.dependencies?.["@daybreakbuilder/engine"]) pkg.dependencies["@daybreakbuilder/engine"] = version;
    writeJson(p, pkg);
  }

  const lock = readJson("package-lock.json");
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  for (const ws of ["packages/engine", "apps/desktop"]) {
    if (lock.packages?.[ws]) {
      lock.packages[ws].version = version;
      if (lock.packages[ws].dependencies?.["@daybreakbuilder/engine"]) lock.packages[ws].dependencies["@daybreakbuilder/engine"] = version;
    }
  }
  writeJson("package-lock.json", lock);

  const conf = readJson(TAURI_CONF);
  conf.version = version;
  writeJson(TAURI_CONF, conf);

  const toml = readFileSync(path(CARGO_TOML), "utf8");
  writeFileSync(
    path(CARGO_TOML),
    toml.replace(/(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m, `$1${version}$2`),
  );

  try {
    const lockText = readFileSync(path(CARGO_LOCK), "utf8");
    writeFileSync(
      path(CARGO_LOCK),
      lockText.replace(new RegExp(`(\\[\\[package\\]\\]\\nname = "${CRATE}"\\nversion = ")[^"]+(")`), `$1${version}$2`),
    );
  } catch {
    /* no lock file */
  }
}

const [arg, value] = process.argv.slice(2);

if (!arg) {
  const versions = currentVersions();
  const unique = [...new Set(Object.values(versions).filter(Boolean))];
  if (unique.length === 1) console.log(unique[0]);
  else {
    console.error("Versions are out of sync:");
    for (const [file, v] of Object.entries(versions)) console.error(`  ${v ?? "(missing)"}\t${file}`);
    process.exit(1);
  }
} else if (arg === "--check") {
  const expected = (value ?? "").replace(/^v/, "");
  if (!SEMVER.test(expected)) {
    console.error(`Not a version: ${value}`);
    process.exit(2);
  }
  const wrong = Object.entries(currentVersions()).filter(([, v]) => v !== undefined && v !== expected);
  if (wrong.length) {
    console.error(`Expected version ${expected}, but:`);
    for (const [file, v] of wrong) console.error(`  ${v}\t${file}`);
    console.error(`Run: node scripts/version.mjs ${expected}`);
    process.exit(1);
  }
  console.log(`All files are at ${expected}`);
} else {
  const version = arg.replace(/^v/, "");
  if (!SEMVER.test(version)) {
    console.error(`Not a supported version: ${arg} (use MAJOR.MINOR.PATCH, or MAJOR.MINOR.PATCH-N for a pre-release)`);
    process.exit(2);
  }
  setVersion(version);
  console.log(`Set version ${version}`);
}
