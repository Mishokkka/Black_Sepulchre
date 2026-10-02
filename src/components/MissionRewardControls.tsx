import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, Unit } from '../types'

type CampaignEvent={id:string;kind:string;code:string|null;title:string;payload:any;resolved:boolean;created_at:string}

export default function MissionRewardControls({
  event,member,units
}:{
  event:CampaignEvent;member:Member;units:Unit[]
}){
  const[selectedUnit,setSelectedUnit]=useState('')
  const[msg,setMsg]=useState('')
  const[working,setWorking]=useState(false)
  const code=event.code??''
  const winner=event.payload?.winner_side
  const mine=useMemo(()=>units.filter(u=>u.side===member.side&&u.status!=='lost'),[units,member.side])
  if(event.resolved||event.kind!=='mission_reward')return null

  async function resolve(action:string,unit?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('resolve_mission_reward',{
      p_event:event.id,p_action:action,p_unit:unit||null
    })
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(`Mission reward ${data.mission}: ${data.choice}.`)
  }

  if(member.side!==winner)return <small>Награду разрешает winner: {winner==='necrons'?'Necrons':'Deathwatch'}.</small>

  const select=(rows:Unit[],placeholder:string)=><select value={selectedUnit} onChange={e=>setSelectedUnit(e.target.value)}>
    <option value="">{placeholder}</option>
    {rows.map(u=><option key={u.id} value={u.id}>{u.name} · Damage {u.damage} · XP {u.xp}</option>)}
  </select>

  let body:React.ReactNode=null
  if(code==='D2'){
    body=<><div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>resolve('supply')}>+25 Supply</button></div>
      <div className="d66-choice-row">{select(mine.filter(u=>u.damage>0),'Участвовавший damaged unit')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>resolve('heal',selectedUnit)}>Снять 1 Damage</button></div></>
  }else if(code==='G1'){
    body=<><div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>resolve('intel')}>+1 Intel</button></div>
      <div className="d66-choice-row">{select(mine.filter(u=>(u.relics?.length??0)===0),'Unit с пустым Relic slot')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>resolve('relic',selectedUnit)}>Random Campaign Relic D6</button></div></>
  }else if(code==='I1'){
    const eligible=mine.filter(u=>u.damage>0&&(u.keywords?.includes('CANOPTEK')||u.keywords?.includes('INFANTRY')))
    body=<div className="d66-choice-row">{select(eligible,'Участвовавший CANOPTEK/INFANTRY')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>resolve('heal',selectedUnit)}>Снять 1 Damage</button></div>
  }else if(code==='J1'){
    body=<><div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>resolve('supply')}>+20 Supply</button></div>
      <div className="d66-choice-row">{select(mine.filter(u=>(u.armoury?.length??0)===0),'Unit с пустым Armoury slot')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>resolve('cache',selectedUnit)}>Recovery Cache бесплатно</button></div></>
  }

  return <div className="d66-choice">
    <div className="eyebrow">MISSION REWARD · {code}</div>
    {body}
    {msg&&<small className="choice-message">{msg}</small>}
  </div>
}
