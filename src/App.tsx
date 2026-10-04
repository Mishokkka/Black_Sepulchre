import { Auth, PasswordRecovery, RECOVERY_KEY } from './views/AuthView'
import { DraftUser } from './lib/useBattleDraft'
import { clearFinishedDrafts } from './lib/drafts'
import { campaignKey, initialCampaign, type CampaignChoice } from './lib/campaign-selection'
import { NextStep } from './views/NextStep'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  BookOpen,
  Footprints,
  LogOut,
  Map,
  RefreshCw,
  Shield,
  Skull,
  Swords,
  Users,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Command, Side, State, View } from '../shared/model'
import { STAGES } from '../shared/rules'
import { labels, phases, type Send } from './views/common'
import type { LibraryAPI } from './views/CatalogView'
import { SyncStatus } from './views/SyncStatus'
import {
  errorHelp,
  CampaignRequestError,
  retryableStatus,
  pendingKey,
  readPending,
} from './lib/requests'
import { initialSync, type SyncState } from './lib/sync'
const CampaignMap = lazy(() =>
  import('./views/CampaignMap').then((m) => ({ default: m.CampaignMap })),
)
const SetupView = lazy(() => import('./views/SetupView').then((m) => ({ default: m.SetupView })))
const StrategyView = lazy(() =>
  import('./views/CampaignViews').then((m) => ({ default: m.StrategyView })),
)
const LogisticsView = lazy(() =>
  import('./views/CampaignViews').then((m) => ({ default: m.LogisticsView })),
)
const RosterView = lazy(() =>
  import('./views/CampaignViews').then((m) => ({ default: m.RosterView })),
)
const BattleView = lazy(() => import('./views/BattleView').then((m) => ({ default: m.BattleView })))
const ReportView = lazy(() => import('./views/BattleView').then((m) => ({ default: m.ReportView })))
const CatalogView = lazy(() =>
  import('./views/CatalogView').then((m) => ({ default: m.CatalogView })),
)
const HistoryView = lazy(() =>
  import('./views/HistoryView').then((m) => ({ default: m.HistoryView })),
)
const ReferenceView = lazy(() => import('./views/ReferenceView'))
function Gate({ ready, onError }: { ready: (id: string) => void; onError: (m: string) => void }) {
  const inFlight = useRef(false)
  const [name, setName] = useState('The Black Sepulchre'),
    [display, setDisplay] = useState('Commander'),
    [side, setSide] = useState<Side>('deathwatch'),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false)
  const run = async (join: boolean) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const r = join
        ? await supabase.rpc('v221_join_campaign', {
            p_invite_code: code.trim().toUpperCase(),
            p_display_name: display,
          })
        : await supabase.rpc('create_campaign', {
            p_name: name,
            p_side: side,
            p_display_name: display,
          })
      if (r.error) onError(r.error.message)
      else ready(r.data)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <div className="center">
      <section className="login">
        <h1>Ваша кампания</h1>
        <label>
          Имя командира
          <input value={display} onChange={(e) => setDisplay(e.target.value)} />
        </label>
        <label>
          Название
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Сторона
          <select
            aria-label="Сторона"
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} onClick={() => run(false)}>
          Создать кампанию
        </button>
        <hr />
        <label>
          Код приглашения
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код второго командира"
          />
        </label>
        <button disabled={busy || !code.trim()} onClick={() => run(true)}>
          Присоединиться
        </button>
      </section>
    </div>
  )
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(false),
    [recovering, setRecovering] = useState(false),
    [campaigns, setCampaigns] = useState<CampaignChoice[]>([]),
    [choosing, setChoosing] = useState(false),
    [creating, setCreating] = useState(false),
    [id, setId] = useState<string | null>(null),
    [view, setView] = useState<View | null>(null),
    [side, setSide] = useState<Side>('deathwatch'),
    [tab, setTab] = useState('overview'),
    [error, setError] = useState<Error | string>(''),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(''),
    [pending, setPending] = useState<unknown>(null),
    [correcting, setCorrecting] = useState(false),
    [membershipReady, setMembershipReady] = useState(false),
    [membershipFailed, setMembershipFailed] = useState(false),
    [membershipAttempt, setMembershipAttempt] = useState(0)
  const [sync, setSync] = useState<SyncState>(() => initialSync(navigator.onLine))
  const viewVersion = useRef(0)
  viewVersion.current = view?.version ?? 0
  const scope = useRef(''),
    user = useRef<string | null>(null),
    sending = useRef(false)
  scope.current = `${session?.user.id ?? ''}:${id ?? ''}`
  useEffect(() => {
    setSync(initialSync(navigator.onLine))
    if (id && session) {
      try {
        setPending(readPending(sessionStorage, session.user.id, id))
      } catch {
        /* The in-memory receipt remains available if storage is blocked. */
      }
    }
  }, [id, session?.user.id])
  useEffect(() => {
    const updateOnline = () => setSync((s) => ({ ...s, online: navigator.onLine }))
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])
  useEffect(() => {
    const update = (s: Session | null) => {
      if (user.current !== (s?.user.id ?? null)) {
        user.current = s?.user.id ?? null
        scope.current = ''
        setId(null)
        setView(null)
        setPending(null)
        setInvite('')
        setError('')
        setCorrecting(false)
        setCampaigns([])
        setChoosing(false)
        setCreating(false)
        setRecovering(false)
        setMembershipReady(false)
        setMembershipFailed(false)
      }
      setSession(s)
      setAuthReady(true)
    }
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      update(s)
      try {
        if (event === 'PASSWORD_RECOVERY' && s) sessionStorage.setItem(RECOVERY_KEY, s.user.id)
        if (!s) sessionStorage.removeItem(RECOVERY_KEY)
        setRecovering(!!s && sessionStorage.getItem(RECOVERY_KEY) === s.user.id)
      } catch {
        if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    let cancelled = false
    setMembershipReady(false)
    setMembershipFailed(false)
    const loadMemberships = async () => {
      try {
        const { data, error } = await supabase
          .from('campaign_members')
          .select('campaign_id,side,campaigns(id,name)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
        if (cancelled || user.current !== session.user.id) return
        if (error) throw error
        const choices: CampaignChoice[] = (data ?? []).map((m) => {
          const c = m.campaigns as unknown as { id: string; name: string } | null
          return { id: m.campaign_id as string, name: c?.name ?? 'Кампания', side: m.side as Side }
        })
        setCampaigns(choices)
        let remembered: string | null = null
        try {
          remembered = localStorage.getItem(campaignKey(session.user.id))
        } catch {
          /* optional preference */
        }
        const activeId = scope.current.slice(scope.current.indexOf(':') + 1)
        const selected = initialCampaign(choices, activeId || remembered)
        if (selected && selected !== activeId) {
          scope.current = `${session.user.id}:${selected}`
          setId(selected)
          setView(null)
          setInvite('')
        } else if (!selected) {
          scope.current = `${session.user.id}:`
          setId(null)
          setView(null)
          setInvite('')
          setChoosing(choices.length > 0)
        }
        setMembershipReady(true)
      } catch (e) {
        if (cancelled || user.current !== session.user.id) return
        setError(e as Error)
        setMembershipFailed(true)
        setMembershipReady(true)
      }
    }
    void loadMemberships()
    return () => {
      cancelled = true
    }
  }, [session?.user.id, membershipAttempt])
  const selectCampaign = (next: string) => {
    if (!session || user.current !== session.user.id || sending.current || pending) return
    if (next === id && view?.id === next) {
      setChoosing(false)
      setCreating(false)
      setTab('overview')
      return
    }
    scope.current = `${session.user.id}:${next}`
    setId(next)
    setView(null)
    setInvite('')
    setError('')
    setCorrecting(false)
    setTab('overview')
    setChoosing(false)
    setCreating(false)
    try {
      localStorage.setItem(campaignKey(session.user.id), next)
    } catch {
      /* optional preference */
    }
  }
  useEffect(() => {
    if (!session || !view) return
    try {
      clearFinishedDrafts(localStorage, session.user.id, view as unknown as State, side)
    } catch {
      /* storage may be unavailable */
    }
  }, [session?.user.id, view, side])
  const call = useCallback(async (body: Record<string, unknown>) => {
    const started = scope.current
    if (started !== `${user.current ?? ''}:${String(body.campaignId)}`)
      throw new CampaignRequestError('Кампания изменена', false)
    const { data, error } = await supabase.functions.invoke('campaign-engine', { body })
    if (started !== scope.current)
      throw new CampaignRequestError('Сессия или кампания изменена', false)
    if (error) {
      let m = error.message
      let status: number | undefined
      let code: string | undefined
      if ('context' in error) {
        status = (error.context as Response)?.status
        try {
          const body = await (error.context as Response).json()
          m = body.error ?? m
          code = body.code
        } catch {
          /* A network failure has no response body. */
        }
      }
      throw new CampaignRequestError(m, retryableStatus(status), status, code)
    }
    if (data?.error) throw Error(data.error)
    if (data?.state) {
      if (data.state.id !== body.campaignId)
        throw new CampaignRequestError('Получено состояние другой кампании', false)
      setView((old) =>
        !old || old.id !== data.state.id || data.state.version >= old.version ? data.state : old,
      )
      setSide(data.side)
      const now = Date.now()
      setSync((s) => ({
        ...s,
        lastLoad: now,
        lastCommit: body.command ? now : s.lastCommit,
        unavailable: false,
        refreshing: false,
      }))
    }
    return data
  }, [])
  const load = useCallback(async () => {
    if (!id) return
    const started = scope.current
    if (started !== `${user.current ?? ''}:${id}`) return
    try {
      await call({ campaignId: id })
      const [campaign, members] = await Promise.all([
        supabase.from('campaigns').select('invite_code').eq('id', id).single(),
        supabase.from('campaign_members').select('side').eq('campaign_id', id),
      ])
      if (started !== scope.current) return
      if (campaign.data) setInvite(campaign.data.invite_code)
      setSync((s) =>
        members.error || !members.data
          ? { ...s, metadataFailed: true }
          : {
              ...s,
              members: members.data.map((m) => m.side as Side),
              membersChecked: Date.now(),
              metadataFailed: false,
            },
      )
    } catch (e) {
      if (started === scope.current) {
        setError(e as Error)
        setSync((s) => ({ ...s, unavailable: true, refreshing: false }))
      }
    }
  }, [id, call])
  const libraryApi: LibraryAPI = useCallback(
    async (action, payload = {}) => {
      if (!id) throw Error('Кампания не выбрана')
      return call({ campaignId: id, action, ...payload })
    },
    [id, call],
  )
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!id) return
    let disposed = false
    setSync((s) => ({ ...s, realtime: 'connecting' }))
    const channel = supabase
      .channel(`v221:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_versions',
          filter: `campaign_id=eq.${id}`,
        },
        (payload) => {
          if (disposed) return
          if ('version' in payload.new && Number(payload.new.version) > viewVersion.current)
            setSync((s) => ({ ...s, refreshing: true }))
          void load()
        },
      )
      .subscribe((status) => {
        if (disposed) return
        setSync((s) => ({
          ...s,
          realtime:
            status === 'SUBSCRIBED'
              ? 'connected'
              : status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
                ? 'fallback'
                : 'connecting',
        }))
        if (status === 'SUBSCRIBED') void load()
      })
    const onFocus = () => load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const poll = window.setInterval(onVisible, 30000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [id, load])
  const send: Send = async (type, payload = {}) => {
    if (!id || !view || pending || sending.current) return false
    if (!navigator.onLine) {
      setError('Нет интернета')
      return false
    }
    sending.current = true
    const started = scope.current
    setBusy(true)
    setError('')
    const body = {
      campaignId: id,
      requestId: crypto.randomUUID(),
      expectedVersion: view.version,
      command: { type, payload } satisfies Command,
    }
    const receiptKey = pendingKey(session!.user.id, id)
    try {
      sessionStorage.setItem(receiptKey, JSON.stringify(body))
    } catch {
      /* In-memory retry remains available if storage is blocked. */
    }
    try {
      await call(body)
      setPending(null)
      try {
        sessionStorage.removeItem(receiptKey)
      } catch {
        /* optional storage */
      }
      return true
    } catch (e) {
      if (started !== scope.current) return false
      setError(e as Error)
      const uncertain = !(e instanceof CampaignRequestError) || e.retryable
      setPending(uncertain ? body : null)
      if (uncertain) {
        try {
          sessionStorage.setItem(receiptKey, JSON.stringify(body))
        } catch {
          /* In-memory retry still uses the same UUID. */
        }
      } else {
        try {
          sessionStorage.removeItem(receiptKey)
        } catch {
          /* optional storage */
        }
      }
      await load()
      return false
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const retry = async () => {
    if (!pending || sending.current) return
    sending.current = true
    const started = scope.current
    setBusy(true)
    try {
      await call(pending as Record<string, unknown>)
      setPending(null)
      try {
        sessionStorage.removeItem(pendingKey(user.current!, id!))
      } catch {
        /* optional storage */
      }
      setError('')
    } catch (e) {
      if (started === scope.current) {
        setError(e as Error)
        if (e instanceof CampaignRequestError && !e.retryable && e.status !== 401) {
          setPending(null)
          try {
            sessionStorage.removeItem(pendingKey(user.current!, id!))
          } catch {
            /* optional storage */
          }
        }
        await load()
      }
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const help = errorHelp(error, !!pending, sync.online)
  const alert = (error || !!pending) && (
    <div role="alert" className="toast">
      <span>{help.text}</span>
      {!!pending && (
        <button className="quiet" disabled={busy} onClick={retry}>
          Проверить прежнюю отправку
        </button>
      )}
      {help.action === 'signin' && (
        <button className="quiet" onClick={() => supabase.auth.signOut()}>
          Войти снова
        </button>
      )}
      {help.action === 'refresh' && !pending && (
        <button className="quiet" onClick={load}>
          Обновить состояние
        </button>
      )}
      {(help.action === 'stage' || help.action === 'refresh') && view && (
        <button
          className="quiet"
          onClick={() =>
            setTab(
              view.phase === 'strategy' || view.phase === 'reaction'
                ? 'strategy'
                : view.phase === 'logistics'
                  ? 'logistics'
                  : 'battle',
            )
          }
        >
          Открыть текущий этап
        </button>
      )}
      <button className="quiet" aria-label="Закрыть уведомление" onClick={() => setError('')}>
        ×
      </button>
    </div>
  )
  if (!authReady) return <div className="center">Загрузка…</div>
  if (!session)
    return (
      <>
        {alert}
        <Auth onError={setError} />
      </>
    )
  if (recovering)
    return (
      <>
        {alert}
        <PasswordRecovery
          onError={setError}
          done={() => {
            try {
              sessionStorage.removeItem(RECOVERY_KEY)
            } catch {
              /* optional marker */
            }
            setRecovering(false)
          }}
        />
      </>
    )
  if (!membershipReady) return <div className="center">Загрузка списка кампаний…</div>
  if (membershipFailed)
    return (
      <>
        {alert}
        <div className="center">
          <button onClick={() => setMembershipAttempt((n) => n + 1)}>
            Повторить загрузку кампаний
          </button>
        </div>
      </>
    )
  if (!id || choosing || creating)
    return (
      <>
        {alert}
        {campaigns.length > 0 && !creating ? (
          <div className="center">
            <section className="login">
              <h1>Выберите кампанию</h1>
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  className="quiet campaign-choice"
                  onClick={() => selectCampaign(c.id)}
                >
                  {c.name}
                  <small>
                    {labels[c.side]}
                    {id === c.id ? ' · текущая' : ''}
                  </small>
                </button>
              ))}
              <button onClick={() => setCreating(true)}>Создать или присоединиться</button>
              <button className="quiet" onClick={() => supabase.auth.signOut()}>
                Выйти
              </button>
            </section>
          </div>
        ) : (
          <>
            {campaigns.length > 0 && (
              <button className="quiet" onClick={() => setCreating(false)}>
                ← К списку кампаний
              </button>
            )}
            <Gate
              ready={(next) => {
                selectCampaign(next)
                setMembershipAttempt((n) => n + 1)
              }}
              onError={setError}
            />
            {campaigns.length === 0 && (
              <button className="quiet" onClick={() => supabase.auth.signOut()}>
                Выйти
              </button>
            )}
          </>
        )}
      </>
    )
  if (!view)
    return (
      <>
        {alert}
        <div className="center">
          <div>
            <p>Загрузка кампании…</p>
            <button onClick={load}>Обновить</button>
          </div>
        </div>
      </>
    )
  const s = view as unknown as State,
    stage = STAGES[s.stage],
    p = s.players[side],
    nav = [
      ['overview', Shield, 'Сводка'],
      ['strategy', Footprints, 'Стратегия'],
      ['map', Map, 'Карта'],
      ['roster', Users, 'Армия'],
      ['catalog', BookOpen, 'Каталог'],
      ['battle', Swords, 'Текущий бой'],
      ['logistics', Shield, 'Logistics'],
      ['history', BookOpen, 'История'],
      ['rules', BookOpen, 'Правила'],
    ] as const
  return (
    <DraftUser.Provider value={session.user.id}>
      <div className="app">
        <aside>
          <div className="brand">
            <Skull />
            <div>
              BLACK
              <br />
              SEPULCHRE
            </div>
          </div>
          <span className={`faction ${side}`}>{labels[side]}</span>
          <nav>
            {nav.map(([key, Icon, label]) => (
              <button
                key={key}
                className={tab === key ? 'selected' : 'quiet'}
                onClick={() => setTab(key)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          <div className="aside-bottom">
            <small>Правила 2.2.1 · состояние {s.version}</small>
            <button
              className="quiet"
              disabled={busy || !!pending}
              onClick={() => {
                setChoosing(true)
                setMembershipAttempt((n) => n + 1)
              }}
              title={
                pending
                  ? 'Сначала восстановите ответ на последнюю отправку'
                  : 'Выбрать другую кампанию'
              }
            >
              Сменить кампанию
            </button>
            <button
              className="quiet"
              disabled={busy || !!pending}
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </aside>
        <main className="content">
          {alert}
          <header>
            <div>
              <p className="eyebrow">KHARON SECUNDUS · {phases[s.phase]}</p>
              <h1>{s.name}</h1>
            </div>
            <div className="toolbar">
              <button
                className="quiet"
                onClick={() => navigator.clipboard.writeText(invite)}
                title="Скопировать код приглашения"
              >
                Код: {invite}
              </button>
              <button className="quiet" aria-label="Обновить состояние" onClick={load}>
                <RefreshCw size={18} className={busy ? 'spin' : ''} />
              </button>
            </div>
          </header>
          <SyncStatus sync={sync} pending={!!pending} side={side} />
          <div className="statusline">
            <span>Бой {Math.min(18, s.battles + 1)} / 18</span>
            <span>AL {stage.al}</span>
            <span>Supply {p.supply}</span>
            <span>Intel {p.intel}</span>
            <span>Recovery {p.recovery}</span>
            <span>Choir {s.choir}/8</span>
            {p.debt > 0 && <span>Аварийный долг {p.debt}</span>}
          </div>
          <Suspense
            fallback={
              <p className="panel" role="status">
                Загрузка раздела…
              </p>
            }
          >
            <fieldset className="workspace" disabled={busy || !!pending}>
              <NextStep s={s} side={side} navigate={setTab} />
              {s.correctionProposal && (
                <section className="panel" id="correction-panel">
                  <h2>Предложена коррекция последнего результата</h2>
                  <p>
                    Зависимые действия приостановлены. После общего согласия они будут отменены и
                    последствия боя пересчитаны из прежнего состояния.
                  </p>
                  <p>
                    VP Deathwatch {s.correctionProposal.report.vp.deathwatch} : Necrons{' '}
                    {s.correctionProposal.report.vp.necrons}
                  </p>
                  <p>{s.correctionProposal.report.narrative}</p>
                  {s.correctionProposal.report.units.map((r) => (
                    <p key={r.id}>
                      {s.units.find((u) => u.id === r.id)?.name}:{' '}
                      {r.entered ? 'участвовал' : 'не вошёл'}
                      {r.destroyed ? ' · уничтожен' : ''}
                      {r.deed ? ` · ${r.deed}` : ''}
                    </p>
                  ))}
                  <button
                    disabled={s.correctionProposal.approved.includes(side)}
                    onClick={() => {
                      send('approve_correction')
                      setCorrecting(false)
                    }}
                  >
                    Согласовать откат и новую ревизию
                  </button>
                  <button className="quiet" onClick={() => send('cancel_correction')}>
                    Отклонить
                  </button>
                </section>
              )}
              {s.flags.correctionAvailable && !s.correctionProposal && (
                <details className="panel">
                  <summary>Исправить последний результат</summary>
                  <button className="quiet" onClick={() => setCorrecting(!correcting)}>
                    {correcting ? 'Закрыть редактор' : 'Подготовить новую ревизию'}
                  </button>
                  {correcting && <ReportView s={s} side={side} send={send} correction />}
                </details>
              )}
              <div id="stage-panel">
                {tab === 'history' ? (
                  <HistoryView key={s.id} s={s} side={side} />
                ) : tab === 'catalog' ? (
                  <CatalogView s={s} side={side} send={send} api={libraryApi} />
                ) : s.phase === 'setup' ? (
                  <SetupView
                    s={s}
                    side={side}
                    send={send}
                    members={
                      sync.metadataFailed ||
                      !sync.online ||
                      !sync.membersChecked ||
                      Date.now() - sync.membersChecked > 45000
                        ? null
                        : sync.members
                    }
                  />
                ) : (
                  <>
                    {tab === 'overview' && (
                      <>
                        <div className="hero">
                          <div>
                            <p className="eyebrow">
                              {s.phase === 'terminal' ? 'ЭПИЛОГ' : 'СЛЕДУЮЩИЙ ШАГ'}
                            </p>
                            <h2>{phases[s.phase]}</h2>
                            <p>
                              {s.phase === 'strategy'
                                ? `Действует ${labels[s.active]}. ${s.activation?.actions} Actions · ${s.activation?.mp} MP.`
                                : s.phase === 'terminal'
                                  ? `Исход: ${s.winner === 'both_win' ? 'CONCORDAT — общая победа' : s.winner === 'both_lose' ? 'Общее поражение' : labels[s.winner as Side]}`
                                  : 'Решения и расчёты сохраняются для обоих игроков.'}
                            </p>
                            <button
                              onClick={() =>
                                setTab(
                                  s.phase === 'strategy' || s.phase === 'reaction'
                                    ? 'strategy'
                                    : s.phase === 'logistics'
                                      ? 'logistics'
                                      : 'battle',
                                )
                              }
                            >
                              Перейти к текущему этапу
                            </button>
                          </div>
                          <div className="hero-stats">
                            <strong>{p.mf}</strong>
                            <span>Main Force</span>
                            <strong>{p.integrity}</strong>
                            <span>Integrity Home</span>
                            <strong>{p.fragments}/3</strong>
                            <span>Fragments</span>
                          </div>
                        </div>
                        <CampaignMap s={s} side={side} />
                        <button className="quiet" onClick={() => setTab('history')}>
                          История кампании · {s.log.length} записей
                        </button>
                      </>
                    )}
                    {tab === 'map' && <CampaignMap s={s} side={side} />}
                    {tab === 'strategy' && <StrategyView s={s} side={side} send={send} />}
                    {tab === 'roster' && <RosterView s={s} side={side} send={send} />}
                    {tab === 'battle' && <BattleView s={s} side={side} send={send} />}
                    {tab === 'logistics' && <LogisticsView s={s} side={side} send={send} />}
                    {tab === 'rules' && (
                      <Suspense fallback={<p>Загрузка свода…</p>}>
                        <ReferenceView s={s} />
                      </Suspense>
                    )}
                  </>
                )}
              </div>
            </fieldset>
          </Suspense>
        </main>
      </div>
    </DraftUser.Provider>
  )
}
