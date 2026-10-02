import { useMemo, useState } from 'react'
import { Award, PackageCheck, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CAMPAIGN_ARMOURY } from '../data/campaign'
import type { Member, Unit } from '../types'

const roundUp5=(n:number)=>Math.ceil(n/5)*5

export default function LogisticsUpgrades({
  activationId,member,currentSector,units,reload,onMessage
}:{
  activationId:string;member:Member;currentSector:string;units:Unit[];reload:()=>void;onMessage:(message:string)=>void
}){
  const[armouryUnit,setArmouryUnit]=useState('')
  const[item,setItem]=useState('')
  const[working,setWorking]=useState(false)
  const[drillUnits,setDrillUnits]=useState<string[]>([])
  const mine=useMemo(()=>units.filter(u=>u.side===member.side&&u.status!=='lost'&&(u.location_type==='field'||u.sector_key===currentSector)),[units,member.side,currentSector])
  const armouryEligible=mine.filter(u=>(u.armoury?.length??0)===0)
  const scarred=mine.filter(u=>(u.scars?.length??0)>0)

  async function buy(){
    if(!armouryUnit||!item)return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_buy_armoury',{p_activation:activationId,p_unit:armouryUnit,p_item_code:item})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(`${data.name} куплен за ${data.cost} Supply. Campaign Rating +${data.cr_added}%.`)
    setArmouryUnit('');setItem('');reload()
  }

  async function treat(u:Unit,scar:any,deep:boolean){
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_rehabilitate_scar',{
      p_activation:activationId,p_unit:u.id,p_scar_code:scar.code,p_deep:deep
    })
    setWorking(false)
    if(error){onMessage(error.message);return}
    if(deep)onMessage(`${u.name}: ${scar.name} удалён Deep Reconstruction за ${data.cost} Supply.`)
    else onMessage(`${u.name}: Rehabilitation D6=${data.roll}${data.rehab_bonus?` + ${data.rehab_bonus} = ${data.effective_roll}`:''}, ${data.success?'Scar удалён':'Scar остался'}; потрачено ${data.cost} Supply.`)
    reload()
  }

  return <>
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">CAMPAIGN ARMOURY</div><h2>Снаряжение persistent units</h2></div><PackageCheck/></div>
      <p className="muted">Один persistent unit может иметь максимум один Campaign Armoury item независимо от источника. Relic использует отдельный slot. CR входит в Effective Cost.</p>
      <div className="armoury-buy">
        <label>Unit<select value={armouryUnit} onChange={e=>setArmouryUnit(e.target.value)}><option value="">Выберите unit</option>{armouryEligible.map(u=><option key={u.id} value={u.id}>{u.name} · CR +{u.campaign_rating}%</option>)}</select></label>
        <label>Item<select value={item} onChange={e=>setItem(e.target.value)}><option value="">Выберите item</option>{CAMPAIGN_ARMOURY.map(i=><option key={i.code} value={i.code}>{i.name} · {i.cost} Supply · CR +{i.cr}%</option>)}</select></label>
      </div>
      {item&&<div className="armoury-effect">{CAMPAIGN_ARMOURY.find(i=>i.code===item)?.effect}</div>}
      <button className="primary action-main" disabled={working||!armouryUnit||!item} onClick={buy}>Купить Armoury item</button>
      {mine.some(u=>(u.armoury?.length??0)>0)&&<div className="owned-armoury">{mine.filter(u=>(u.armoury?.length??0)>0).map(u=><div key={u.id}><strong>{u.name}</strong><span>{u.armoury?.[0]?.name??u.armoury?.[0]?.code}</span></div>)}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">BATTLE SCARS</div><h2>Rehabilitation</h2></div><Stethoscope/></div>
      {scarred.length===0?<p className="muted">У доступных units нет Battle Scars.</p>:<div className="scar-treatment-list">{scarred.flatMap(u=>(u.scars??[]).map((scar:any)=><div className="scar-treatment" key={u.id+'-'+scar.code}>
        <div><strong>{u.name}</strong><small>{scar.name??scar.code}{u.campaign_flags?.scar_lock?' · FOURTH-SCAR LOCK':''}{Number(u.campaign_flags?.rehab_bonus??0)>0?` · Rehab +${u.campaign_flags.rehab_bonus}`:''}</small></div>
        <div className="scar-costs"><span>Rehab {Math.max(15,roundUp5(u.reference_cost*.25))}</span><span>Deep {Math.max(25,roundUp5(u.reference_cost*.50))}</span></div>
        <div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>treat(u,scar,false)}>Rehab · {Math.max(1,4-Number(u.campaign_flags?.rehab_bonus??0))}+</button><button className="ghost compact" disabled={working} onClick={()=>treat(u,scar,true)}>Deep · auto</button></div>
      </div>))}</div>}
    </section>
  </>
}
