import { Auth, PasswordRecovery, RECOVERY_KEY } from './views/AuthView'
import { DraftUser } from './lib/useBattleDraft'
import { clearFinishedDrafts } from './lib/drafts'
import { campaignKey, initialCampaign, type CampaignChoice } from './lib/campaign-selection'
import { NextStep } from './views/NextStep'
import { HistoryView } from './views/HistoryView'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
import { CampaignRequestError, retryableStatus } from './lib/requests'
import type { Command, Side, State, View } from '../shared/model'
import { STAGES } from '../shared/rules'
import {
  CampaignMap,
  LogisticsView,
  ReferenceView,
  RosterView,
  SetupView,
  StrategyView,
} from './views/CampaignViews'
import { BattleView, ReportView } from './views/BattleView'
import { CatalogView, type LibraryAPI } from './views/CatalogView'
export type Send = (type: string, payload?: Record<string, unknown>) => Promise<void | boolean>
export const labels: Record<Side, string> = { deathwatch: 'Deathwatch', necrons: 'Necrons' }
export const phases: Record<string, string> = {
  setup: 'Подготовка кампании',
  strategy: 'Стратегический ход',
  reaction: 'Ответ на саботаж',
  mission: 'Выбор миссии',
  lock: 'Разведка',
  muster: 'Сбор армии',
  interdict: 'Interdict',
  assets: 'Боевые Assets',
  battle: 'Бой за столом',
  result: 'Подтверждение результата',
  aftermath: 'Последствия боя',
  logistics: 'Снабжение',
  finale_mode: 'Решение о финале',
  ending: 'Судьба планеты',
  terminal: 'Кампания завершена',
}
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
          <select value={side} onChange={(e) => setSide(e.target.value as Side)}>
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
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(''),
    [pending, setPending] = useState<unknown>(null),
    [correcting, setCorrecting] = useState(false),
    [membershipReady, setMembershipReady] = useState(false),
    [membershipFailed, setMembershipFailed] = useState(false),
    [membershipAttempt, setMembershipAttempt] = useState(0)
  const scope = useRef(''),
    user = useRef<string | null>(null),
    sending = useRef(false)
  scope.current = `${session?.user.id ?? ''}:${id ?? ''}`
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
        setError((e as Error).message)
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
      if ('context' in error) {
        status = (error.context as Response)?.status
        try {
          const body = await (error.context as Response).json()
          m = body.error ?? m
        } catch {
          /* A network failure has no response body. */
        }
      }
      throw new CampaignRequestError(m, retryableStatus(status))
    }
    if (data?.error) throw Error(data.error)
    if (data?.state) {
      if (data.state.id !== body.campaignId)
        throw new CampaignRequestError('Получено состояние другой кампании', false)
      setView((old) =>
        !old || old.id !== data.state.id || data.state.version >= old.version ? data.state : old,
      )
      setSide(data.side)
    }
    return data
  }, [])
  const load = useCallback(async () => {
    if (!id) return
    const started = scope.current
    if (started !== `${user.current ?? ''}:${id}`) return
    try {
      await call({ campaignId: id })
      const { data } = await supabase.from('campaigns').select('invite_code').eq('id', id).single()
      if (data && started === scope.current) setInvite(data.invite_code)
    } catch (e) {
      if (started === scope.current) setError((e as Error).message)
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
        () => load(),
      )
      .subscribe((status) => {
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
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [id, load])
  const send: Send = async (type, payload = {}) => {
    if (!id || !view || pending || sending.current) return false
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
    try {
      await call(body)
      setPending(null)
      return true
    } catch (e) {
      if (started !== scope.current) return false
      setError((e as Error).message)
      setPending(e instanceof CampaignRequestError && !e.retryable ? null : body)
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
      setError('')
    } catch (e) {
      if (started === scope.current) {
        setError((e as Error).message)
        if (e instanceof CampaignRequestError && !e.retryable) setPending(null)
        await load()
      }
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const alert = (error || !!pending) && (
    <div role="alert" className="toast">
      <span>
        {error || 'Ответ не получен. Проверьте прежнюю отправку перед следующим действием.'}
      </span>
      {!!pending && (
        <button className="quiet" disabled={busy} onClick={retry}>
          Повторить отправку
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
          <div className="statusline">
            <span>Бой {Math.min(18, s.battles + 1)} / 18</span>
            <span>AL {stage.al}</span>
            <span>Supply {p.supply}</span>
            <span>Intel {p.intel}</span>
            <span>Recovery {p.recovery}</span>
            <span>Choir {s.choir}/8</span>
            {p.debt > 0 && <span>Аварийный долг {p.debt}</span>}
          </div>
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
                <SetupView s={s} side={side} send={send} />
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
        </main>
      </div>
    </DraftUser.Provider>
  )
}
