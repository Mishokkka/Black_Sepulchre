import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, PlayerState, Sector, Unit } from '../types'

type CampaignEvent={id:string;kind:string;code:string|null;title:string;payload:any;resolved:boolean;created_at:string}

const CHOICE_CODES=new Set(['11','12','13','14','24','31','32','33','41','52','53','54','56','63'])

export default function D66ChoiceControls({
  event,member,players,sectors,units
}:{
  event:CampaignEvent;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[]
}){
  const[selectedUnit,setSelectedUnit]=useState('')
  const[selectedSector,setSelectedSector]=useState('')
  const[working,setWorking]=useState(false)
  const[msg,setMsg]=useState('')
  const[battleMeta,setBattleMeta]=useState<{attacker_side:string;defender_side:string;outcome:string|null}|null>(null)
  const[destroyedIds,setDestroyedIds]=useState<string[]>([])
  const code=event.code??''
  const mine=useMemo(()=>units.filter(u=>u.side===member.side),[units,member.side])
  const me=players.find(p=>p.side===member.side)
  const resolvedSides=(event.payload?.resolved_sides??[]) as string[]
  const done=resolvedSides.includes(member.side)
  const controlsG=sectors.find(s=>s.sector_key==='G')?.owner_side===member.side
  const sectorCounts={
    necrons:sectors.filter(s=>s.owner_side==='necrons').length,
    deathwatch:sectors.filter(s=>s.owner_side==='deathwatch').length
  }
  const eventBattleId=event.payload?.battle_id as string|undefined

  useEffect(()=>{
    if(!eventBattleId)return
    supabase.from('battles').select('attacker_side,defender_side,outcome').eq('id',eventBattleId).single()
      .then(({data})=>setBattleMeta((data as any)??null))
    if(code==='14'){
      supabase.from('battle_units').select('unit_id').eq('battle_id',eventBattleId).eq('side',member.side).eq('destroyed',true).eq('participated',true)
        .then(({data})=>setDestroyedIds((data??[]).map((x:any)=>x.unit_id)))
    }
  },[eventBattleId,code,member.side])

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

  async function globalChoice(choice:'supply'|'intelligence'){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('resolve_d66_global_choice',{p_event:event.id,p_choice:choice})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(`Выбор ${data.choice} применён для ${data.chooser}.`)
  }
  async function specialChoice(action:string,unit?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('resolve_d66_special_choice',{
      p_event:event.id,p_action:action,p_unit:unit||null
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

  if(code==='11'){
    const chooser=sectorCounts.necrons===sectorCounts.deathwatch
      ?null
      :sectorCounts.necrons<sectorCounts.deathwatch?'necrons':'deathwatch'
    body=<>
      <p className="muted">{chooser
        ?`Выбор делает ${chooser==='necrons'?'Necrons':'Deathwatch'} как сторона с меньшим числом секторов.`
        :'Количество секторов равно. Rules source не определяет tie-break; событие оставлено unresolved.'}</p>
      <div className="button-row">
        <button className="ghost compact" disabled={working||member.side!==chooser} onClick={()=>globalChoice('intelligence')}>+1 Intel</button>
        <button className="ghost compact" disabled={working||member.side!==chooser} onClick={()=>globalChoice('supply')}>+25 Supply · BLACK CHOIR +1</button>
      </div>
    </>
  }else if(code==='32'){
    body=<>
      <p className="muted">Winner выбирает одну награду; другая автоматически уходит проигравшему. При Draw выбор у стороны с меньшим числом секторов. Сервер проверит право выбора.</p>
      <div className="button-row">
        <button className="ghost compact" disabled={working} onClick={()=>globalChoice('supply')}>Выбрать +25 Supply</button>
        <button className="ghost compact" disabled={working} onClick={()=>globalChoice('intelligence')}>Выбрать +1 Intel</button>
      </div>
    </>
  }else if(code==='12'){
    const winner=battleMeta?.outcome==='attacker_win'||battleMeta?.outcome==='defender_withdrawal'
      ?battleMeta.attacker_side
      :battleMeta?.outcome==='defender_win'||battleMeta?.outcome==='attacker_withdrawal'
        ?battleMeta.defender_side:null
    const canCache=winner===member.side
    body=<>
      <div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>specialChoice('supply')}>Получить +20 Supply</button></div>
      {canCache&&<div className="d66-choice-row">{unitSelect(mine.filter(u=>(u.armoury?.length??0)===0),'Unit для Recovery Cache')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>specialChoice('cache',selectedUnit)}>Вместо Supply получить Recovery Cache</button></div>}
    </>
  }else if(code==='13'){
    const eligible=sectors.some(s=>s.owner_side===member.side&&['B','C','D','E','F','G','H','I','J'].includes(s.sector_key))
    const hasWard=mine.some(u=>u.armoury?.some((a:any)=>a?.code==='blackglass_ward'))
    body=!eligible
      ?<button className="ghost compact" disabled={working} onClick={()=>specialChoice('pass')}>Нет подходящего контроля · закрыть для моей стороны</button>
      :hasWard
        ?<button className="ghost compact" disabled={working} onClick={()=>specialChoice('intel')}>Ward уже есть · получить +1 Intel</button>
        :<div className="d66-choice-row">{unitSelect(mine.filter(u=>(u.armoury?.length??0)===0),'Unit для Blackglass Ward')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>specialChoice('ward',selectedUnit)}>Получить Blackglass Ward бесплатно</button></div>
  }else if(code==='14'){
    const destroyed=mine.filter(u=>destroyedIds.includes(u.id))
    body=destroyed.length
      ?<div className="d66-choice-row">{unitSelect(destroyed,'Уничтоженный unit')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>specialChoice('improve',selectedUnit)}>Casualty Roll +1 задним числом</button></div>
      :<button className="ghost compact" disabled={working} onClick={()=>specialChoice('pass')}>Уничтоженных units нет · закрыть</button>
  }else if(code==='24'){
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
  }else if(code==='63'){
    body=<div className="d66-choice-row">{unitSelect(mine.filter(u=>u.is_character),'CHARACTER для Names in the Static')}<button className="ghost compact" disabled={working||!selectedUnit} onClick={()=>specialChoice('name',selectedUnit)}>Назвать CHARACTER</button></div>
  }

  return <div className="d66-choice">
    <div className="eyebrow">YOUR RESOLUTION · {member.side==='necrons'?'NECRONS':'DEATHWATCH'}</div>
    {body}
    {msg&&<small className="choice-message">{msg}</small>}
  </div>
}
