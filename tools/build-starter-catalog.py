"""Build ready variants from the pinned factual reference and optional private exports.

No ability/rule prose or original roster files are published. Regeneration:
python tools/build-starter-catalog.py [directory containing *.normalized.json]
"""
import copy
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
reference = json.loads((ROOT / 'public/data/wahapedia.reference.json').read_text(encoding='utf-8'))
catalog = []
skipped = []


def key(name):
    result = re.sub('[^A-Z0-9]', '', name.upper().replace('ARMOR', 'ARMOUR'))
    return {'LOKHUSTHEAVYDESTROYER': 'LOKHUSTHEAVYDESTROYERS', 'INTERCESSORS': 'INTERCESSORSQUAD'}.get(result, result)


prohibited = {key(n) for n in ['Terminator Squad', 'Terminator Assault Squad', 'Scout Squad', 'Tactical Squad', 'Devastator Squad', 'Assault Squad', 'Assault Squad with Jump Packs', 'Attack Bike Squad', 'Land Speeder Storm', 'Relic Terminator Squad', 'Scout Bike Squad', 'Scout Sniper Squad']}
core = {
    'necrons': {key(n) for n in ['Necron Warriors', 'Immortals', 'Deathmarks', 'Flayed Ones', 'Canoptek Scarab Swarms', 'Cryptothralls', 'Lychguard', 'Lokhust Heavy Destroyers']},
    'deathwatch': {key(n) for n in ['Deathwatch Veterans', 'Intercessor Squad', 'Assault Intercessor Squad', 'Heavy Intercessor Squad', 'Infernus Squad', 'Eliminator Squad', 'Infiltrator Squad', 'Bladeguard Veteran Squad', 'Sternguard Veteran Squad']},
}
heavy = {
    'necrons': {key(n) for n in ['Canoptek Doomstalker', 'Canoptek Spyders', 'Canoptek Wraiths', 'Tomb Blades', 'Doomsday Ark']},
    'deathwatch': {key(n) for n in ['Deathwatch Terminator Squad', 'Eradicator Squad', 'Eradicator Squad with Heavy Bolters', 'Dreadnought', 'Ballistus Dreadnought', 'Brutalis Dreadnought', 'Redemptor Dreadnought', 'Decimus Kill Team', 'Fortis Kill Team', 'Indomitor Kill Team', 'Spectrus Kill Team', 'Talonstrike Kill Team']},
}


def category(side, name, keywords):
    if 'EPIC HERO' in keywords or any(k in keywords for k in ['TITANIC', 'AIRCRAFT']) or 'CTAN' in key(name):
        return 'forbidden'
    if side == 'deathwatch' and any(k in keywords for k in ['MOUNTED', 'JUMP PACK']):
        return 'forbidden'
    if key(name) in core[side]:
        return 'core'
    if 'CHARACTER' in keywords or key(name) in heavy[side]:
        return 'heavy'
    allowed = ['INFANTRY', 'VEHICLE'] if side == 'deathwatch' else ['VEHICLE', 'MONSTER']
    return 'other' if any(k in keywords for k in allowed) else 'forbidden'


def finish(side, name, size, models, rc, keywords, card, leaders, support, copy_prices):
    size = size.replace(f'{models} моделей', f'{models} ' + ('модель' if models == 1 else 'модели' if 2 <= models <= 4 else 'моделей'))
    signature = json.dumps([side, key(name), models, [[g['count'], [[key(e['name']), e['count']] for e in g['equipment']]] for g in card['models']], card['equipment']], sort_keys=True)
    cid = 'stock:' + side + ':' + key(name).lower() + ':' + hashlib.sha256(signature.encode()).hexdigest()[:12]
    if any(c['id'] == cid for c in catalog):
        return
    card['reviewedAgainst'] = 'Правила и цены сайта Black Sepulchre · 2.2.1 · приняты для дружеской кампании'
    if len(size) > 100:
        size = size[:97] + '…'
    catalog.append(dict(id=cid, side=side, datasheet=name, size=size, models=models, rc=rc,
                        copyPrices=copy_prices, keywords=keywords, character='CHARACTER' in keywords,
                        epic='EPIC HERO' in keywords, battleline='BATTLELINE' in keywords,
                        garrison=category(side, name, keywords), leaderFor=leaders, supportFor=support,
                        transport=0, cargoKeywords=[], ranged=any('ranged' in p['type'].lower() for p in card['profiles'].values()),
                        restoration=side == 'necrons', unique='EPIC HERO' in keywords, card=card))


def gear_profiles(d, name):
    target = key(name).rstrip('S')
    matches = [(i, p) for i, p in enumerate(d['weaponProfiles']) if key(p['name']).rstrip('S') == target or key(re.split(r'\s+[–—]\s+', p['name'])[0]).rstrip('S') == target]
    # These source labels append a keyword to a single physical weapon's name.
    if not matches:
        matches = [(i, p) for i, p in enumerate(d['weaponProfiles']) if key(p['name']).rstrip('S') == target + 'ONESHOT']
    if not matches and name.lower() not in ['resurrection orb', 'astraeus void shields']:
        raise ValueError('No weapon profile: ' + name)
    return ['w' + str(i) for i, _ in matches]


def default_groups(d, total, replace=None):
    if len(d['defaultEquipment']) != 1 or not re.match(r'(Every model|Each model|This model) is', d['defaultEquipment'][0]['carrier']):
        raise ValueError('Mixed carrier/composition needs an explicit recipe')
    if len(d['modelProfiles']) != 1 or not d['keywords'] or any(g['model'] == 'MODELS MAXIMUM' for g in d['composition']):
        raise ValueError('Missing or mixed model metadata')
    groups = [dict(g) for g in d['composition'] if g['min'] > 0]
    remaining = total - sum(g['min'] for g in groups)
    for g in reversed(groups):
        added = min(remaining, g['max'] - g['min'])
        g['min'] += added
        remaining -= added
    if remaining != 0:
        raise ValueError('No composition for point tier')
    equipment = copy.deepcopy(d['defaultEquipment'][0]['items'])
    if replace:
        old, new = replace
        for e in equipment:
            if key(e['name']) == key(old):
                e['name'] = new
    return [dict(id='g'+str(i), entryId=d['id'], name=g['model'], count=g['min'], keywords=[], stats=['m0'], abilities=[], profileOrigin='reviewed',
                 equipment=[dict(entryId=d['id']+':'+key(e['name']), name=e['name'], count=e['quantity']*g['min'], profiles=gear_profiles(d, e['name'])) for e in equipment]) for i, g in enumerate(groups)]


def recipe(d, specs):
    return [dict(id='g'+str(i),entryId=d['id'],name=name,count=n,keywords=[],stats=['m0'],abilities=[],profileOrigin='reviewed',
                 equipment=[dict(entryId=d['id']+':'+key(gear),name=gear,count=n,profiles=[] if gear=='Astartes shield' else gear_profiles(d,gear)) for gear in gears]) for i,(name,n,gears) in enumerate(specs) if n]


def special_groups(d, n):
    name=d['name']
    if name=='Deathwatch Veterans':
        k=n//5
        return [('огневая поддержка',recipe(d,[('Watch Sergeant',1,['boltgun','power weapon']),('Veteran: frag cannon',k,['frag cannon','close combat weapon']),('Veteran: infernus heavy bolter',k,['infernus heavy bolter','close combat weapon']),('Veterans',n-1-2*k,['boltgun','power weapon'])])),
                ('штурм и щиты',recipe(d,[('Watch Sergeant',1,['combi-weapon','xenophase blade']),('Veterans: thunder hammer',2*k,['Deathwatch thunder hammer']),('Veterans: shield',2*k,['power weapon','Astartes shield']),('Black Shield',n-1-4*k,['Black Shield blades'])]))]
    if name=='Lokhust Heavy Destroyers' and n>1:
        return [('смешанное оружие',recipe(d,[('Destroyer: gauss destructor',1,['gauss destructor','close combat weapon']),('Destroyers: enmitic exterminator',n-1,['enmitic exterminator','close combat weapon'])]))]
    if name=='Aggressor Squad':
        return [('boltstorm',recipe(d,[('Aggressor Sergeant',1,['auto boltstorm gauntlets','fragstorm grenade launcher','twin power fists']),('Aggressors',n-1,['auto boltstorm gauntlets','fragstorm grenade launcher','twin power fists'])]))]
    return []


swaps = {
    'Immortals': [('gauss blaster', 'tesla carbine')],
    'Necron Warriors': [('gauss flayer', 'gauss reaper')],
    'Lokhust Heavy Destroyers': [('gauss destructor', 'enmitic exterminator')],
    'Inceptor Squad': [('assault bolters', 'plasma exterminators')],
}

for d in reference['datasheets']:
    if d['campaignSide'] == 'deathwatch' and (key(d['name']) in prohibited or any(k not in ['ADEPTUS ASTARTES', 'DEATHWATCH'] for k in d['factionKeywords'])):
        skipped.append((d['name'], 'Not a Deathwatch army datasheet'))
        continue
    # Conditional C'tan bindings stay in the import editor until mapped to a package.
    if 'CTAN' in key(d['name']):
        skipped.append((d['name'], 'Conditional package costs'))
        continue
    profiles = {'m'+str(i): dict(sourceId=d['id']+':m'+str(i), name=p['name'], type='Unit', values={**p['values'], 'Base': p['base']}) for i, p in enumerate(d['modelProfiles'])}
    profiles.update({'w'+str(i): dict(sourceId=d['id']+':w'+str(i), name=p['name'], type='Melee Weapons' if p['type']=='melee' else 'Ranged Weapons',
                 values={'Range':p['range'], 'A':p['A'], 'WS' if p['type']=='melee' else 'BS':p['skill'], 'S':p['S'], 'AP':p['AP'], 'D':p['D'], 'Keywords':', '.join(p['keywords'])}) for i, p in enumerate(d['weaponProfiles'])})
    profiles.update({'a'+str(i): dict(sourceId=d['id']+':a'+str(i), name=name, type='Abilities', values={'Reference':d['source']['url']}) for i, name in enumerate(d['references']['abilities'])})
    tiers = {}
    for p in d['pointTiers']:
        if p['copyFrom'] == 1 and p['models'] not in tiers:
            tiers[p['models']] = p
    for n, tier in tiers.items():
        variants=[]
        for swap in [None, *swaps.get(d['name'], [])]:
            try:
                variants.append(('',default_groups(d, n, swap)))
            except ValueError as e:
                skipped.append((d['name'], str(e)))
        variants.extend(special_groups(d,n))
        for label,groups in variants:
            unit_profiles = ['a'+str(i) for i in range(len(d['references']['abilities']))]
            refs = {'m0', *unit_profiles, *(p for g in groups for e in g['equipment'] for p in e['profiles'])}
            keys = list(dict.fromkeys([*d['keywords'], *d['factionKeywords']]))
            card = dict(source=dict(filename=d['name'],gameId='wh40k11',gameRevision='reference',catalogueId=d['id'],catalogueRevision=d['source']['observedAt'],catalogueName=d['campaignSide'],generator='Wahapedia',provider='Wahapedia',url=d['source']['url']),
                        sourceEntryId=d['id'],sourceSelectionId=d['id'], unitKeywords=keys, models=groups, profiles={i:profiles[i] for i in sorted(refs)},unitProfiles=unit_profiles,equipment=[],rules=[],exportedPoints=tier['points'],copyOrdinal=1,paidOptions=[])
            copy_prices = [next((p['points'] for p in d['pointTiers'] if p['models']==n and p['copyFrom'] <= i and (p['copyTo'] is None or i<=p['copyTo'])),tier['points']) for i in range(1,7)]
            gear = label or ', '.join(e['name'] for e in groups[0]['equipment'])
            finish(d['campaignSide'],d['name'],f'{n} моделей · {gear}',n,tier['points'],keys,card,d['references']['attachmentTargets']['leader'],d['references']['attachmentTargets']['support'],copy_prices)

# Detachment prices are the owners' supplied New Recruit choices, not a live price feed.
detachments = []
source_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tmp/imports'
for path in sorted(source_dir.glob('*.normalized.json')):
    source = json.loads(path.read_text(encoding='utf-8'))
    side = source['side']
    for d in source['detachments']:
        if any(v['side'] == side and key(v['name']) == key(d['name']) for v in detachments):
            continue
        detachments.append(dict(id='stock-detachment:'+side+':'+key(d['name']).lower(), side=side, name=d['name'], dp=d['dp'], requiredKeywords=[]))
    for u in source['units']:
        if any(i['blocking'] for i in u['issues']) or u['paidOptions']:
            skipped.append((path.name+': '+u['datasheet'], 'Unresolved exported composition/profile/package option'))
            continue
        card_refs = set(u['profiles'] + u['rules'] + [i for e in u['equipment'] for i in e['profiles']] + [i for g in u['models'] for i in g['stats']+g['abilities']+[i for e in g['equipment'] for i in e['profiles']]])
        profiles = copy.deepcopy({i: source['profiles'][i] for i in sorted(card_refs)})
        sheet = next((d for d in reference['datasheets'] if key(d['name']) == key(u['datasheet'])),None)
        url = sheet['source']['url'] if sheet else 'https://www.newrecruit.eu/'
        for p in profiles.values():
            if p['type'] != 'Unit' and 'weapons' not in p['type'].lower():
                p['values'] = {'Reference':url}
        keys = list(dict.fromkeys([k.upper() for k in u['keywords']]+[k.upper() for g in u['models'] for k in g['keywords']]))
        n = sum(g['count'] for g in u['models'])
        rc = next((p['points'] for p in sheet['pointTiers'] if p['models']==n and p['copyFrom']==1),u['exportedPoints']) if sheet else u['exportedPoints']
        info = copy.deepcopy(source['source'])
        info['provider'] = 'New Recruit'
        info['url'] = url
        card = dict(source=info,sourceEntryId=u['entryId'],sourceSelectionId=u['id'],unitKeywords=u['keywords'],models=u['models'],profiles=profiles,unitProfiles=u['profiles'],equipment=u['equipment'],rules=u['rules'],exportedPoints=u['exportedPoints'],copyOrdinal=1,paidOptions=[])
        if key(u['datasheet']) == key('Deathwatch Veterans'):
            card['composition'] = {'min':5,'max':10}
        gear = ', '.join(dict.fromkeys(e['name'] for g in u['models'] for e in g['equipment'] if 'close combat' not in e['name'].lower()))
        copy_prices = [next((p['points'] for p in sheet['pointTiers'] if p['models']==n and p['copyFrom'] <= i and (p['copyTo'] is None or i<=p['copyTo'])),rc) for i in range(1,7)] if sheet else []
        finish(side,u['datasheet'],f'{n} моделей · {gear}',n,rc,keys,card,u['leaderFor'],u['supportFor'],copy_prices)

out = '// Generated by tools/build-starter-catalog.py; factual profiles and source links only.\nimport type { CatalogUnit, Detachment } from "./model.ts"\n'
out += 'export const STOCK_CATALOG = [\n'+',\n'.join(json.dumps(c,ensure_ascii=False,separators=(',', ':')) for c in catalog)+'\n] as CatalogUnit[]\n'
out += 'export const STOCK_DETACHMENTS = [\n'+',\n'.join(json.dumps(d,ensure_ascii=False,separators=(',', ':')) for d in detachments)+'\n] as Detachment[]\n'
(ROOT / 'shared/stock.generated.ts').write_text(out,encoding='utf-8')
(ROOT / 'tmp/starter-catalog-skipped.json').write_text(json.dumps(sorted(set(skipped)),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'variants':len(catalog),'bySide':{s:sum(c['side']==s for c in catalog) for s in core},'detachments':{s:sum(d['side']==s for d in detachments) for s in core},'bytes':len(out.encode()),'skipped':len(set(skipped))},ensure_ascii=False))
