"""Regenerate Deathwatch facts from the reviewed reference and official MFM snapshot.

Run from any directory: python tools/update-space-marines.py
Necron catalog entries, enhancements and bindings are preserved verbatim as data.
No rules prose, credentials or player data are included.
"""
import copy
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def key(s):
    return re.sub('[^A-Z0-9]', '', s.upper().replace('ARMOR', 'ARMOUR'))
def array(path, name):
    code = 'import { '+name+' } from '+json.dumps(path.as_uri())+'; process.stdout.write(JSON.stringify('+name+'))'
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,encoding='utf-8'))
def dump(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
def declaration(name, data, typename):
    return 'export const '+name+' = [\n'+',\n'.join(dump(v) for v in data)+'\n] as '+typename+'[]\n'

ref = json.loads((ROOT/'public/data/wahapedia.reference.json').read_text(encoding='utf-8'))
mfm = json.loads((ROOT/'public/data/space-marines.points.json').read_text(encoding='utf-8'))
stock_path = ROOT/'shared/stock.generated.ts'
enh_path = ROOT/'shared/enhancements.generated.ts'
catalog = [v for v in array(stock_path, 'STOCK_CATALOG') if v['side']=='necrons']
detachments = [v for v in array(stock_path, 'STOCK_DETACHMENTS') if v['side']=='necrons']
enhancements = [v for v in array(enh_path, 'STOCK_ENHANCEMENTS') if v['detachment'] in {d['id'] for d in detachments}]
bindings = array(enh_path, 'STOCK_BINDINGS')

CORE = set(map(key, ['Deathwatch Veterans','Intercessor Squad','Assault Intercessor Squad','Heavy Intercessor Squad','Infernus Squad','Eliminator Squad','Infiltrator Squad','Bladeguard Veteran Squad','Sternguard Veteran Squad']))
HEAVY = set(map(key, ['Deathwatch Terminator Squad','Eradicator Squad','Eradicator Squad with Heavy Bolters','Dreadnought','Ballistus Dreadnought','Brutalis Dreadnought','Redemptor Dreadnought','Decimus Kill Team','Fortis Kill Team','Indomitor Kill Team','Spectrus Kill Team','Talonstrike Kill Team']))
def category(name, keys):
    if any(k in keys for k in ['EPIC HERO','TITANIC','AIRCRAFT','MOUNTED','JUMP PACK']):return 'forbidden'
    if key(name) in CORE:return 'core'
    if 'CHARACTER' in keys or key(name) in HEAVY:return 'heavy'
    return 'other' if any(k in keys for k in ['INFANTRY','VEHICLE']) else 'forbidden'

def gear_profiles(d, name):
    target=key(name).rstrip('S')
    matches=['w'+str(i) for i,p in enumerate(d['weaponProfiles']) if key(re.split(r'\s+[-–—]\s+',p['name'])[0]).rstrip('S')==target]
    if not matches:
        matches=['w'+str(i) for i,p in enumerate(d['weaponProfiles']) if key(p['name']).rstrip('S')==target+'ONESHOT']
    if not matches and key(name) not in set(map(key,['Storm Shield','Orbital Comms Array','Astartes Shield','Auspex Array'])):
        raise ValueError(d['name']+': no weapon profile for '+name)
    return matches

def group(d, name, n, equipment, gid):
    stats=[i for i,p in enumerate(d['modelProfiles']) if key(p['name'])==key(name)]
    if not stats and (len(d['modelProfiles'])==1 or len({dump(p['values']) for p in d['modelProfiles']})==1):stats=[0]
    if not stats:raise ValueError(d['name']+': no stats for '+name)
    keys=[]
    if d['name']=='Decimus Kill Team':keys=['GRAVIS'] if 'Gravis' in name else ['TACTICUS']
    if d['name']=='Talonstrike Kill Team':keys=['GRAVIS'] if 'Heavy' in name else ['TACTICUS']
    return dict(id=gid,entryId=d['id'],name=name,count=n,keywords=keys,stats=['m'+str(stats[0])],abilities=[],profileOrigin='reviewed',equipment=[dict(entryId=d['id']+':'+key(e['name']),name=e['name'],count=e['quantity']*n,profiles=gear_profiles(d,e['name'])) for e in equipment])

def defaults(d,n):
    comp=copy.deepcopy(d['composition']);remaining=n-sum(c['min'] for c in comp)
    for c in reversed(comp):
        added=min(remaining,c['max']-c['min']);c['min']+=added;remaining-=added
    if remaining:raise ValueError(d['name']+': size has no legal composition')
    groups=[]
    for c in comp:
        if not c['min']:continue
        options=[g['items'] for g in d['defaultEquipment'] if re.match(r'(Every model|Each model|This model) is',g['carrier']) or key(re.sub(r'^(The|Every|Each) | is$','',g['carrier']))==key(c['model'])]
        if not options and d['name']!='Drop Pod':raise ValueError(d['name']+': no default gear for '+c['model'])
        groups.append(group(d,c['model'],c['min'],options[0] if options else [],'g'+str(len(groups))))
    return groups

def paid_variants(d,n,default):
    yield '',copy.deepcopy(default)
    name=d['name']
    if name=='Inceptor Squad':
        groups=copy.deepcopy(default)
        for g in groups:
            for e in g['equipment']:
                if key(e['name'])=='ASSAULTBOLTERS':
                    e['name']='plasma exterminators';e['profiles']=gear_profiles(d,e['name'])
        yield 'plasma exterminators',groups
    if name=='Deathwatch Terminator Squad':
        # Datasheet: up to three Terminators (not the Sergeant), independent of squad size.
        for shields in range(n+1):
            for cyclones in range(min(3,n-1,n-shields)+1):
                if not shields and not cyclones:continue
                specs=[('Deathwatch Terminator Sergeant',1,[])];groups=[]
                # Keep the Sergeant clear of Cyclones; shields can include the Sergeant.
                sergeant_shield=shields>0
                loadouts=[('Deathwatch Terminator Sergeant',1,['Thunder Hammer','Storm Shield'] if sergeant_shield else ['Power Fist','Storm Bolter']),('Deathwatch Terminator',shields-int(sergeant_shield),['Thunder Hammer','Storm Shield']),('Deathwatch Terminator',cyclones,['Power Fist','Storm Bolter','Cyclone Missile Launcher']),('Deathwatch Terminator',n-1-(shields-int(sergeant_shield))-cyclones,['Power Fist','Storm Bolter'])]
                for model,count,gear in loadouts:
                    if count:groups.append(group(d,model,count,[dict(name=g,quantity=1) for g in gear],'g'+str(len(groups))))
                yield f'Storm Shield ×{shields}, Cyclone ×{cyclones}',groups
        return
    swaps={'Desolation Squad':('Superfrag Rocket Launcher','Vengor Launcher',1),'Impulsor':(None,'Orbital Comms Array',1),'Invader ATVs':('Onslaught Gatling Cannon','Multi-melta',n),'Redemptor Dreadnought':('Heavy Onslaught Gatling Cannon','Macro Plasma Incinerator',1),'Repulsor Executioner':('Macro Plasma Incinerator','Heavy Laser Destroyer',1)}
    if name not in swaps:return
    old,new,max_count=swaps[name]
    for count in range(1,max_count+1):
        groups=[];remaining=count
        for g in default:
            replace=min(g['count'],remaining);remaining-=replace
            for qty,change in [(replace,True),(g['count']-replace,False)]:
                if not qty:continue
                items=[dict(name=e['name'],quantity=e['count']//g['count']) for e in g['equipment'] if not change or old is None or key(e['name'])!=key(old)]
                if change:items.append(dict(name=new,quantity=1))
                groups.append(group(d,g['name'],qty,items,'g'+str(len(groups))))
        yield new+f' ×{count}',groups

price_data=[]
for d in ref['datasheets']:
    if d['campaignSide']!='deathwatch':continue
    d=copy.deepcopy(d)
    # The printed default has the paid laser; offer both legal turret choices explicitly.
    if d['name']=='Repulsor Executioner':
        for g in d['defaultEquipment']:
            for e in g['items']:
                if key(e['name'])=='HEAVYLASERDESTROYER':e['name']='Macro Plasma Incinerator'
    assert d['modelProfiles'] and d['keywords'],d['name']
    profiles={'m'+str(i):dict(sourceId=d['id']+':m'+str(i),name=p['name'],type='Unit',values={**p['values'],'Base':p['base'] or ''}) for i,p in enumerate(d['modelProfiles'])}
    for i,p in enumerate(d['weaponProfiles']):
        profiles['w'+str(i)]=dict(sourceId=d['id']+':w'+str(i),name=p['name'],type='Melee Weapons' if p['type']=='melee' else 'Ranged Weapons',values={'Range':p['range'],'A':p['A'],'WS' if p['type']=='melee' else 'BS':p['skill'],'S':p['S'],'AP':p['AP'],'D':p['D'],'Keywords':', '.join(p['keywords'])})
    for i,name in enumerate(d['references']['abilities']):profiles['a'+str(i)]=dict(sourceId=d['id']+':a'+str(i),name=name,type='Abilities',values={'Reference':d['source'].get('profilesUrl',d['source']['url'])})
    keys=list(dict.fromkeys(d['keywords']+d['factionKeywords']+[d['name'].upper()]))
    price_data.append(dict(name=d['name'],tiers=d['pointTiers'],paidWargear=d['paidWargear']))
    for n in sorted({p['models'] for p in d['pointTiers']}):
        for label,groups in paid_variants(d,n,defaults(d,n)):
            paid=[];ps=copy.deepcopy(profiles)
            for option in d['paidWargear']:
                count=sum(e['count'] for g in groups for e in g['equipment'] if key(e['name'])==key(option['name']))
                if count:paid.append(dict(name=option['name']+' ×'+str(count),cost=count*option['points']))
            for g in groups:
                if any(key(e['name'])=='STORMSHIELD' for e in g['equipment']):
                    pid=g['stats'][0];sid=pid+'shield';ps[sid]=copy.deepcopy(ps[pid]);ps[sid]['values']['W']=str(int(ps[pid]['values']['W'])+1);ps[sid]['name']+=' (Storm Shield)';g['stats']=[sid]
            extra=sum(p['cost'] for p in paid)
            prices=[next(p['points'] for p in d['pointTiers'] if p['models']==n and p['copyFrom']<=i and (p['copyTo'] is None or i<=p['copyTo']))+extra for i in range(1,7)]
            card=dict(source=dict(filename=d['name'],gameId='wh40k11',gameRevision='11',catalogueId=d['id'],catalogueRevision=mfm['asOf'],catalogueName='Deathwatch',generator=d['source'].get('profileProvider','Wahapedia'),provider=d['source'].get('profileProvider','Wahapedia'),url=d['source'].get('profilesUrl',d['source']['url'])),sourceEntryId=d['id'],sourceSelectionId=d['id'],unitKeywords=keys,profiles=ps,models=groups,unitProfiles=['a'+str(i) for i in range(len(d['references']['abilities']))],equipment=[],rules=[],exportedPoints=prices[0],copyOrdinal=1,paidOptions=paid,reviewedAgainst='MFM v1.5 · Space Marines / Deathwatch · 2026-10-12',composition=dict(min=n,max=n))
            signature=dump([d['name'],n,label]);cid='stock:deathwatch:'+key(d['name']).lower()+':'+hashlib.sha256(signature.encode()).hexdigest()[:12]
            catalog.append(dict(id=cid,side='deathwatch',datasheet=d['name'],size=(f'{n} моделей · '+(label or 'базовое вооружение'))[:100],models=n,rc=prices[0],copyPrices=prices,keywords=keys,character='CHARACTER' in keys,epic='EPIC HERO' in keys,battleline='BATTLELINE' in keys,garrison=category(d['name'],keys),leaderFor=d['references']['attachmentTargets']['leader'],supportFor=d['references']['attachmentTargets']['support'],transport=0,cargoKeywords=[],ranged=any(w['type']=='ranged' for w in d['weaponProfiles']),restoration=False,unique='EPIC HERO' in keys,card=card))

for d in mfm['detachments']:
    did='stock-detachment:deathwatch:'+key(d['name']).lower()
    detachments.append(dict(id=did,name=d['name'],side='deathwatch',dp=d['dp'],requiredKeywords=[],**({'uniqueGroup':d['unique']} if d['unique'] else {}),dispositions=d['dispositions']))
    for e in d['enhancements']:
        enhancements.append(dict(**{**e,'source':'https://wahapedia.ru/wh40k11ed/factions/space-marines/'},id='sm-enhancement:'+key(d['name']).lower()+':'+key(e['name']).lower(),detachment=did))
stock_path.write_text('// Generated; run tools/update-space-marines.py for Marines, tools/build-starter-catalog.py for the legacy baseline.\nimport type { CatalogUnit, Detachment } from "./model.ts"\n'+declaration('STOCK_CATALOG',catalog,'CatalogUnit')+declaration('STOCK_DETACHMENTS',detachments,'Detachment'),encoding='utf-8')
enh_path.write_text('// Generated faction data; see tools/update-space-marines.py.\nimport type { Enhancement } from "./model.ts"\n'+declaration('STOCK_ENHANCEMENTS',enhancements,'Enhancement')+declaration('STOCK_BINDINGS',bindings,'{ datasheet: string; name: string; cost: number; detachment: string }'),encoding='utf-8')
(ROOT/'shared/marine-prices.generated.ts').write_text('// Generated from public/data/space-marines.points.json, MFM v1.5.\nexport const MARINE_DATA_VERSION = "2026-10-12"\nexport const MARINE_PRICES = '+dump(price_data)+'\n',encoding='utf-8')
print(dump(dict(catalog=len(catalog),marineDatasheets=len(price_data),marineVariants=sum(c['side']=='deathwatch' for c in catalog),detachments=len(detachments),enhancements=len(enhancements))))
