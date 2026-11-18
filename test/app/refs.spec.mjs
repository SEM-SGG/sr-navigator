// Browsertests Verweisnetz (Chronologie-Leiste, Dialog) und Verweisstruktur (Übersicht), SPEC §12.3, über file://.
// Screenshots nach test/app/out/shots-refs/.
import { test, expect, MANIFEST_URL, manifestRoute, currentManifest, updateSettled } from './pw.mjs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { layoutCheck } from './helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const APP = 'file://' + join(ROOT, 'dist/sr-navigator.html');
const OUT = join(ROOT, 'test/app/out');
const SHOTS = join(OUT, 'shots-refs');
mkdirSync(SHOTS, { recursive: true });
const AIG = 'cc-2007-758';
const ASYLG = 'cc-1999-358';
const EESV = 'cc-2021-734';

async function open(page, hash) {
  const log = { errors: [], requests: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob):/.test(u) && u !== MANIFEST_URL) log.requests.push(u); });
  await page.goto(APP + hash);
  await page.waitForFunction(() => window.__sr && window.__sr.ready, null, { timeout: 30000 });
  return log;
}
async function nav(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(80);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
const pngOk = (buf) => buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
/** Erwartete Kennzahlen aus denselben Modellfunktionen (Prüfschnittstelle). */
async function expected(page, work, unit, key = null) {
  return page.evaluate(async ({ work, unit, key }) => {
    const d = await window.__sr.open(work);
    const ctx = await window.__srRefs.context(d, 'de');
    return window.__srRefs.egoGraph(ctx, unit, key, null).stats;
  }, { work, unit, key });
}

test('Verweise in der Leiste: Wahl «Verweise», Liste als Standard, Netz gespeichert, Zahlen gleich', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}&u=art_76&k=*`);
  const panel = page.locator('aside.panel');
  await expect(panel.getByRole('button', { name: 'Chronologie', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Verweise', exact: true }).click();
  await expect(panel).toHaveClass(/is-refs/);
  await expect(panel.getByRole('button', { name: 'Liste', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const exp = await expected(page, AIG, 'art_76');
  await expect(panel.locator('.rl-count[data-side="in"]')).toHaveAttribute('data-refs', String(exp.inRefs));
  await expect(panel.locator('.rl-count[data-side="in"]')).toHaveAttribute('data-n', String(exp.inUnits));
  await expect(panel.locator('.rl-count[data-side="out"]')).toHaveAttribute('data-refs', String(exp.outRefs));
  await expect(panel.locator('.rl-count[data-side="out"]')).toHaveAttribute('data-n', String(exp.outNodes));
  const listText = { in: await panel.locator('.rl-count[data-side="in"]').textContent(), out: await panel.locator('.rl-count[data-side="out"]').textContent() };
  // Liste: eine Zeile je Fundstelle und Ziel bzw. Quelle
  await expect(panel.locator('[aria-labelledby="rl-out-h"] .rl-item')).toHaveCount(exp.outRefs);
  await expect(panel.locator('[aria-labelledby="rl-in-h"] .rl-item')).toHaveCount(exp.inRefs);
  await expect(panel.locator('.rl-ex mark').first()).toBeVisible();
  expect(await panel.locator('.rl-ex').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Plex Serif/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(SHOTS, 'e-1440-de-leiste-liste.png') });
  // Netz
  await panel.getByRole('button', { name: 'Netz', exact: true }).click();
  await expect(panel.locator('svg.rn-svg')).toBeVisible();
  const shown = await panel.locator('.rn-node').count();
  expect(shown).toBeGreaterThan(5);
  expect(await panel.locator('.rn-node[data-side="left"]').count()).toBeLessThanOrEqual(7);
  await expect(panel.locator('.rn-more').first()).toContainText('weitere');
  await expect(panel.locator('.rn-legend')).toContainText('Linienstärke = Zahl der Fundstellen');
  // Zähler je Seite im Netz: gleiche Wörter und Zahlen wie in der Liste
  const sideText = (side) => panel.locator(`.rn-side[data-side="${side}"] .rn-sidecount`).allTextContents().then((l) => l.join(' '));
  expect(await sideText('in')).toBe(listText.in);
  expect(await sideText('out')).toBe(listText.out);
  await expect(panel.locator('.rn-side[data-side="in"]')).toHaveAttribute('data-refs', String(exp.inRefs));
  await page.screenshot({ path: join(SHOTS, 'a-1440-de-leiste-netz.png') });
  // gespeichert: nach dem Neuladen wieder Netz (Wahl «Verweise» gilt für die Sitzung)
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await page.locator('aside.panel').getByRole('button', { name: 'Verweise', exact: true }).click();
  await expect(page.locator('aside.panel').getByRole('button', { name: 'Netz', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(log.errors).toEqual([]);
  expect(log.requests).toEqual([]);
});

test('Verweise einer Bestimmung: Umfang «Bestimmung | ganzer Artikel», Tooltip bei Fokus, Navigation', async ({ page }) => {
  await open(page, `#/lesen?w=${AIG}&u=art_76`);
  await page.locator('.unit-head').waitFor();
  const key = await page.evaluate(async () => {
    const d = await window.__sr.open('cc-2007-758');
    const ctx = await window.__srRefs.context(d, 'de');
    for (const b of d.version('art_76', 'de', d.current.id).blocks) { const g = window.__srRefs.egoGraph(ctx, 'art_76', b.k, null); if (g.stats.outRefs && g.stats.inRefs) return b.k; }
    return d.version('art_76', 'de', d.current.id).blocks[0].k;
  });
  await page.locator(`.blk[data-k="${key}"]`).click();
  const panel = page.locator('aside.panel');
  await expect(panel.getByRole('button', { name: 'Änderungen', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Verweise', exact: true }).click();
  await panel.getByRole('button', { name: 'Netz', exact: true }).click();
  const scope = panel.locator('.rn-scope');
  await expect(scope.getByRole('button', { name: 'ganzer Artikel' })).toBeVisible();
  const ek = await expected(page, AIG, 'art_76', key);
  const eu = await expected(page, AIG, 'art_76', null);
  await expect(panel.locator('.rn-side[data-side="out"]')).toHaveAttribute('data-refs', String(ek.outRefs));
  await expect(panel.locator('.rn-side[data-side="in"]')).toHaveAttribute('data-refs', String(ek.inRefs));
  await scope.getByRole('button', { name: 'ganzer Artikel' }).click();
  await expect(panel.locator('.rn-side[data-side="out"]')).toHaveAttribute('data-refs', String(eu.outRefs));
  await expect(panel.locator('.rn-side[data-side="in"]')).toHaveAttribute('data-n', String(eu.inUnits));
  // Tooltip bei Fokus
  const node = panel.locator('a.rn-node[data-side="right"]').first();
  await node.focus();
  await expect(panel.locator('.rn-tip')).toBeVisible();
  await expect(panel.locator('.rn-tip-h')).toContainText('→');
  expect(await panel.locator('.rn-tip-x').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Plex Serif/);
  await expect(panel.locator('.rn-edge.is-on')).toHaveCount(1);
  await page.screenshot({ path: join(SHOTS, 'b-1440-de-tooltip.png') });
  // Klick auf einen Knoten des eigenen Erlasses navigiert
  const target = await panel.locator(`a.rn-node[data-node^="u|${AIG}|"][data-side="right"]`).first().getAttribute('data-node');
  const unit = target.split('|')[2];
  await panel.locator(`a.rn-node[data-node="${target}"][data-side="right"]`).click();
  await expect(page).toHaveURL(new RegExp(`u=${unit}(&|$)`));
  await expect(page.locator('aside.panel')).toHaveClass(/is-refs/);
  await expect(page.locator('.unit-head .unit-label')).toContainText(unit.replace('art_', '').replace(/_/g, ''));
});

test('Verweisnetz: Knoten eines anderen Bibliotheks-Erlasses wechselt den Erlass, Knoten nach aussen in neuem Tab', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}&u=art_76&k=*`);
  const panel = page.locator('aside.panel');
  await panel.getByRole('button', { name: 'Verweise', exact: true }).click();
  await panel.getByRole('button', { name: 'Netz', exact: true }).click();
  const ext = panel.locator('a.rn-node[data-node^="sr|"]').first();
  await expect(ext).toHaveAttribute('target', '_blank');
  await expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await ext.getAttribute('href')).toMatch(/^https:\/\/www\.fedlex\.admin\.ch\/eli\//);
  const lib = panel.locator(`a.rn-node[data-node^="u|${ASYLG}|"]`).first();
  const id = await lib.getAttribute('data-node');
  await lib.click();
  await expect(page).toHaveURL(new RegExp(`w=${ASYLG}`));
  await expect(page).toHaveURL(new RegExp(`u=${id.split('|')[2]}(&|$)`));
  await expect(page.locator('aside.panel')).toHaveClass(/is-refs/);
  await expect(page.locator('.btn-work .wp-abbr')).toHaveText('AsylG');
  // Stand nach Datum: Fassung des AsylG, die am Datum der gelesenen AIG-Fassung in Kraft war
  const ok = await page.evaluate(async () => { const aig = await window.__sr.open('cc-2007-758'); const d = window.__sr.data(); const s = new URLSearchParams(location.hash.split('?')[1]).get('s'); return !s || s === d.stageAt(aig.current.date); });
  expect(ok).toBe(true);
  expect(log.errors).toEqual([]);
  expect(log.requests).toEqual([]);
});

test('Netz vergrössern: Dialog modal, Hash unverändert, Esc schliesst nur den Dialog, Fokus zurück, PNG-Export', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}&u=art_76&k=*`);
  const panel = page.locator('aside.panel');
  await panel.getByRole('button', { name: 'Verweise', exact: true }).click();
  const hash = await page.evaluate(() => location.hash);
  await panel.locator('.rn-open').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute('aria-modal', 'true');
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  expect(await page.evaluate(() => document.getElementById('app').inert)).toBe(true);
  const exp = await expected(page, AIG, 'art_76');
  await expect(dlg.locator('.rn-side[data-side="in"]')).toHaveAttribute('data-refs', String(exp.inRefs));
  await expect(dlg.locator('.rn-side[data-side="out"]')).toHaveAttribute('data-refs', String(exp.outRefs));
  await expect(dlg.locator('.rn-side[data-side="out"]')).toHaveAttribute('data-n', String(exp.outNodes));
  await expect(dlg.locator('.rn-more')).toHaveCount(0); // ohne Kürzung
  await expect(dlg.locator('.rn-node')).toHaveCount(exp.inUnits + exp.outNodes);
  // Fokusfalle
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
  await page.screenshot({ path: join(SHOTS, 'c-1440-de-dialog.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.locator('#rd-png').click()]);
  const p = join(OUT, 'export-verweisnetz.png');
  await dl.saveAs(p);
  const buf = readFileSync(p);
  expect(pngOk(buf)).toBe(true);
  expect(buf.readUInt32BE(16)).toBe(794 * 2);
  expect(dl.suggestedFilename()).toBe('Art-76-AIG_Verweisnetz_A4.png');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('aside.panel')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('rn-open'))).toBe(true);
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  expect(await page.evaluate(() => document.getElementById('app').inert)).toBe(false);
  expect(log.errors).toEqual([]);
});

test('Leiste bei 1024 px: Netz in der Schublade ohne Überlappung', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await open(page, `#/lesen?w=${AIG}&u=art_120_d&k=*`);
  const panel = page.locator('aside.panel');
  await panel.getByRole('button', { name: 'Verweise', exact: true }).click();
  await panel.getByRole('button', { name: 'Netz', exact: true }).click();
  await expect(panel.locator('svg.rn-svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(layoutCheck)).toEqual([]);
  await page.screenshot({ path: join(SHOTS, 'd-1024-de-leiste-netz.png') });
});

test('Verweisstruktur: Platzhalter, Auswahl per Klick und Tastatur, Leiste, Absprünge, Tabelle, PNG', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  const log = await open(page, `#/uebersicht?w=${AIG}`);
  const sec = page.locator('#rs-sec');
  await expect(sec.locator('h2')).toHaveText('Verweisstruktur');
  // Erstes Rendern: der Abschnitt liegt ausserhalb der Sichtnähe, der Platzhalter steht, nichts ist berechnet
  await expect(sec.locator('.rs-placeholder')).toBeVisible();
  expect(await page.evaluate(() => (window.__srRefsTimings || []).filter((x) => x.what === 'structure').length)).toBe(0);
  await sec.scrollIntoViewIfNeeded();
  await expect(sec.locator('svg.rs-svg')).toBeVisible();
  await expect(sec.locator('.rs-placeholder')).toHaveCount(0);
  const timing = await page.evaluate(() => window.__srRefsTimings.slice());
  console.log('Rechenzeit AIG im Browser (ms):', JSON.stringify(timing));
  await page.setViewportSize({ width: 1440, height: 900 });
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, 'f-1440-de-struktur-aig.png') });
  // Erwartung aus dem Modell
  const exp = await page.evaluate(async () => {
    const d = window.__sr.data();
    const ctx = await window.__srRefs.context(d, 'de');
    const cols = window.__srRefs.structColumns(d, 'de', d.current.id);
    const m = window.__srRefs.structureModel(ctx, cols);
    const i = cols.findIndex((c) => c.unit === 'art_76');
    const partners = m.arcs.filter((a) => a.a === i || a.b === i).length;
    const g = window.__srRefs.egoGraph(ctx, 'art_76', null, null).stats;
    return { i, n: cols.length, partners, g, arcs: m.arcs.length };
  });
  expect(await sec.locator('.rs-arcs path').count()).toBe(exp.arcs);
  const colW = Number(await sec.locator('svg.rs-svg').getAttribute('data-colw'));
  expect(colW).toBeGreaterThanOrEqual(4);
  // Klick wählt die Spalte
  await sec.locator(`rect.rs-col[data-col="${exp.i}"]`).click();
  await expect(sec.locator('.rs-bar')).toHaveAttribute('data-unit', 'art_76');
  await expect(sec.locator('rect.rs-selcol')).toHaveCount(1);
  await expect(sec.locator('circle.rs-selpt')).toHaveCount(1);
  await expect(sec.locator('.rs-arcs path.is-out, .rs-arcs path.is-in')).toHaveCount(exp.partners);
  await expect(sec.locator('#rs-kpi-in')).toHaveAttribute('data-refs', String(exp.g.inRefs));
  await expect(sec.locator('#rs-kpi-out')).toHaveAttribute('data-refs', String(exp.g.outRefs));
  await expect(sec.locator('.rs-top-l li')).toHaveCount(3);
  await sec.locator('.rs-bar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, 'g-1440-de-struktur-auswahl.png') });
  // Verweisnetz zeigen: Dialog mit denselben Zahlen
  await sec.locator('#rs-net').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dl2 = page.getByRole('dialog');
  for (const side of ['in', 'out']) {
    await expect(dl2.locator(`.rn-side[data-side="${side}"]`)).toHaveAttribute('data-refs', String(side === 'in' ? exp.g.inRefs : exp.g.outRefs));
    const a = (await dl2.locator(`.rn-side[data-side="${side}"] .rn-sidecount`).allTextContents()).join(' ');
    expect(a).toBe(await sec.locator(`#rs-kpi-${side} .rs-kpi-v`).textContent()); // gleiche Wörter wie die Leiste
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Tastatur: Pos1, Ende, Pfeil, Enter
  await sec.locator(`rect.rs-col[data-col="${exp.i}"]`).focus();
  await page.keyboard.press('Home');
  await expect(sec.locator('rect.rs-col[data-col="0"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(sec.locator(`rect.rs-col[data-col="${exp.n - 1}"]`)).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(sec.locator('rect.rs-col[data-col="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sec.locator('rect.rs-col[data-col="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(sec.locator('.rs-bar')).toHaveAttribute('data-unit', /.+/);
  await page.keyboard.press(' ');
  await expect(sec.locator('rect.rs-col[aria-pressed="true"]')).toHaveCount(0);
  // PNG
  const [dl] = await Promise.all([page.waitForEvent('download'), sec.locator('#rs-png').click()]);
  const p = join(OUT, 'export-verweisstruktur.png');
  await dl.saveAs(p);
  const buf = readFileSync(p);
  expect(pngOk(buf)).toBe(true);
  expect(buf.readUInt32BE(16)).toBeGreaterThanOrEqual(exp.n * 4 * 2);
  // Tabelle: Zahlen wie Modell, Wahl gespeichert
  await sec.getByRole('button', { name: 'Tabelle', exact: true }).click();
  const row = sec.locator('tr[data-unit="art_76"]');
  await expect(row.locator('td[data-k="in"]')).toHaveText(String(exp.g.inRefs));
  const cells = await row.locator('td.num').allTextContents();
  const sum = cells.filter((_, i) => i !== 1).reduce((s, x) => s + (Number(x) || 0), 0);
  expect(sum).toBe(exp.g.outRefs);
  await page.screenshot({ path: join(SHOTS, 'h-1440-de-struktur-tabelle.png') });
  // «alle zeigen»
  const n1 = await sec.locator('.rs-table tbody tr').count();
  await sec.locator('#rs-all').check();
  await expect(sec.locator('.rs-table tbody tr')).toHaveCount(exp.n);
  expect(n1).toBeLessThan(exp.n);
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await page.locator('#rs-sec').scrollIntoViewIfNeeded();
  await expect(page.locator('#rs-sec .rs-table')).toBeVisible();
  await page.locator('#rs-sec').getByRole('button', { name: 'Diagramm', exact: true }).click();
  // Text lesen
  await page.locator(`#rs-sec rect.rs-col[data-col="${exp.i}"]`).click();
  await page.locator('#rs-read').click();
  await expect(page).toHaveURL(/#\/lesen\?.*u=art_76/);
  expect(log.errors).toEqual([]);
  expect(log.requests).toEqual([]);
});

test('Verweisstruktur EESV, VZAE und AsylG; Netz und Struktur gleich über alle Einheiten der EESV', async ({ page }) => {
  await open(page, `#/uebersicht?w=${EESV}`);
  const sec = page.locator('#rs-sec');
  await sec.scrollIntoViewIfNeeded();
  await expect(sec.locator('svg.rs-svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(layoutCheck)).toEqual([]);
  // Leiste neben dem Diagramm (27 Einheiten)
  await expect(sec.locator('.rs-grid')).toHaveClass(/is-beside/);
  await sec.locator('rect.rs-col[data-col="5"]').click();
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, 'i-1440-de-struktur-eesv.png') });
  const bad = await page.evaluate(async () => {
    const d = window.__sr.data();
    const ctx = await window.__srRefs.context(d, 'de');
    const m = window.__srRefs.structureModel(ctx, window.__srRefs.structColumns(d, 'de', d.current.id));
    const out = [];
    for (const u of d.unitOrder) {
      const g = window.__srRefs.egoGraph(ctx, u, null, null).stats;
      const s = m.units.get(u) || { inRefs: 0, outRefs: 0, inUnits: 0, outNodes: 0 };
      if (g.inRefs !== s.inRefs || g.outRefs !== s.outRefs || g.inUnits !== s.inUnits || g.outNodes !== s.outNodes) out.push(u);
    }
    return out;
  });
  expect(bad).toEqual([]);
  for (const [w, name] of [['cc-2007-759', 'j-1440-de-struktur-vzae.png'], [ASYLG, 'j-1440-de-struktur-asylg.png']]) {
    await nav(page, `#/uebersicht?w=${w}`);
    await page.locator('#rs-sec').scrollIntoViewIfNeeded();
    await expect(page.locator('#rs-sec svg.rs-svg')).toBeVisible();
    expect(await page.evaluate(layoutCheck)).toEqual([]);
    await page.screenshot({ path: join(SHOTS, name) });
  }
});

test('Verweise in FR und IT: Leiste, Dialog und Verweisstruktur', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}&u=art_76&k=*&ui=fr&l=fr`);
  const panel = page.locator('aside.panel');
  await panel.getByRole('button', { name: 'Renvois', exact: true }).click();
  await panel.getByRole('button', { name: 'Réseau', exact: true }).click();
  await expect(panel.locator('.rn-side[data-side="in"] .rn-head')).toHaveText('Cité par');
  await expect(panel.locator('.rn-side[data-side="out"] .rn-head')).toHaveText('Renvoie à');
  await expect(panel.locator('.rn-side[data-side="out"]')).toContainText('passages');
  await page.screenshot({ path: join(SHOTS, 'k-1440-fr-leiste-netz.png') });
  await panel.locator('.rn-open').click();
  await expect(page.getByRole('dialog')).toContainText('Exporter en PNG');
  await page.keyboard.press('Escape');
  await nav(page, `#/uebersicht?w=${AIG}&ui=it&l=it`);
  const sec = page.locator('#rs-sec');
  await expect(sec.locator('h2')).toHaveText('Struttura dei rinvii');
  await sec.scrollIntoViewIfNeeded();
  await expect(sec.locator('svg.rs-svg')).toBeVisible();
  await sec.locator('rect.rs-col[data-col="10"]').click();
  await expect(sec.locator('#rs-read')).toHaveText(/Leggere il testo/);
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, 'k-1440-it-struktur.png') });
  const txt = await page.evaluate(() => document.body.innerText);
  expect(txt).not.toMatch(/⟦/);
  expect(log.errors).toEqual([]);
});

test('Anleitung und Info: Abschnitte zu Verweisnetz und Verweisstruktur mit gerenderten Formen, Methodik', async ({ page }) => {
  await open(page, `#/anleitung?w=${AIG}&sec=verweisnetz`);
  await expect(page.locator('#g-verweisnetz h3')).toHaveText('Verweise einer Bestimmung sehen');
  await expect(page.locator('#g-verweisstruktur h3')).toHaveText('Verweisstruktur eines Erlasses lesen');
  await expect(page.locator('.g-legend .rn-legend .rn-ico')).toHaveCount(6);
  await expect(page.locator('.g-refs svg.rn-svg')).toBeVisible();
  await nav(page, `#/info?w=${AIG}`);
  await expect(page.locator('main')).toContainText('Fundstellen, deren Ziel nicht eindeutig ist, erscheinen nicht als Kante');
});
