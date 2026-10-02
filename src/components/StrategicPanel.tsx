import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BatteryCharging, Castle, Eye, Footprints, Hammer, Radio, ShieldAlert, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import LogisticsPanel from './LogisticsPanel'
import ReorganisePanel from './ReorganisePanel'
import { ADJACENCY, STAGES, fortifyCost, mobiliseGain, stageIndexForBattles } from '../data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from '../types'

interface Activation {
  id:string
  campaign_id:string
  sequence_no:number
  side:'necrons'|'deathwatch'
  start_sector:string
  end_sector:string|null
  march_points_start:number
  march_points_spent:number
  actions_available:number
  actions:any[]
  movement:any[]
  status:'open'|'battle_pending'|'logistics'|'completed'|'cancelled'
}

const label=(s:string|null)=>s==='necrons'?'Necrons':s==='deathwatch'?'Deathwatch':'Neutral'

function supplied(side:string, sector:string, sectors:Sector[]) {
  const home=side==='deathwatch'?'A':'K'
  const owned=new Set(sectors.filter(s=>s.owner_side===side).map(s=>s.sector_key))
  if(!owned.has(sector)) return false
  const seen=new Set([sector]),queue=[sector]
  while(queue.length){
    const here=queue.shift()!
    if(here===home)return true
    for(const next of ADJACENCY[here]??[]){
      if(owned.has(next)&&!seen.has(next)){seen.add(next);queue.push(next)}
    }
  }
  return false
}

export default function StrategicPanel({
  campaign,member,players,sectors,units,reload,onOpenBattles,
}:{
  campaign:Campaign
  member:Member
  players:PlayerState[]
  sectors:Sector[]
  units:Unit[]
  reload:()=>void
  onOpenBattles:()=>void
}){
  const[activation,setActivation]=useState<Activation|null>(null)
  const[msg,setMsg]=useState('')
  const[working,setWorking]=useState(false)
  const[sabotageTarget,setSabotageTarget]=useState('')
  const[showReorganise,setShowReorganise]=useState(false)

  const me=players.find(p=>p.side===member.side)
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const current=sectors.find(s=>s.sector_key===me?.main_force_sector)
  const neighbors=current?ADJACENCY[current.sector_key]??[]:[]
  const enemyNeighbors=neighbors.filter(k=>{
    const s=sectors.find(x=>x.sector_key===k)
    return s?.owner_side && s.owner_side!==member.side
  })
  const isMyTurn=campaign.active_side===member.side
  const currentSupplied=me?supplied(member.side,me.main_force_sector,sectors):false
  const canInvestigate=campaign.black_choir>=4&&!!current&&(current.sector_key==='G'||((ADJACENCY[current.sector_key]??[]).includes('G')&&current.owner_side===member.side))

  const fetchActivation=useCallback(async()=>{
    const{data}=await supabase.from('activations').select('*').eq('campaign_id',campaign.id).in('status',['open','battle_pending','logistics']).order('sequence_no',{ascending:false}).limit(1)
    setActivation((data?.[0] as Activation)??null)
  },[campaign.id])

  useEffect(()=>{fetchActivation()},[fetchActivation])

  const refresh=useCallback(async()=>{await Promise.all([fetchActivation(),Promise.resolve(reload())])},[fetchActivation,reload])

  async function rpc(name:string,args:Record<string,unknown>,success?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc(name,args)
    if(error)setMsg(error.message)
    else{
      setMsg(success??'Готово.')
      await refresh()
    }
    setWorking(false)
    return {data,error}
  }

  async function setFirst(side:'necrons'|'deathwatch'){
    await rpc('set_first_player',{p_campaign:campaign.id,p_side:side},'Первый игрок зафиксирован.')
  }

  async function begin(){
    const r=await rpc('begin_activation',{p_campaign:campaign.id})
    if(r.data)setMsg('Strategic Activation началась.')
  }

  async function move(target:string){
    const r=await rpc('activation_move',{p_activation:activation?.id,p_target:target})
    if(r.data?.kind==='battle'){setMsg('Контакт. Создан Battle Setup.');onOpenBattles()}
    if(r.data?.kind==='occupation')setMsg('Сектор занят без tabletop battle. Открыта Logistics Phase.')
  }

  const conditionList=current?.conditions?.length?current.conditions:[]
  const mpLeft=activation?activation.march_points_start-activation.march_points_spent:0

  if(campaign.active_side===null){
    return <section className="panel strategy-panel">
      <div className="section-head"><div><div className="eyebrow">CAMPAIGN START</div><h2>Определите первый ход</h2></div><Radio/></div>
      <p className="muted">По правилам первый Strategic Activation определяется броском. После броска зафиксируйте сторону здесь.</p>
      {member.role==='owner'?<div className="button-row">
        <button className="primary" disabled={working} onClick={()=>setFirst('deathwatch')}>Deathwatch ходят первыми</button>
        <button className="primary" disabled={working} onClick={()=>setFirst('necrons')}>Necrons ходят первыми</button>
      </div>:<div className="notice">Владелец кампании ещё не зафиксировал первый ход.</div>}
      {msg&&<div className="notice">{msg}</div>}
    </section>
  }

  if(!activation){
    return <div className="strategy-grid">
      <section className="panel">
        <div className="section-head"><div><div className="eyebrow">STRATEGIC TURN</div><h2>{label(campaign.active_side)}</h2></div><Footprints/></div>
        <dl className="rows">
          <div><dt>Ваш Main Force</dt><dd>{me?.main_force_sector}</dd></div>
          <div><dt>Supply Line</dt><dd>{currentSupplied?'Supplied':'Unsupplied'}</dd></div>
          <div><dt>Army Limit</dt><dd>{stage.armyLimit}</dd></div>
          <div><dt>Actions / MP</dt><dd>2 / 2</dd></div>
        </dl>
        {isMyTurn?<button className="primary action-main" disabled={working} onClick={begin}>Начать Strategic Activation</button>:<div className="notice">Сейчас ходит {label(campaign.active_side)}.</div>}
        {msg&&<div className="notice">{msg}</div>}
      </section>
      <section className="panel"><div className="eyebrow">POSITION</div><h2>{current?.name}</h2><p className="muted">{current?.sector_class} · {currentSupplied?'линия снабжения есть':'отрезан от Home Stronghold'}</p></section>
    </div>
  }

  if(activation.status==='logistics'){
    return <LogisticsPanel activationId={activation.id} campaign={campaign} member={member} players={players} sectors={sectors} units={units} reload={reload} onPassed={refresh}/>
  }

  if(activation.status==='battle_pending'){
    return <section className="panel empty-state">
      <ShieldAlert size={42}/><h2>Tabletop battle ожидает результата</h2>
      <p>Strategic Activation #{activation.sequence_no} остановлена на контакте. Дальнейшие Strategic Actions недоступны до Aftermath.</p>
      <button className="primary" onClick={onOpenBattles}>Открыть Battle Setup</button>
    </section>
  }

  const actionUsed=(type:string)=>activation.actions?.some(a=>a.type===type)
  const canAct=isMyTurn&&activation.side===member.side&&activation.actions_available>0
  const mobiliseBlocked=!!me?.resource_mobilise_used
  const reconBlocked=!!me?.resource_recon_used
  const fortCost=fortifyCost(stage.armyLimit)
  const mobGain=mobiliseGain(stage.armyLimit)

  return <div className="strategy-grid">
    <section className="panel wide">
      <div className="section-head"><div><div className="eyebrow">ACTIVATION #{activation.sequence_no}</div><h2>{label(activation.side)} · Sector {me?.main_force_sector}</h2></div><Footprints/></div>
      <div className="activation-meters">
        <div><span>Strategic Actions</span><strong>{activation.actions_available} / 2</strong></div>
        <div><span>March Points</span><strong>{mpLeft} / {activation.march_points_start}</strong></div>
        <div><span>Supply</span><strong>{me?.supply??0}</strong></div>
        <div><span>Intel</span><strong>{me?.intelligence??0}</strong></div>
      </div>
      {msg&&<div className="notice">{msg}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">MOVEMENT</div><h2>Соседние сектора</h2></div><ArrowRight/></div>
      <div className="move-list">
        {neighbors.map(k=>{const s=sectors.find(x=>x.sector_key===k)!;const hostile=s.owner_side!==member.side;return <button key={k} className={hostile?'move-button hostile':'move-button'} disabled={working||mpLeft<1} onClick={()=>move(k)}>
          <span><strong>{k}</strong> {s.name}</span><small>{hostile?(s.owner_side?label(s.owner_side):'Neutral'):'Friendly · 1 MP'}</small>
        </button>})}
      </div>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">STRATEGIC ACTIONS</div><h2>Действия</h2></div><BatteryCharging/></div>
      <div className="action-list">
        <button disabled={working||!canAct||reconBlocked||actionUsed('recon')} onClick={()=>rpc('activation_recon',{p_activation:activation.id},'+1 Intelligence.')}><Eye/><span><strong>Recon</strong><small>{reconBlocked?'Недоступно до battle/Occupation':'+1 Intelligence'}</small></span></button>
        <button disabled={working||!canAct||mobiliseBlocked||current?.sector_class==='Home Stronghold'||!currentSupplied||actionUsed('mobilise')} onClick={()=>rpc('activation_mobilise',{p_activation:activation.id},'Mobilise: +'+mobGain+' Supply; сектор Exhausted.')}><BatteryCharging/><span><strong>Mobilise</strong><small>+{mobGain} Supply · Exhausted 2</small></span></button>
        <button disabled={working||!canAct||actionUsed('forced_march')} onClick={()=>rpc('activation_forced_march',{p_activation:activation.id},'+1 March Point.')}><Footprints/><span><strong>Forced March</strong><small>+1 MP · без нового garrison в конце</small></span></button>
        <button disabled={working||!canAct||!!current?.fortified||!currentSupplied||actionUsed('fortify')||(me?.supply??0)<fortCost} onClick={()=>rpc('activation_fortify',{p_activation:activation.id},'Fortified. Потрачено '+fortCost+' Supply.')}><Castle/><span><strong>Fortify</strong><small>{fortCost} Supply</small></span></button>
        {conditionList.filter(c=>c==='Exhausted'||c==='Sabotaged').map(c=><button key={c} disabled={working||!canAct} onClick={()=>rpc('activation_repair_network',{p_activation:activation.id,p_condition:c},'Снято состояние '+c+'.')}><Wrench/><span><strong>Repair Network</strong><small>Снять {c}</small></span></button>)}
      </div>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">SABOTAGE</div><h2>Соседняя вражеская сеть</h2></div><Hammer/></div>
      {enemyNeighbors.length?<><select value={sabotageTarget} onChange={e=>setSabotageTarget(e.target.value)}><option value="">Выберите сектор</option>{enemyNeighbors.map(k=><option key={k} value={k}>{k} · {sectors.find(s=>s.sector_key===k)?.name}</option>)}</select>
      <div className="button-row">
        <button className="ghost" disabled={working||!canAct||!sabotageTarget||actionUsed('sabotage')||(me?.intelligence??0)<1} onClick={()=>rpc('activation_sabotage',{p_activation:activation.id,p_target:sabotageTarget,p_auto:false})}>1 Intel · бросок 4+</button>
        <button className="ghost" disabled={working||!canAct||!sabotageTarget||actionUsed('sabotage')||(me?.intelligence??0)<2} onClick={()=>rpc('activation_sabotage',{p_activation:activation.id,p_target:sabotageTarget,p_auto:true})}>2 Intel · автоуспех</button>
      </div></>:<p className="muted">Нет соседних enemy-controlled секторов.</p>}
    </section>

    <section className="panel">
      <div className="eyebrow">CURRENT SECTOR</div><h2>{current?.name}</h2>
      <dl className="rows">
        <div><dt>Контроль</dt><dd>{label(current?.owner_side??null)}</dd></div>
        <div><dt>Supply</dt><dd>{currentSupplied?'Supplied':'Unsupplied'}</dd></div>
        <div><dt>Fortified</dt><dd>{current?.fortified?'Да':'Нет'}</dd></div>
        <div><dt>Conditions</dt><dd>{conditionList.length?conditionList.join(', '):'Normal'}</dd></div>
      </dl>
      <button className="ghost action-main" disabled={working||!isMyTurn} onClick={()=>rpc('end_activation',{p_activation:activation.id},'Открыта Logistics Phase.')}>Завершить Activation</button>
    </section>
  </div>
}
