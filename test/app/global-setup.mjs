// Baut die App und die Testvariante ohne EESV (für «Erlass hinzufügen» mit gemockten Antworten aus raw/).
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export default function () {
  if (process.env.SKIP_BUILD) return;
  const run = (args) => console.log(execFileSync('node', ['build.mjs', ...args], { cwd: root, encoding: 'utf8' }).trim());
  run([]);
  run(['--exclude', 'cc-2021-734', '--out', 'test/app/out/sr-navigator-ohne-eesv.html']);
  run(['--built', '2026-06-01', '--out', 'test/app/out/sr-navigator-alt.html']); // für den Hinweis auf eine neuere Version
  run(['--no-update-check', '--out', 'test/app/out/sr-navigator-ohne-pruefung.html']); // Build ohne Versionsprüfung
}
