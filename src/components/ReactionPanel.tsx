import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'

type Reaction={id:string;reaction_type:string;actor_side:'necrons'|'deathwatch';target_side:'necrons'|'deathwatch';target_sector:string;payload:any}
const label=(s:string)=>s==='necrons'?'Necrons':'Deathwatch'

export default function ReactionPanel({activationId,member,onDone}:{activationId:string;member:Member;onDone:(message:string)=>void}){
  const[reaction,setReaction]=useState<Reaction|null>(null),[working,setWorking]=useState(false),[msg,setMsg]=useState('')
  useEffect(()=>{
    const load=()=>supabase.from('reactions').select('*').eq('activation_id',activationId).eq('status','pending').maybeSingle().then(({data})=>setReaction(data as Reaction|null))
    load()
    const ch=supabase.channel('reaction-'+activationId).on('postgres_changes',{event:'*',schema:'public',table:'reactions',filter:'activation_id=eq.'+activationId},load).subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[activationId])

  async function respond(counter:boolean){
    if(!reaction)return
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('respond_counter_sabotage',{p_reaction:reaction.id,p_counter:counter})
    setWorking(false)
    if(error){setMsg(error.message);return}
    const result=data.countered?'Sabotage отменён Counter-Sabotage.':data.success?`Counter-Sabotage отклонён. Бросок ${data.roll}: сектор Sabotaged.`:`Counter-Sabotage отклонён. Бросок ${data.roll}: Sabotage провален.`
    onDone(result)
  }

  if(!reaction)return <section className="panel empty-state"><ShieldAlert size={36}/><h2>Ожидание реакции</h2><p>Получаю данные Counter-Sabotage…</p></section>
  const mine=reaction.target_side===member.side
  return <section className="panel reaction-panel">
    <div className="section-head"><div><div className="eyebrow">REACTION WINDOW</div><h2>Counter-Sabotage</h2></div><ShieldAlert/></div>
    <p><strong>{label(reaction.actor_side)}</strong> направили Sabotage на сектор <strong>{reaction.target_sector}</strong>.</p>
    {mine?<><p className="muted">Потратьте 1 Intelligence, чтобы отменить Sabotage, либо пропустите реакцию. После решения активный игрок продолжит Activation.</p>
      <div className="button-row"><button className="primary" disabled={working} onClick={()=>respond(true)}>Counter-Sabotage · 1 Intel</button><button className="ghost" disabled={working} onClick={()=>respond(false)}>Не вмешиваться</button></div></>
    :<div className="notice">Ожидается решение {label(reaction.target_side)}.</div>}
    {msg&&<div className="notice">{msg}</div>}
  </section>
}
