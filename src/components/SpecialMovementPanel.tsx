import { useMemo, useState } from 'react'
import { Orbit, Radar, Route } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ADJACENCY } from '../data/campaign'
import type { Member, Sector } from '../types'

function distance(a:string,b:string){
  if(a===b)return 0
  const seen=new Set([a]),q:[string,number][]=[[a,0]]
  while(q.length){const[cur,d]=q.shift()!;for(const n of ADJACENCY[cur]??[]){if(n===b)return d+1;if(!seen.has(n)){seen.add(n);q.push([n,d+1])}}}
  return 99
}
function supplied(side:string,sector:string,sectors:Sector[]){
  const home=side==='deathwatch'?'A':'K',owned=new Set(sectors.filter(s=>s.owner_side===side).map(s=>s.sector_key))
  if(!owned.has(sector))return false
  const seen=new Set([sector]),q=[sector]
  while(q.length){const k=q.shift()!;if(k===home)return true;for(const n of ADJACENCY[k]??[])if(owned.has(n)&&!seen.has(n)){seen.add(n);q.push(n)}}
  return false
}

export default function SpecialMovementPanel({
  activationId,startSector,currentSector,member,sectors,intelligence,orbitalDisabled,secretRouteSector,hiddenRouteAvailable,onResolved
}:{
  activationId:string;startSector:string;currentSector:string;member:Member;sectors:Sector[];intelligence:number;orbitalDisabled:boolean;secretRouteSector:string|null;hiddenRouteAvailable:boolean;onResolved:(data:any,message:string)=>void
}){
  const[target,setTarget]=useState(''),[friendly,setFriendly]=useState(''),[routeTarget,setRouteTarget]=useState(''),[hiddenTarget,setHiddenTarget]=useState(''),[working,setWorking]=useState(false),[msg,setMsg]=useState('')
  const enemyTwo=useMemo(()=>sectors.filter(s=>s.owner_side&&s.owner_side!==member.side&&distance(currentSector,s.sector_key)===2&&s.sector_class!=='Home Stronghold'),[sectors,member.side,currentSector])
  const cEnemy=useMemo(()=>sectors.filter(s=>s.owner_side&&s.owner_side!==member.side&&distance('C',s.sector_key)===2&&s.sector_class!=='Home Stronghold'),[sectors,member.side])
  const hEnemy=useMemo(()=>sectors.filter(s=>s.owner_side&&s.owner_side!==member.side&&distance('H',s.sector_key)===2&&s.sector_class!=='Home Stronghold'),[sectors,member.side])
  const cFriendly=useMemo(()=>sectors.filter(s=>s.owner_side===member.side&&s.sector_key!=='C'&&distance('C',s.sector_key)<=2&&supplied(member.side,s.sector_key,sectors)),[sectors,member.side])
  const routeOwner=secretRouteSector?sectors.find(s=>s.sector_key===secretRouteSector)?.owner_side:null
  const routeTargets=useMemo(()=>sectors.filter(s=>(ADJACENCY.G??[]).includes(s.sector_key)&&s.sector_key!==currentSector),[sectors,currentSector])

  async function special(method:string,t:string){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('activation_special_attack',{p_activation:activationId,p_target:t,p_method:method})
    setWorking(false)
    if(error){setMsg(error.message);return}
    onResolved(data,method==='deep_raid'?`Deep Raid declared. Intel cost ${data.intel_cost}.`:method==='airlift_attack'?`Attacking Airlift: D6 ${data.airlift_roll}${data.c_exhausted?' · C Exhausted':''}.`:'Glass Wastes route used.')
  }
  async function airliftMove(){
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('activation_airlift_move',{p_activation:activationId,p_target:friendly})
    setWorking(false)
    if(error){setMsg(error.message);return}
    onResolved(data,`Airlift to sector ${friendly}.`)
  }
  async function secretRouteMove(){
    if(!routeTarget)return
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('activation_secret_route_move',{p_activation:activationId,p_target:routeTarget})
    setWorking(false)
    if(error){setMsg(error.message);return}
    onResolved(data,`SECRET ROUTE used: ${currentSector} → ${routeTarget}.`)
  }
  async function hiddenRouteAttack(){
    if(!hiddenTarget)return
    setWorking(true);setMsg('')
    const{data,error}=await supabase.rpc('activation_hidden_route_attack',{p_activation:activationId,p_target:hiddenTarget})
    setWorking(false)
    if(error){setMsg(error.message);return}
    onResolved(data,`Hidden Route attack declared on sector ${hiddenTarget} for 1 Intel.`)
  }

  const canC=startSector==='C'&&currentSector==='C'&&!orbitalDisabled
  const canH=startSector==='H'&&currentSector==='H'
  return <section className="panel special-move-panel">
    <div className="section-head"><div><div className="eyebrow">SPECIAL MOVEMENT</div><h2>Разведка и переброска</h2></div><Route/></div>
    <div className="special-move-list">
      <div><div><Radar/><span><strong>Deep Raid</strong><small>2 Intel · при активном G bonus первый Deep Raid стадии дешевле на 1 · нужен Supply Line</small></span></div>
        <div className="inline-control"><select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Цель</option>{enemyTwo.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost" disabled={working||intelligence<1||!target} onClick={()=>special('deep_raid',target)}>1–2 Intel</button></div>
      </div>
      {secretRouteSector&&<div><div><Route/><span><strong>SECRET ROUTE · token {secretRouteSector}</strong><small>{routeOwner===member.side?'Вы владеете token sector: один виртуальный соседний move/attack к любому сектору рядом с G.':'Использовать может текущий владелец token sector.'}</small></span></div>
        {routeOwner===member.side&&<div className="inline-control"><select value={routeTarget} onChange={e=>setRouteTarget(e.target.value)}><option value="">Destination</option>{routeTargets.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}{s.owner_side===member.side?' · friendly':s.owner_side?' · enemy':' · neutral'}</option>)}</select><button className="ghost" disabled={working||!routeTarget} onClick={secretRouteMove}>Use route</button></div>}
      </div>}
      {hiddenRouteAvailable&&<div><div><Radar/><span><strong>Hidden Route</strong><small>D66 35 · один раз вашей стороне до следующей tabletop battle: enemy sector ровно в двух связях за 1 Intel.</small></span></div>
        <div className="inline-control"><select value={hiddenTarget} onChange={e=>setHiddenTarget(e.target.value)}><option value="">Цель</option>{enemyTwo.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost" disabled={working||intelligence<1||!hiddenTarget} onClick={hiddenRouteAttack}>1 Intel</button></div>
      </div>}
      {orbitalDisabled&&startSector==='C'&&currentSector==='C'&&<div className="notice">Broken Map: Orbital Ossuary Lift отключён до конца следующей tabletop battle.</div>}
      {canC&&<><div><div><Orbit/><span><strong>Orbital Airlift</strong><small>1 MP · controlled supplied sector до двух связей от C</small></span></div>
        <div className="inline-control"><select value={friendly} onChange={e=>setFriendly(e.target.value)}><option value="">Destination</option>{cFriendly.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost" disabled={working||!friendly} onClick={airliftMove}>1 MP</button></div>
      </div>
      <div><div><Orbit/><span><strong>Attacking Airlift</strong><small>1 Intel · enemy sector в двух связях от C · D6: на 1 C Exhausted</small></span></div>
        <div className="inline-control"><select id="airlift-target" defaultValue=""><option value="">Цель</option>{cEnemy.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost" disabled={working||intelligence<1||cEnemy.length===0} onClick={()=>{const el=document.getElementById('airlift-target') as HTMLSelectElement|null;if(el?.value)special('airlift_attack',el.value)}}>1 Intel</button></div>
      </div></>}
      {canH&&<div><div><Route/><span><strong>Glass Wastes</strong><small>1 Intel · enemy sector в двух связях от H</small></span></div>
        <div className="inline-control"><select id="glass-target" defaultValue=""><option value="">Цель</option>{hEnemy.map(s=><option key={s.sector_key} value={s.sector_key}>{s.sector_key} · {s.name}</option>)}</select><button className="ghost" disabled={working||intelligence<1||hEnemy.length===0} onClick={()=>{const el=document.getElementById('glass-target') as HTMLSelectElement|null;if(el?.value)special('glass_wastes',el.value)}}>1 Intel</button></div>
      </div>}
    </div>
    {msg&&<div className="notice">{msg}</div>}
  </section>
}
