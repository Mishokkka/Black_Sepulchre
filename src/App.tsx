import { Suspense, useCallback, useEffect, useState } from 'react'
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
function Auth({ onError }: { onError: (m: string) => void }) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <div className="center">
      <section className="login">
        <Skull size={38} />
        <p className="eyebrow">THE BLACK SEPULCHRE · 2.2.1</p>
        <h1>Война за Kharon Secundus</h1>
        <p>Два командира. Одна карта. Каждый бой оставляет след.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const r = signup
              ? await supabase.auth.signUp({ email, password })
              : await supabase.auth.signInWithPassword({ email, password })
            setBusy(false)
            if (r.error) onError(r.error.message)
            else if (signup && !r.data.session)
              onError('Подтвердите адрес через письмо, затем войдите.')
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button disabled={busy}>{signup ? 'Создать аккаунт' : 'Войти'}</button>
        </form>
        <button className="quiet" onClick={() => setSignup(!signup)}>
          {signup ? 'Уже есть аккаунт' : 'Регистрация'}
        </button>
        <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
          Открыть правила 2.2.1
        </a>
      </section>
    </div>
  )
}
function Gate({ ready, onError }: { ready: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState('The Black Sepulchre'),
    [display, setDisplay] = useState('Commander'),
    [side, setSide] = useState<Side>('deathwatch'),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false)
  const run = async (join: boolean) => {
    setBusy(true)
    const r = join
      ? await supabase.rpc('v221_join_campaign', {
          p_invite_code: code.toUpperCase(),
          p_display_name: display,
        })
      : await supabase.rpc('create_campaign', {
          p_name: name,
          p_side: side,
          p_display_name: display,
        })
    setBusy(false)
    if (r.error) onError(r.error.message)
    else ready(r.data)
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
    [id, setId] = useState<string | null>(null),
    [view, setView] = useState<View | null>(null),
    [side, setSide] = useState<Side>('deathwatch'),
    [tab, setTab] = useState('overview'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(''),
    [pending, setPending] = useState<unknown>(null),
    [correcting, setCorrecting] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        setId(null)
        setView(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    supabase
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data?.length) setId(data[0].campaign_id)
      })
  }, [session])
  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('campaign-engine', { body })
    if (error) {
      let m = error.message
      if ('context' in error) {
        try {
          const body = await (error.context as Response).json()
          m = body.error ?? m
        } catch {
          /* A network failure has no response body. */
        }
      }
      throw Error(m)
    }
    if (data?.error) throw Error(data.error)
    if (data?.state) {
      setView((old) => (!old || data.state.version >= old.version ? data.state : old))
      setSide(data.side)
    }
    return data
  }, [])
  const load = useCallback(async () => {
    if (!id) return
    try {
      await call({ campaignId: id })
      const { data } = await supabase.from('campaigns').select('invite_code').eq('id', id).single()
      if (data) setInvite(data.invite_code)
    } catch (e) {
      setError((e as Error).message)
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
      .subscribe()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [id, load])
  const send: Send = async (type, payload = {}) => {
    if (!id || !view || busy) return
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
      setError((e as Error).message)
      setPending(body)
      await load()
      return false
    } finally {
      setBusy(false)
    }
  }
  const retry = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await call(pending as Record<string, unknown>)
      setPending(null)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const alert = error && (
    <div role="alert" className="toast">
      <span>{error}</span>
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
  if (!id)
    return (
      <>
        {alert}
        <Gate ready={setId} onError={setError} />
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
      ['rules', BookOpen, 'Правила'],
    ] as const
  return (
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
          <button className="quiet" onClick={() => supabase.auth.signOut()}>
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
        <fieldset className="workspace" disabled={busy}>
          {s.correctionProposal && (
            <section className="panel">
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
          {tab === 'catalog' ? (
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
                  <details className="panel">
                    <summary>История решений ({s.log.length})</summary>
                    {s.log
                      .slice(-30)
                      .reverse()
                      .map((l) => (
                        <div className="log-row" key={l.version}>
                          <span>#{l.version}</span>
                          <span>{labels[l.actor]}</span>
                          <span>{l.command}</span>
                          <small>
                            {l.dice.length ? `Кампанийные броски: ${l.dice.join(', ')}` : ''}
                          </small>
                        </div>
                      ))}
                  </details>
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
        </fieldset>
      </main>
    </div>
  )
}
