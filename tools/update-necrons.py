"""Update Necron facts from the reviewed MFM snapshot, preserving Marine data.

Run: python tools/update-necrons.py (Node 22.18+).
Existing loadouts and IDs are preserved. Four C'tan defaults include mandatory
Pantheon bindings. No rule prose or campaign/player data is published.
"""
import copy
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def key(s):
    k = re.sub('[^A-Z0-9]', '', s.upper().replace('(UPGRADE)', '').replace('(AURA)', ''))
    return {'LOKHUSTHEAVYDESTROYER':'LOKHUSTHEAVYDESTROYERS', 'RELETAVISTICTETHER':'RELATIVISTICTETHER'}.get(k,k)
def dump(v): return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
def array(path,name):
    code='import { '+name+' } from '+json.dumps(path.as_uri())+'; process.stdout.write(JSON.stringify('+name+'))'
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,encoding='utf-8'))
def decl(name,data,typ): return 'export const '+name+' = [\n'+',\n'.join(dump(x) for x in data)+'\n] as '+typ+'[]\n'

mf=json.loads((ROOT/'public/data/necrons.points.json').read_text(encoding='utf-8'))
units={key(x['name']):x for x in mf['units']}
refpath=ROOT/'public/data/wahapedia.reference.json'
ref=json.loads(refpath.read_text(encoding='utf-8'))
stockpath=ROOT/'shared/stock.generated.ts';enhpath=ROOT/'shared/enhancements.generated.ts'
catalog=array(stockpath,'STOCK_CATALOG');dets=array(stockpath,'STOCK_DETACHMENTS')
enh=array(enhpath,'STOCK_ENHANCEMENTS');bindings=array(enhpath,'STOCK_BINDINGS')
def prices(name,n):
    tiers=units[key(name)]['tiers']
    return [next(t['points'] for t in tiers if t['models']==n and t['copyFrom']<=i and (t['copyTo'] is None or i<=t['copyTo'])) for i in range(1,7)]

for d in ref['datasheets']:
    if d['campaignSide']!='necrons': continue
    u=units[key(d['name'])]
    d['pointTiers']=copy.deepcopy(u['tiers']);d['priceContextResolved']=True
    d['source']['pointsSource']=mf['source'];d['source']['pointsVerifiedAt']=mf['asOf']
    if key(d['name']) in {key(c['datasheet']) for c in catalog if c['side']=='necrons'}:continue
    assert 'CTAN' in key(d['name']),d['name']
    profiles={'m0':dict(sourceId=d['id']+':m0',name=d['name'],type='Unit',values={**d['modelProfiles'][0]['values'],'Base':d['modelProfiles'][0]['base']})}
    for i,p in enumerate(d['weaponProfiles']):
        profiles['w'+str(i)]=dict(sourceId=d['id']+':w'+str(i),name=p['name'],type='Melee Weapons' if p['type']=='melee' else 'Ranged Weapons',values={'Range':p['range'],'A':p['A'],'WS' if p['type']=='melee' else 'BS':p['skill'],'S':p['S'],'AP':p['AP'],'D':p['D'],'Keywords':', '.join(p['keywords'])})
    for i,name in enumerate(d['references']['abilities']):
        profiles['a'+str(i)]=dict(sourceId=d['id']+':a'+str(i),name=name,type='Abilities',values={'Reference':d['source']['url']})
    equipment=[]
    for e in d['defaultEquipment'][0]['items']:
        ids=['w'+str(i) for i,p in enumerate(d['weaponProfiles']) if key(re.split(r'\s+[–—-]\s+',p['name'])[0])==key(e['name'])]
        assert ids,(d['name'],e['name'])
        equipment.append(dict(entryId=d['id']+':'+key(e['name']),name=e['name'],count=e['quantity'],profiles=ids))
    keys=d['keywords']+d['factionKeywords'];ps=prices(d['name'],1)
    card=dict(source=dict(filename=d['name'],gameId='wh40k11',gameRevision='11',catalogueId=d['id'],catalogueRevision=d['source']['observedAt'],catalogueName='necrons',generator='Wahapedia',provider='Wahapedia',url=d['source']['url']),sourceEntryId=d['id'],sourceSelectionId=d['id'],unitKeywords=keys,profiles=profiles,models=[dict(id='g0',entryId=d['id'],name=d['name'],count=1,keywords=[],stats=['m0'],abilities=[],profileOrigin='reviewed',equipment=equipment)],unitProfiles=['a'+str(i) for i in range(len(d['references']['abilities']))],equipment=[],rules=[],exportedPoints=ps[0],copyOrdinal=1,paidOptions=[],composition=dict(min=1,max=1))
    catalog.append(dict(id='stock:necrons:'+key(d['name']).lower()+':default',side='necrons',datasheet=d['name'],size='1 модель · базовое вооружение',models=1,rc=ps[0],copyPrices=ps,keywords=keys,character=True,epic='EPIC HERO' in keys,battleline=False,garrison='forbidden',leaderFor=[],supportFor=[],transport=0,cargoKeywords=[],ranged=True,restoration=True,unique='EPIC HERO' in keys,card=card))

for c in catalog:
    if c['side']!='necrons':continue
    c['copyPrices']=prices(c['datasheet'],c['models']);c['rc']=c['copyPrices'][0]
    if c.get('card'):
        c['card']['exportedPoints']=c['rc'];c['card']['copyOrdinal']=1
        c['card']['reviewedAgainst']='Necron points: MFM v1.5 · '+mf['asOf']
    binding=next((b for b in bindings if key(b['datasheet'])==key(c['datasheet'])),None)
    if binding:
        c['packageCosts']=[x for x in c.get('packageCosts',[]) if key(x['name'])!=key(binding['name'])]+[dict(name=binding['name'],cost=binding['cost'],detachments=[binding['detachment']])]

for d in dets:
    if d.get('side')!='necrons':continue
    official=next(x for x in mf['detachments'] if key(x['name'])==key(d['name']))
    d['dp']=official['dp'];d['dispositions']=official['dispositions']
    if official['unique']:d['uniqueGroup']=official['unique']
    else:d.pop('uniqueGroup',None)
    for e in [e for e in enh if e['detachment']==d['id']]:
        e['cost']=next(x['cost'] for x in official['enhancements'] if key(x['name'])==key(e['name']))
        if e['name'] in ['Atomic Disintegrators','Gravitic Bolas']:e['eligibleAny']=[['CRYPTEK']]
        if e['name']=='Murdermind':e['supportFor']=['Ophydian Destroyers','Skorpekh Destroyers','Lokhust Destroyers','Lokhust Heavy Destroyers']

refpath.write_text(json.dumps(ref,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
stockpath.write_text('// Generated faction data; see tools/update-space-marines.py and tools/update-necrons.py.\nimport type { CatalogUnit, Detachment } from "./model.ts"\n'+decl('STOCK_CATALOG',catalog,'CatalogUnit')+decl('STOCK_DETACHMENTS',dets,'Detachment'),encoding='utf-8')
enhpath.write_text('// Generated faction data; see tools/update-space-marines.py and tools/update-necrons.py.\nimport type { Enhancement } from "./model.ts"\n'+decl('STOCK_ENHANCEMENTS',enh,'Enhancement')+decl('STOCK_BINDINGS',bindings,'{ datasheet: string; name: string; cost: number; detachment: string }'),encoding='utf-8')
(ROOT/'shared/necron-prices.generated.ts').write_text('// Generated from public/data/necrons.points.json, MFM v1.5.\nexport const NECRON_DATA_VERSION = '+dump(mf['asOf'])+'\nexport const NECRON_PRICES = '+dump(mf['units'])+'\n',encoding='utf-8')
print(dump(dict(necronDatasheets=len(units),necronVariants=sum(c['side']=='necrons' for c in catalog))))
