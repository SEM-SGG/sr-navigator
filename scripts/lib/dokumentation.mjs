// Versionsangaben in der Produktdokumentation (docs/sr-navigator-dokumentation.html).
// Die Dokumentation nennt die Version an mehreren Stellen: im Titel «(v1.2.3)», in der Kopfzeile und im Kopf der Seite
// «Version 1.2.3» bzw. «Versione 1.2.3», in der Fusszeile und in den Titeln je Sprache im Skript.
// scripts/check-dokumentation.mjs prüft, dass jede dieser Stellen die Version aus package.json nennt;
// scripts/apply-fassungen.mjs setzt beim automatischen Einbau die neue Version mit setDocVersion.

export const DOC_FILE = 'docs/sr-navigator-dokumentation.html';

// «Version 1.2.3», «Versione 1.2.3» und «(v1.2.3)». Andere Zahlen der Form 1.2.3 (zum Beispiel Daten) zählen nicht.
const PATTERN = /(\bVersione? |\(v)(\d+\.\d+\.\d+)\b/g;

/** Alle Versionsangaben: [{ line, version, text }]. text ist die Fundstelle, gekürzt auf die Zeile um die Angabe. */
export function docVersions(html) {
  const out = [];
  String(html).split(/\r?\n/).forEach((l, i) => {
    for (const m of l.matchAll(PATTERN)) {
      const from = Math.max(0, m.index - 40);
      out.push({ line: i + 1, version: m[2], text: l.slice(from, m.index + m[0].length + 40).trim() });
    }
  });
  return out;
}

/** Prüft die Dokumentation gegen die Version. Ergebnis { ok, found, wrong: [{ line, version, text }] }. */
export function checkDocVersion(html, version) {
  const found = docVersions(html);
  const wrong = found.filter((f) => f.version !== version);
  return { ok: found.length > 0 && wrong.length === 0, found: found.length, wrong };
}

/** Setzt jede Versionsangabe auf version. Endet mit Fehler, wenn die Dokumentation keine Versionsangabe enthält. */
export function setDocVersion(html, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error(`Version «${version}» hat nicht die Form 1.2.3.`);
  if (!docVersions(html).length) throw new Error(`${DOC_FILE}: keine Versionsangabe gefunden (erwartet «Version 1.2.3» oder «(v1.2.3)»).`);
  return String(html).replace(PATTERN, (_, pre) => pre + version);
}

/** Meldung für einen roten Lauf, auf Deutsch, mit Datei, Fundstelle und Behebung. */
export function docVersionMessage(result, version) {
  if (result.ok) return null;
  const fix = 'Behebung: «node scripts/check-dokumentation.mjs --fix» setzt die Version an allen Stellen. Ohne Node.js: jede genannte Stelle in der Datei von Hand berichtigen.';
  if (!result.found) return `${DOC_FILE}: keine Versionsangabe gefunden. Erwartet ist «Version ${version}» in Kopfzeile, Seitenkopf und Fusszeile und «(v${version})» im Titel.\n${fix}`;
  const lines = result.wrong.map((w) => `  Zeile ${w.line}: nennt ${w.version} statt ${version} («${w.text}»)`);
  return `${DOC_FILE}: Die Versionsangabe passt nicht zu package.json (Version ${version}).\n${lines.join('\n')}\n${fix}`;
}
