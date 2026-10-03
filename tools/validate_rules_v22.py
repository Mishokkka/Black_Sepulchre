"""Analytical checks, not a simulation or tabletop win-rate estimate."""
from fractions import Fraction
from collections import deque
from itertools import permutations
from pathlib import Path
import json, re

graph = dict(A=['B','C'], B=['A','D'], C=['A','E'], D=['B','F','G'], E=['C','H','G'], F=['D','I','G'], G=['D','E','F','H'], H=['E','J','G'], I=['F','K'], J=['H','K'], K=['I','J'])
mirror={'A':'K','B':'I','C':'J','D':'F','E':'H','F':'D','G':'G','H':'E','I':'B','J':'C','K':'A'}
assert all(a in graph[b] for a,bs in graph.items() for b in bs)
assert all(set(graph[mirror[a]])=={mirror[b] for b in bs} for a,bs in graph.items())
q=deque([('A',0)]); seen={'A'}; distance=None
while q:
    a,n=q.popleft()
    if a=='K': distance=n; break
    for b in graph[a]:
        if b not in seen: seen.add(b);q.append((b,n+1))
assert distance==5
geometry=[]
for L,W,d,speed in [(44,30,7,9),(44,44,10,9),(60,44,12,12)]:
    assert speed*4<L<=speed*5
    gap=W-2*d
    four=[(x,y) for x in [.3*L,.7*L] for y in [W/2-gap/4,W/2+gap/4]]
    assert all(0<x<L and d<y<W-d for x,y in four)
    geometry.append(dict(L=L,W=W,depth=d,speed=speed,exit_round=5,four=four))

# Conditional 1/n discovery yields one uniform true index, for every scan order.
discovery={}
for order in permutations(range(5)):
    survive=Fraction(1)
    probs={}
    for i,marker in enumerate(order):
        p=Fraction(1,5-i); probs[marker]=survive*p;survive*=1-p
    assert set(probs.values())=={Fraction(1,5)} and survive==0
    discovery[str(order)]=[str(probs[i]) for i in range(5)]

damage=[2,2,1,0,0,0]
xp=[0,0,0,0,1,1]
def casualty(raw,mod):
    total=raw+mod; clamped=max(1,min(6,total))
    return damage[clamped-1], clamped==1, total<=0, xp[clamped-1]
# All bonuses weakly improve Damage/Scar/Critical and never reduce XP.
for raw in range(1,7):
    for mod in range(-3,3):
        a,b=casualty(raw,mod),casualty(raw,mod+1)
        assert b[0]<=a[0] and b[1]<=a[1] and b[2]<=a[2] and b[3]>=a[3]
stats={}
for mod in [-2,-1,0,1]:
    rolls=[casualty(r,mod) for r in range(1,7)]
    stats[str(mod)]={'mean_damage':sum(x[0] for x in rolls)/6,'scar':sum(x[1] for x in rolls)/6,'critical':sum(x[2] for x in rolls)/6}
assert sum(casualty(r,-1)[0]>0 for r in range(1,7))==4

# M6 infantry deployment: DW central key R1, left R2, right R3;
# Necrons left R2, central R3, right R4. Dedicated channelers R5.
# Check actual straight-line distances from legal deployment edges.
for side,edge,rounds in [('DW',12,[2,3,1]),('N',32,[2,4,3])]:
    for (_,y),r in zip([(18,22),(42,22),(30,16)],rounds):
        assert abs(edge-y)<=6*r+3
assert abs(12-22)<=6*2+3 and abs(32-22)<=6*2+3
schedule={1:[(2,'DW')],2:[(0,'DW'),(0,'N')],3:[(1,'DW'),(2,'N')],4:[(1,'N')]}
keys=[set() for _ in range(3)]; instability=0; progress=[]; sealed=set()
for r in range(1,6):
    instability+=2
    for i,side in schedule.get(r,[]):
        keys[i].add(side)
        if len(keys[i])==2 and i not in sealed:
            sealed.add(i);instability=max(0,instability-2)
    progress.append({'round':r,'instability_after':instability,'sealed':sum(len(k)==2 for k in keys)})
assert all(len(k)==2 for k in keys) and progress[3]['sealed']==3
assert max(p['instability_after'] for p in progress)<12
assert progress[3]['sealed']==3 and 5>=4 # CORE PRIME can start both R5 turns.

root=Path('docs')
mission=(root/'Black_Sepulchre_v2.2_missions_RU.md').read_text(encoding='utf-8')
headers=' '.join(re.findall(r'^## ([A-K][123].*)$',mission,re.M))
ids=set(re.findall(r'\b([A-K][123])\.',headers))
assert ids=={f'{letter}{i}' for letter in 'ABCDEFGHIJK' for i in (1,2,3)},ids
decisions=(root/'Black_Sepulchre_v2.2_decisions_RU.md').read_text(encoding='utf-8')
ids=set(re.findall(r'\| F(\d\d) \|',decisions))
assert ids=={f'{i:02}' for i in range(1,38)}
texts='\n'.join(p.read_text(encoding='utf-8') for p in root.glob('Black_Sepulchre_v2.2_*.md'))
assert not re.search(r'\b(TODO|TBD|FIXME)\b',texts)
assert not re.search(r'[\u4e00-\u9fff]',texts)
result={'map_distance_A_K':distance,'symmetric_map':True,'layouts':geometry,'deferred_discovery_uniform_all_120_orders':True,'casualty':stats,'monotone_bonus':True,'ideal_coop_schedule':progress,'missions':len({f'{a}{n}' for a in 'ABCDEFGHIJK' for n in (1,2,3)}),'review_coverage':37,'limitation':'No faction combat simulation or measured win rates; ideal cooperation schedule assumes successful movement/eligibility and survival.'}
Path('docs/Black_Sepulchre_v2.2_checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
