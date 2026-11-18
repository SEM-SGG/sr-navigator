// Tests für scripts/fetch-raw.mjs: Welche Volltexte lädt das Skript neu? Ohne Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDownloads, xmlUrls, rawName } from '../../scripts/fetch-raw.mjs';

const F = 'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2007/759/';
const url = (d, l, n = '') => `${F}${d}/${l}/xml/fedlex-data-admin-ch-eli-cc-2007-759-${d}-${l}-xml${n}.xml`;
const version = (date, files) => ({ date, files: Object.fromEntries(['de', 'fr', 'it'].map((l) => [l, { xml: files[l] || null, pdf: null, html: null }])) });

test('fetch-raw: ersetzte Datei wird neu geladen, unveränderte nicht', () => {
  const prev = { versions: [
    version('2026-06-12', { de: url('20260612', 'de', '-2'), fr: url('20260612', 'fr', '-2'), it: url('20260612', 'it', '-2') }),
    version('2026-10-01', { de: url('20261001', 'de'), fr: url('20261001', 'fr'), it: url('20261001', 'it') }),
  ] };
  const next = { versions: [
    prev.versions[0],
    version('2026-10-01', { de: url('20261001', 'de', '-1'), fr: url('20261001', 'fr', '-1'), it: url('20261001', 'it') }),
    version('2027-01-01', { de: url('20270101', 'de') }),
  ] };
  const present = new Set([...xmlUrls(prev).keys()]);
  const plan = planDownloads(prev, next, (n) => present.has(n));
  const by = Object.fromEntries(plan.map((p) => [p.name, p.action]));
  assert.deepEqual(by, {
    '20260612_de.xml': 'cached', '20260612_fr.xml': 'cached', '20260612_it.xml': 'cached',
    '20261001_de.xml': 'replaced', '20261001_fr.xml': 'replaced', '20261001_it.xml': 'cached',
    '20270101_de.xml': 'new',
  });
  const de = plan.find((p) => p.name === '20261001_de.xml');
  assert.equal(de.prevUrl, url('20261001', 'de'));
  assert.equal(de.url, url('20261001', 'de', '-1'));
});

test('fetch-raw: fehlende Datei wird geladen, ohne gespeicherte Adresse bleibt die vorhandene Datei', () => {
  const next = { versions: [version('2026-10-01', { de: url('20261001', 'de', '-1'), fr: url('20261001', 'fr', '-1') })] };
  const plan = planDownloads(null, next, (n) => n === '20261001_de.xml');
  assert.deepEqual(plan.map((p) => [p.name, p.action]), [['20261001_de.xml', 'unchecked'], ['20261001_fr.xml', 'new']]);
  assert.equal(rawName('2026-10-01', 'it'), '20261001_it.xml');
});
