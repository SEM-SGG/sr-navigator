// Layoutprüfung (keine abgeschnittenen oder überlappenden Texte) bei 1024, 1280, 1440, 1920 px in DE, FR und IT in jeder Ansicht,
// Schaltflächenprüfung und Screenshots aller Ansichten nach test/app/out/shots/.
import { test, expect, MANIFEST_URL, manifestRoute, currentManifest, updateSettled } from './pw.mjs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { layoutCheck, buttonCheck, mockFedlex } from './helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const APP = 'file://' + join(ROOT, 'dist/sr-navigator.html');
const SHOTS = join(ROOT, 'test/app/out/shots');
const SHOTS_REFS = join(ROOT, 'test/app/out/shots-refs');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(SHOTS_REFS, { recursive: true });
const AIG = 'cc-2007-758';
const WIDTHS = [1024, 1280, 1440, 1920];
const LANGS = ['de', 'fr', 'it'];

async function open(page, hash) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP + hash);
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  return errors;
}
async function nav(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(120);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Ansichten mit Hash; Platzhalter {cb} (Bestimmung mit Chronologie), {fut} (künftige Fassung). */
function views(ctx) {
  const v = [
    ['bibliothek', '#/bibliothek'],
    ['uebersicht', `#/uebersicht?w=${AIG}`],
    ['lesen', `#/lesen?w=${AIG}&u=art_5`],
    ['lesen-chronologie', `#/lesen?w=${AIG}&u=${ctx.u}&k=${ctx.k}`],
    ['lesen-einheit-chronologie', `#/lesen?w=${AIG}&u=${ctx.u}&k=*`],
    ['lesen-in-kraft-am', `#/lesen?w=${AIG}&u=art_5&m=datum&d=2023-01-01`],
    ['lesen-vor-xml', `#/lesen?w=${AIG}&u=art_5&m=datum&d=2015-01-01`],
    ['lesen-redline', `#/lesen?w=${AIG}&u=${ctx.u}&red=1&s=${ctx.s}`],
    ['lesen-suche', `#/lesen?w=${AIG}&u=art_5&q=Einreise`],
    ['lesen-filter-erlass', `#/lesen?w=${AIG}&u=${ctx.u}&act=${encodeURIComponent(ctx.act)}`],
    ['chronik', `#/chronik?w=${AIG}&u=${ctx.u}&k=${ctx.k}`],
    ['chronik-einheit', `#/chronik?w=${AIG}&u=${ctx.u}&k=*`],
    ['vergleich', `#/vergleich?w=${AIG}&u=${ctx.u}&a=${ctx.a}&b=${ctx.s}`],
    ['vergleich-redline', `#/vergleich?w=${AIG}&u=${ctx.u}&a=${ctx.a}&b=${ctx.s}&lay=redline&sc=full`],
    ['sprachvergleich', `#/vergleich?w=${AIG}&u=art_5&cm=sprache`],
    ['aktualisieren', `#/aktualisieren?w=${AIG}`],
    ['anleitung', `#/anleitung?w=${AIG}`],
    ['anleitung-legende', `#/anleitung?w=${AIG}&sec=legende`],
    ['info', `#/info?w=${AIG}`],
  ];
  if (ctx.fut) v.splice(8, 0, ['lesen-kuenftig', `#/lesen?w=${AIG}&u=${ctx.fut.u}&s=${ctx.fut.s}`]);
  if (ctx.other) v.push(['uebersicht-eesv', `#/uebersicht?w=${ctx.other}`]);
  // Verweise (SPEC §12.3): Zustand ausserhalb des Hash über die Prüfschnittstelle, danach zurückgesetzt
  const panel = (view) => ({ set: { panel: true, refsView: view }, post: { panel: false, refsView: 'list' } });
  const showStruct = async (page) => { await page.locator('#rs-sec').scrollIntoViewIfNeeded(); await page.locator('#rs-sec svg.rs-svg, #rs-sec .rs-table').first().waitFor(); await page.evaluate(() => document.fonts.ready); };
  v.push(
    ['lesen-verweise-liste', `#/lesen?w=${AIG}&u=art_76&k=*`, { ...panel('list'), after: async (page) => { await page.locator('.rl').waitFor(); } }],
    ['lesen-verweise-netz', `#/lesen?w=${AIG}&u=art_120_d&k=*`, { ...panel('net'), after: async (page) => { await page.locator('svg.rn-svg').waitFor(); } }],
    ['lesen-verweise-bestimmung', `#/lesen?w=${AIG}&u=art_76&k=${ctx.refKey}`, { ...panel('net'), after: async (page) => { await page.locator('svg.rn-svg').waitFor(); } }],
    ['verweisnetz-dialog', `#/lesen?w=${AIG}&u=art_76&k=*`, { ...panel('net'), after: async (page) => { await page.locator('.rn-open:not([disabled])').click(); await page.locator('[role="dialog"] svg.rn-svg').waitFor(); }, close: true }],
    ['uebersicht-verweisstruktur', `#/uebersicht?w=${AIG}`, { after: showStruct }],
    ['uebersicht-verweisstruktur-auswahl', `#/uebersicht?w=${AIG}`, { after: async (page) => { await showStruct(page); await page.locator('#rs-sec rect.rs-col[data-col="60"]').click(); await page.locator('.rs-bar[data-unit]').scrollIntoViewIfNeeded(); await page.mouse.move(2, 2); } }],
    ['uebersicht-verweisstruktur-tabelle', `#/uebersicht?w=${AIG}`, { set: { refsStructView: 'table' }, post: { refsStructView: 'chart' }, after: showStruct }],
  );
  if (ctx.other) v.push(['uebersicht-eesv-verweisstruktur', `#/uebersicht?w=${ctx.other}`, { after: async (page) => { await showStruct(page); await page.locator('#rs-sec rect.rs-col[data-col="5"]').click(); await page.mouse.move(2, 2); } }]);
  return v;
}
async function setRefs(page, st) {
  if (!st) return;
  await page.evaluate((st) => { if ('panel' in st) window.__srRefs.setPanel(st.panel); for (const k of ['refsView', 'refsStructView']) if (k in st) window.__srRefs.setSetting(k, st[k]); }, st);
}

async function context(page) {
  return page.evaluate(async () => {
    const d = await window.__sr.open('cc-2007-758');
    let best = null;
    for (const u of d.unitOrder) {
      if (d.unitChangeStages(u, 'de').length < 2) continue;
      const vs = d.versions(u, 'de');
      const last = vs[vs.length - 1];
      for (const b of last.blocks || []) {
        if (!b.t || b.ty) continue;
        const h = d.history(u, 'de', b.k);
        if (h.length >= 2 && (!best || h.length > best.n)) best = { u, k: b.k, n: h.length, s: h[h.length - 1].stage };
      }
      if (best && best.n >= 3) break;
    }
    const a = d.prevStage(best.s).id;
    const fs = d.stages.find((x) => d.isFuture(x.id));
    const fut = fs ? { s: fs.id, u: d.unitOrder.find((id) => d.versions(id, 'de').some((v) => v.stage === fs.id)) } : null;
    const act = d.unitActs(best.u, 'de')[0];
    const other = window.__sr.library().map((e) => e.id).find((id) => id === 'cc-2021-734');
    const rctx = await window.__srRefs.context(d, 'de');
    const refKey = (d.version('art_76', 'de', d.current.id).blocks.find((b) => { const g = window.__srRefs.egoGraph(rctx, 'art_76', b.k, null); return g.stats.inRefs && g.stats.outRefs; }) || d.version('art_76', 'de', d.current.id).blocks[0]).k;
    return { ...best, a, fut, act, other, refKey };
  });
}

const report = { checked: 0, issues: {} };

for (const ui of LANGS) {
  test(`Layoutprüfung ${ui.toUpperCase()} bei ${WIDTHS.join(', ')} px, alle Ansichten`, async ({ page }) => {
    test.setTimeout(900000);
    const errors = await open(page, `#/bibliothek?ui=${ui}`);
    const ctx = await context(page);
    const issues = [];
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const [name, h, o = {}] of views(ctx)) {
        if (o.set) { await nav(page, `#/bibliothek?ui=${ui}`); await setRefs(page, o.set); }
        await nav(page, `${h}${h.includes('?') ? '&' : '?'}ui=${ui}`);
        if (o.after) await o.after(page);
        const li = await page.evaluate(layoutCheck);
        const bi = await page.evaluate(buttonCheck);
        report.checked++;
        for (const x of [...li, ...bi]) issues.push(`${w} ${ui} ${name}: ${x}`);
        if (ui === 'de' && w === 1440) await page.screenshot({ path: join(SHOTS, `1440-de-${name}.png`) });
        if (ui === 'de' && w === 1024 && ['bibliothek', 'uebersicht', 'lesen-chronologie', 'vergleich'].includes(name)) await page.screenshot({ path: join(SHOTS, `1024-de-${name}.png`) });
        if (ui !== 'de' && w === 1440 && ['uebersicht', 'lesen-chronologie', 'vergleich', 'bibliothek'].includes(name)) await page.screenshot({ path: join(SHOTS, `1440-${ui}-${name}.png`) });
        if (ui === 'de' && w === 1920 && name === 'lesen-chronologie') await page.screenshot({ path: join(SHOTS, `1920-de-${name}.png`) });
        if (/verweis/.test(name) && (w === 1024 || w === 1920 || (ui !== 'de' && w === 1440))) await page.screenshot({ path: join(SHOTS_REFS, `layout-${w}-${ui}-${name}.png`) });
        if (o.close) { await page.keyboard.press('Escape'); await page.locator('[role="dialog"]').waitFor({ state: 'detached' }); }
        if (o.post) await setRefs(page, o.post);
      }
    }
    report.issues[ui] = issues;
    writeFileSync(join(ROOT, `test/app/out/layout-${ui}.json`), JSON.stringify({ checked: WIDTHS.length * views(ctx).length, issues }, null, 1));
    expect(issues).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('Screenshots: Sammelkorb, Erlasswahl, Suchergebnis mit Fortschritt (DE 1440)', async ({ page }) => {
  await mockFedlex(page, { delayMs: 400 });
  await page.goto('file://' + join(ROOT, 'test/app/out/sr-navigator-ohne-eesv.html#/bibliothek?ui=de'));
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await page.fill('#lib-q', '142.206');
  await page.click('#btn-lib-search');
  await expect(page.locator('tr[data-work="cc-2021-734"]')).toBeVisible();
  await page.locator('tr[data-work="cc-2021-734"] .btn-add').click();
  await expect(page.locator('.job')).toContainText('Datei');
  await page.locator('.lib-search').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, '1440-de-bibliothek-hinzufuegen.png') });
  expect(await page.evaluate(layoutCheck)).toEqual([]);
  await page.click('#btn-job-cancel');
  await page.evaluate(() => { location.hash = '#/uebersicht?w=cc-2007-758&ui=de'; });
  await page.click('#btn-work');
  await page.screenshot({ path: join(SHOTS, '1440-de-erlasswahl.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#/chronik?w=cc-2007-758&u=art_5&k=*&ui=de'; });
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'In Sammelkorb (A4)' }).click();
  await page.click('#btn-basket');
  await page.screenshot({ path: join(SHOTS, '1440-de-sammelkorb.png') });
});
