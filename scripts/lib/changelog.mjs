// Liest den Abschnitt einer Version aus CHANGELOG.md. Überschriften haben die Form «## 1.2.1 (18. November 2026)».

/** Text des Abschnitts zur Version, ohne Überschrift; null, wenn der Abschnitt fehlt oder leer ist. */
export function changelogSection(markdown, version) {
  const lines = String(markdown).split(/\r?\n/);
  const isHead = (l) => /^## /.test(l);
  const start = lines.findIndex((l) => isHead(l) && l.slice(3).trim().split(/\s+/)[0] === version);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && isHead(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  return body || null;
}

/** Datum aus der Überschrift des Abschnitts, wie geschrieben; null, wenn keines in Klammern steht. */
export function changelogDate(markdown, version) {
  const m = String(markdown).split(/\r?\n/).find((l) => /^## /.test(l) && l.slice(3).trim().split(/\s+/)[0] === version);
  const d = m && m.match(/\(([^)]+)\)\s*$/);
  return d ? d[1] : null;
}
