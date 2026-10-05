import { Auth, PasswordRecovery, RECOVERY_KEY } from './views/AuthView'
import { DraftUser } from './lib/useBattleDraft'
import { clearFinishedDrafts } from './lib/drafts'
import { campaignKey, initialCampaign, type CampaignChoice } from './lib/campaign-selection'
import { CampaignShell } from './views/CampaignShell'
import { CampaignAccess, CampaignChooser } from './views/CampaignAccess'
import { ScreenLoading } from './views/ScreenLoading'
import { commandReceipt, type CommandReceipt } from './lib/command-receipt'
import type { PendingRequest } from './lib/requests'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Command, Side, State, View } from '../shared/model'
import type { Send } from './views/common'
import type { LibraryAPI } from './views/CatalogView'
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
  import('./views/StrategyView').then((m) => ({ default: m.StrategyView })),
)
const LogisticsView = lazy(() =>
  import('./views/LogisticsView').then((m) => ({ default: m.LogisticsView })),
)
const RosterView = lazy(() => import('./views/RosterView').then((m) => ({ default: m.RosterView })))
const BattleView = lazy(() => import('./views/BattleView').then((m) => ({ default: m.BattleView })))
const ResultCorrection = lazy(() =>
  import('./views/ResultCorrection').then((m) => ({ default: m.ResultCorrection })),
)
const CatalogView = lazy(() =>
  import('./views/CatalogView').then((m) => ({ default: m.CatalogView })),
)
const HistoryView = lazy(() =>
  import('./views/HistoryView').then((m) => ({ default: m.HistoryView })),
)
const OverviewView = lazy(() =>
  import('./views/OverviewView').then((m) => ({ default: m.OverviewView })),
)
const ReferenceView = lazy(() => import('./views/ReferenceView'))
function Gate({
  ready,
  onError,
  back,
}: {
  ready: (id: string) => void
  onError: (m: string) => void
  back?: () => void
}) {
  return (
    <CampaignAccess
      onError={onError}
      back={back}
      signOut={() => {
        void supabase.auth.signOut()
      }}
      run={async (join, { name, display, side, code }) => {
        const r = join
          ? await supabase.rpc('v221_join_campaign', {
              p_invite_code: code,
              p_display_name: display,
            })
          : await supabase.rpc('create_campaign', {
              p_name: name,
              p_side: side,
              p_display_name: display,
            })
        if (r.error) throw r.error
        ready(r.data)
        return undefined
      }}
    />
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
    [historyBattle, setHistoryBattle] = useState(''),
    [error, setError] = useState<Error | string>(''),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(''),
    [pending, setPending] = useState<PendingRequest | null>(null),
    [receipt, setReceipt] = useState<CommandReceipt | null>(null),
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
    setReceipt(null)
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
        setReceipt(null)
        setInvite('')
        setError('')
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
    setReceipt(null)
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
      const result = await call(body)
      if (started !== scope.current) return false
      setReceipt(commandReceipt(body, result?.state, side, Date.now()))
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
    if (!navigator.onLine) {
      setError('Нет интернета')
      return
    }
    sending.current = true
    const started = scope.current
    setBusy(true)
    try {
      const result = await call({ ...pending })
      if (started !== scope.current) return
      setReceipt(commandReceipt(pending, result?.state, side, Date.now()))
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
    <div role="alert" className={`toast${pending ? ' uncertain' : ''}`}>
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
  if (!authReady) return <ScreenLoading full label="Проверяем доступ…" />
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
  if (!membershipReady) return <ScreenLoading full label="Загрузка списка кампаний…" />
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
          <CampaignChooser
            campaigns={campaigns}
            current={id}
            choose={selectCampaign}
            create={() => setCreating(true)}
            signOut={() => {
              void supabase.auth.signOut()
            }}
          />
        ) : (
          <Gate
            back={campaigns.length > 0 ? () => setCreating(false) : undefined}
            ready={(next) => {
              selectCampaign(next)
              setMembershipAttempt((n) => n + 1)
            }}
            onError={setError}
          />
        )}
      </>
    )
  if (!view)
    return (
      <>
        {alert}
        <div className="screen-loading-center">
          <div className="campaign-loading">
            <ScreenLoading label="Загрузка кампании…" />
            <button className="quiet" onClick={load}>
              Повторить загрузку
            </button>
          </div>
        </div>
      </>
    )
  const s = view as unknown as State
  return (
    <DraftUser.Provider value={session.user.id}>
      <CampaignShell
        receipt={receipt}
        dismissReceipt={() => setReceipt(null)}
        s={s}
        side={side}
        tab={tab}
        navigate={(tab) => {
          if (tab === 'history') setHistoryBattle('')
          setTab(tab)
        }}
        sync={sync}
        pending={!!pending}
        busy={busy}
        invite={invite}
        refresh={load}
        alert={alert}
        utilities={
          <>
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
          </>
        }
      >
        <Suspense fallback={<ScreenLoading />}>
          <fieldset className="workspace" disabled={busy || !!pending}>
            {(s.correctionProposal || s.flags.correctionAvailable) && (
              <ResultCorrection key={`${s.id}:${side}`} s={s} side={side} send={send} />
            )}
            <div id="stage-panel">
              {tab === 'history' ? (
                <HistoryView
                  key={`${s.id}:${historyBattle}`}
                  s={s}
                  side={side}
                  initialBattle={historyBattle}
                />
              ) : tab === 'catalog' ? (
                <CatalogView
                  key={`${s.id}:${side}`}
                  s={s}
                  side={side}
                  send={send}
                  api={libraryApi}
                />
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
                    <OverviewView
                      s={s}
                      side={side}
                      navigate={setTab}
                      openHistory={(battle = '') => {
                        setHistoryBattle(battle)
                        setTab('history')
                      }}
                    />
                  )}
                  {tab === 'map' && <CampaignMap s={s} side={side} />}
                  {tab === 'strategy' && <StrategyView s={s} side={side} send={send} />}
                  {tab === 'roster' && <RosterView s={s} side={side} send={send} />}
                  {tab === 'battle' && <BattleView s={s} side={side} send={send} />}
                  {tab === 'logistics' && <LogisticsView s={s} side={side} send={send} />}
                  {tab === 'rules' && (
                    <Suspense fallback={<ScreenLoading label="Загрузка свода правил…" />}>
                      <ReferenceView s={s} />
                    </Suspense>
                  )}
                </>
              )}
            </div>
          </fieldset>
        </Suspense>
      </CampaignShell>
    </DraftUser.Provider>
  )
}
