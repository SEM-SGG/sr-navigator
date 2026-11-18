#!/usr/bin/env python3
"""Unabhängige Prüfung des Orchestrators: Wortlaut je Einheit aus der Fedlex-XML (eigene, einfache Extraktion)
gegen die Blockfolge in data/library.json. Aufruf: python3 -I check_wortlaut.py <raw-dir> <library.json> [werk-id ...]
Vergleich wortweise nach Normalisierung (Whitespace, typografische Leerzeichen). Fussnoten sind ausgenommen."""
import sys, os, re, json, html, glob, collections, difflib
from xml.etree import ElementTree as ET
NS = '{http://docs.oasis-open.org/legaldocml/ns/akn/3.0}'
def tag(e): return e.tag.split('}')[-1] if isinstance(e.tag, str) else ''
def text_no_notes(e):
    out = []
    def walk(n):
        if tag(n) in ('authorialNote', 'placeholder'):   # Fussnoten; Platzhalter des Fedlex-Konverters («[tab]»)
            if n.tail: out.append(n.tail)
            return
        if n.text: out.append(n.text)
        if tag(n) in ('br',): out.append(' ')
        for c in n: walk(c)
        if tag(n) in ('p','num','heading','item','listIntroduction','td','th','tr','paragraph','content','level','subparagraph','blockList'): out.append(' ')
        if n.tail: out.append(n.tail)
    if e.text: out.append(e.text)
    for c in e: walk(c)
    return ''.join(out)
def norm_words(s):
    s = html.unescape(s)
    s = re.sub(r'</?(?:i|b|sup|sub|span|a)(?:\s[^>]*)?>', '', s)   # Inline-Auszeichnung ohne Leerzeichen entfernen
    s = re.sub(r'<[^>]+>', ' ', s)                                # Blockelemente (br, Tabellen) trennen Wörter
    s = s.replace(' ', ' ').replace(' ', ' ').replace(' ', ' ').replace('­', '')
    s = re.sub(r'\s+', ' ', s).strip()
    # Satzzeichen von Wörtern lösen, damit Leerzeichen-Artefakte nicht zählen
    return re.findall(r'[^\W_]+|[^\w\s]', s, flags=re.UNICODE)
def source_units(path):
    """eId -> Wortliste, für Artikel, Übergangsbestimmungen, Anhänge (grob: alles mit eId auf oberster Einheitsebene)."""
    root = ET.parse(path).getroot()
    units = collections.OrderedDict()
    for e in root.iter():
        t = tag(e)
        if t == 'article' and e.get('eId'):
            units[e.get('eId')] = norm_words(text_no_notes(e))
    whole = norm_words(text_no_notes(root.find(NS+'act').find(NS+'body')))
    return units, whole
TYPO = str.maketrans({'\u2026': '...', '\u2019': "'", '\u2011': '-', '\u00b0': 'o', '\u00ba': 'o', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3'})
def canon(words):
    """Kanonische Form für «nur typografisch verschieden»: ohne Leerzeichen, Auslassungszeichen, Apostroph, Bindestrich, n° vereinheitlicht."""
    return ''.join(words).translate(TYPO)
def version_at(unit, lang, stage_order, order):
    best = None
    for v in unit.get('versions', {}).get(lang, []):
        if order[v['stage']] <= stage_order: best = v
    return best
def unit_words(v):
    parts = [v.get('label') or '', v.get('title') or '']
    for b in v.get('blocks', []):
        parts.append(b.get('l') or '')
        if b.get('ty') == 'table': parts.append(b.get('html') or b.get('t') or '')
        else: parts.append(b.get('t') or '')
    return norm_words(' '.join(parts))
def main():
    raw, libf = sys.argv[1], sys.argv[2]
    lib = json.load(open(libf, encoding='utf-8'))
    only = set(sys.argv[3:])
    tot = collections.Counter(); bad = []
    for wid in lib['order']:
        if only and wid not in only: continue
        ds = lib['works'][wid]
        order = {s['id']: s['order'] for s in ds['stages']}
        for st in ds['stages']:
            for lang in ds['langs']:
                f = os.path.join(raw, wid, f"{st['id']}_{lang}.xml")
                if not os.path.exists(f): bad.append((wid, st['id'], lang, 'DATEI FEHLT', '')); continue
                src, _ = source_units(f)
                for uid, sw in src.items():
                    u = ds['units'].get(uid) or ds['units'].get(uid.replace('/', '.')) or (ds['units'].get(uid.rsplit('/', 1)[-1]) if uid.rsplit('/', 1)[-1].startswith('art_') else None)
                    tot['units'] += 1; tot['words'] += len(sw)
                    if not u: bad.append((wid, st['id'], lang, uid, 'Einheit fehlt im Datensatz')); tot['miss'] += len(sw); continue
                    v = version_at(u, lang, st['order'], order)
                    if not v: bad.append((wid, st['id'], lang, uid, 'keine Version')); tot['miss'] += len(sw); continue
                    dw = unit_words(v)
                    if dw == sw: tot['ok'] += 1; continue
                    if canon(dw) == canon(sw): tot['typo'] += 1; continue
                    sm = difflib.SequenceMatcher(None, sw, dw, autojunk=False)
                    miss = sum(i2-i1 for op,i1,i2,j1,j2 in sm.get_opcodes() if op in ('delete','replace'))
                    extra = sum(j2-j1 for op,i1,i2,j1,j2 in sm.get_opcodes() if op in ('insert','replace'))
                    tot['miss'] += miss; tot['extra'] += extra
                    ex = next(((' '.join(sw[i1:i2])[:70], ' '.join(dw[j1:j2])[:70]) for op,i1,i2,j1,j2 in sm.get_opcodes() if op != 'equal'), ('',''))
                    bad.append((wid, st['id'], lang, uid, f'fehlend {miss}, zusätzlich {extra}: Quelle «{ex[0]}» | Datensatz «{ex[1]}»'))
        print(wid, 'geprüft')
    w = tot['words'] or 1
    print(f"Einheiten-Fassungen geprüft: {tot['units']}, identisch: {tot['ok']}, nur typografisch verschieden: {tot['typo']}, Wörter Quelle: {tot['words']}, fehlend: {tot['miss']} ({100*(1-tot['miss']/w):.4f} % Abdeckung), zusätzlich: {tot['extra']}")
    by = collections.Counter((b[0], b[4].split(':')[0][:40]) for b in bad)
    for b in bad[:40]: print('  ', *b)
    print('Abweichungen gesamt:', len(bad))
if __name__ == '__main__': main()
