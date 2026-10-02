import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Skull } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Campaign, Member, PlayerState, Unit } from '../types'

type Side='necrons'|'deathwatch'
type FinaleBattleUnit={unit_id:string;side:Side;participated:boolean}

const ENDINGS={
  PURGE:{title:'PURGE',text:'Уничтожить engine. Все persistent units, участвовавшие в финале, делают дополнительный Casualty Roll +1.'},
  SEIZE:{title:'SEIZE',text:'Захватить engine. Все Legendary units получают narrative mark Choir-Touched.'},
  SEAL:{title:'SEAL',text:'Запечатать машину. Требует 3 Secret Fragments; каждый игрок выбирает один участвовавший unit, исчезающий из эпилога без нового Casualty Roll.'},
  FEED:{title:'FEED',text:'Завершить цикл выборочно. Доступно только при BLACK CHOIR 8.'}
} as const

export default function FinalePanel({
  campaign,member,players,units,reload
}:{
  campaign:Campaign;member:Member;players:PlayerState[];units:Unit[];reload:()=>void
}){
  const[working,setWorking]=useState(false)
  const[msg,setMsg]=useState('')
  const[finalBattleId,setFinalBattleId]=useState<string|null>(null)
  const[finalUnits,setFinalUnits]=useState<FinaleBattleUnit[]>([])
  const[sealUnit,setSealUnit]=useState('')

  const ending=(campaign.settings?.final_ending?.code??'') as keyof typeof ENDINGS|''
  const winner=campaign.winner_side
  const me=players.find(p=>p.side===member.side)
  const sealChoices=(campaign.settings?.seal_epilogue_choices??{}) as Record<string,{unit_id:string;unit_name:string}>
  const mySeal=sealChoices[member.side]

  useEffect(()=>{
    if(campaign.status!=='finished')return
    ;(async()=>{
      const{data:b}=await supabase.from('battles').select('id').eq('campaign_id',campaign.id).eq('status','completed').eq('battle_type','Stronghold Assault').order('sequence_no',{ascending:false}).limit(1)
      const id=b?.[0]?.id??null
      setFinalBattleId(id)
      if(!id){setFinalUnits([]);return}
      const{data:bu}=await supabase.from('battle_units').select('unit_id,side,participated').eq('battle_id',id).eq('participated',true)
      setFinalUnits((bu??[]) as FinaleBattleUnit[])
    })()
  },[campaign.id,campaign.status,campaign.settings?.final_ending?.battle_id])

  const mine=useMemo(()=>finalUnits.filter(x=>x.side===member.side).map(x=>units.find(u=>u.id===x.unit_id)).filter(Boolean) as Unit[],[finalUnits,member.side,units])

  async function choose(code:keyof typeof ENDINGS){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('campaign_choose_final_ending',{p_campaign:campaign.id,p_ending:code})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(code==='PURGE'
      ?'PURGE: обработано '+String(data?.purge?.units_rolled??0)+' Casualty Rolls.'
      :'Финальный исход: '+code+'.')
    await reload()
  }

  async function seal(){
    if(!sealUnit)return
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('campaign_choose_seal_epilogue_unit',{p_campaign:campaign.id,p_unit:sealUnit})
    setWorking(false)
    if(error){setMsg(error.message);return}
    setMsg(String(data.unit_name)+' исчезает из эпилога.')
    setSealUnit('')
    await reload()
  }

  if(campaign.status!=='finished')return null

  return <section className="panel wide finale-panel">
    <div className="section-head"><div><div className="eyebrow">CAMPAIGN FINALE</div><h2>The Black Sepulchre</h2></div><Skull/></div>
    <p>Победитель кампании: <strong>{winner==='necrons'?'Necrons':'Deathwatch'}</strong>.</p>

    {!ending&&member.side===winner&&<div className="asset-options">
      {(Object.keys(ENDINGS) as (keyof typeof ENDINGS)[]).map(code=>{
        const disabled=working||(code==='SEAL'&&(me?.secret_fragments??0)<3)||(code==='FEED'&&campaign.black_choir<8)
        return <button key={code} className="asset-option" disabled={disabled} onClick={()=>choose(code)}>
          <span><strong>{ENDINGS[code].title}</strong><small>{ENDINGS[code].text}</small></span>
        </button>
      })}
    </div>}

    {!ending&&member.side!==winner&&<p className="muted">Ожидается выбор финального исхода победителем.</p>}

    {ending&&<div className="notice"><CheckCircle2 size={16}/><strong>{ENDINGS[ending].title}</strong> · {ENDINGS[ending].text}</div>}

    {ending==='SEAL'&&<>
      {mySeal?<p><strong>Ваш выбор:</strong> {mySeal.unit_name}</p>:<div className="inline-control">
        <select value={sealUnit} onChange={e=>setSealUnit(e.target.value)}>
          <option value="">Участвовавший unit</option>
          {mine.map(u=><option key={u.id} value={u.id}>{u.name} · {u.datasheet}</option>)}
        </select>
        <button className="ghost compact" disabled={working||!sealUnit||!finalBattleId} onClick={seal}>Выбрать для эпилога</button>
      </div>}
      <small className="muted">SEAL требует отдельного выбора от каждой стороны. Выбранный unit получает только narrative mark эпилога; дополнительный Casualty Roll не делается.</small>
    </>}

    {msg&&<div className="notice">{msg}</div>}
  </section>
}
