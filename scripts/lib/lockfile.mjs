// Versionsangaben in package-lock.json. Die Datei nennt die Version aus package.json zweimal: im Feld «version»
// zuoberst und im Feld «version» unter packages[""].
// scripts/check-dokumentation.mjs prüft beide Felder und setzt sie mit --fix, zusammen mit der Produktdokumentation.
// So bleibt die Datei auch auf dem Weg «Neue Version veröffentlichen» im Browser (MAINTAINING.md) gleich wie package.json.

export const LOCK_FILE = 'package-lock.json';

// Die beiden Felder stehen in jeder Lock-Datei von npm als erste zwei «"version": "…"» (nach «name» zuoberst und nach
// «name» unter packages[""]). setLockVersion prüft das nach dem Ersetzen und endet sonst mit Fehler.
const FIELD = /("version"\s*:\s*)"([^"]*)"/g;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Prüft beide Felder gegen die Version. Ergebnis { ok, wrong: [{ field, line, version }] }. */
export function checkLockVersion(lockText, version) {
  const text = String(lockText);
  const lock = JSON.parse(text);
  const found = [...text.matchAll(FIELD)].slice(0, 2);
  const fields = [
    { field: 'version', version: lock.version, line: found[0] ? lineOf(text, found[0].index) : null },
    { field: 'packages[""].version', version: lock.packages?.['']?.version, line: found[1] ? lineOf(text, found[1].index) : null },
  ];
  const wrong = fields.filter((f) => f.version !== version);
  return { ok: wrong.length === 0, wrong };
}

/** Setzt beide Felder auf version. Der übrige Text bleibt byte-gleich; sonst endet die Funktion mit Fehler. */
export function setLockVersion(lockText, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error(`Version «${version}» hat nicht die Form 1.2.3.`);
  const text = String(lockText);
  const lock = JSON.parse(text);
  if (!lock.packages || !lock.packages['']) throw new Error(`${LOCK_FILE}: Eintrag packages[""] fehlt.`);
  let n = 0;
  const out = text.replace(FIELD, (m, pre) => (n++ < 2 ? `${pre}"${version}"` : m));
  const after = JSON.parse(out);
  if (after.version !== version || after.packages[''].version !== version) {
    throw new Error(`${LOCK_FILE}: Die Felder «version» liessen sich nicht eindeutig finden. Die Datei ist von Hand zu berichtigen.`);
  }
  // Sonst darf sich nichts ändern.
  after.version = lock.version;
  after.packages[''].version = lock.packages[''].version;
  if (JSON.stringify(after) !== JSON.stringify(lock)) throw new Error(`${LOCK_FILE}: Beim Setzen der Version hätte sich mehr geändert.`);
  return out;
}

/** Meldung für einen roten Lauf, auf Deutsch, mit Datei, Zeile und Behebung. */
export function lockVersionMessage(result, version) {
  if (result.ok) return null;
  const lines = result.wrong.map((w) => `  ${w.line ? `Zeile ${w.line}, ` : ''}Feld «${w.field}»: nennt ${w.version ?? 'nichts'} statt ${version}`);
  const fix = 'Behebung: «node scripts/check-dokumentation.mjs --fix» setzt die Version in beiden Feldern. Ohne Node.js: jede genannte Stelle in der Datei von Hand berichtigen.';
  return `${LOCK_FILE}: Die Versionsangabe passt nicht zu package.json (Version ${version}).\n${lines.join('\n')}\n${fix}`;
}
