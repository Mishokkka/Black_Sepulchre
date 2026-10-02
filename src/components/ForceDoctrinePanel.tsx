import { useMemo, useState } from 'react'
import { Award, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGES, stageIndexForBattles } from '../data/campaign'
import type { Campaign, PlayerState, Unit } from '../types'

export default function ForceDoctrinePanel({
  activationId,campaign,player,currentSector,units,reload,onMessage
}:{
  activationId:string;campaign:Campaign;player:PlayerState;currentSector:string;units:Unit[];reload:()=>void;onMessage:(message:string)=>void
}){
  const mine=useMemo(()=>units.filter(u=>u.side===player.side&&u.status!=='lost'&&(u.location_type==='field'||u.sector_key===currentSector)),[units,player.side,currentSector])
  const stage=STAGES[stageIndexForBattles(campaign.battle_count)]
  const packageOpen=player.detachment_stage_index!==campaign.stage_index
  const assignments=player.enhancement_stage_index===campaign.stage_index?(player.enhancement_assignments??{}):{}

  const[working,setWorking]=useState(false)
  const[packageText,setPackageText]=useState(()=>Array.isArray(player.detachment_package)?player.detachment_package.map((x:any)=>typeof x==='string'?x:x?.name??'').filter(Boolean).join(', '):'')
  const[enhUnit,setEnhUnit]=useState('')
  const[enhName,setEnhName]=useState('')
  const[enhFrom,setEnhFrom]=useState('')
  const[refitUnit,setRefitUnit]=useState('')
  const[refitKind,setRefitKind]=useState<'size'|'loadout'>('size')
  const[refitRC,setRefitRC]=useState('')
  const[refitSize,setRefitSize]=useState('')
  const[refitLoadout,setRefitLoadout]=useState('')

  async function stagePackage(){
    const pkg=packageText.split(',').map(x=>x.trim()).filter(Boolean)
    if(!pkg.length)return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_set_stage_detachment_package',{p_activation:activationId,p_package:pkg})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage('Detachment Package сохранён: '+data.package.join(', ')+'.')
    reload()
  }

  async function assignEnhancement(){
    if(!enhUnit||!enhName.trim())return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_assign_enhancement',{p_activation:activationId,p_unit:enhUnit,p_name:enhName.trim()})
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage('Enhancement '+data.name+' закреплён бесплатно на этой Stage.')
    setEnhUnit('');setEnhName('');reload()
  }

  async function reassignEnhancement(){
    if(!enhFrom||!enhUnit||!enhName.trim())return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_reassign_enhancement',{
      p_activation:activationId,p_from_unit:enhFrom,p_to_unit:enhUnit,p_name:enhName.trim()
    })
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage('Enhancement переназначен за '+data.cost+' Supply.')
    setEnhFrom('');setEnhUnit('');setEnhName('');reload()
  }

  async function refit(){
    if(!refitUnit||!Number(refitRC))return
    setWorking(true)
    const{data,error}=await supabase.rpc('logistics_refit_unit',{
      p_activation:activationId,p_unit:refitUnit,p_kind:refitKind,p_new_reference_cost:Number(refitRC),
      p_size_label:refitKind==='size'?(refitSize||null):null,
      p_loadout_text:refitKind==='loadout'?(refitLoadout||null):null
    })
    setWorking(false)
    if(error){onMessage(error.message);return}
    onMessage((refitKind==='size'?'Size':'Loadout')+' refit: RC '+data.old_rc+' → '+data.new_rc+'; '+data.cost+' Supply.')
    setRefitUnit('');setRefitRC('');setRefitSize('');setRefitLoadout('');reload()
  }

  return <>
    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">DETACHMENT PACKAGE</div><h2>Stage doctrine</h2></div><Award/></div>
      <p className="muted">В начале Stage пакет фиксируется бесплатно. Вне Stage его меняет Strategic Action Doctrine Refit за 25 Supply.</p>
      <label>Detachments через запятую<input value={packageText} onChange={e=>setPackageText(e.target.value)} placeholder="Awakened Dynasty"/></label>
      <button className="primary action-main" disabled={working||!packageOpen||!packageText.trim()} onClick={stagePackage}>{packageOpen?'Зафиксировать пакет бесплатно':'Пакет этой Stage уже зафиксирован'}</button>
      <small className="muted">Allowance: {stage.dp}. DP legality проверяется по вашему Season Snapshot.</small>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">ENHANCEMENTS</div><h2>Persistent assignments</h2></div><Award/></div>
      <p className="muted">Лимит Stage: {stage.enhancements}. Первый assignment в свободный slot бесплатный. Reassignment вне Stage transition стоит 15 Supply. Official points cost укажите через OBC при Muster.</p>
      {Object.entries(assignments).length>0&&<div className="owned-armoury">{Object.entries(assignments).map(([uid,name])=><div key={uid}><strong>{mine.find(u=>u.id===uid)?.name??uid}</strong><span>{String(name)}</span></div>)}</div>}
      <div className="armoury-buy">
        <label>Unit<select value={enhUnit} onChange={e=>setEnhUnit(e.target.value)}><option value="">Выберите unit</option>{mine.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>Enhancement<input value={enhName} onChange={e=>setEnhName(e.target.value)} placeholder="Название по Codex"/></label>
      </div>
      <div className="button-row">
        <button className="ghost compact" disabled={working||!enhUnit||!enhName.trim()||Object.keys(assignments).length>=stage.enhancements} onClick={assignEnhancement}>Assign free Stage slot</button>
        <select value={enhFrom} onChange={e=>setEnhFrom(e.target.value)}><option value="">Reassign from…</option>{Object.keys(assignments).map(uid=><option key={uid} value={uid}>{mine.find(u=>u.id===uid)?.name??uid}</option>)}</select>
        <button className="ghost compact" disabled={working||!enhFrom||!enhUnit||!enhName.trim()} onClick={reassignEnhancement}>Reassign · 15 Supply</button>
      </div>
    </section>

    <section className="panel">
      <div className="section-head"><div><div className="eyebrow">PERSISTENT REFIT</div><h2>Size / loadout</h2></div><SlidersHorizontal/></div>
      <p className="muted">Size change pays positive RC difference. Loadout change outside Stage transition costs 5 Supply plus positive RC difference. Снижение RC не даёт refund.</p>
      <div className="armoury-buy">
        <label>Unit<select value={refitUnit} onChange={e=>{setRefitUnit(e.target.value);const u=mine.find(x=>x.id===e.target.value);if(u){setRefitRC(String(u.reference_cost));setRefitSize(u.size_label??'');setRefitLoadout(String(u.loadout?.text??''))}}}><option value="">Выберите unit</option>{mine.map(u=><option key={u.id} value={u.id}>{u.name} · RC {u.reference_cost}</option>)}</select></label>
        <label>Type<select value={refitKind} onChange={e=>setRefitKind(e.target.value as 'size'|'loadout')}><option value="size">Unit size</option><option value="loadout">Loadout / wargear</option></select></label>
        <label>Новый RC<input type="number" min={1} value={refitRC} onChange={e=>setRefitRC(e.target.value)}/></label>
        {refitKind==='size'?<label>Size label<input value={refitSize} onChange={e=>setRefitSize(e.target.value)} placeholder="10 models"/></label>:<label>Loadout<input value={refitLoadout} onChange={e=>setRefitLoadout(e.target.value)} placeholder="Persistent loadout"/></label>}
      </div>
      <button className="primary action-main" disabled={working||!refitUnit||!Number(refitRC)} onClick={refit}>Применить Refit</button>
    </section>
  </>
}
