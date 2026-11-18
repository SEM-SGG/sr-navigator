// Schriften für die selbsttragende HTML-Datei: IBM Plex (SIL Open Font License 1.1), eingebettet als woff2-Data-URLs.
// Quelle: node_modules/@fontsource/ibm-plex-sans|serif|mono, Teilmengen latin und latin-ext (unicode-range aus den
// Fontsource-CSS-Dateien, damit der Browser latin-ext nur für Zeichen wie «Łódź» heranzieht).
// Aufruf in build.mjs:  import { fontFaceCss } from './build-fonts.mjs';  const fontCss = fontFaceCss(ROOT);
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Schnitte nach Design System Carbon: Sans 300, 400, 400 kursiv, 600; Serif 400, 400 kursiv; Mono 400. */
export const FONT_FACES = [
  ['IBM Plex Sans', 'ibm-plex-sans', 300, 'normal'],
  ['IBM Plex Sans', 'ibm-plex-sans', 400, 'normal'],
  ['IBM Plex Sans', 'ibm-plex-sans', 400, 'italic'],
  ['IBM Plex Sans', 'ibm-plex-sans', 600, 'normal'],
  ['IBM Plex Serif', 'ibm-plex-serif', 400, 'normal'],
  ['IBM Plex Serif', 'ibm-plex-serif', 400, 'italic'],
  ['IBM Plex Serif', 'ibm-plex-serif', 600, 'normal'], // Agent UI: Sachüberschriften in Anhängen und <b> im Rechtstext (sonst synthetisch fett)
  ['IBM Plex Mono', 'ibm-plex-mono', 400, 'normal'],
];
export const FONT_SUBSETS = ['latin', 'latin-ext'];

/** unicode-range einer Teilmenge aus der Fontsource-CSS-Datei des Schnitts (z. B. 400-italic.css). */
function unicodeRange(dir, pkg, subset, weight, style) {
  const css = readFileSync(join(dir, `${weight}${style === 'italic' ? '-italic' : ''}.css`), 'utf8');
  const marker = `/* ${pkg}-${subset}-${weight}-${style} */`;
  const i = css.indexOf(marker);
  if (i < 0) throw new Error(`Fontsource: ${marker} fehlt`);
  const block = css.slice(i, css.indexOf('}', i));
  const m = /unicode-range:\s*([^;]+);/.exec(block);
  if (!m) throw new Error(`Fontsource: unicode-range für ${marker} fehlt`);
  return m[1].trim();
}

/**
 * Liefert die @font-face-Regeln als String.
 * @param {string} root  Projektwurzel (Ordner mit node_modules)
 * @param {{ display?: string }} [o]  font-display; «block», damit Exportkarten nie mit Ersatzschrift gerendert werden
 */
export function fontFaceCss(root, { display = 'block' } = {}) {
  const out = [];
  for (const [family, pkg, weight, style] of FONT_FACES) {
    const dir = join(root, 'node_modules', '@fontsource', pkg);
    for (const subset of FONT_SUBSETS) {
      const file = `${pkg}-${subset}-${weight}-${style}.woff2`;
      const b64 = readFileSync(join(dir, 'files', file)).toString('base64');
      out.push(`@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:${display};`
        + `src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${unicodeRange(dir, pkg, subset, weight, style)}}`);
    }
  }
  return out.join('\n');
}
