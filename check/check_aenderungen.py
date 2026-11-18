#!/usr/bin/env python3
"""Unabhängige Prüfung des Orchestrators: Welche Artikel ändern zwischen zwei aufeinanderfolgenden XML-Fassungen ihren
Wortlaut (eigene Extraktion aus der Quelle, ohne Fussnoten, typografische Varianten vereinheitlicht), und weist der
Datensatz genau diese als neue Version mit geändertem Wortlaut aus?
Aufruf: python3 -I check_aenderungen.py <raw-dir> <library.json> [werk-id ...]"""
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_wortlaut import source_units, unit_words, canon
def main():
    raw, libf = sys.argv[1], sys.argv[2]
    lib = json.load(open(libf, encoding='utf-8')); only = set(sys.argv[3:])
    tot = collections.Counter(); rows = []
    for wid in lib['order']:
        if only and wid not in only: continue
        ds = lib['works'][wid]; stages = sorted(ds['stages'], key=lambda s: s['order'])
        for lang in ds['langs']:
            prev = None
            for st in stages:
                f = os.path.join(raw, wid, f"{st['id']}_{lang}.xml")
                if not os.path.exists(f): prev = None; continue
                cur = {k.rsplit('/', 1)[-1]: canon(v) for k, v in source_units(f)[0].items()}
                if prev is not None:
                    src_changed = {u for u in set(cur) | set(prev) if cur.get(u) != prev.get(u)}
                    ds_text, ds_other = set(), set()
                    for uid, u in ds['units'].items():
                        if not uid.startswith('art_'): continue
                        vs = u.get('versions', {}).get(lang, [])
                        for i, v in enumerate(vs):
                            if v['stage'] != st['id']: continue
                            before = canon(unit_words(vs[i-1])) if i > 0 else None
                            (ds_text if canon(unit_words(v)) != before else ds_other).add(uid)
                    only_src = sorted(src_changed - ds_text); only_ds = sorted(ds_text - src_changed)
                    tot['Standpaare'] += 1; tot['Quelle geändert'] += len(src_changed); tot['übereinstimmend'] += len(src_changed & ds_text)
                    tot['nur Quelle (Änderung fehlt im Datensatz)'] += len(only_src); tot['nur Datensatz (Scheinänderung)'] += len(only_ds)
                    tot['neue Version ohne Wortlautänderung (Fussnote, Auszeichnung)'] += len(ds_other)
                    if only_src or only_ds: rows.append((wid, st['id'], lang, 'nur Quelle: ' + ', '.join(only_src[:8]), '| nur Datensatz: ' + ', '.join(only_ds[:8])))
                prev = cur
        print(wid, 'geprüft')
    for k, v in tot.items(): print(f'  {k}: {v}')
    for r in rows[:40]: print('  ', *r)
    print('Standpaare mit Abweichung:', len(rows))
if __name__ == '__main__': main()
