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
  const protocolPending=mine.filter(u=>(u.scars??[]).some((s:any)=>s?.code==='NEC-12')&&!u.campaign_flags?.protocol_obsession_choice)
  const ammoDue=mine.filter(u=>Boolean(u.campaign_flags?.ammunition_debt_due_battle))
  const grenadesLocked=mine.filter(u=>Boolean(u.campaign_flags?.ammunition_debt_grenades_lock))

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


  async function veteranDrill(){
    if(drillUnits.length<1||drillUnits.length>2)return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_veteran_drill',{p_activation:activationId,p_units:drillUnits})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage('Veteran Drill: '+data.units+' unit(s) получили +1 XP за 30 Supply.')
    setDrillUnits([]);reload()
  }

  async function criticalChoice(u:Unit,choice:'lost'|'evacuation'){
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_resolve_critical_choice',{p_activation:activationId,p_unit:u.id,p_choice:choice})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(choice==='lost'
      ?u.name+': Lost, удалён из campaign roster.'
      :u.name+': Evacuation. Damage 3, дополнительный Scar; к оплате '+data.cost_due+' Supply до следующего участия.')
    reload()
  }

  async function payEvacuation(u:Unit){
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_pay_character_evacuation',{p_activation:activationId,p_unit:u.id})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(u.name+': Evacuation cost '+data.cost+' Supply оплачен.')
    reload()
  }

  async function protocolChoice(u:Unit,choice:'HOLD'|'HUNT'){
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_set_protocol_obsession',{p_activation:activationId,p_unit:u.id,p_choice:choice})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(u.name+': Protocol Obsession = '+data.choice+'.')
    reload()
  }

  async function ammunitionDebt(u:Unit,pay:boolean){
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_resolve_ammunition_debt',{p_activation:activationId,p_unit:u.id,p_pay:pay})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(pay?u.name+': Ammunition Debt оплачен за 5 Supply.':u.name+': 5 Supply не оплачены; Grenades Stratagem недоступен в следующей battle.')
    reload()
  }

  async function damagedRelicCheck(u:Unit){
    setWorking(true)
    const{data,error}=await supabase.rpc('unit_resolve_damaged_armoury_first_use',{p_unit:u.id})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage(u.name+': Damaged Relic D6='+data.roll+'. '+(data.destroyed?'Item уничтожен.':'Item сохранился навсегда.'))
    reload()
  }

  const toggleDrill=(id:string)=>setDrillUnits(v=>v.includes(id)?v.filter(x=>x!==id):v.length<2?[...v,id]:v)

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
      {mine.some(u=>(u.armoury?.length??0)>0)&&<div className="owned-armoury">{mine.filter(u=>(u.armoury?.length??0)>0).map(u=><div key={u.id}><strong>{u.name}</strong><span>{u.armoury?.[0]?.name??u.armoury?.[0]?.code}</span>{u.armoury?.[0]?.damaged_relic_first_use_check&&<button className="ghost compact" disabled={working} onClick={()=>damagedRelicCheck(u)}>Первое использование было · D6</button>}</div>)}</div>}
      {mine.some(u=>(u.relics?.length??0)>0)&&<div className="owned-armoury">{mine.filter(u=>(u.relics?.length??0)>0).map(u=><div key={'relic-'+u.id}><strong>{u.name}</strong><span>Relic: {u.relics?.[0]?.name??u.relics?.[0]?.code} · CR +{u.relics?.[0]?.cr??0}%</span></div>)}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">VETERAN DRILL</div><h2>30 Supply · до двух units</h2></div><Award/></div>
      <p className="muted">Выберите 1–2 persistent units из current Main Force/local garrison. Каждый получает +1 XP; один и тот же unit не чаще одного раза за Stage.</p>
      <div className="mission-unit-checks">{mine.map(u=><label key={'drill-'+u.id}><input type="checkbox" checked={drillUnits.includes(u.id)} disabled={working||(!drillUnits.includes(u.id)&&drillUnits.length>=2)} onChange={()=>toggleDrill(u.id)}/>{u.name} · XP {u.xp}</label>)}</div>
      <button className="primary action-main" disabled={working||drillUnits.length<1} onClick={veteranDrill}>Провести Veteran Drill</button>
    </section>

    {mine.some(u=>u.status==='critical_choice'||Number(u.campaign_flags?.evacuation_due_cost??0)>0)&&<section className="panel">
      <div className="section-head"><div><div className="eyebrow">CRITICAL INJURY</div><h2>CHARACTER aftermath</h2></div><Stethoscope/></div>
      <div className="scar-treatment-list">
        {mine.filter(u=>u.status==='critical_choice').map(u=><div className="scar-treatment" key={'critical-'+u.id}><div><strong>{u.name}</strong><small>Lost · выберите окончательный исход в текущем aftermath</small></div><div className="button-row"><button className="ghost compact danger" disabled={working} onClick={()=>criticalChoice(u,'lost')}>Lost · удалить из roster</button><button className="ghost compact" disabled={working} onClick={()=>criticalChoice(u,'evacuation')}>Evacuation</button></div></div>)}
        {mine.filter(u=>Number(u.campaign_flags?.evacuation_due_cost??0)>0).map(u=><div className="scar-treatment" key={'evac-'+u.id}><div><strong>{u.name}</strong><small>Evacuation due · {u.campaign_flags.evacuation_due_cost} Supply · до оплаты участие запрещено</small></div><button className="ghost compact" disabled={working} onClick={()=>payEvacuation(u)}>Оплатить Evacuation</button></div>)}
      </div>
    </section>}

    {(protocolPending.length>0||ammoDue.length>0||grenadesLocked.length>0)&&<section className="panel">
      <div className="section-head"><div><div className="eyebrow">SCAR CONSEQUENCES</div><h2>Обязательные решения v2.0</h2></div><Stethoscope/></div>
      {protocolPending.map(u=><div className="scar-treatment" key={'protocol-'+u.id}><div><strong>{u.name}</strong><small>Protocol Obsession: зафиксируйте Deed. Выполнение выбранного Deed даёт +1 XP; без него unit не может быть Distinguished.</small></div><div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>protocolChoice(u,'HOLD')}>HOLD</button><button className="ghost compact" disabled={working} onClick={()=>protocolChoice(u,'HUNT')}>DESTROY / HUNT</button></div></div>)}
      {ammoDue.map(u=><div className="scar-treatment" key={'ammo-'+u.id}><div><strong>{u.name}</strong><small>Ammunition Debt после участия в battle: заплатите 5 Supply или потеряйте Grenades Stratagem в следующей battle.</small></div><div className="button-row"><button className="ghost compact" disabled={working} onClick={()=>ammunitionDebt(u,true)}>Заплатить 5 Supply</button><button className="ghost compact" disabled={working} onClick={()=>ammunitionDebt(u,false)}>Не платить</button></div></div>)}
      {grenadesLocked.map(u=><div className="notice" key={'grenades-'+u.id}><strong>{u.name}</strong>: Grenades Stratagem недоступен в следующей battle; после участия ограничение снимается, затем Ammunition Debt возникает снова.</div>)}
    </section>}

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
