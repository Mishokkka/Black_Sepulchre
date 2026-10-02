import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Dices, LockKeyhole, RefreshCw, Skull, Swords } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ADJACENCY, BREACH_ASSETS, MISSIONS, STAGES, TACTICAL_ASSETS, campaignSurcharge, stageIndexForBattles } from '../data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from '../types'
import BattleAssets from './BattleAssets'

type Side='necrons'|'deathwatch'
type Battle={
  id:string;campaign_id:string;sequence_no:number;activation_id:string|null;sector_key:string;mission_code:string;
  battle_type:'Field Battle'|'Garrison Battle'|'Stronghold Assault';attacker_side:Side;defender_side:Side;attacker_origin:string;
  attacker_vp:number;defender_vp:number;outcome:string|null;status:'draft'|'completed';
  attacker_muster_locked:boolean;defender_muster_locked:boolean;salvage_attacker:number|null;salvage_defender:number|null;
  attacker_tactical_assets:string[];defender_tactical_assets:string[];defensive_asset:string|null;breach_assets:string[];
  recon_lock_sides:string[];attacker_interdict:string|null;defender_interdict:string|null;
  mission_options:string[];mission_choice_side:Side|null;
  attacker_salvage_choice:string|null;defender_salvage_choice:string|null;salvage_rerolled_sides:string[];
  event_code:string|null;event_options:string[];event_choice_side:Side|null;d66_rerolled:boolean;
  aftermath:any;report:any;created_at:string;completed_at:string|null
}
type BattleUnit={
  battle_id:string;unit_id:string;side:Side;role:'field'|'garrison_initial'|'garrison_reinforcement';
  participated:boolean;destroyed:boolean;deed:string|null;distinguished:boolean;resting:boolean;casualty_roll:number|null;
  casualty_modifier:number;casualty_result:string|null;damage_before:number|null;damage_after:number|null;xp_gained:number;
  scar_gained:string|null;critical_injury:string|null
}
type Pick={selected:boolean;role:'field'|'garrison_initial'|'garrison_reinforcement';resting:boolean}
type ResultPick={destroyed:boolean;deed:string;distinguished:boolean;casualty_modifier:number;mission_xp:number;use_medicae:boolean;khepra_rest:boolean}

const sideLabel=(s:string|null)=>s==='necrons'?'Necrons':s==='deathwatch'?'Deathwatch':'Neutral'
const outcomeLabel:Record<string,string>={
  attacker_win:'Победа атакующего',defender_win:'Победа защитника',draw:'Ничья',
  attacker_withdrawal:'Отступление атакующего',defender_withdrawal:'Отступление защитника'
}
const eff=(u:Unit)=>u.reference_cost+campaignSurcharge(u.reference_cost,u.campaign_rating)

function supplied(side:string,sector:string,sectors:Sector[]){
  const home=side==='deathwatch'?'A':'K',owned=new Set(sectors.filter(s=>s.owner_side===side).map(s=>s.sector_key))
  if(!owned.has(sector))return false
  const seen=new Set([sector]),q=[sector]
  while(q.length){const k=q.shift()!;if(k===home)return true;for(const n of ADJACENCY[k]??[])if(owned.has(n)&&!seen.has(n)){seen.add(n);q.push(n)}}
  return false
}

function caps(battle:Battle,campaign:Campaign,sectors:Sector[]){
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)],s=sectors.find(x=>x.sector_key===battle.sector_key)
  if(!s)return {initial:0,reserve:0,arrival:3}
  let ip=s.sector_class==='Home Stronghold'?100:s.fortified?100:s.sector_class==='Strategic Node'?75:50
  let rp=s.sector_class==='Home Stronghold'?75:s.fortified?50:s.sector_class==='Strategic Node'?35:25
  if(!supplied(battle.defender_side,battle.sector_key,sectors))rp-=10
  if(s.conditions?.includes('Exhausted'))rp-=10
  rp=Math.max(0,rp)
  return {initial:Math.floor(stage.armyLimit*ip/100/5)*5,reserve:Math.floor(stage.armyLimit*rp/100/5)*5,arrival:(s.sector_class==='Home Stronghold'||s.fortified)?2:3}
}

export default function BattleCenter({campaign,member,players,sectors,units,reload}:{campaign:Campaign;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[];reload:()=>void}){
  const[battles,setBattles]=useState<Battle[]>([])
  const[battleUnits,setBattleUnits]=useState<BattleUnit[]>([])
  const[picks,setPicks]=useState<Record<string,Pick>>({})
  const[resultPicks,setResultPicks]=useState<Record<string,ResultPick>>({})
  const[attVp,setAttVp]=useState(0),[defVp,setDefVp]=useState(0)
  const[outcome,setOutcome]=useState('draw')
  const[defRetreat,setDefRetreat]=useState(''),[garRetreat,setGarRetreat]=useState('')
  const[attSalvage,setAttSalvage]=useState('supply'),[defSalvage,setDefSalvage]=useState('supply')
  const[narrative,setNarrative]=useState('')
  const[interdictAsset,setInterdictAsset]=useState('')
  const[salvageRerollChoice,setSalvageRerollChoice]=useState<'supply'|'intelligence'>('supply')
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)

  const fetchBattles=useCallback(async()=>{
    const{data}=await supabase.from('battles').select('*').eq('campaign_id',campaign.id).order('sequence_no',{ascending:false})
    setBattles((data??[]) as Battle[])
    const pending=(data??[]).find((b:any)=>b.status==='draft') as Battle|undefined
    if(pending){
      const{data:bu}=await supabase.from('battle_units').select('*').eq('battle_id',pending.id)
      setBattleUnits((bu??[]) as BattleUnit[])
    }else setBattleUnits([])
  },[campaign.id])

  useEffect(()=>{
    fetchBattles()
    const ch=supabase.channel('battle-center-'+campaign.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'battles',filter:'campaign_id=eq.'+campaign.id},fetchBattles)
      .on('postgres_changes',{event:'*',schema:'public',table:'battle_units'},fetchBattles)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[campaign.id,fetchBattles])
  const pending=battles.find(b=>b.status==='draft')??null
  const history=battles.filter(b=>b.status==='completed')
  const scoreOutcome=attVp>defVp?'attacker_win':defVp>attVp?'defender_win':'draw'
  useEffect(()=>{if(outcome!=='attacker_withdrawal'&&outcome!=='defender_withdrawal')setOutcome(scoreOutcome)},[attVp,defVp,scoreOutcome])

  useEffect(()=>{
    if(!pending)return
    const existing=new Map(battleUnits.filter(x=>x.side===member.side).map(x=>[x.unit_id,x]))
    const next:Record<string,Pick>={}
    for(const u of units.filter(x=>x.side===member.side)){
      const x=existing.get(u.id)
      const defaultRole:Pick['role']=u.location_type==='field'?'field':pending.battle_type==='Garrison Battle'?'garrison_initial':pending.battle_type==='Field Battle'?'garrison_reinforcement':players.find(p=>p.side===pending.defender_side)?.main_force_sector===pending.sector_key?'garrison_reinforcement':'garrison_initial'
      next[u.id]={selected:!!x,role:(x?.role??defaultRole) as Pick['role'],resting:!!x?.resting}
    }
    setPicks(next)
    const rp:Record<string,ResultPick>={}
    for(const bu of battleUnits)rp[bu.unit_id]={destroyed:bu.destroyed,deed:bu.deed??'',distinguished:bu.distinguished,casualty_modifier:0,mission_xp:0,use_medicae:false,khepra_rest:false}
    setResultPicks(rp)
  },[pending?.id,pending?.battle_type,pending?.sector_key,battleUnits.length,member.side,units,players])

  const refresh=async()=>{await fetchBattles();reload()}
  async function rpc(name:string,args:Record<string,unknown>,success?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc(name,args)
    if(error)setMsg(error.message)
    else{setMsg(success??'Готово.');await refresh()}
    setWorking(false)
    return {data,error}
  }

  async function useReconLock(){
    if(!pending)return
    const r=await rpc('battle_use_recon_lock',{p_battle:pending.id},'Recon Lock активирован.')
    if(r.data?.both)setMsg('Обе стороны используют Recon Lock: Muster раскрывается одновременно.')
  }

  async function useInterdict(){
    if(!pending||!interdictAsset)return
    const r=await rpc('battle_use_interdict',{p_battle:pending.id,p_asset:interdictAsset},`Interdict: ${interdictAsset} запрещён противнику.`)
    if(!r.error)setInterdictAsset('')
  }

  async function chooseMission(code:string){
    if(!pending)return
    await rpc('battle_choose_mission',{p_battle:pending.id,p_code:code},`Mission selected: ${code}.`)
  }

  const mission=useMemo(()=>pending?MISSIONS.find(m=>m[0]===pending.mission_code):undefined,[pending?.mission_code])
  const ownLocked=pending?(member.side===pending.attacker_side?pending.attacker_muster_locked:pending.defender_muster_locked):false
  const myPlayer=players.find(p=>p.side===member.side)
  const c=pending?caps(pending,campaign,sectors):null
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const reconSides=pending?.recon_lock_sides??[]
  const ownRecon=reconSides.includes(member.side)
  const bothRecon=reconSides.length>=2
  const ownInterdict=pending?(member.side===pending.attacker_side?pending.attacker_interdict:pending.defender_interdict):null
  const enemyInterdict=pending?(member.side===pending.attacker_side?pending.defender_interdict:pending.attacker_interdict):null
  const interdictOptions=member.side===pending?.attacker_side?[...TACTICAL_ASSETS]:[...TACTICAL_ASSETS,...BREACH_ASSETS]
  const khepra=sectors.find(s=>s.sector_key==='I')
  const khepraRestActive=!!pending&&pending.sector_key==='I'&&khepra?.owner_side==='necrons'&&!khepra.conditions?.some(x=>['Exhausted','Sabotaged','Disrupted','Contested'].includes(x))

  const eligible=useMemo(()=>{
    if(!pending)return []
    if(member.side===pending.attacker_side)return units.filter(u=>u.side===member.side&&u.location_type==='field'&&u.damage<3)
    if(pending.battle_type==='Garrison Battle')return units.filter(u=>u.side===member.side&&u.location_type==='garrison'&&u.sector_key===pending.sector_key&&u.damage<3)
    const forceHere=players.find(p=>p.side===member.side)?.main_force_sector===pending.sector_key
    return units.filter(u=>u.side===member.side&&u.damage<3&&((forceHere&&u.location_type==='field')||(u.location_type==='garrison'&&u.sector_key===pending.sector_key)))
  },[pending,units,member.side,players])

  const totals=useMemo(()=>{
    let field=0,initial=0,reserve=0
    for(const u of eligible){const p=picks[u.id];if(!p?.selected||p.resting)continue;const cost=eff(u);if(p.role==='field')field+=cost;else if(p.role==='garrison_initial')initial+=cost;else reserve+=cost}
    return {field,initial,reserve}
  },[eligible,picks])

  async function lockMuster(){
    if(!pending)return
    const payload=eligible.filter(u=>picks[u.id]?.selected).map(u=>({unit_id:u.id,role:picks[u.id].role,resting:picks[u.id].resting}))
    await rpc('battle_set_muster',{p_battle:pending.id,p_units:payload,p_lock:true},'Muster зафиксирован.')
  }

  function toggle(id:string,patch:Partial<Pick>){setPicks(p=>({...p,[id]:{...p[id],...patch}}))}
  function resultPatch(id:string,patch:Partial<ResultPick>){setResultPicks(p=>({...p,[id]:{...(p[id]??{destroyed:false,deed:'',distinguished:false,casualty_modifier:0,mission_xp:0,use_medicae:false,khepra_rest:false}),...patch}}))}

  function setKhepraRest(id:string,checked:boolean){
    setResultPicks(p=>{
      const next={...p}
      for(const key of Object.keys(next))next[key]={...next[key],khepra_rest:false}
      next[id]={...(next[id]??{destroyed:false,deed:'',distinguished:false,casualty_modifier:0,mission_xp:0,use_medicae:false,khepra_rest:false}),khepra_rest:checked}
      return next
    })
  }

  const legalDefRetreat=useMemo(()=>{
    if(!pending)return []
    const defenderForce=players.find(p=>p.side===pending.defender_side)
    if(defenderForce?.main_force_sector!==pending.sector_key)return []
    return (ADJACENCY[pending.sector_key]??[]).filter(k=>sectors.find(s=>s.sector_key===k)?.owner_side===pending.defender_side)
  },[pending,players,sectors])
  const localGarrison=useMemo(()=>pending?units.filter(u=>u.side===pending.defender_side&&u.location_type==='garrison'&&u.sector_key===pending.sector_key):[],[pending,units])
  const legalGarRetreat=useMemo(()=>pending?(ADJACENCY[pending.sector_key]??[]).filter(k=>sectors.find(s=>s.sector_key===k)?.owner_side===pending.defender_side):[],[pending,sectors])

  async function rerollSalvage(b:Battle){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('battle_reroll_salvage',{p_battle:b.id,p_choice:salvageRerollChoice})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(`Salvage re-roll: ${data.old_roll} → ${data.new_roll}. Reward: ${data.supply_reward} Supply, ${data.intel_reward} Intel.`)
    await refresh()
  }

  async function rerollD66(b:Battle){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('battle_reroll_d66',{p_battle:b.id})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(`D66 re-roll: ${b.event_code} → ${data}. Второй результат обязателен.`)
    await refresh()
  }

  async function resolve(){
    if(!pending)return
    const unitResults=battleUnits.map(bu=>({unit_id:bu.unit_id,...(resultPicks[bu.unit_id]??{destroyed:false,deed:'',distinguished:false,casualty_modifier:0,mission_xp:0,use_medicae:false,khepra_rest:false})}))
    const r=await rpc('battle_resolve',{
      p_battle:pending.id,p_attacker_vp:attVp,p_defender_vp:defVp,p_outcome:outcome,p_unit_results:unitResults,
      p_defender_retreat:defRetreat||null,p_garrison_retreat:garRetreat||null,
      p_attacker_salvage_choice:attSalvage,p_defender_salvage_choice:defSalvage,p_narrative:narrative
    })
    if(r.data)setMsg(`Aftermath завершён. Salvage ${pending.attacker_side}: ${r.data.attacker_salvage}; ${pending.defender_side}: ${r.data.defender_salvage}; D66: ${r.data.d66}.`)
  }

  if(!pending)return <div className="battle-page">
    <section className="panel empty-state"><Swords size={42}/><h2>Нет активного боя</h2><p>Контакт создаётся автоматически, когда Main Force входит во вражеский сектор. После этого здесь появится Mission → Muster → Report → Aftermath.</p></section>
    {history.length>0&&<section className="panel"><div className="section-head"><div><div className="eyebrow">BATTLE LOG</div><h2>Завершённые бои</h2></div></div>
      <div className="battle-history">{history.map((b,i)=>{const mySalvage=member.side===b.attacker_side?b.salvage_attacker:b.salvage_defender;const logisticsOpen=i===0&&campaign.active_side===b.attacker_side;const salvageUsed=(b.salvage_rerolled_sides??[]).includes(member.side);return <div key={b.id} className="battle-history-row"><div><strong>#{b.sequence_no} · {b.mission_code}</strong><small>{b.battle_type} · Sector {b.sector_key}</small></div><div>{b.attacker_vp}:{b.defender_vp}</div><div>{outcomeLabel[b.outcome??'']??b.outcome}</div><div><small>Ваш Salvage {mySalvage??'—'} · D66 {b.event_code??'—'}</small></div>
        {logisticsOpen&&<div className="history-actions">
          {!salvageUsed&&<><select value={salvageRerollChoice} onChange={e=>setSalvageRerollChoice(e.target.value as 'supply'|'intelligence')}><option value="supply">Если 6: +20 Supply</option><option value="intelligence">Если 6: +1 Intel</option></select><button className="ghost compact" disabled={working||(players.find(p=>p.side===member.side)?.intelligence??0)<1} onClick={()=>rerollSalvage(b)}><RefreshCw size={13}/> Salvage · 1 Intel</button></>}
          {!b.d66_rerolled&&b.event_code?.match(/^[1-6][1-6]$/)&&<button className="ghost compact" disabled={working||(players.find(p=>p.side===member.side)?.intelligence??0)<2} onClick={()=>rerollD66(b)}><Dices size={13}/> D66 · 2 Intel</button>}
          {b.event_code==='CHOICE'&&<small>Сначала выберите Fleshworks D66 в «Событиях».</small>}
        </div>}
      </div>})}</div>
      {msg&&<div className="notice">{msg}</div>}
    </section>}
  </div>

  const bothLocked=pending.attacker_muster_locked&&pending.defender_muster_locked
  const attacker=sideLabel(pending.attacker_side),defender=sideLabel(pending.defender_side)
  return <div className="battle-page">
    <section className="panel battle-hero">
      <div><div className="eyebrow">BATTLE #{pending.sequence_no} · SECTOR {pending.sector_key}</div><h2>{pending.battle_type}</h2><p>{attacker} атакует {defender} из сектора {pending.attacker_origin}.</p></div>
      <div className="battle-locks"><span className={pending.attacker_muster_locked?'ok':''}>{attacker} {pending.attacker_muster_locked?'LOCKED':'MUSTER'}</span><span className={pending.defender_muster_locked?'ok':''}>{defender} {pending.defender_muster_locked?'LOCKED':'MUSTER'}</span></div>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">MISSION</div><h2>{pending.mission_code==='TBD'?'Не определена':pending.mission_code==='CHOICE'?'Noctis Relay: выберите результат':`${pending.mission_code} · ${mission?.[1]??''}`}</h2></div><Dices/></div>
      {pending.mission_code==='TBD'?<button className="primary" disabled={working} onClick={()=>rpc('battle_roll_mission',{p_battle:pending.id})}>Бросить миссию</button>:
      pending.mission_code==='CHOICE'?<div className="mission-choice">
        <p className="muted">Noctis Relay бросил D3 дважды. Выбор принадлежит {sideLabel(pending.mission_choice_side)}.</p>
        <div className="button-row">{(pending.mission_options??[]).map(code=>{const m=MISSIONS.find(x=>x[0]===code);return <button key={code} className="ghost" disabled={working||member.side!==pending.mission_choice_side} onClick={()=>chooseMission(code)}>{code} · {m?.[1]??''}</button>})}</div>
      </div>:
      <div className="mission-line"><span>{mission?.[2]}</span><div className="button-row">
        <button className="ghost compact" disabled={working||(myPlayer?.intelligence??0)<1} onClick={()=>rpc('battle_reroll_mission',{p_battle:pending.id})}><RefreshCw size={14}/> Re-roll · 1 Intel</button>
        <button className="ghost compact" disabled={working||ownRecon||(myPlayer?.intelligence??0)<1||pending.attacker_muster_locked||pending.defender_muster_locked} onClick={useReconLock}><LockKeyhole size={14}/> Recon Lock · 1 Intel</button>
      </div></div>}
      {reconSides.length>0&&<div className="notice">{bothRecon?'Обе стороны активировали Recon Lock: порядок раскрытия не меняется.':`Recon Lock: ${sideLabel(reconSides[0])} фиксирует Muster после соперника.`}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">YOUR MUSTER · {sideLabel(member.side)}</div><h2>{ownLocked?'Зафиксирован':'Сформируйте силы'}</h2></div><LockKeyhole/></div>
      <div className="muster-summary"><span>Army Limit <strong>{stage.armyLimit}</strong></span><span>Field <strong>{totals.field}</strong></span><span>Garrison initial <strong>{totals.initial}{c?` / ${pending.battle_type==='Garrison Battle'?c.initial:stage.armyLimit}`:''}</strong></span><span>Reserve <strong>{totals.reserve}{c?` / ${c.reserve}`:''}</strong></span></div>
      {eligible.length===0?<div className="notice">Для этой стороны сейчас нет доступных units.</div>:<div className="muster-list">{eligible.map(u=>{const fallbackRole:Pick['role']=u.location_type==='field'?'field':pending.battle_type==='Garrison Battle'?'garrison_initial':pending.battle_type==='Field Battle'?'garrison_reinforcement':players.find(p=>p.side===pending.defender_side)?.main_force_sector===pending.sector_key?'garrison_reinforcement':'garrison_initial';const p=picks[u.id]??{selected:false,role:fallbackRole,resting:false};return <div className={'muster-unit '+(p.selected?'selected':'')} key={u.id}>
        <input type="checkbox" checked={p.selected} disabled={ownLocked} onChange={e=>toggle(u.id,{selected:e.target.checked})}/>
        <div><strong>{u.name}</strong><small>{u.datasheet} · EC {eff(u)} · Damage {u.damage}</small></div>
        {u.location_type==='garrison'?<select disabled={ownLocked||!p.selected||p.resting} value={p.role} onChange={e=>toggle(u.id,{role:e.target.value as Pick['role']})}><option value="garrison_initial">Initial</option><option value="garrison_reinforcement">Reinforcement</option></select>:<span className="tag">Field</span>}
        <label className="rest-toggle"><input type="checkbox" checked={p.resting} disabled={ownLocked||!p.selected||u.damage===0} onChange={e=>toggle(u.id,{resting:e.target.checked})}/> Rest</label>
      </div>})}</div>}
      {!ownLocked&&<button className="primary action-main" disabled={working||pending.mission_code==='TBD'||pending.mission_code==='CHOICE'} onClick={lockMuster}><LockKeyhole size={15}/> Lock Muster</button>}
      {ownLocked&&!bothLocked&&<div className="notice">Ваш Muster сохранён. Ожидается вторая сторона.</div>}
    </section>

    {bothLocked&&<section className="panel intel-tools">
      <div className="section-head"><div><div className="eyebrow">INTELLIGENCE</div><h2>Interdict</h2></div><LockKeyhole/></div>
      {ownInterdict?<div className="notice">Ваш Interdict: противнику запрещён <strong>{ownInterdict}</strong>.</div>:<div className="inline-control">
        <select value={interdictAsset} onChange={e=>setInterdictAsset(e.target.value)}><option value="">Выберите Tactical/Breach Asset</option>{interdictOptions.map(a=><option key={a.code} value={a.code}>{a.code}</option>)}</select>
        <button className="ghost" disabled={working||!interdictAsset||(myPlayer?.intelligence??0)<2} onClick={useInterdict}>Interdict · 2 Intel</button>
      </div>}
      {enemyInterdict&&<p className="muted">Противник запретил для вашей стороны: <strong>{enemyInterdict}</strong>.</p>}
    </section>}

    {bothLocked&&<BattleAssets battle={pending} campaign={campaign} member={member} sectors={sectors} units={units} battleUnits={battleUnits} onSaved={async message=>{setMsg(message);await refresh()}}/>}

    {bothLocked&&<section className="panel">
      <div className="section-head"><div><div className="eyebrow">TABLETOP RESULT</div><h2>Battle Report</h2></div><Skull/></div>
      <div className="score-grid"><label>{attacker} VP<input type="number" min={0} max={100} value={attVp} onChange={e=>setAttVp(Number(e.target.value))}/></label><label>{defender} VP<input type="number" min={0} max={100} value={defVp} onChange={e=>setDefVp(Number(e.target.value))}/></label><label>Outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value={scoreOutcome}>{outcomeLabel[scoreOutcome]}</option><option value="attacker_withdrawal">{outcomeLabel.attacker_withdrawal}</option><option value="defender_withdrawal">{outcomeLabel.defender_withdrawal}</option></select></label></div>
      <div className="result-list">{battleUnits.map(bu=>{const u=units.find(x=>x.id===bu.unit_id);if(!u)return null;const r=resultPicks[bu.unit_id]??{destroyed:false,deed:'',distinguished:false,casualty_modifier:0,mission_xp:0,use_medicae:false,khepra_rest:false};return <div className="result-unit" key={bu.unit_id}>
        <div><strong>{u.name}</strong><small>{sideLabel(bu.side)} · {bu.resting?'RESTING':bu.role}</small></div>
        {bu.resting&&bu.side==='necrons'&&khepraRestActive&&u.damage>0&&<label title="Necropolis Khepra: один Necron unit за эту Logistics снимает 2 Damage вместо 1."><input type="checkbox" checked={r.khepra_rest} onChange={e=>setKhepraRest(bu.unit_id,e.target.checked)}/> Khepra Rest ×2</label>}
        {!bu.resting&&<><label><input type="checkbox" checked={r.destroyed} onChange={e=>resultPatch(bu.unit_id,{destroyed:e.target.checked})}/> Destroyed</label>
        <select value={r.deed} onChange={e=>resultPatch(bu.unit_id,{deed:e.target.value})}><option value="">No Deed</option>{['HOLD','BREAK','HUNT','ENDURE','OPERATE'].map(d=><option key={d}>{d}</option>)}</select>
        <label title={u.damage>=2?'Damage 2+ units cannot be Distinguished':''}><input type="checkbox" checked={r.distinguished} disabled={u.damage>=2} onChange={e=>resultPatch(bu.unit_id,{distinguished:e.target.checked})}/> Distinguished</label>
        <label>Casualty mod<input className="mini" type="number" min={-3} max={3} value={r.casualty_modifier} disabled={!r.destroyed} onChange={e=>resultPatch(bu.unit_id,{casualty_modifier:Number(e.target.value)})}/></label>
        <label>Mission XP<input className="mini" type="number" min={0} max={5} value={r.mission_xp} onChange={e=>resultPatch(bu.unit_id,{mission_xp:Number(e.target.value)})}/></label>
        {r.destroyed&&u.armoury?.some((a:any)=>a?.code==='field_medicae')&&<label><input type="checkbox" checked={r.use_medicae} onChange={e=>resultPatch(bu.unit_id,{use_medicae:e.target.checked})}/> Auto-use Medicae if Damage</label>}</>}
      </div>})}</div>

      {(outcome==='attacker_win'||outcome==='defender_withdrawal')&&pending.battle_type!=='Stronghold Assault'&&<div className="retreat-grid">
        {legalDefRetreat.length>0&&<label>Defender Main Force retreat<select value={defRetreat} onChange={e=>setDefRetreat(e.target.value)}><option value="">Выберите сектор</option>{legalDefRetreat.map(k=><option key={k}>{k}</option>)}</select></label>}
        {localGarrison.length>0&&legalGarRetreat.length>0&&<label>Garrison displacement<select value={garRetreat} onChange={e=>setGarRetreat(e.target.value)}><option value="">Выберите сектор</option>{legalGarRetreat.map(k=><option key={k}>{k}</option>)}</select></label>}
      </div>}

      <div className="retreat-grid"><label>Если Salvage {attacker} = 6<select value={attSalvage} onChange={e=>setAttSalvage(e.target.value)}><option value="supply">+20 Supply</option><option value="intelligence">+1 Intelligence</option></select></label><label>Если Salvage {defender} = 6<select value={defSalvage} onChange={e=>setDefSalvage(e.target.value)}><option value="supply">+20 Supply</option><option value="intelligence">+1 Intelligence</option></select></label></div>
      <label>Строка летописи<textarea value={narrative} onChange={e=>setNarrative(e.target.value)} placeholder="Коротко: что произошло в битве."/></label>
      <button className="primary resolve-button" disabled={working} onClick={resolve}><Check size={16}/> Resolve + Automatic Aftermath</button>
      <p className="muted small-note">Сайт начислит Participation/Deed/Distinguished XP, бросит Casualty/Scar/Salvage/D66, обновит Damage, Supply, Intel, сектор, retreat и стадию. Critical Injury и содержимое D66 пока фиксируются как отдельные события для ручного разрешения.</p>
    </section>}
    {msg&&<div className="notice">{msg}</div>}
  </div>
}
