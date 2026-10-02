import { useMemo, useState } from 'react'
import { Shield, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BREACH_ASSETS, DEFENSIVE_ASSETS, STAGES, TACTICAL_ASSETS, campaignSurcharge, stageIndexForBattles } from '../data/campaign'
import type { Campaign, Member, Sector, Unit } from '../types'

type Side='necrons'|'deathwatch'
type BattleLike={
  id:string;sector_key:string;battle_type:'Field Battle'|'Garrison Battle'|'Stronghold Assault';
  attacker_side:Side;defender_side:Side;
  attacker_tactical_assets:string[];defender_tactical_assets:string[];
  defensive_asset:string|null;breach_assets:string[];
}
type BattleUnitLike={unit_id:string;side:Side;role:'field'|'garrison_initial'|'garrison_reinforcement';participated:boolean}

const label=(s:string)=>s==='necrons'?'Necrons':'Deathwatch'

export default function BattleAssets({
  battle,campaign,member,sectors,units,battleUnits,onSaved
}:{
  battle:BattleLike;campaign:Campaign;member:Member;sectors:Sector[];units:Unit[];battleUnits:BattleUnitLike[];onSaved:(message:string)=>void
}){
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const sector=sectors.find(s=>s.sector_key===battle.sector_key)
  const side=member.side
  const[working,setWorking]=useState(false),[msg,setMsg]=useState('')
  const[tactical,setTactical]=useState<string[]>(side===battle.attacker_side?battle.attacker_tactical_assets??[]:battle.defender_tactical_assets??[])
  const[defensive,setDefensive]=useState(side===battle.defender_side?battle.defensive_asset??'':'')
  const[breach,setBreach]=useState<string[]>(side===battle.attacker_side?battle.breach_assets??[]:[])

  const totals=useMemo(()=>{
    const total=(s:Side)=>battleUnits.filter(b=>b.side===s&&b.participated&&(b.role==='field'||b.role==='garrison_initial')).reduce((sum,b)=>{
      const u=units.find(x=>x.id===b.unit_id)
      return sum+(u?u.reference_cost+campaignSurcharge(u.reference_cost,u.campaign_rating):0)
    },0)
    return {attacker:total(battle.attacker_side),defender:total(battle.defender_side)}
  },[battleUnits,units,battle.attacker_side,battle.defender_side])

  const underdog=useMemo(()=>{
    if(battle.battle_type!=='Field Battle'||totals.attacker===totals.defender)return {side:null as Side|null,slots:0,gap:0}
    const gap=Math.abs(totals.attacker-totals.defender)
    const pct=gap/stage.armyLimit
    const slots=pct<.10?0:pct<.20?1:pct<.30?2:3
    return {side:slots?totals.attacker<totals.defender?battle.attacker_side:battle.defender_side:null,slots,gap}
  },[battle.battle_type,totals,stage.armyLimit,battle.attacker_side,battle.defender_side])

  const defensiveSlots=side===battle.defender_side&&sector?.fortified&&!sector.conditions?.includes('Sabotaged')&&!(sector.sector_key==='E'&&sector.conditions?.includes('Exhausted'))?1:0
  const breachSlots=side===battle.attacker_side&&battle.battle_type!=='Stronghold Assault'?(sector?.fortified?2:sector?.sector_class==='Strategic Node'?1:0):0
  const tacticalSlots=underdog.side===side?underdog.slots:0

  const toggle=(arr:string[],set:(v:string[])=>void,value:string,max:number)=>{
    if(arr.includes(value)){set(arr.filter(x=>x!==value));return}
    if(arr.length<max)set([...arr,value])
  }

  async function save(){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('battle_set_assets',{
      p_battle:battle.id,p_tactical:tactical,p_defensive:defensive||null,p_breach:breach
    })
    setWorking(false)
    if(error){setMsg(error.message);return}
    onSaved(`Battle Assets сохранены. Tactical ${data.tactical_slots}, Defensive ${data.defensive_slots}, Breach ${data.breach_slots}.`)
  }

  const hasAnything=tacticalSlots>0||defensiveSlots>0||breachSlots>0
  return <section className="panel battle-assets">
    <div className="section-head"><div><div className="eyebrow">BATTLE ASSETS · {label(side)}</div><h2>Подготовка к tabletop battle</h2></div><Shield/></div>
    <div className="asset-meters">
      <span>Initial EC <strong>{side===battle.attacker_side?totals.attacker:totals.defender}</strong></span>
      <span>Enemy EC <strong>{side===battle.attacker_side?totals.defender:totals.attacker}</strong></span>
      <span>Tactical <strong>{tactical.length}/{tacticalSlots}</strong></span>
      <span>Breach <strong>{breach.length}/{breachSlots}</strong></span>
    </div>

    {!hasAnything&&<p className="muted">Для вашей стороны в этой battle дополнительных Campaign Assets нет.</p>}

    {tacticalSlots>0&&<div className="asset-group">
      <h3>Tactical Assets · Underdog gap {underdog.gap} / Army Limit {stage.armyLimit}</h3>
      <div className="asset-options">{TACTICAL_ASSETS.filter(a=>!(battle.sector_key==='H'&&a.code==='Prepared Barricades')).map(a=><label className={tactical.includes(a.code)?'asset-option selected':'asset-option'} key={a.code}>
        <input type="checkbox" checked={tactical.includes(a.code)} onChange={()=>toggle(tactical,setTactical,a.code,tacticalSlots)}/>
        <span><strong>{a.code}</strong><small>{a.effect}</small></span>
      </label>)}</div>
    </div>}

    {defensiveSlots>0&&<div className="asset-group">
      <h3>Fortified Defensive Asset</h3>
      <div className="asset-options">{DEFENSIVE_ASSETS.map(a=><label className={defensive===a.code?'asset-option selected':'asset-option'} key={a.code}>
        <input type="radio" name="defensive-asset" checked={defensive===a.code} onChange={()=>setDefensive(a.code)}/>
        <span><strong>{a.code}</strong><small>{a.effect}</small></span>
      </label>)}</div>
    </div>}

    {breachSlots>0&&<div className="asset-group">
      <h3>Breach Assets · {breachSlots}</h3>
      <div className="asset-options">{BREACH_ASSETS.map(a=><label className={breach.includes(a.code)?'asset-option selected':'asset-option'} key={a.code}>
        <input type="checkbox" checked={breach.includes(a.code)} onChange={()=>toggle(breach,setBreach,a.code,breachSlots)}/>
        <span><strong>{a.code}</strong><small>{a.effect}</small></span>
      </label>)}</div>
    </div>}

    {hasAnything&&<button className="primary action-main" disabled={working} onClick={save}><Target size={15}/> Сохранить Assets</button>}
    {msg&&<div className="notice">{msg}</div>}
  </section>
}
