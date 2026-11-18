#!/usr/bin/env python3
"""Unabhängige Gegenprüfung des Orchestrators für den Verweis-Index (nur Deutsch, nur Verweise zwischen Artikeln
desselben Erlasses). Eigene, einfache Extraktion aus der Fedlex-XML: je Artikel die Menge der Artikel desselben
Erlasses, auf die der Wortlaut verweist. Vergleich mit einem JSON-Auszug des Index (von dump_refs.mjs):
{ "<unit>": ["<zielunit>", ...] }.
Aufruf: python3 -I check_verweise.py <xml> <index-auszug.json>"""
import sys, re, json, collections
from xml.etree import ElementTree as ET
NS = '{http://docs.oasis-open.org/legaldocml/ns/akn/3.0}'
def tag(e): return e.tag.split('}')[-1]
SUP = {'bis','ter','quater','quinquies','sexies','septies','octies','novies','decies','undecies','duodecies'}
def body_text(art):
    """Wortlaut eines Artikels ohne Fussnoten, ohne Artikelkopf (num, heading der Einheit)."""
    out = []
    def walk(n, top=False):
        t = tag(n)
        if t in ('authorialNote', 'placeholder'):
            if n.tail: out.append(n.tail)
            return
        if top and t in ('num', 'heading'):
            if n.tail: out.append(n.tail)
            return
        if t == 'sup':   # hochgestellt: lateinischer Zusatz, als ^bis kennzeichnen
            out.append('^' + ''.join(n.itertext()))
        else:
            if n.text: out.append(n.text)
            for c in n: walk(c)
        if t in ('p','num','heading','item','listIntroduction','td','th','paragraph'): out.append(' ')
        if n.tail: out.append(n.tail)
    for c in art: walk(c, top=True)
    return re.sub(r'\s+', ' ', ''.join(out).replace(' ', ' '))
NUM = r'\d+[a-z]{0,2}(?:\^?(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?'
LIST = re.compile(r'\b(?:Artikel[ns]?|Art\.)\s+(' + NUM + r'(?:\s*(?:,|und|oder|sowie|bis|–|-)\s*' + NUM + r')*)')
# Wörter, die nach der Zahl einen anderen Erlass anzeigen
FOREIGN = re.compile(r'^(?:\s+(?:Absatz|Absätze[n]?|Abs\.|Buchstabe[n]?|Bst\.|Ziffer[n]?|Ziff\.)\s+[\w^–]+(?:\s*(?:,|und|oder|sowie|bis|–)\s*[\w^]+)*)*\s+(?:(?:des|der|vom)\s+(?!vorliegenden|dieses)|[A-ZÄÖÜ][A-Za-zÄÖÜäöü-]*[A-ZÄÖÜ][A-Za-zÄÖÜäöü]*\b)')
def eid(num):
    m = re.match(r'(\d+)([a-z]{0,2})\^?(\w*)$', num)
    n, let, sup = m.group(1), m.group(2), m.group(3)
    return 'art_' + n + ('_' + let if let else '') + ('_' + sup if sup else '')
def expand(lst, known):
    """Liste/Bereich in Einzelziele; Bereiche über die Reihenfolge der bekannten Artikel."""
    toks = re.split(r'\s*(,|und|oder|sowie|bis|–|-)\s*', lst)
    out = []; i = 0
    while i < len(toks):
        t = toks[i]
        if re.fullmatch(NUM, t):
            if i + 2 < len(toks) and toks[i+1] in ('bis', '–', '-') and re.fullmatch(NUM, toks[i+2]):
                a, b = eid(t), eid(toks[i+2])
                if a in known and b in known and known.index(a) <= known.index(b): out += known[known.index(a):known.index(b)+1]
                else: out += [a, b]
                i += 3; continue
            out.append(eid(t))
        i += 1
    return out
def main():
    root = ET.parse(sys.argv[1]).getroot()
    arts = [a for a in root.iter(NS+'article') if a.get('eId') and '/' not in a.get('eId')]
    known = [a.get('eId') for a in arts]
    mine = {}
    for a in arts:
        txt = body_text(a); tg = set()
        for m in LIST.finditer(txt):
            rest = txt[m.end():m.end()+90]
            if FOREIGN.match(rest): continue
            for t in expand(m.group(1), known):
                if t != a.get('eId'): tg.add(t)
        mine[a.get('eId')] = tg
    idx = {k: set(v) for k, v in json.load(open(sys.argv[2])).items()}
    tot = collections.Counter(); rows = []
    for u in known:
        a, b = mine.get(u, set()), {t for t in idx.get(u, set()) if t.startswith('art_')}
        tot['Paare eigene Extraktion'] += len(a); tot['Paare Index'] += len(b); tot['gemeinsam'] += len(a & b)
        tot['nur eigene Extraktion'] += len(a - b); tot['nur Index'] += len(b - a)
        dangling = {t for t in a - b if t not in known}
        tot['davon Ziel nicht im Erlass (eigene Extraktion)'] += len(dangling)
        if a != b: rows.append((u, 'nur eigene: ' + ', '.join(sorted(a - b)), '| nur Index: ' + ', '.join(sorted(b - a))))
    for k, v in tot.items(): print(f'  {k}: {v}')
    for r in rows[:int(sys.argv[3]) if len(sys.argv) > 3 else 40]: print('  ', *r)
    print('Artikel mit Abweichung:', len(rows), 'von', len(known))
if __name__ == '__main__': main()
