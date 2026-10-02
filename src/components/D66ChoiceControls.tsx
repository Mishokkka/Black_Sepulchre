import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, PlayerState, Sector, Unit } from '../types'

type CampaignEvent={id:string;kind:string;code:string|null;title:string;payload:any;resolved:boolean;created_at:string}

const CHOICE_CODES=new Set(['24','31','33','41','52','53','54','56'])

export default function D66ChoiceControls({
  event,member,players,sectors,units
}:{
  event:CampaignEvent;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[]
}){
  const[selectedUnit,setSelectedUnit]=useState('')
  const[selectedSector,setSelectedSector]=useState('')
  const[working,setWorking]=useState(false)
  const[msg,setMsg]=useState('')
  const code=event.code??''
  const mine=useMemo(()=>units.filter(u=>u.side===member.side),[units,member.side])
  const me=players.find(p=>p.side===member.side)
  const resolvedSides=(event.payload?.resolved_sides??[]) as string[]
  const done=resolvedSides.includes(member.side)
  const controlsG=sectors.find(s=>s.sector_key==='G')?.owner_side===member.side

  if(!CHOICE_CODES.has(code)||event.resolved)return null
  if(done)return <div className="d66-choice done">Ваша сторона уже разрешила этот event.</div>

  async function act(action:string,unit?:string,sector?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('resolve_d66_player_choice',{
      p_event:event.id,p_action:action,p_unit:unit||null,p_sector:sector||null
    })
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(data.event_complete?'Event полностью разрешён.':'Ваш выбор сохранён. Ожидается вторая сторона.')
  }

  const unitSelect=(rows:Unit[],placeholder:string)=><select value={selectedUnit} onChange={e=>setSelectedUnit(e.target.value)}>
    <option value="">{placeholder}</option>
    {rows.map(u=><option key={u.id} value={u.id}>{u.name} · {u.datasheet} · XP {u.xp} · Damage {u.damage}</option>)}
  </select>

  let body:React.ReactNode=null
  if(code==='24'){
    body=member.side==='deathwatch'
      ?<button className="ghost compact" disabled={working} onClick={()=>act('claim')}>Получить +20 Supply</button>
      :<div className="d66-choice-row">{unitSelect(mine.filter(u=>u.damage>0),'Повреждённый Necron unit')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>act('heal',selectedUnit)}>Снять 1 Damage</button></div>
  }else if(code==='31'){
    body=<><div className="d66-choice-row">{unitSelect(mine.filter(u=>u.xp<=2),'Recruit unit (0–2 XP)')}<button className="ghost compact" disabled={working||!selectedUnit||(me?.supply??0)<10} onClick={()=>act('grant',selectedUnit)}>10 Supply → +1 XP</button></div><button className="ghost compact" disabled={working} onClick={()=>act('pass')}>Отказаться</button></>
  }else if(code==='33'){
    body=member.side==='deathwatch'
      ?<button className="ghost compact" disabled={working} onClick={()=>act('claim')}>Получить Xenos Script rewards</button>
      :<div className="d66-choice-row">{unitSelect(mine,'Necron unit')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>act('xp',selectedUnit)}>Дать +1 XP</button></div>
  }else if(code==='41'){
    body=<><div className="d66-choice-row">{unitSelect(mine,'Unit для ограничения')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>act('disable',selectedUnit)}>Не использовать Armoury в следующей battle</button></div><button className="ghost compact" disabled={working||(me?.supply??0)<10} onClick={()=>act('pay')}>Заплатить 10 Supply</button></>
  }else if(code==='52'){
    const owned=sectors.filter(s=>s.owner_side===member.side)
    body=<><div className="d66-choice-row"><select value={selectedSector} onChange={e=>setSelectedSector(e.target.value)}><option value="">Сектор для Exhausted</option>{owned.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost compact" disabled={working||!selectedSector} onClick={()=>act('accept',undefined,selectedSector)}>+20 Supply · Exhausted</button></div><button className="ghost compact" disabled={working} onClick={()=>act('pass')}>Ничего</button></>
  }else if(code==='53'){
    body=member.side==='necrons'
      ?<button className="ghost compact" disabled={working} onClick={()=>act('claim')}>Necrons: +15 Supply</button>
      :<div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>act('intel')}>Deathwatch: +1 Intel</button>{controlsG&&<button className="ghost compact" disabled={working} onClick={()=>act('supply')}>Вместо этого +20 Supply</button>}</div>
  }else if(code==='54'){
    body=member.side==='deathwatch'
      ?<button className="ghost compact" disabled={working} onClick={()=>act('claim')}>Deathwatch: +15 Supply</button>
      :<div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>act('intel')}>Necrons: +1 Intel</button>{controlsG&&<button className="ghost compact" disabled={working} onClick={()=>act('supply')}>Вместо этого +20 Supply</button>}</div>
  }else if(code==='56'){
    body=<><div className="d66-choice-row">{unitSelect(mine.filter(u=>(u.scars?.length??0)>0),'Unit с Battle Scar')}<button className="ghost compact" disabled={working||!selectedUnit||(me?.supply??0)<10} onClick={()=>act('boost',selectedUnit)}>10 Supply · next Rehab +1</button></div><button className="ghost compact" disabled={working} onClick={()=>act('pass')}>Отказаться</button></>
  }

  return <div className="d66-choice">
    <div className="eyebrow">YOUR RESOLUTION · {member.side==='necrons'?'NECRONS':'DEATHWATCH'}</div>
    {body}
    {msg&&<small className="choice-message">{msg}</small>}
  </div>
}
