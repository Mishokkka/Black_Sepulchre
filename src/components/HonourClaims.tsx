import { useMemo, useState } from 'react'
import { Medal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BATTLE_HONOURS, SIGNATURE_HONOURS } from '../data/campaign'
import type { Member, Unit } from '../types'

export default function HonourClaims({units,member,reload}:{units:Unit[];member:Member;reload:()=>void}){
  const[selected,setSelected]=useState<Record<string,string>>({})
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  const eligible=useMemo(()=>units.filter(u=>{
    if(u.side!==member.side)return false
    const hs=(u.honours??[]) as any[]
    const regular=hs.filter(h=>!h?.signature).length
    const sig=hs.filter(h=>h?.signature).length
    const slots=u.xp>=12?3:u.xp>=7?2:u.xp>=3?1:0
    return regular<slots||(u.xp>=18&&sig<1)
  }),[units,member.side])

  async function claim(u:Unit){
    const code=selected[u.id]
    if(!code)return
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('unit_claim_honour',{p_unit:u.id,p_code:code})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(`${u.name}: ${data.name}, Campaign Rating +${data.cr_added}%.`)
    setSelected(s=>({...s,[u.id]:''}));reload()
  }

  if(!eligible.length)return null
  return <section className="panel honour-panel">
    <div className="section-head"><div><div className="eyebrow">RANK ADVANCEMENT</div><h2>Невыбранные Battle Honours</h2></div><Medal/></div>
    <div className="honour-claims">{eligible.map(u=>{
      const hs=(u.honours??[]) as any[]
      const regular=hs.filter(h=>!h?.signature).length
      const sig=hs.filter(h=>h?.signature).length
      const slots=u.xp>=12?3:u.xp>=7?2:u.xp>=3?1:0
      const regularOpen=regular<slots
      const sigOpen=u.xp>=18&&sig<1
      const taken=new Set(hs.map(h=>h?.code))
      const options=[
        ...(regularOpen?BATTLE_HONOURS.filter(h=>(!h.character||u.is_character)&&!taken.has(h.code)):[]),
        ...(sigOpen?SIGNATURE_HONOURS.filter(h=>h.side===member.side&&!taken.has(h.code)):[])
      ]
      return <div className="honour-claim" key={u.id}>
        <div><strong>{u.name}</strong><small>{u.xp} XP · CR +{u.campaign_rating}% · Regular {regular}/{slots}{sigOpen?' · Signature open':''}</small></div>
        <select value={selected[u.id]??''} onChange={e=>setSelected(s=>({...s,[u.id]:e.target.value}))}><option value="">Выберите Honour</option>{options.map(h=><option key={h.code} value={h.code}>{'category' in h?`${h.category} · `:''}{h.name} (+{h.cr}%)</option>)}</select>
        <button className="primary compact" disabled={working||!selected[u.id]} onClick={()=>claim(u)}>Выбрать</button>
        {selected[u.id]&&<p>{[...BATTLE_HONOURS,...SIGNATURE_HONOURS].find(h=>h.code===selected[u.id])?.effect}</p>}
      </div>
    })}</div>
    {msg&&<div className="notice">{msg}</div>}
  </section>
}
