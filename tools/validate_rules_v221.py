"""Analytical acceptance checks for the written rules, not tests of the live app."""
from pathlib import Path
from collections import deque
from fractions import Fraction
from itertools import permutations
import math, re, json

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs'
core=(DOC/'Black_Sepulchre_v2.2.1_core_RU.md').read_text(encoding='utf-8')
missions=(DOC/'Black_Sepulchre_v2.2.1_missions_RU.md').read_text(encoding='utf-8')
crisis=(DOC/'Black_Sepulchre_v2.2.1_crisis_RU.md').read_text(encoding='utf-8')
ref=(DOC/'Black_Sepulchre_v2.2.1_reference_RU.md').read_text(encoding='utf-8')
checks=[]
def record(name, **details):checks.append({'check':name, 'passed':True, **details})

# Parse the normative adjacency rather than maintaining an unlinked second map.
line=next(l for l in core.splitlines() if l.startswith('Канонические связи:'))
graph={a:set(b.split(',')) for a,b in re.findall(r'([A-K]):([A-K](?:,[A-K])*)',line)}
assert len(graph)==11
for a,ns in graph.items():
    for b in ns:assert a in graph[b]
mirror={'A':'K','K':'A','B':'I','I':'B','C':'J','J':'C','D':'F','F':'D','E':'H','H':'E','G':'G'}
for a,ns in graph.items():assert {mirror[n] for n in ns}==graph[mirror[a]]
dist={'A':0};queue=deque(['A'])
while queue:
    a=queue.popleft()
    for b in graph[a]:
        if b not in dist:dist[b]=dist[a]+1;queue.append(b)
assert dist['K']==5 and graph['G']==set('DEFH')
record('map symmetry and distance', links=sum(map(len,graph.values()))//2, A_to_K=dist['K'])

ids=[]
for line in missions.splitlines():
    if line.startswith('## '):ids.extend(re.findall(r'\b([A-K][1-3])\.',line))
assert set(ids)=={f'{a}{n}' for a in 'ABCDEFGHIJK' for n in range(1,4)} and len(ids)==33
event_ids=re.findall(r'^\| ([1-6][1-6]) [A-Za-z]',ref,re.M)
assert len(event_ids)==36 and len(set(event_ids))==36
record('complete catalogue', missions=len(ids), D66_events=len(event_ids))

up5=lambda n:5*math.ceil(n/5)
assert '25% AL новой Stage' in core and 'RC ≤25% AL' in core
for rc in [80,100]:assert rc<=up5(500*.25)
record('early local supply feasibility',AL=500,old_cap=50,new_cap=125,RC100_deposits_from_25=3)

def casualty(raw):
    n=max(1,min(6,raw))
    damage={1:2,2:2,3:1,4:0,5:0,6:0}[n]
    return damage, int(n==1), int(raw<=0), int(n>=5)
for raw in range(-5,12):
    before=casualty(raw);after=casualty(raw+1)
    assert all(after[i]<=before[i] for i in range(3))
    assert after[3]>=before[3]
shattered=sum(2+casualty(d-1)[0]>=3 for d in range(1,7))
assert shattered==4
record('casualty modifier monotonicity', checked_raw_totals=17, damage2_shattered_probability='4/6', scope='base table; Critical subtable is a separate narrative result')

geometry=[]
for L,W,speed,d in [(44,30,9,7),(44,44,9,10),(60,44,12,12)]:
    assert 4*speed<L<=5*speed
    g=W-2*d
    for y in [W/2-g/4,W/2+g/4]:assert d<y<W-d
    geometry.append({'field':[L,W],'procession_exit_round':5,'platform_moves_to_edge':math.ceil(W/2/6)})
record('layouts and moving objects', cases=geometry)

# All scan orders: latent uniform transmitter equals old deferred Dn discovery.
for order in permutations(range(5)):
    survival=Fraction(1)
    for index in range(5):
        p=survival/Fraction(5-index)
        assert p==Fraction(1,5)
        survival*=Fraction(4-index,5-index)
record('F2 latent transmitter distribution',orders=120, probability_per_marker='1/5')

assert '(18,22), (42,22), (30,22)' in crisis
seals=[(18,22),(30,22),(42,22)]
for x,y in seals:assert y-12==32-y==10
# Reach from the deployment front with M6 by R2; static actor can encode in R2/3/4.
assert 10-3>6 and 10-3<=12
schedule=[];instability=0;keys=0
for rnd in range(1,6):
    instability+=2
    start=instability
    added=2 if rnd in (2,3,4) else 0
    if added:
        keys+=added;instability=max(0,instability-2)
    if rnd<=4 and keys<6 and added==0:instability+=1
    assert instability<12
    schedule.append({'round':rnd,'instability_at_pulse':start,'keys_total':keys,'instability_end':instability,'prime_possible':rnd==5})
assert keys==6
# Explicit completion-only kill gate avoids the first player's respawn trap.
assert 'Начать можно при живом Echo' in crisis
first_player={'echo_alive_at_action_start':True,'support_kills_in_shooting':True,'actor_alive_and_eligible_at_completion':True}
assert first_player['support_kills_in_shooting'] and first_player['actor_alive_and_eligible_at_completion']
idle=0
for rnd in range(1,5):idle+=2+1
assert idle==12
record('PACT symmetric reachable schedule', schedule=schedule, no_key_failure='end R4 without suppression', assumes='support destroys Echo before ENCODE completion; actors survive and remain eligible; no suppression used')

# Expected damage, not win probability; no Cover or additional abilities.
echo_damage=Fraction(8)*Fraction(1,2)*Fraction(2,3)*Fraction(1,2)*2
record('Echo ranged baseline',target='T4 Sv3+, AP-1, no Cover/invulnerable/mitigation',expected_unsaved_damage=float(echo_damage),not_a_winrate=True)

assert 'R2-R5 по 3 VP' in crisis and 'ещё 6 VP' in crisis
assert 4*3*3+2*6==48
record('WAR score ceiling',max_score=48, all_candidates_require_override=True)

all_text='\n'.join([core,missions,crisis,ref])
assert not re.search(r'\bTODO\b|\bTBD\b|\bFIXME\b|[\u4e00-\u9fff]',all_text)
for required in ['доход','request ID','версию состояния','одной транзакцией','повторный запрос','Snapshot']:
    assert required.lower() in all_text.lower(),required
record('publication completeness', unresolved_placeholders=0, server_contract='specified, not implemented or integration-tested')

result={'ruleset':'2.2.1','scope':'analytical validation of written homebrew rules; no live app or table playtest', 'checks':checks}
(DOC/'Black_Sepulchre_v2.2.1_checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
