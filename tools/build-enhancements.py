"""Compile factual choices for the campaign's existing detachments, not a new detachment set.

Inputs: ignored tmp/enhancements/{necrons,marines}.json from the pinned BSData revision.
No ability descriptions are published. Prices belong to these accepted detachment definitions.
"""
import json, re
from pathlib import Path

REVISION = '190c9966980a95a0c13034ed364b317d14057840'
SOURCE = f'https://github.com/BSData/wh40k-11e/tree/{REVISION}'
text = Path('shared/stock.generated.ts').read_text(encoding='utf-8')
detachments = json.loads('[' + text.split('export const STOCK_DETACHMENTS = [')[1].split('] as Detachment[]')[0] + ']')
by_name = {d['name']: d for d in detachments}

def walk(x, ancestors=()):
    if isinstance(x, dict):
        yield x, ancestors
        for v in x.values(): yield from walk(v, ancestors + (x,))
    elif isinstance(x, list):
        for v in x: yield from walk(v, ancestors)

special_det = {
    'Enlivened Sentinels': 'Hand of the Dynasty', 'Tools of Dominion': 'Hand of the Dynasty',
    'Recursive Reanimation': 'Skyshroud Spearhead', 'Deepening Madness': 'Skyshroud Spearhead',
    'Mortality Shroud (Aura)': "The Phaeron's Armoury",
    'Prelocational Optimiser': "The Phaeron's Armoury",
}
special_units = {
    'Enlivened Sentinels': ['Necron Warriors'], 'Tools of Dominion': ['Immortals'],
    'Recursive Reanimation': ['Tomb Blades'], 'Deepening Madness': ['Lokhust Destroyers', 'Lokhust Heavy Destroyers'],
    'Mortality Shroud (Aura)': ['Obelisk'],
}
special_keywords = {
    'Dread Majesty': [['OVERLORD'], ['CATACOMB COMMAND BARGE']],
    'Destroyer Ankh': [['OVERLORD'], ['CATACOMB COMMAND BARGE']],
    'Murdermind': [['CRYPTEK']], 'Mark of the Nekrosor': [['DESTROYER CULT']],
    'Cursed Circlet': [['DESTROYER CULT']], 'Honour Indefatigable': [['GRAVIS']],
}
excluded = {'Mark of the Nekrosor': ['OVERLORD', 'CRYPTEK', 'CATACOMB COMMAND BARGE'],
            'Cursed Circlet': ['OVERLORD', 'CRYPTEK', 'CATACOMB COMMAND BARGE']}
bindings = {'Singularity Matrix': "C'tan Shard of the Deceiver", 'Quantum Goad': "C'tan Shard of the Nightbringer",
            'Animus Damper': "C'tan Shard of the Void Dragon", 'Reletavistic Tether': "Transcendent C'tan"}
keywords = ['CATACOMB COMMAND BARGE', 'ADEPTUS ASTARTES', 'DESTROYER CULT', 'WATCH MASTER',
            'TECHMARINE', 'TERMINATOR', 'INFANTRY', 'OVERLORD', 'CRYPTEK', 'NECRONS', 'CAPTAIN',
            'TACTICUS', 'MOUNTED', 'PHOBOS', 'PSYKER', 'GRAVIS', 'VEHICLE', 'SPEEDER', 'FLY']
choices, compulsory = [], []
for filename in ['necrons', 'marines']:
    root = json.loads(Path(f'tmp/enhancements/{filename}.json').read_text(encoding='utf-8'))['catalogue']
    nodes = list(walk(root))
    for e, ancestors in nodes:
        pts = next((c['value'] for c in e.get('costs', []) if c.get('name') == 'pts'), None)
        if e.get('type') != 'upgrade' or pts is None: continue
        name = e['name']
        if name in bindings:
            compulsory.append({'name': name.replace('Reletavistic', 'Relativistic'), 'datasheet': bindings[name], 'cost': pts,
                               'detachment': by_name['Pantheon of Woe']['id']})
            continue
        det = special_det.get(name) or next((a['name'].replace(' Enhancements', '') for a in reversed(ancestors)
                                            if a.get('name', '').endswith(' Enhancements')), e.get('comment', ''))
        if det not in by_name: continue
        desc = ' '.join(c.get('$text', '') for p in e.get('profiles', []) for c in p.get('characteristics', [])
                        if c.get('name') == 'Description')
        prefix = re.search(r'^(.{0,160}?\b(?:model|unit)s? only)', re.sub(r'[*^\n]', '', desc), re.I)
        clauses = []
        if prefix:
            eligibility = prefix[1].upper().replace('ADPETUS', 'ADEPTUS')
            for part in eligibility.split(' OR '):
                clauses.append([k for k in keywords if k in part])
        clauses = special_keywords.get(name, clauses)
        choice = {'id': f"stock-enhancement:{e['id']}", 'name': name, 'cost': pts, 'eligible': [], 'detachment': by_name[det]['id']}
        if clauses: choice['eligibleAny'] = clauses
        if name in excluded: choice['excluded'] = excluded[name]
        if name in special_units: choice['datasheets'] = special_units[name]
        upgrade = any(c.get('type') == 'max' and c.get('value') == 3 and c.get('scope') in ['force', 'roster']
                      for c in e.get('constraints', []))
        if upgrade: choice['upgrade'] = True
        if det == 'Headhunter Task Force':
            # This accepted detachment explicitly permits one Vehicle bearer per enhancement.
            group = next(a for a in reversed(ancestors) if a.get('name') == 'Headhunter Task Force Enhancements')
            choice['unitEligible'] = True
            choice['datasheets'] = sorted({next(a['name'] for a in reversed(aa) if a.get('type') in ['model', 'unit', 'selectionEntry'])
                                          for x, aa in nodes if x.get('targetId') == group['id']})
        choice['source'] = SOURCE
        choices.append(choice)

covered = {e['detachment'] for e in choices + compulsory}
assert all(d['id'] in covered for d in detachments), f"Missing: {[d['name'] for d in detachments if d['id'] not in covered]}"
assert len({e['id'] for e in choices}) == len(choices)
out = '// Generated by tools/build-enhancements.py; names, prices and eligibility only.\n'
out += 'import type { Enhancement } from "./model.ts"\n'
out += 'export const STOCK_ENHANCEMENTS: Enhancement[] = ' + json.dumps(choices, ensure_ascii=False, indent=2) + '\n'
out += 'export const STOCK_BINDINGS = ' + json.dumps(compulsory, ensure_ascii=False, indent=2) + '\n'
Path('shared/enhancements.generated.ts').write_text(out, encoding='utf-8')
print(f'{len(choices)} optional enhancements; {len(compulsory)} compulsory bindings; {len(covered)} detachments')
