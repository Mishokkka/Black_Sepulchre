import { useMemo, useState } from 'react'
import { Coins, PackagePlus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGES, stageIndexForBattles } from '../data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from '../types'
import LogisticsUpgrades from './LogisticsUpgrades'
import ForceDoctrinePanel from './ForceDoctrinePanel'

export default function LogisticsPanel({
  activationId,campaign,member,players,sectors,units,reload,onPassed,canPass
}:{
  activationId:string;campaign:Campaign;member:Member;players:PlayerState[];sectors:Sector[];units:Unit[];reload:()=>void;onPassed:()=>void;canPass:boolean
}){
  const[form,setForm]=useState({name:'',datasheet:'',cost:'',location:'field',garrisonClass:'core',size:'',keywords:'',character:false,epic:false,battleline:false})
  const[msg,setMsg]=useState(''),[working,setWorking]=useState(false)
  const me=players.find(p=>p.side===member.side)
  const sector=sectors.find(s=>s.sector_key===me?.main_force_sector)
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const allMine=useMemo(()=>units.filter(u=>u.side===member.side),[units,member.side])
  const mine=useMemo(()=>allMine.filter(u=>u.status!=='lost'),[allMine])
  const lost=useMemo(()=>allMine.filter(u=>u.status==='lost'),[allMine])
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
    if(!form.name.trim()||!form.datasheet.trim()||!Number.isFinite(cost)||cost<=0){setMsg('Укажите имя, datasheet и Reference Cost (RC).');return}
    const r=await rpc('logistics_buy_unit',{
      p_activation:activationId,p_name:form.name,p_datasheet:form.datasheet,p_reference_cost:cost,p_location_type:form.location,
      p_garrison_class:form.garrisonClass,p_size_label:form.size,
      p_keywords:form.keywords.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),
      p_is_character:form.character,p_is_epic_hero:form.epic,p_is_battleline:form.battleline
    },'Unit куплен. Фактическая стоимость рассчитана сервером с учётом sector bonuses.')
    if(!r.error)setForm({name:'',datasheet:'',cost:'',location:'field',garrisonClass:'core',size:'',keywords:'',character:false,epic:false,battleline:false})
  }
  async function recover(u:Unit){
    const r=await rpc('logistics_recover',{p_activation:activationId,p_unit:u.id})
    if(r.data&&!r.error){
      const bonuses=[r.data.recovery_cache_used?'Recovery Cache':'',r.data.d_discount?'Fleshworks IX':'',r.data.home_discount?'Home discount':''].filter(Boolean)
      const paid=[r.data.recovery_supply_spent?`Recovery Supply ${r.data.recovery_supply_spent}`:'',r.data.supply_spent?`Supply ${r.data.supply_spent}`:''].filter(Boolean)
      setMsg(`${u.name}: снят 1 Damage за ${r.data.cost}${paid.length?` (${paid.join(' + ')})`:''}${bonuses.length?` · ${bonuses.join(', ')}`:''}.`)
    }
  }
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
        <div><span>Recovery Supply</span><strong>{me?.recovery_supply??0}</strong></div>
        <div><span>Army Limit</span><strong>{stage.armyLimit}</strong></div>
        <div><span>Field Roster</span><strong>{fieldBase} / {stage.rosterCap}</strong></div>
        <div><span>Sector</span><strong>{sector?.sector_class??'—'}</strong></div>
      </div>
      <p className="muted">После tabletop battle обе стороны используют это Logistics window со своих текущих позиций. После небойевой Activation доступ имеет только active side.</p>
      {msg&&<div className="notice">{msg}</div>}
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">REINFORCEMENTS</div><h2>Купить unit</h2></div><PackagePlus/></div>
      <div className="buy-form">
        <label>Имя<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Immortals Alpha"/></label>
        <label>Datasheet<input value={form.datasheet} onChange={e=>setForm({...form,datasheet:e.target.value})} placeholder="Immortals"/></label>
        <label>Reference Cost (RC)<input type="number" min={1} value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/></label>
        <label>Размер / заметка<input value={form.size} onChange={e=>setForm({...form,size:e.target.value})} placeholder="10 models"/></label>
        <label>Куда<select value={form.location} onChange={e=>setForm({...form,location:e.target.value})}><option value="field">Field Roster</option><option value="garrison">Local Garrison</option></select></label>
        {form.location==='garrison'&&<label>Garrison class<select value={form.garrisonClass} onChange={e=>setForm({...form,garrisonClass:e.target.value})}><option value="core">Core</option><option value="heavy">Heavy</option></select></label>}
        {form.location==='garrison'&&<div className="wide-label muted small-note">v2.0 legality проверяется сервером по faction list/keywords. Heavy доступен только в Strategic/Fortified/Home и имеет RC ≤35% Army Limit. TRANSPORT разрешён правилами только с подходящим garrison payload; связь payload сайт пока не моделирует, поэтому это условие проверяйте вручную.</div>}
        <label className="wide-label">Keywords через запятую<input value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="INFANTRY, NECRON"/></label>
        <div className="flag-row"><label><input type="checkbox" checked={form.character} onChange={e=>setForm({...form,character:e.target.checked})}/> CHARACTER</label><label><input type="checkbox" checked={form.epic} onChange={e=>setForm({...form,epic:e.target.checked})}/> EPIC HERO</label><label><input type="checkbox" checked={form.battleline} onChange={e=>setForm({...form,battleline:e.target.checked})}/> BATTLELINE</label></div>
      </div>
      <button className="primary action-main" disabled={working} onClick={buy}><PackagePlus size={15}/> Купить</button>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">RECOVERY</div><h2>Persistent units</h2></div><RotateCcw/></div>
      <div className="logistics-units">{mine.map(u=><div key={u.id} className="logistics-unit">
        <div><strong>{u.name}</strong><small>{u.location_type==='field'?'Field Roster':`Garrison ${u.sector_key}`} · RC {u.reference_cost} · XP {u.xp}</small></div>
        <span className={'damage-badge d'+u.damage}>Damage {u.damage}</span>
        <button className="ghost compact" disabled={working||u.damage===0} onClick={()=>recover(u)}><RotateCcw size={14}/> Recover</button>
        <button className="ghost compact danger" disabled={working} onClick={()=>disband(u)}><Trash2 size={14}/></button>
      </div>)}</div>
      {lost.length>0&&<p className="muted small-note">{lost.length} CHARACTER отмечено как Lost и хранится только в campaign history.</p>}
    </section>

    {me&&<ForceDoctrinePanel activationId={activationId} campaign={campaign} player={me} currentSector={me.main_force_sector} units={units} reload={reload} onMessage={setMsg}/>}
    <LogisticsUpgrades activationId={activationId} member={member} currentSector={me?.main_force_sector??''} units={units} reload={reload} onMessage={setMsg}/>

    <section className="panel wide pass-panel">
      <div><div className="eyebrow">END LOGISTICS</div><h2>{canPass?'Все покупки и восстановление закончены?':'Ваши Logistics действия доступны'}</h2><p className="muted">{canPass?'После передачи хода это Logistics window закрывается для обеих сторон. Убедитесь, что соперник закончил свои действия.':'Ход закрывает сторона текущей Strategic Activation. Сообщите сопернику, когда закончите свои Logistics действия.'}</p></div>
      {canPass&&<button className="primary" disabled={working} onClick={pass}><Send size={16}/> Передать ход</button>}
    </section>
  </div>
}
