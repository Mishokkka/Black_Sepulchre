import { useMemo, useState } from 'react'
import { Coins, PackagePlus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGES, stageIndexForBattles } from '../data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from '../types'

export default function LogisticsPanel({
  activationId,campaign,member,players,sectors,units,reload,onPassed
}:{
  activationId:string;campaign:Campaign;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[];reload:()=>void;onPassed:()=>void
}){
  const[form,setForm]=useState({name:'',datasheet:'',cost:'',location:'field',garrisonClass:'core',size:'',keywords:'',character:false,epic:false,battleline:false})
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  const me=players.find(p=>p.side===member.side)
  const sector=sectors.find(s=>s.sector_key===me?.main_force_sector)
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const mine=useMemo(()=>units.filter(u=>u.side===member.side),[units,member.side])
  const fieldBase=mine.filter(u=>u.location_type==='field').reduce((a,u)=>a+u.reference_cost,0)

  async function rpc(name:string,args:Record<string,unknown>,success?:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc(name,args)
    if(error)setMsg(error.message)
    else{setMsg(success??'Готово.');reload()}
    setWorking(false)
    return {data,error}
  }
  async function buy(){
    const cost=Number(form.cost)
    if(!form.name.trim()||!form.datasheet.trim()||!Number.isFinite(cost)||cost<=0){setMsg('Укажите имя, datasheet и Base Points.');return}
    const r=await rpc('logistics_buy_unit',{
      p_activation:activationId,p_name:form.name,p_datasheet:form.datasheet,p_reference_cost:cost,p_location_type:form.location,
      p_garrison_class:form.garrisonClass,p_size_label:form.size,
      p_keywords:form.keywords.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),
      p_is_character:form.character,p_is_epic_hero:form.epic,p_is_battleline:form.battleline
    },`Unit куплен за ${cost} Supply.`)
    if(!r.error)setForm({name:'',datasheet:'',cost:'',location:'field',garrisonClass:'core',size:'',keywords:'',character:false,epic:false,battleline:false})
  }
  async function recover(u:Unit){await rpc('logistics_recover',{p_activation:activationId,p_unit:u.id},`${u.name}: снят 1 Damage.`)}
  async function disband(u:Unit){
    if(!window.confirm(`Расформировать ${u.name}? XP, Honours, Scars и ID будут потеряны.`))return
    const r=await rpc('logistics_disband',{p_activation:activationId,p_unit:u.id})
    if(r.data!==null&&!r.error)setMsg(`${u.name} расформирован. Возврат: ${r.data} Supply.`)
  }
  async function pass(){
    const r=await rpc('activation_pass_turn',{p_activation:activationId},'Ход передан сопернику.')
    if(!r.error)onPassed()
  }

  return <div className="logistics-grid">
    <section className="panel wide logistics-head">
      <div className="section-head"><div><div className="eyebrow">LOGISTICS PHASE</div><h2>Sector {me?.main_force_sector} · {sector?.name}</h2></div><Coins/></div>
      <div className="activation-meters">
        <div><span>Supply</span><strong>{me?.supply??0}</strong></div>
        <div><span>Army Limit</span><strong>{stage.armyLimit}</strong></div>
        <div><span>Field Roster</span><strong>{fieldBase} / {stage.rosterCap}</strong></div>
        <div><span>Sector</span><strong>{sector?.sector_class??'—'}</strong></div>
      </div>
      <p className="muted">Покупки и recovery проходят через кампанийную экономику. После «Передать ход» Logistics закрывается.</p>
      {msg&&<div className="notice">{msg}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">REINFORCEMENTS</div><h2>Купить unit</h2></div><PackagePlus/></div>
      <div className="buy-form">
        <label>Имя<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Immortals Alpha"/></label>
        <label>Datasheet<input value={form.datasheet} onChange={e=>setForm({...form,datasheet:e.target.value})} placeholder="Immortals"/></label>
        <label>Base Points<input type="number" min={1} value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/></label>
        <label>Размер / заметка<input value={form.size} onChange={e=>setForm({...form,size:e.target.value})} placeholder="10 models"/></label>
        <label>Куда<select value={form.location} onChange={e=>setForm({...form,location:e.target.value})}><option value="field">Field Roster</option><option value="garrison">Local Garrison</option></select></label>
        {form.location==='garrison'&&<label>Garrison class<select value={form.garrisonClass} onChange={e=>setForm({...form,garrisonClass:e.target.value})}><option value="core">Core</option><option value="heavy">Heavy</option></select></label>}
        <label className="wide-label">Keywords через запятую<input value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="INFANTRY, NECRON"/></label>
        <div className="flag-row"><label><input type="checkbox" checked={form.character} onChange={e=>setForm({...form,character:e.target.checked})}/> CHARACTER</label><label><input type="checkbox" checked={form.epic} onChange={e=>setForm({...form,epic:e.target.checked})}/> EPIC HERO</label><label><input type="checkbox" checked={form.battleline} onChange={e=>setForm({...form,battleline:e.target.checked})}/> BATTLELINE</label></div>
      </div>
      <button className="primary action-main" disabled={working} onClick={buy}><PackagePlus size={15}/> Купить</button>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">RECOVERY</div><h2>Persistent units</h2></div><RotateCcw/></div>
      <div className="logistics-units">{mine.map(u=><div key={u.id} className="logistics-unit">
        <div><strong>{u.name}</strong><small>{u.location_type==='field'?'Field Roster':`Garrison ${u.sector_key}`} · Base {u.reference_cost} · XP {u.xp}</small></div>
        <span className={'damage-badge d'+u.damage}>Damage {u.damage}</span>
        <button className="ghost compact" disabled={working||u.damage===0} onClick={()=>recover(u)}><RotateCcw size={14}/> Recover</button>
        <button className="ghost compact danger" disabled={working} onClick={()=>disband(u)}><Trash2 size={14}/></button>
      </div>)}</div>
    </section>

    <section className="panel wide pass-panel">
      <div><div className="eyebrow">END LOGISTICS</div><h2>Все покупки и восстановление закончены?</h2><p className="muted">После передачи хода изменить эту Logistics Phase уже нельзя.</p></div>
      <button className="primary" disabled={working} onClick={pass}><Send size={16}/> Передать ход</button>
    </section>
  </div>
}
