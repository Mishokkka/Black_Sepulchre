import { useMemo, useState } from 'react'
import { ArrowDownUp, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Member, Unit } from '../types'

export default function ReorganisePanel({
  activationId,member,currentSector,units,onDone,onCancel
}:{
  activationId:string;member:Member;currentSector:string;units:Unit[];onDone:(message:string)=>void;onCancel:()=>void
}){
  const[toField,setToField]=useState<string[]>([])
  const[toGarrison,setToGarrison]=useState<string[]>([])
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  const field=useMemo(()=>units.filter(u=>u.side===member.side&&u.location_type==='field'),[units,member.side])
  const garrison=useMemo(()=>units.filter(u=>u.side===member.side&&u.location_type==='garrison'&&u.sector_key===currentSector),[units,member.side,currentSector])
  const toggle=(id:string,list:string[],set:(v:string[])=>void)=>set(list.includes(id)?list.filter(x=>x!==id):[...list,id])

  async function submit(){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('activation_reorganise',{p_activation:activationId,p_to_field:toField,p_to_garrison:toGarrison})
    setWorking(false)
    if(error){setMsg(error.message);return}
    onDone(`Reorganise: ${data.to_field} в Field Roster, ${data.to_garrison} в garrison. Field Base ${data.field_base_after}/${data.field_cap}.`)
  }

  return <section className="panel reorg-panel">
    <div className="section-head"><div><div className="eyebrow">REORGANISE FORCES</div><h2>Sector {currentSector}</h2></div><ArrowDownUp/></div>
    <p className="muted">Выберите подразделения, которые физически меняют Field Roster и локальный garrison. Это тратит 1 Strategic Action.</p>
    <div className="reorg-columns">
      <div><h3>Garrison → Field</h3>{garrison.length?garrison.map(u=><label className="reorg-unit" key={u.id}><input type="checkbox" checked={toField.includes(u.id)} onChange={()=>toggle(u.id,toField,setToField)}/><span><strong>{u.name}</strong><small>{u.datasheet} · Base {u.reference_cost}</small></span></label>):<p className="muted">Локальный garrison пуст.</p>}</div>
      <div><h3>Field → Garrison</h3>{field.length?field.map(u=><label className="reorg-unit" key={u.id}><input type="checkbox" checked={toGarrison.includes(u.id)} onChange={()=>toggle(u.id,toGarrison,setToGarrison)}/><span><strong>{u.name}</strong><small>{u.datasheet} · Base {u.reference_cost}</small></span></label>):<p className="muted">Field Roster пуст.</p>}</div>
    </div>
    {msg&&<div className="notice">{msg}</div>}
    <div className="button-row"><button className="primary" disabled={working||(!toField.length&&!toGarrison.length)} onClick={submit}><Check size={15}/> Применить</button><button className="ghost" disabled={working} onClick={onCancel}>Отмена</button></div>
  </section>
}
