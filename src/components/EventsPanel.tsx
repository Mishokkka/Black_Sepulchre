import { useEffect, useState } from 'react'
import { RadioTower, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BLACK_CHOIR_REVEALS, D66_EVENTS } from '../data/campaign'
import type { Campaign, Member } from '../types'

type CampaignEvent={id:string;kind:string;code:string|null;title:string;payload:any;resolved:boolean;created_at:string}

export default function EventsPanel({campaign,member}:{campaign:Campaign;member:Member}){
  const[events,setEvents]=useState<CampaignEvent[]>([])
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  useEffect(()=>{
    const load=()=>supabase.from('campaign_events').select('*').eq('campaign_id',campaign.id).order('created_at',{ascending:false}).then(({data})=>setEvents((data??[]) as CampaignEvent[]))
    load()
    const ch=supabase.channel('events-'+campaign.id).on('postgres_changes',{event:'*',schema:'public',table:'campaign_events',filter:'campaign_id=eq.'+campaign.id},load).subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[campaign.id])
  async function chooseD66(e:CampaignEvent,code:string){
    const battleId=e.payload?.battle_id
    if(!battleId)return
    setWorking(true);setMsg('')
    const{error}=await supabase.rpc('battle_choose_d66_event',{p_battle:battleId,p_code:code})
    setWorking(false)
    if(error)setMsg(error.message)
    else setMsg(`Fleshworks event selected: D66 ${code}.`)
  }
  return <div className="events-grid">
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">BLACK CHOIR</div><h2>{campaign.black_choir} / 8</h2></div><RadioTower/></div>
      <div className="choir-track"><div style={{width:Math.min(100,campaign.black_choir/8*100)+'%'}}/></div>
      <div className="reveal-list">{BLACK_CHOIR_REVEALS.map(r=><div className={campaign.black_choir>=r.threshold?'revealed':''} key={r.threshold}><strong>{r.threshold} · {r.label}</strong><span>{campaign.black_choir>=r.threshold?r.effect:'Закрыто'}</span></div>)}</div>
    </section>
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">AFTERMATH EVENTS</div><h2>D66 History</h2></div><ScrollText/></div>
      {events.length===0?<p className="muted">D66 ещё не выпадал.</p>:<div className="event-list">{events.map(e=>{
        const d=e.code?D66_EVENTS[e.code]:undefined
        const options=(e.payload?.options??[]) as string[]
        const chooser=e.payload?.chooser_side as string|undefined
        return <div key={e.id} className="event-card">
          <div className="event-code">{e.kind==='D66_choice'?'D66×2':e.code}</div><div><strong>{d?.name??e.title}</strong>
          {e.kind==='D66_choice'?<>
            <p>Fleshworks IX: бросок сделан дважды. Применяется только один результат.</p>
            <div className="event-choice-buttons">{options.map(code=>{const opt=D66_EVENTS[code];return <button className="ghost" key={code} disabled={working||member.side!==chooser} onClick={()=>chooseD66(e,code)}><strong>{code} · {opt?.name??'Event'}</strong><small>{opt?.effect}</small></button>})}</div>
            {member.side!==chooser&&<small>Выбор делает {chooser==='necrons'?'Necrons':'Deathwatch'}.</small>}
          </>:<p>{d?.effect??'Эффект не найден в текущем rules reference.'}</p>}
          <small>{new Date(e.created_at).toLocaleString('ru')}</small></div>
        </div>
      })}</div>}
      {msg&&<div className="notice">{msg}</div>}
      <p className="muted small-note">D66 сохраняется сервером. Fleshworks IX уже поддерживает двойной бросок и выбор результата. Сложные события с целями, решениями или отложенным эффектом пока остаются pending до отдельного resolver.</p>
    </section>
  </div>
}
