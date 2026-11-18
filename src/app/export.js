// Export von Karten als PNG und PDF (offline, file://).
import { html } from 'htm/preact';
import { render } from 'preact';
import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Card, FORMATS, cardTitle, cardSubtitle } from './ui/card.js';
import { t, withUiLang, uiLang } from './lib/i18n.js';

const L = (spec) => spec.ui || uiLang();

let fontCSS = null;
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export function fileBase(data, spec) {
  return withUiLang(L(spec), () => {
    const ti = cardTitle(data, spec).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    const kind = t(spec.kind === 'compare' ? (spec.cm === 'sprache' ? 'export.file.lang' : 'export.file.compare') : spec.kind === 'refnet' ? 'export.file.refnet' : spec.kind === 'refstruct' ? 'export.file.refstruct' : 'export.file.chron');
    return `${ti}_${kind}_${spec.format === '169' ? '16x9' : 'A4'}`;
  });
}

async function mountCard(data, spec) {
  const host = document.createElement('div');
  host.className = 'card-host';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const f = FORMATS[spec.format] || FORMATS.a4;
  let fs = f.h ? 19 : 16;
  const draw = () => withUiLang(L(spec), () => render(html`<${Card} data=${data} spec=${spec} fs=${fs} />`, host));
  draw();
  await document.fonts.ready;
  await frame();
  // 16:9: Schrift verkleinern, bis die Karte auf eine Folie passt (Untergrenze 11 px)
  if (f.h) {
    while (host.firstElementChild.offsetHeight > f.h && fs > 11) {
      fs -= 1;
      draw();
      await frame();
    }
  }
  return host;
}

// SVG in Karten (Verweisnetz, Verweisstruktur): Darstellung aus den Stilregeln als Inline-Stil übernehmen, damit das
// Bild sie behält (html-to-image überträgt Klassenregeln auf SVG-Elemente nicht zuverlässig). Werte stammen aus tokens.css.
const SVG_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-decoration', 'paint-order', 'visibility', 'display'];
function inlineSvgStyles(root) {
  for (const el of root.querySelectorAll('svg, svg *')) {
    const cs = getComputedStyle(el);
    const decl = SVG_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
    el.setAttribute('style', decl);
  }
}

const MAX_PX = 16000; // Canvas-Grenze der Browser (Höhe)

/** Montiert die Karte und führt fn(node, geometrie) aus. */
async function withCard(data, spec, fn) {
  const host = await mountCard(data, spec);
  try {
    const node = host.firstElementChild;
    inlineSvgStyles(node);
    const top = node.getBoundingClientRect().top;
    const breaks = [...node.querySelectorAll('.cbrk')].map((e) => Math.round(e.getBoundingClientRect().top - top)).filter((y) => y > 0);
    const w = node.offsetWidth, h = node.offsetHeight;
    if (!fontCSS) fontCSS = await getFontEmbedCSS(node);
    return await fn(node, { w, h, breaks });
  } finally {
    render(null, host);
    host.remove();
  }
}
const snap = (node, w, h, ratio, offset = 0) => toCanvas(node, {
  pixelRatio: ratio, backgroundColor: '#ffffff', width: w, height: h, fontEmbedCSS: fontCSS, cacheBust: false,
  style: offset ? { marginTop: `-${offset}px` } : undefined,
});

/** Rendert die ganze Karte auf ein Canvas (2x, bei sehr langen Karten weniger). */
export async function cardCanvas(data, spec) {
  return withCard(data, spec, async (node, g) => {
    const ratio = Math.min(2, MAX_PX / g.h);
    if (ratio < 1) throw new Error(t('export.tooLong', { px: Math.round(g.h / 1000) * 1000 }));
    const canvas = await snap(node, g.w, g.h, ratio);
    return { canvas, ...g, ratio };
  });
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportPng(data, spec) {
  const { canvas } = await cardCanvas(data, spec);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  download(blob, fileBase(data, spec) + '.png');
}

const PAGE = {
  a4: { w: 210, h: 297, margin: 12, orientation: 'portrait' },
  169: { w: 338.67, h: 190.5, margin: 0, orientation: 'landscape' },
};

function slices(h, pageH, breaks) {
  const out = [];
  let start = 0;
  while (start < h - 1) {
    let end = Math.min(h, start + pageH);
    if (end < h) {
      const cand = breaks.filter((y) => y > start + pageH * 0.35 && y <= start + pageH);
      if (cand.length) end = Math.max(...cand);
    }
    out.push([start, end]);
    start = end;
  }
  return out;
}

async function addCardPages(pdf, data, spec, first) {
  const fmt = spec.format === '169' ? '169' : 'a4';
  const P = PAGE[fmt];
  return withCard(data, spec, async (node, { w, h, breaks }) => {
    const usableW = P.w - 2 * P.margin;
    const usableH = P.h - 2 * P.margin;
    const mmPerPx = usableW / w;
    const pageHpx = Math.floor(usableH / mmPerPx);
    const parts = slices(h, pageHpx, breaks);
    for (let i = 0; i < parts.length; i++) {
      const [s, e] = parts[i];
      if (!(first && i === 0)) pdf.addPage([P.w, P.h], P.orientation);
      // Seite einzeln rendern (verschoben), damit lange Karten die Canvas-Grenze nicht überschreiten
      const c = await snap(node, w, e - s, 2, s);
      pdf.addImage(c.toDataURL('image/png'), 'PNG', P.margin, P.margin, usableW, (e - s) * mmPerPx, undefined, 'FAST');
      if (parts.length > 1) {
        pdf.setFontSize(7);
        pdf.setTextColor(110);
        pdf.text(withUiLang(L(spec), () => `${cardTitle(data, spec)}  |  ${t('export.page', { i: i + 1, n: parts.length })}`), P.margin || 6, P.h - (P.margin ? P.margin / 2 : 3));
      }
    }
    return parts.length;
  });
}

function newPdf(spec) {
  const fmt = spec.format === '169' ? '169' : 'a4';
  const P = PAGE[fmt];
  return new jsPDF({ unit: 'mm', format: [P.w, P.h], orientation: P.orientation, compress: true });
}

/** pairs: [{ data, spec }] (Sammelkorb über Erlasse hinweg). */
export async function buildPdf(pairs) {
  const pdf = newPdf(pairs[0].spec);
  let pages = 0;
  for (let i = 0; i < pairs.length; i++) pages += await addCardPages(pdf, pairs[i].data, pairs[i].spec, i === 0);
  const { data, spec } = pairs[0];
  withUiLang(L(spec), () => pdf.setProperties({ title: pairs.length === 1 ? `${cardTitle(data, spec)}: ${cardSubtitle(data, spec)}` : t('export.pdfTitleMany', { n: pairs.length }), creator: 'SR-Navigator', subject: t('app.subtitle') }));
  return { pdf, pages };
}

export async function exportPdf(pairs, name) {
  const list = Array.isArray(pairs) ? pairs : [pairs];
  const { pdf } = await buildPdf(list);
  const blob = pdf.output('blob');
  download(blob, name || (list.length === 1 ? fileBase(list[0].data, list[0].spec) : withUiLang(L(list[0].spec), () => t('export.file.basket', { n: list.length }))) + '.pdf');
}

/** Druckansicht: Karten in eigenem Container, dann Browser-Druck. pairs: [{ data, spec }] */
export async function printCards(pairs) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  render(html`${pairs.map(({ data, spec: s }) => html`<div class="print-card">${withUiLang(L(s), () => { const host = document.createElement('div'); render(html`<${Card} data=${data} spec=${{ ...s, format: 'a4' }} />`, host); return html`<div dangerouslySetInnerHTML=${{ __html: host.innerHTML }}></div>`; })}</div>`)}`, root);
  document.body.classList.add('printing');
  await document.fonts.ready;
  await frame();
  const done = () => { document.body.classList.remove('printing'); render(null, root); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (document.body.classList.contains('printing') && !window.matchMedia('print').matches) done(); }, 1500);
}

