import { useEffect, useState } from 'react'
import { RadioTower, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BLACK_CHOIR_REVEALS, D66_EVENTS } from '../data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from '../types'
import D66ChoiceControls from './D66ChoiceControls'

type CampaignEvent={id:string;kind:string;code:string|null;title:string;payload:any;resolved:boolean;created_at:string}

const AUTO_D66=new Set(['15','21','22','23','25','26','34','35','36','42','43','44','45','46','51','55','61','62','65','66'])
const PENDING_LABELS:Record<string,string>={
  vox_from_dead:'Vox From the Dead · первый failed Battle-shock следующей battle можно перебросить',
  ash_rain:'Ash Rain · battle round 3 следующей battle: ranged attacks максимум 24"',
  missing_hour:'The Missing Hour · первое Strategic Action следующей Activation требует 4+',
  bone_bloom:'Bone Bloom · центральный objective следующей battle окружён 5" Difficult Ground',
  machine_hymn:'Machine Hymn · первый VEHICLE/MONSTER Battle-shock заменяется D3 mortal wounds',
  auspex_ghost:'Auspex Ghost · бесплатный Recon Lock в следующей battle',
  hidden_route:'Hidden Route · по одной дальней атаке каждой стороне до конца следующей battle',
  broken_map:'Broken Map · Noctis Relay и Orbital Ossuary Lift отключены до конца следующей battle',
  noosphere_static:'Noosphere Static · Recon, Recon Lock и Sabotage дороже на 1 Intel до конца следующей battle',
  false_orders:'False Orders · -1 Strategic Action в следующую Activation указанной стороны',
  delayed_reinforcements:'Delayed Reinforcements · первое campaign reinforcement каждой стороны на round позже',
  ceasefire:'Ceasefire That Never Was · следующий объявивший атаку получает +1 Intel',
  nine_seconds:'Nine Seconds Repeated · специальный эффект в round 2 следующей battle',
  black_sun:'Black Sun · round 4 следующей battle без Benefit of Cover',
}

export default function EventsPanel({campaign,member,players,sectors,units}:{campaign:Campaign;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[]}){
  const[events,setEvents]=useState<CampaignEvent[]>([])
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  const pendingEffects=(campaign.settings?.pending_effects??[]) as any[]
  const forcedReveal=Number(campaign.settings?.forced_reveal_threshold??0)
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

  async function resolveEvent(e:CampaignEvent){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('resolve_d66_event',{p_event:e.id})
    setWorking(false)
    if(error){setMsg(error.message);return}
    if(e.code==='45')setMsg(`Contaminated Supply: Necrons D6=${data.roll_necrons}, Deathwatch D6=${data.roll_deathwatch}.`)
    else setMsg(`D66 ${e.code} applied.`)
  }
  return <div className="events-grid">
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">BLACK CHOIR</div><h2>{campaign.black_choir} / 8</h2></div><RadioTower/></div>
      <div className="choir-track"><div style={{width:Math.min(100,campaign.black_choir/8*100)+'%'}}/></div>
      <div className="reveal-list">{BLACK_CHOIR_REVEALS.map(r=>{const open=campaign.black_choir>=r.threshold||forcedReveal>=r.threshold;return <div className={open?'revealed':''} key={r.threshold}><strong>{r.threshold} · {r.label}</strong><span>{open?r.effect:'Закрыто'}</span></div>})}</div>
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
          {e.kind==='D66'&&e.code&&AUTO_D66.has(e.code)&&!e.resolved&&<button className="ghost compact event-apply" disabled={working} onClick={()=>resolveEvent(e)}>Применить / поставить эффект в очередь</button>}
          {e.kind==='D66'&&e.code&&['11','12','13','14','24','31','32','33','41','52','53','54','56'].includes(e.code)&&!e.resolved&&<D66ChoiceControls event={e} member={member} players={players} sectors={sectors} units={units}/>}
          {e.kind==='D66'&&e.code&&!AUTO_D66.has(e.code)&&!['11','12','13','14','24','31','32','33','41','52','53','54','56'].includes(e.code)&&!e.resolved&&<small className="pending-tag">Требуется отдельный выбор или цель. Resolver ещё не автоматизирован.</small>}
          {e.resolved&&<small className="resolved-tag">Resolved</small>}
          <small>{new Date(e.created_at).toLocaleString('ru')}</small></div>
        </div>
      })}</div>}
      {msg&&<div className="notice">{msg}</div>}
      {pendingEffects.length>0&&<div className="pending-effects"><div className="eyebrow">ACTIVE / QUEUED EFFECTS</div>{pendingEffects.map((e:any,i:number)=><div key={(e.code??'effect')+'-'+i}><strong>{e.code}</strong><span>{PENDING_LABELS[e.code]??'Отложенный кампанийный эффект'}</span>{e.side&&<small>{e.side==='necrons'?'Necrons':'Deathwatch'}</small>}</div>)}</div>}
      <p className="muted small-note">Простые и часть отложенных D66 effects уже применяются сервером. Эффекты, которым нужен выбор unit/sector/reward, остаются unresolved до специализированного resolver, чтобы сайт не делал выбор за игроков.</p>
    </section>
  </div>
}
