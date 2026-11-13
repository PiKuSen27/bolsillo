// Sube el último número de la versión (1.3.0 → 1.3.1) en los tres lugares que tienen que coincidir:
// package.json, src-tauri/tauri.conf.json y src-tauri/Cargo.toml. Lo usan "pnpm release" y "pnpm release:desktop".
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;

const replaceOnce = (file, from, to) => {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`No encontré la versión ${pkg.version} en ${file}`);
  writeFileSync(file, text.replace(from, to));
};

replaceOnce("package.json", `"version": "${pkg.version}"`, `"version": "${next}"`);
replaceOnce("src-tauri/tauri.conf.json", `"version": "${pkg.version}"`, `"version": "${next}"`);
replaceOnce("src-tauri/Cargo.toml", `version = "${pkg.version}"`, `version = "${next}"`);
console.log(`Versión: ${pkg.version} → ${next}`);
