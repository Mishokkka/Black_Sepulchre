import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, BookOpen, Copy, LogOut, Map, RefreshCw, Shield, Skull, Swords, Users, Footprints, RadioTower } from 'lucide-react'
import StrategicPanel from './components/StrategicPanel'
import BattleCenter from './components/BattleCenter'
import EventsPanel from './components/EventsPanel'
import { supabase } from './lib/supabase'
import { ADJACENCY, SECTOR_META, STAGES, campaignSurcharge, recoveryCost, stageIndexForBattles } from './data/campaign'
import type { Campaign, Member, PlayerState, Sector, Unit } from './types'

type Tab='dashboard'|'strategy'|'map'|'rosters'|'battles'|'events'|'log'
const sideLabel=(s:string|null)=>s==='necrons'?'Necrons':s==='deathwatch'?'Deathwatch':'Neutral'

function AuthScreen(){
 const[mode,setMode]=useState<'in'|'up'>('in')
 const[email,setEmail]=useState('')
 const[password,setPassword]=useState('')
 const[msg,setMsg]=useState('')
 async function submit(e:React.FormEvent){
  e.preventDefault();setMsg('')
  const r=mode==='in'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password})
  if(r.error)setMsg(r.error.message)
  else if(mode==='up'&&!r.data.session)setMsg('Аккаунт создан. Проверьте почту и подтвердите адрес.')
 }
 return <main className="auth-shell"><section className="auth-card">
  <div className="eyebrow">THE BLACK SEPULCHRE</div><h1>Campaign Command</h1>
  <p className="muted">Стратегический слой кампании. Бои проводятся отдельно.</p>
  <form onSubmit={submit}>
   <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/></label>
   <button className="primary" type="submit">{mode==='in'?'Войти':'Создать аккаунт'}</button>
  </form>
  {msg&&<div className="notice">{msg}</div>}
  <button className="ghost" onClick={()=>setMode(mode==='in'?'up':'in')}>{mode==='in'?'Нет аккаунта':'Уже есть аккаунт'}</button>
 </section></main>
}

function CampaignGate({onReady}:{onReady:(id:string)=>void}){
 const[name,setName]=useState('The Black Sepulchre')
 const[displayName,setDisplayName]=useState('Commander')
 const[side,setSide]=useState<'necrons'|'deathwatch'>('necrons')
 const[code,setCode]=useState('');const[msg,setMsg]=useState('')
 async function create(){
  setMsg('');const{data,error}=await supabase.rpc('create_campaign',{p_name:name,p_side:side,p_display_name:displayName})
  if(error)setMsg(error.message);else onReady(data)
 }
 async function join(){
  setMsg('');const{data,error}=await supabase.rpc('join_campaign',{p_invite_code:code,p_display_name:displayName})
  if(error)setMsg(error.message);else onReady(data)
 }
 return <main className="gate-shell"><section className="gate-card"><div className="eyebrow">NO ACTIVE CAMPAIGN</div><h1>Создать или присоединиться</h1>
  <div className="gate-grid">
   <div><h3>Новая кампания</h3>
    <label>Название<input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Ваше имя<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
    <label>Сторона<select value={side} onChange={e=>setSide(e.target.value as typeof side)}><option value="necrons">Necrons</option><option value="deathwatch">Deathwatch</option></select></label>
    <button className="primary" onClick={create}>Создать</button>
   </div>
   <div><h3>Войти по коду</h3>
    <label>Ваше имя<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
    <label>Invite code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXX"/></label>
    <button className="primary" onClick={join}>Присоединиться</button>
   </div>
  </div>{msg&&<div className="notice">{msg}</div>}
 </section></main>
}

const nodes:Record<string,[number,number]>={A:[50,7],B:[29,22],C:[71,22],D:[17,42],E:[83,42],F:[30,63],G:[50,48],H:[70,63],I:[31,84],J:[69,84],K:[50,95]}

function MapView({sectors,players,selected,onSelect}:{sectors:Sector[];players:PlayerState[];selected:string|null;onSelect:(s:string)=>void}){
 const byKey=useMemo(()=>Object.fromEntries(sectors.map(s=>[s.sector_key,s])),[sectors])
 const lines:string[]=[];Object.entries(ADJACENCY).forEach(([a,bs])=>bs.forEach(b=>{if(a<b)lines.push(a+b)}))
 return <div className="map-layout">
  <div className="map-frame"><svg viewBox="0 0 100 102" className="sector-map">
   {lines.map(pair=>{const a=pair[0],b=pair[1];return <line key={pair} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} className="map-link"/>})}
   {Object.entries(nodes).map(([key,[x,y]])=>{const s=byKey[key];const force=players.find(p=>p.main_force_sector===key);return <g key={key} onClick={()=>onSelect(key)} className="sector-node">
    <circle cx={x} cy={y} r={selected===key?5.6:4.8} className={'node '+(s?.owner_side??'neutral')+(s?.fortified?' fortified':'')}/>
    <text x={x} y={y+1.15} textAnchor="middle" className="node-label">{key}</text>
    {force&&<circle cx={x+4.5} cy={y-4.5} r="1.6" className={'force-dot '+force.side}/>}
   </g>})}
  </svg></div>
  <div className="sector-panel">{selected&&byKey[selected]?<>
   <div className="eyebrow">{selected} · {byKey[selected].sector_class}</div><h2>{byKey[selected].name}</h2>
   <dl><div><dt>Владелец</dt><dd>{sideLabel(byKey[selected].owner_side)}</dd></div><div><dt>Состояние</dt><dd>{byKey[selected].conditions?.length?byKey[selected].conditions.join(', '):'Normal'}</dd></div><div><dt>Fortified</dt><dd>{byKey[selected].fortified?'Да':'Нет'}</dd></div><div><dt>Соседи</dt><dd>{ADJACENCY[selected].join(', ')}</dd></div></dl>
   {players.filter(p=>p.main_force_sector===selected).map(p=><div className="tag" key={p.side}>{sideLabel(p.side)} Main Force</div>)}
  </>:<p className="muted">Выберите сектор.</p>}</div>
 </div>
}

function RosterView({units,member}:{units:Unit[];member:Member}){
 const mine=units.filter(u=>u.side===member.side),enemy=units.filter(u=>u.side!==member.side)
 const rank=(xp:number)=>xp>=18?'Legendary':xp>=12?'Elite':xp>=7?'Veteran':xp>=3?'Blooded':'Recruit'
 const render=(rows:Unit[])=><div className="unit-list">{rows.map(u=><div className="unit-row" key={u.id}>
  <div><strong>{u.name}</strong><small>{u.datasheet} · {u.location_type==='field'?'Field Roster':'Garrison '+u.sector_key}</small></div>
  <div className="stat"><span>Base</span>{u.reference_cost}</div>
  <div className="stat"><span>CR</span>+{u.campaign_rating}%</div>
  <div className="stat"><span>Effective</span>{u.reference_cost+campaignSurcharge(u.reference_cost,u.campaign_rating)}</div>
  <div className="stat"><span>XP</span>{u.xp}</div>
  <div className="stat"><span>Rank</span>{rank(u.xp)}</div>
  <div className={'status-pill d'+u.damage}>{u.damage===3?'Shattered':'Damage '+u.damage}</div>
 </div>)}</div>
 return <div><div className="section-head"><div><div className="eyebrow">PERSISTENT UNITS</div><h2>{sideLabel(member.side)}</h2></div></div>{render(mine)}
  <p className="muted roster-note">Покупка, recovery и расформирование выполняются только в Logistics Phase. XP и Damage меняются через Battle Aftermath.</p>
  <div className="section-head secondary"><div><div className="eyebrow">OPPONENT</div><h2>{sideLabel(member.side==='necrons'?'deathwatch':'necrons')}</h2></div></div>{render(enemy)}
 </div>
}

function App(){
 const[session,setSession]=useState<Session|null>(null),[campaignId,setCampaignId]=useState<string|null>(null),[campaign,setCampaign]=useState<Campaign|null>(null),[member,setMember]=useState<Member|null>(null)
 const[players,setPlayers]=useState<PlayerState[]>([]),[sectors,setSectors]=useState<Sector[]>([]),[units,setUnits]=useState<Unit[]>([]),[logs,setLogs]=useState<any[]>([])
 const[tab,setTab]=useState<Tab>('dashboard'),[selectedSector,setSelectedSector]=useState<string|null>('G'),[busy,setBusy]=useState(false)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[])
 const discover=useCallback(async()=>{if(!session)return;const{data}=await supabase.from('campaign_members').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(1);if(data?.[0])setCampaignId(data[0].campaign_id)},[session])
 useEffect(()=>{if(session&&!campaignId)discover()},[session,campaignId,discover])
 const load=useCallback(async()=>{if(!campaignId||!session)return;setBusy(true);const[c,m,p,s,u,l]=await Promise.all([
  supabase.from('campaigns').select('*').eq('id',campaignId).single(),supabase.from('campaign_members').select('*').eq('campaign_id',campaignId).eq('user_id',session.user.id).single(),supabase.from('players').select('*').eq('campaign_id',campaignId).order('side'),supabase.from('sectors').select('*').eq('campaign_id',campaignId).order('sector_key'),supabase.from('units').select('*').eq('campaign_id',campaignId).order('side').order('created_at'),supabase.from('audit_log').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:false}).limit(40)])
  if(c.data)setCampaign(c.data as Campaign);if(m.data)setMember(m.data as Member);setPlayers((p.data??[]) as PlayerState[]);setSectors((s.data??[]) as Sector[]);setUnits((u.data??[]) as Unit[]);setLogs(l.data??[]);setBusy(false)},[campaignId,session])
 useEffect(()=>{load()},[load])
 useEffect(()=>{if(!campaignId)return;const ch=supabase.channel('campaign-'+campaignId);['players','sectors','units','activations','battles','battle_units','campaign_events','audit_log'].forEach(table=>{ch.on('postgres_changes',{event:'*',schema:'public',table,filter:'campaign_id=eq.'+campaignId},()=>load())});ch.on('postgres_changes',{event:'*',schema:'public',table:'campaigns',filter:'id=eq.'+campaignId},()=>load());ch.subscribe();return()=>{supabase.removeChannel(ch)}},[campaignId,load])
 if(!session)return <AuthScreen/>;if(!campaignId)return <CampaignGate onReady={setCampaignId}/>;if(!campaign||!member)return <main className="loading"><RefreshCw className="spin"/>Загрузка кампании…</main>
 const stage=STAGES[stageIndexForBattles(campaign.battle_count)],me=players.find(p=>p.side===member.side),enemy=players.find(p=>p.side!==member.side)
 const rosterRC=units.filter(u=>u.side===member.side&&u.location_type==='field').reduce((a,u)=>a+u.reference_cost,0)
 return <div className="app"><aside><div className="brand"><Skull/><div><strong>BLACK SEPULCHRE</strong><small>Campaign Command</small></div></div>
  <nav>{([['dashboard',Activity,'Сводка'],['strategy',Footprints,'Стратегия'],['map',Map,'Карта'],['rosters',Users,'Армии'],['battles',Swords,'Бои'],['events',RadioTower,'События'],['log',BookOpen,'Журнал']] as [Tab,typeof Activity,string][]).map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}</nav>
  <div className="side-foot"><span className={'faction '+member.side}>{sideLabel(member.side)}</span><button className="ghost compact" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Выйти</button></div></aside>
  <main className="content"><header><div><div className="eyebrow">RULES v{campaign.rules_version} · SNAPSHOT {campaign.snapshot_date}</div><h1>{campaign.name}</h1></div><div className="header-actions"><button className="ghost compact" onClick={()=>navigator.clipboard.writeText(campaign.invite_code)}><Copy size={15}/> {campaign.invite_code}</button><button className="ghost compact" onClick={load}><RefreshCw size={15} className={busy?'spin':''}/></button></div></header>
   {tab==='dashboard'&&<><div className="metric-grid"><div className="metric"><span>Stage</span><strong>{stage.armyLimit}</strong><small>Army Limit</small></div><div className="metric"><span>Battle</span><strong>{campaign.battle_count+1}</strong><small>{campaign.battle_count} completed</small></div><div className="metric"><span>Supply</span><strong>{me?.supply??0}</strong><small>{enemy?.supply??0} enemy</small></div><div className="metric"><span>Intelligence</span><strong>{me?.intelligence??0}</strong><small>soft cap 6</small></div><div className="metric choir"><span>Black Choir</span><strong>{campaign.black_choir}</strong><small>hidden track</small></div></div>
    <div className="dashboard-grid"><section className="panel"><div className="section-head"><div><div className="eyebrow">YOUR FORCE</div><h2>{sideLabel(member.side)}</h2></div><Shield/></div><dl className="rows"><div><dt>Main Force</dt><dd>{me?.main_force_sector}</dd></div><div><dt>Field Roster</dt><dd>{rosterRC} / {stage.rosterCap} RC</dd></div><div><dt>Army Limit</dt><dd>{stage.armyLimit}</dd></div><div><dt>Recovery Supply</dt><dd>{me?.recovery_supply??0}</dd></div><div><dt>Secret Fragments</dt><dd>{me?.secret_fragments??0}</dd></div><div><dt>Fortress Integrity</dt><dd>{me?.fortress_integrity??2}</dd></div></dl></section>
    <section className="panel"><div className="section-head"><div><div className="eyebrow">STAGE RULES</div><h2>{stage.battles} battles</h2></div></div><dl className="rows"><div><dt>Detachment</dt><dd>{stage.dp}</dd></div><div><dt>Enhancements</dt><dd>{stage.enhancements}</dd></div><div><dt>Battlefield</dt><dd>{stage.field}</dd></div><div><dt>Recovery example</dt><dd>{recoveryCost(100)} / RC 100</dd></div></dl></section>
    <section className="panel wide"><div className="section-head"><div><div className="eyebrow">LIVE MAP</div><h2>Strategic situation</h2></div></div><MapView sectors={sectors} players={players} selected={selectedSector} onSelect={setSelectedSector}/></section></div></>}
   {tab==='strategy'&&<StrategicPanel campaign={campaign} member={member} players={players} sectors={sectors} units={units} reload={load} onOpenBattles={()=>setTab('battles')}/>} 
   {tab==='map'&&<section className="panel map-page"><MapView sectors={sectors} players={players} selected={selectedSector} onSelect={setSelectedSector}/></section>}
   {tab==='rosters'&&<RosterView units={units} member={member}/>}
   {tab==='battles'&&<BattleCenter campaign={campaign} member={member} players={players} sectors={sectors} units={units} reload={load}/>}\n   {tab==='events'&&<EventsPanel campaign={campaign}/>}
   {tab==='log'&&<section className="panel"><div className="section-head"><div><div className="eyebrow">AUDIT LOG</div><h2>История кампании</h2></div></div><div className="log-list">{logs.map(l=><div key={l.id}><time>{new Date(l.created_at).toLocaleString('ru')}</time><strong>{l.action}</strong><span>{l.entity_type} {l.entity_id??''}</span></div>)}</div></section>}
  </main></div>
}
export default App
