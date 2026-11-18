// Baut dist/sr-navigator.html: eine selbsttragende Datei (JS, CSS, Schriften, Icons, Bibliothek inline).
// Aufruf: node build.mjs [--fixtures] [--out <pfad>] [--exclude <id,id>] [--core|--no-core] [--dev]
//   --fixtures   Test-Fixtures (test/app/fixtures/library.json) statt data/library.json
//   --exclude    Erlasse nicht einbetten (Testvariante für «Erlass hinzufügen»)
//   --core       src/core verwenden, auch wenn data/STATUS.md es nicht meldet; --no-core: nie
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontFaceCss } from './build-fonts.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(ROOT, opt('--out', 'dist/sr-navigator.html'));
const p = (...x) => join(ROOT, ...x);
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

// ------------------------------------------------------------ Daten wählen
const REAL = p('data/library.json');
const FIX = p('test/app/fixtures/library.json');
const useFix = flag('--fixtures') || !existsSync(REAL);
const libFile = useFix ? FIX : REAL;
const lib = readJson(libFile);
if (lib.schema !== 2) throw new Error(`${libFile}: schema ${lib.schema}, erwartet 2`);
const exclude = new Set(String(opt('--exclude', '')).split(',').filter(Boolean));
const order = (lib.order || Object.keys(lib.works)).filter((id) => lib.works[id] && !exclude.has(id));

function summarize(b) {
  const st = b.stages || [];
  return {
    id: b.work.id, sr: b.work.sr, abbr: b.work.abbr, title: b.work.title, short: b.work.short, status: b.work.status,
    fetched: b.fetched, versions: (b.timeline || []).length, xmlVersions: st.length,
    xmlFrom: st.length ? st[0].date : null, xmlTo: st.length ? st[st.length - 1].date : null,
    langs: b.langs || ['de', 'fr', 'it'], units: Object.keys(b.units || {}).length,
  };
}

// ------------------------------------------------------------ Kernbibliothek (virtuelle Module sr-core/*)
// src/core wird verwendet, sobald data/STATUS.md die Funktionen als lauffähig meldet (oder mit --core).
const statusText = existsSync(p('data/STATUS.md')) ? readFileSync(p('data/STATUS.md'), 'utf8') : '';
const statusReady = !!statusText && !/noch nicht lauffähig/i.test(statusText) && /loadWork|getVersion/.test(statusText);
let useCore = flag('--core') || (statusReady && !flag('--no-core'));
const empty = p('src/app/core-missing.js');
const coreFile = (name) => p('src/core', name + '.js');
const corePlugin = (enabled) => ({
  name: 'sr-core',
  setup(b) {
    b.onResolve({ filter: /^sr-core\/(model|fedlex|parser|refs)$/ }, (a) => {
      const f = coreFile(a.path.split('/')[1]);
      return { path: enabled && existsSync(f) ? f : empty };
    });
  },
});
const esb = (enabled) => build({
  entryPoints: [p('src/app/main.js')],
  bundle: true, write: false, format: 'iife', target: ['chrome110', 'firefox115', 'safari16.4', 'edge110'],
  minify: !flag('--dev'), legalComments: 'none', charset: 'utf8',
  plugins: [corePlugin(enabled)],
  external: ['html2canvas', 'dompurify', 'canvg', 'core-js'],
  logLevel: enabled ? 'silent' : 'warning',
});
let bundle;
try { bundle = await esb(useCore); }
catch (e) {
  if (!useCore) throw e;
  console.warn('src/core lässt sich nicht bündeln, Ersatzfunktionen der Oberfläche werden verwendet: ' + (e.message || e).split('\n')[0]);
  useCore = false;
  bundle = await esb(false);
}
const js = bundle.outputFiles[0].text;

// ------------------------------------------------------------ CSS und Schriften (IBM Plex aus build-fonts.mjs; tokens → styles → styles-sr)
const fontCss = fontFaceCss(ROOT);
const css = ['tokens.css', 'styles.css', 'styles-sr.css'].map((f) => readFileSync(p('src/app', f), 'utf8')).join('\n');
const icons = readFileSync(p('src/app/assets/icons.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');

// ------------------------------------------------------------ Daten einbetten (je Erlass gzip + base64, beim Öffnen entpackt)
const gz = (obj) => gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString('base64');
const index = { order, works: Object.fromEntries(order.map((id) => [id, summarize(lib.works[id])])) };
// Version aus package.json; Adressen für den Hinweis auf eine neuere Version aus release.config.json.
// --built JJJJ-MM-TT setzt das Build-Datum (für Tests des Hinweises), --repo-url übersteuert das Repository.
const pkg = readJson(p('package.json'));
const relFile = p('release.config.json');
const release = existsSync(relFile) ? readJson(relFile) : null;
if (release && opt('--repo-url', null)) release.repoUrl = opt('--repo-url');
const builtAt = opt('--built', null) ? new Date(opt('--built') + 'T12:00:00Z').toISOString() : new Date().toISOString();
const meta = { built: builtAt, version: pkg.version, release, fixtures: useFix || !!lib.fixtures, library: libFile.replace(ROOT + '/', ''), generated: lib.generated || null, excluded: [...exclude], core: useCore };
// Die Versionsprüfung ruft version.json von der Projektseite ab. Nur dieser Ursprung kommt zu Fedlex hinzu.
if (release && args.includes('--no-update-check')) { delete release.siteUrl; delete release.manifest; }
const siteOrigin = release && /^https:\/\/[\w-]+\.github\.io\/[\w.-]+\/$/.test(release.siteUrl || '') && release.manifest ? new URL(release.siteUrl).origin : null;
const csp = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", 'img-src data: blob:', 'font-src data:',
  `connect-src https://fedlex.data.admin.ch${siteOrigin ? ' ' + siteOrigin : ''}`, "base-uri 'none'", "form-action 'none'",
].join('; ');
const enc = (s) => s.replace(/<\/script/gi, '<\\/script');

const htmlOut = `<!DOCTYPE html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="description" content="SR-Navigator: Änderungen an Erlassen der Systematischen Rechtssammlung nachvollziehen, vergleichen und exportieren.">
<title>SR-Navigator</title>
<style>${fontCss}</style>
<style>${css}</style>
</head>
<body>
<div hidden aria-hidden="true">${icons}</div>
<div id="app"></div>
<script type="application/json" id="sr-meta">${enc(JSON.stringify(meta))}</script>
<script type="application/json" id="sr-index">${enc(JSON.stringify(index))}</script>
${order.map((id) => `<script type="application/octet-stream" id="sr-work-${id}" data-enc="gz64">${gz(lib.works[id])}</script>`).join('\n')}
<script>${enc(js)}</script>
</body>
</html>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT + '.tmp', htmlOut);
renameSync(OUT + '.tmp', OUT);
const size = statSync(OUT).size;
console.log(`${OUT.replace(ROOT + '/', '')}: ${(size / 1024 / 1024).toFixed(2)} MB | Daten: ${useFix ? 'Fixtures' : 'data/library.json'} (${order.join(', ')}) | Kern: ${useCore ? 'src/core' : 'Ersatzfunktionen'}`);
if (size > 8 * 1024 * 1024) console.warn('WARNUNG: Datei grösser als 8 MB');
