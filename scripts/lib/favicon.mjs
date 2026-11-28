// Favicon «SR» (weisse Buchstaben auf Rot --primary) für den Browser-Tab von Navigator und Projektseite.
// Quelle: src/app/assets/favicon.svg (Buchstaben als Pfade aus IBM Plex Sans 600, damit keine Schrift nötig ist)
// und favicon-32.png (gerendert aus der SVG-Datei, für Browser ohne SVG-Favicon). Beide als Data-URL eingebettet:
// die Dateien sind selbsttragend, und die CSP erlaubt Bilder nur aus data:.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FAVICON_SVG = 'src/app/assets/favicon.svg';
export const FAVICON_PNG = 'src/app/assets/favicon-32.png';

/** <link>-Elemente für den <head>: PNG als Rückfall, SVG für Browser, die es unterstützen. */
export function faviconLinks(root) {
  const png = readFileSync(join(root, FAVICON_PNG)).toString('base64');
  const svg = readFileSync(join(root, FAVICON_SVG)).toString('base64');
  return `<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,${png}">\n`
    + `<link rel="icon" type="image/svg+xml" sizes="any" href="data:image/svg+xml;base64,${svg}">`;
}
