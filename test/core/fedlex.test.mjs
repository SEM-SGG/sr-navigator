// Tests für src/core/fedlex.js. Netztest mit SR_NO_NET=1 abschaltbar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { sparqlString, searchWorks, loadWork, checkUpdates, updateWork, workPath, ENDPOINT, normalizeImpacts } from '../../src/core/fedlex.js';
import { buildFromRaw, fetchedDate } from '../../scripts/build-data.mjs';
import { rawFetch } from '../../scripts/lib/rawfetch.mjs';
import { tokenize, sourceText, stripHtml } from '../../scripts/lib/wordcheck.mjs';
import { getVersion, tocAt } from '../../src/core/model.js';
import { existsSync as existsSyncRaw } from 'node:fs';
// Tests mit Rohdaten laufen nur, wenn der Ordner raw/ vorliegt (node scripts/fetch-raw.mjs, node scripts/fetch-meta.mjs).
const RAW_OK = existsSyncRaw(new URL('../../raw/cc-2021-734/fedlex/', import.meta.url));
const RAW_SKIP = 'Ordner raw/ fehlt';

const NET = process.env.SR_NO_NET !== '1';

test('SPARQL-Literale werden maskiert', () => {
  assert.equal(sparqlString('a"b'), '"a\\"b"');
  assert.equal(sparqlString('x\\y'), '"x\\\\y"');
  assert.equal(sparqlString("l'a\n"), '"l\\\'a\\n"');
  assert.equal(sparqlString('\u0001'), '"\\u0001"');
  assert.throws(() => workPath('cc/2007/758> } DROP'), /Ungültige/);
  assert.equal(workPath('cc-2007-758'), 'cc/2007/758');
});

test('Suche: Nutzereingabe verändert die Abfrage nicht', async () => {
  const bodies = [];
  const fake = async (url, init) => { bodies.push(decodeURIComponent(init.body.slice(6))); return { ok: true, status: 200, json: async () => ({ results: { bindings: [] } }) }; };
  const evil = '") } } SELECT * WHERE { ?s ?p ?o } #';
  assert.deepEqual(await searchWorks(evil, { fetch: fake }), []);
  assert.ok(bodies.length >= 1);
  for (const q of bodies) {
    assert.ok(q.includes(sparqlString(evil)), 'Literal maskiert');
    const rest = q.split(sparqlString(evil)).join('LIT');
    assert.equal((rest.match(/SELECT/g) || []).length, 1, 'nur eine Abfrage');
    assert.ok(!rest.includes('?s ?p ?o'), 'Eingabe nur im Literal');
  }
});

test('Impact-Ziele werden auf Einheiten abgebildet, Einträge je Sprache zusammengeführt', () => {
  const base = 'https://fedlex.data.admin.ch/eli/';
  const rows = [
    { imp: base + 'oc/2025/346/x/1', target: base + 'cc/2007/758/art_120d', from: base + 'oc/2025/346/annex_', type: 'https://fedlex.data.admin.ch/vocabulary/impact-type/1', date: '2025-06-15' },
    { imp: base + 'oc/2006/727/x/1', target: base + 'cc/2007/758/text', from: base + 'oc/2006/727/text', type: 'x/impact-type/2', date: '2005-12-16', lang: 'http://publications.europa.eu/resource/authority/language/DEU', comment: 'Art. 72', 'comment@': 'de', label: 'AS 2006 4745' },
    { imp: base + 'oc/2006/727/x/2', target: base + 'cc/2007/758/text', from: base + 'oc/2006/727/text', type: 'x/impact-type/2', date: '2005-12-16', lang: 'http://publications.europa.eu/resource/authority/language/FRA', comment: 'art. 72', 'comment@': 'fr', label: 'RO 2006 4745' },
  ];
  const r = normalizeImpacts(rows, 'cc/2007/758');
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.act === 'oc/2025/346').unit, 'art_120_d');
  const old = r.find((x) => x.act === 'oc/2006/727');
  assert.deepEqual(old.comment, { de: 'Art. 72', fr: 'art. 72' });
  assert.deepEqual(old.label, { de: 'AS 2006 4745', fr: 'RO 2006 4745' });
});

test('loadWork mit fetch aus raw/ ergibt dasselbe Bundle wie der Build (EESV)', { skip: !RAW_OK && RAW_SKIP }, async () => {
  const stats = { sparql: 0, files: 0 }, missing = [];
  const progress = [];
  const b = await loadWork('cc-2021-734', { fetch: rawFetch('cc-2021-734', { stats, missing }), DOMParser, today: fetchedDate('cc-2021-734'), onProgress: (p) => progress.push(p) });
  const { bundle } = await buildFromRaw('cc-2021-734');
  assert.deepEqual(missing, []);
  const files = bundle.stages.length * bundle.langs.length; // je Stand eine Datei je Sprache; folgt neuen Fassungen in raw/
  assert.equal(stats.files, files);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(bundle)));
  assert.ok(progress.some((p) => p.phase === 'download' && p.done === files));
  assert.ok(progress.some((p) => p.phase === 'parse'));
});

test('loadWork: Abbruch über signal und Fehler je Datei mit URL', { skip: !RAW_OK && RAW_SKIP }, async () => {
  const ac = new AbortController();
  const inner = rawFetch('cc-2021-734');
  let n = 0;
  const f = async (url, init) => { if (url !== ENDPOINT && ++n === 2) ac.abort(); return inner(url, init); };
  await assert.rejects(loadWork('cc-2021-734', { fetch: f, DOMParser, signal: ac.signal, concurrency: 1 }), (e) => e.name === 'AbortError');
  const broken = async (url, init) => (url !== ENDPOINT && url.includes('20230901/fr') ? { ok: false, status: 404, text: async () => '' } : inner(url, init));
  await assert.rejects(loadWork('cc-2021-734', { fetch: broken, DOMParser }), (e) => e.code === 'download' && e.errors.length === 1 && e.errors[0].url.includes('20230901/fr'));
});

test('checkUpdates und updateWork ohne neue Fassung ändern nichts', { skip: !RAW_OK && RAW_SKIP }, async () => {
  const { bundle } = await buildFromRaw('cc-2021-734');
  const fetch = rawFetch('cc-2021-734');
  const chk = await checkUpdates(bundle, { fetch });
  assert.deepEqual(chk.newVersions, []);
  assert.deepEqual(chk.changedFiles, []);
  const up = await updateWork(bundle, { fetch, DOMParser });
  assert.deepEqual(up.added, []);
  assert.deepEqual(up.replaced, []);
  // eine fehlende Fassung wird erkannt
  const older = { ...bundle, timeline: bundle.timeline.slice(0, -1), stages: bundle.stages.slice(0, -1) };
  const chk2 = await checkUpdates(older, { fetch });
  assert.deepEqual(chk2.newVersions.map((v) => v.date), [bundle.timeline[bundle.timeline.length - 1].date]);
});

test('Echter Abruf gegen Fedlex: Suche und loadWork (GebV-AIG, SR 142.209)', { skip: !NET && 'SR_NO_NET=1', timeout: 120000 }, async () => {
  const hits = await searchWorks('142.209', { fetch });
  const hit = hits.find((h) => h.sr === '142.209' && h.status === 'inForce');
  assert.ok(hit, 'Treffer 142.209');
  assert.ok(hit.xmlVersions > 0);
  const b = await loadWork(hit.id, { fetch, DOMParser });
  assert.equal(b.work.sr, '142.209');
  assert.ok(b.stages.length >= 1);
  const st = b.stages[b.stages.length - 1];
  const xml = await (await fetch(st.source.url.de)).text();
  const src = tokenize(sourceText(xml).text);
  const seq = [];
  for (const e of tocAt(b, st.id, 'de')) {
    if (!e.unit) { seq.push(e.label, e.text, e.sub || ''); continue; }
    const v = getVersion(b, e.id, 'de', st.id);
    seq.push(v.label, v.title, ...v.blocks.flatMap((x) => [x.l, x.t]));
  }
  assert.deepEqual(tokenize(seq.map(stripHtml).join(' ')), src, 'Wortlaut des echt geladenen Stands');
  const amb = await searchWorks('142.204', { fetch });
  assert.equal(amb[0].status, 'inForce');
  assert.ok(amb.some((h) => h.status === 'repealed'));
});
