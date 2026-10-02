import { useEffect, useState } from 'react'
import { RadioTower, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BLACK_CHOIR_REVEALS, D66_EVENTS } from '../data/campaign'
import type { Campaign } from '../types'

type CampaignEvent={id:string;kind:string;code:string;title:string;payload:any;resolved:boolean;created_at:string}

export default function EventsPanel({campaign}:{campaign:Campaign}){
  const[events,setEvents]=useState<CampaignEvent[]>([])
  useEffect(()=>{supabase.from('campaign_events').select('*').eq('campaign_id',campaign.id).order('created_at',{ascending:false}).then(({data})=>setEvents((data??[]) as CampaignEvent[]))},[campaign.id])
  return <div className="events-grid">
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">BLACK CHOIR</div><h2>{campaign.black_choir} / 8</h2></div><RadioTower/></div>
      <div className="choir-track"><div style={{width:Math.min(100,campaign.black_choir/8*100)+'%'}}/></div>
      <div className="reveal-list">{BLACK_CHOIR_REVEALS.map(r=><div className={campaign.black_choir>=r.threshold?'revealed':''} key={r.threshold}><strong>{r.threshold} · {r.label}</strong><span>{campaign.black_choir>=r.threshold?r.effect:'Закрыто'}</span></div>)}</div>
    </section>
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">AFTERMATH EVENTS</div><h2>D66 History</h2></div><ScrollText/></div>
      {events.length===0?<p className="muted">D66 ещё не выпадал.</p>:<div className="event-list">{events.map(e=>{const d=D66_EVENTS[e.code];return <div key={e.id} className="event-card">
        <div className="event-code">{e.code}</div><div><strong>{d?.name??e.title}</strong><p>{d?.effect??'Эффект не найден в текущем rules reference.'}</p><small>{new Date(e.created_at).toLocaleString('ru')}</small></div>
      </div>})}</div>}
      <p className="muted small-note">Сайт уже бросает и сохраняет D66 автоматически. События с выбором цели или отложенным эффектом пока показаны как памятка и не исполняются без вашего ввода.</p>
    </section>
  </div>
}
