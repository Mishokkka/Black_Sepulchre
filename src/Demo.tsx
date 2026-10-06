import { clearFinishedDrafts } from './lib/drafts'
import { DraftUser } from './lib/useBattleDraft'
import { CampaignShell } from './views/CampaignShell'
import { HistoryView } from './views/HistoryView'
import { OverviewView } from './views/OverviewView'
import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { fixture, context } from '../tests/fixture'
import { command, project } from '../shared/engine'
import { declareBattle } from '../shared/battle'
import { createTable } from '../shared/table'
import { musterCosts } from '../shared/muster'
import { SIDES } from '../shared/model'
import type { Side, State } from '../shared/model'
import { LogisticsView } from './views/LogisticsView'
import { RosterView } from './views/RosterView'
import { StrategyView } from './views/StrategyView'
import { BattleView } from './views/BattleView'
import type { Send } from './views/common'
import { CampaignMap } from './views/CampaignMap'
import { SetupView } from './views/SetupView'
import ReferenceView from './views/ReferenceView'
import { CatalogView, type LibraryAPI, type LibraryEntry } from './views/CatalogView'
import { parseNewRecruit } from '../shared/datasheets'
import { AuthForm } from './views/AuthForm'
import { CampaignAccess, CampaignChooser } from './views/CampaignAccess'
import { ScreenLoading } from './views/ScreenLoading'
import { commandReceipt, type CommandReceipt } from './lib/command-receipt'
import { errorHelp, type PendingRequest } from './lib/requests'
import { initialSync } from './lib/sync'
import { STAGES } from '../shared/rules'
import { ResultCorrection } from './views/ResultCorrection'

type PreviewTransport = 'normal' | 'offline' | 'slow' | 'lost' | 'conflict' | 'fallback'

export default function Demo() {
  const [s, setS] = useState(() => fixture(true)),
    [side, setSide] = useState<Side>('deathwatch'),
    [tab, setTab] = useState('strategy'),
    [historyBattle, setHistoryBattle] = useState(''),
    [error, setError] = useState(''),
    [accessPreview, setAccessPreview] = useState<
      'auth' | 'campaigns' | 'access' | 'loading' | null
    >(null)
  const [transport, setTransport] = useState<PreviewTransport>('normal')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [receipt, setReceipt] = useState<CommandReceipt | null>(null)
  const [pending, setPending] = useState<{
    request: PendingRequest
    response: State
    committed: State
  } | null>(null)
  const [checkedAt, setCheckedAt] = useState(Date.now())
  useEffect(() => {
    try {
      clearFinishedDrafts(localStorage, `demo:${side}`, s, side)
    } catch {
      /* unavailable storage */
    }
  }, [s, side])
  const [imports, setImports] = useState<LibraryEntry[]>([])
  const api: LibraryAPI = useCallback(
    async (action, payload = {}) => {
      if (action === 'imports') return { imports: imports.filter((v) => v.data.side === side) }
      const text = String(payload.text),
        data = parseNewRecruit(text, String(payload.filename))
      if (data.side !== side) throw Error('Фракция не совпадает')
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
      )
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
      data.source.hash = hash
      const old = imports.find((i) => i.hash === hash)
      if (!old) setImports((v) => [{ hash, data, createdAt: new Date().toISOString() }, ...v])
      return { import: old?.data ?? data, reused: !!old }
    },
    [imports, side],
  )
  const view = project(s, side) as unknown as State
  const send: Send = async (type, payload = {}) => {
    if (sending.current || pending) return false
    setReceipt(null)
    if (transport === 'offline') {
      setError('Нет интернета.')
      return false
    }
    sending.current = true
    setBusy(true)
    setError('')
    const request: PendingRequest = {
      campaignId: s.id,
      requestId: crypto.randomUUID(),
      expectedVersion: s.version,
      command: { type, payload },
    }
    try {
      if (transport === 'slow') await new Promise((resolve) => setTimeout(resolve, 1200))
      if (transport === 'conflict') throw Error('STATE_CONFLICT: состояние изменилось.')
      const next = command(s, request.command, { ...context(side), id: () => crypto.randomUUID() })
      const response = project(next, side) as unknown as State
      if (transport === 'lost') {
        setPending({ request, response, committed: next })
        setError('Ответ не получен.')
        return false
      }
      setS(next)
      setCheckedAt(Date.now())
      setReceipt(commandReceipt(request, response, side, Date.now()))
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const retry = async () => {
    if (!pending || sending.current) return
    if (transport === 'offline') {
      setError('Нет интернета.')
      return
    }
    sending.current = true
    setBusy(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      // Return the cached acknowledgement for the same UUID; never apply the engine twice.
      setS(pending.committed)
      setReceipt(commandReceipt(pending.request, pending.response, side, Date.now()))
      setPending(null)
      setError('')
      setCheckedAt(Date.now())
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const load = (mode: string) => {
    if (sending.current || pending) return
    setReceipt(null)
    let next = fixture(true)
    next.id = crypto.randomUUID()
    if (['finale', 'war', 'pact'].includes(mode)) {
      next.battles = 17
      next.stage = STAGES.length - 1
      next.phase = 'finale_mode'
      next.activation = null
      next.finalModes = {}
      if (mode !== 'finale') {
        for (const who of SIDES)
          next = command(
            next,
            { type: 'finale_mode', payload: { mode: mode.toUpperCase() } },
            context(who),
          )
        next = command(
          next,
          { type: 'choose_mission', payload: { code: mode.toUpperCase() } },
          context('deathwatch'),
        )
        for (const who of SIDES)
          next = command(next, { type: 'mission_pass', payload: {} }, context(who))
        if (mode === 'war')
          for (const who of SIDES)
            next = command(next, { type: 'recon_lock', payload: { use: false } }, context(who))
      }
    }
    if (mode === 'routes') {
      next.players.deathwatch.mf = 'D'
      next.activation!.origin = 'D'
      next.players.deathwatch.intel = 3
      next.players.necrons.mf = 'H'
      next.sectors.D.fortified = true
      next.sectors.F.sabotaged = true
      const garrison = next.units.find((u) => u.side === 'necrons')!
      garrison.location = 'garrison'
      garrison.sector = 'F'
    }
    if (mode === 'setup') {
      next.phase = 'setup'
      next.setupApproved = []
    }
    if (mode === 'battle' || mode === 'muster') {
      next.players.deathwatch.mf = 'D'
      next.players.necrons.mf = 'F'
      declareBattle(next, 'F', 'deathwatch', false, context())
      if (mode === 'muster') {
        next.battle!.mission = 'F1'
        next.battle!.lock = { deathwatch: false, necrons: false }
        next.phase = 'muster'
      }
    }
    if (mode === 'logistics') {
      next = command(next, { type: 'end_strategy', payload: {} }, context())
      next.activation!.logistics = ['deathwatch', 'necrons']
      next.units.find((u) => u.side === 'deathwatch')!.damage = 2
      next.units.find((u) => u.side === 'deathwatch')!.recovery = 5
      next.players.deathwatch.recovery = 10
      next.players.deathwatch.inventory = ['cache']
      const own = next.units.filter((u) => u.side === 'deathwatch')
      own[1].evacDebt = 15
      own[1].flags.ammunitionDue = true
      own[1].xp = 5
      own[2].location = 'garrison'
      own[2].sector = 'B'
      own[2].flags.commission = true
      own[2].xp = 8
    }
    if (['live', 'live-start', 'result', 'aftermath', 'chronicle'].includes(mode)) {
      const live = mode === 'live' || mode === 'live-start'
      next.players.deathwatch.mf = 'D'
      next.players.necrons.mf = 'F'
      if (live) declareBattle(next, 'F', 'deathwatch', false, context())
      else declareBattle(next, 'X', 'deathwatch', false, context(), 'encounter')
      const b = next.battle!
      b.mission = live ? 'F1' : 'encounter'
      b.table = createTable(next, b.mission, context())
      b.table.round = mode === 'live-start' ? 1 : mode === 'live' ? 3 : 5
      b.table.step = mode === 'live-start' ? 'start' : mode === 'live' ? 'movement' : 'finished'
      b.table.vp =
        mode === 'live-start'
          ? { deathwatch: 0, necrons: 0 }
          : mode === 'live'
            ? { deathwatch: 18, necrons: 12 }
            : { deathwatch: 10, necrons: 5 }
      b.lock = { deathwatch: false, necrons: false }
      b.interdict = { deathwatch: null, necrons: null }
      for (const who of SIDES) {
        const units = next.units.filter((u) => u.side === who)
        b.muster[who] = {
          picks: units.map((u) => ({
            id: u.id,
            role: 'field',
            formation: u.id,
            transport: null,
            reserve: false,
            enhancement: null,
            honours: [],
            armoury: false,
            relic: false,
            redemption: null,
            protocol: null,
          })),
          rest: [],
          detachments: next.players[who].package,
          dispositions: [],
          commander: units.find(
            (u) => next.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
          )!.id,
        }
        Object.assign(b.costs, musterCosts(next, b.muster[who]!))
        b.assets[who] = { tactical: [], defensive: [], breach: [] }
      }
      next.phase = 'battle'
      if (!live)
        next = command(
          next,
          {
            type: 'submit_result',
            payload: {
              report: {
                vp: b.table.vp,
                units: next.units.map((u) => ({
                  id: u.id,
                  entered: true,
                  destroyed: u.id === next.units[0].id,
                  distinguished: u.id === b.muster.deathwatch!.commander,
                  withdrawn: false,
                  deed: u.id === next.units[1].id ? 'HOLD' : null,
                  casualtySources: [],
                })),
                facts: {},
                retreat: {},
                garrisonRetreat: null,
                withdrawal: [],
                narrative:
                  'Сигнал удержан. Assault Intercessors понесли потери, Bladeguard выполнили HOLD.',
              },
            },
          },
          context(),
        )
      if (mode === 'aftermath' || mode === 'chronicle') {
        next = command(next, { type: 'confirm_result', payload: {} }, context('necrons'))
        for (let i = 0; i < 2; i++) {
          const who = next.battle!.eventPass.length
            ? next.battle!.eventChooser === 'deathwatch'
              ? 'necrons'
              : 'deathwatch'
            : next.battle!.eventChooser
          next = command(next, { type: 'event_pass', payload: {} }, context(who))
        }
        for (let attempt = 0; attempt < 4 && !next.pendingAftermath; attempt++) {
          for (const ch of next.battle!.choices.filter((ch) => ch.value === undefined)) {
            next = command(
              next,
              {
                type: 'aftermath_choice',
                payload: {
                  key: ch.key,
                  value: ch.options.includes('skip') ? 'skip' : ch.options[0],
                  unit: ch.unitIds[0],
                  sector: ch.sectorKeys[0],
                },
              },
              context(ch.side),
            )
          }
          next = command(next, { type: 'preview_aftermath', payload: {} }, context())
        }
        if (mode === 'chronicle') {
          next = command(next, { type: 'confirm_aftermath', payload: {} }, context())
          next = command(next, { type: 'confirm_aftermath', payload: {} }, context('necrons'))
          // Generate later journal rows with real engine commands, not invented outcomes.
          const first = next.units.find((u) => u.side === 'deathwatch' && u.location === 'field')!
          next = command(next, { type: 'drill', payload: { ids: [first.id] } }, context())
        }
      }
    }
    setS(next)
    setError('')
    setHistoryBattle('')
    setTab(
      mode === 'chronicle'
        ? 'overview'
        : [
              'battle',
              'muster',
              'live',
              'live-start',
              'result',
              'aftermath',
              'finale',
              'war',
              'pact',
            ].includes(mode)
          ? 'battle'
          : mode === 'logistics'
            ? 'logistics'
            : 'strategy',
    )
  }
  if (accessPreview)
    return (
      <>
        <div className="demo-access-toolbar">
          <button
            className="quiet"
            onClick={() => {
              setAccessPreview(null)
              setError('')
            }}
          >
            ← Вернуться в локальную кампанию
          </button>
          <small>Локальная проверка форм · запросы авторизации не отправляются</small>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {accessPreview === 'auth' ? (
          <AuthForm
            onError={setError}
            authenticate={async (mode) => {
              await new Promise((resolve) => setTimeout(resolve, 250))
              return `Локальная проверка: ${mode === 'forgot' ? 'форма восстановления' : mode === 'signup' ? 'форма регистрации' : 'форма входа'} заполнена. Запрос в базу не отправлялся.`
            }}
            verifyRecovery={async () => {
              setError('Локальная проверка ссылки. Реальное восстановление здесь отключено.')
            }}
          />
        ) : accessPreview === 'campaigns' ? (
          <CampaignChooser
            campaigns={[
              { id: 'demo-1', name: 'The Black Sepulchre', side: 'deathwatch' },
              { id: 'demo-2', name: 'Кампания второго командира', side: 'necrons' },
            ]}
            current="demo-1"
            choose={() => {
              setAccessPreview(null)
              load('strategy')
            }}
            create={() => setAccessPreview('access')}
            signOut={() => setAccessPreview('auth')}
          />
        ) : accessPreview === 'loading' ? (
          <ScreenLoading full label="Загрузка списка кампаний…" />
        ) : (
          <CampaignAccess
            onError={setError}
            back={() => setAccessPreview('campaigns')}
            signOut={() => setAccessPreview('auth')}
            run={async (join) =>
              `Локальная проверка: ${join ? 'приглашение' : 'создание кампании'} заполнено. Кампания в базе не создавалась.`
            }
          />
        )}
      </>
    )
  return (
    <DraftUser.Provider key={side} value={`demo:${side}`}>
      <CampaignShell
        s={{ ...view, name: 'The Black Sepulchre' }}
        side={side}
        tab={tab}
        busy={busy}
        pending={!!pending}
        receipt={receipt}
        dismissReceipt={() => setReceipt(null)}
        sync={
          transport === 'normal' && !pending
            ? undefined
            : {
                ...initialSync(transport !== 'offline'),
                realtime: 'fallback',
                lastLoad: checkedAt,
                lastCommit: receipt?.at ?? null,
                members: SIDES.slice(),
                membersChecked: checkedAt,
                refreshing: busy,
              }
        }
        refresh={() => {
          setCheckedAt(Date.now())
          setError('')
        }}
        alert={
          (error || pending) && (
            <div role="alert" className={`toast${pending ? ' uncertain' : ''}`}>
              <span>{errorHelp(error, !!pending, transport !== 'offline').text}</span>
              {pending ? (
                <button
                  className="quiet"
                  disabled={busy || transport === 'offline'}
                  onClick={retry}
                >
                  Проверить прежнюю отправку
                </button>
              ) : (
                transport !== 'offline' && (
                  <button
                    className="quiet"
                    onClick={() => {
                      setCheckedAt(Date.now())
                      setError('')
                    }}
                  >
                    Обновить состояние
                  </button>
                )
              )}
              {!pending && (
                <button
                  className="quiet"
                  aria-label="Закрыть уведомление"
                  onClick={() => setError('')}
                >
                  ×
                </button>
              )}
            </div>
          )
        }
        navigate={(tab) => {
          if (tab === 'history') setHistoryBattle('')
          setTab(tab)
        }}
        utilities={
          <>
            <select
              aria-label="Сторона проверки"
              value={side}
              disabled={busy || !!pending}
              onChange={(e) => {
                setSide(e.target.value as Side)
                setReceipt(null)
              }}
            >
              <option value="deathwatch">Deathwatch</option>
              <option value="necrons">Necrons</option>
            </select>
          </>
        }
      >
        <details className="panel demo-controls">
          <summary>Локальные сценарии проверки · база не изменяется</summary>
          <label className="demo-transport">
            Связь проверки
            <select
              value={transport}
              disabled={busy}
              onChange={(e) => {
                setTransport(e.target.value as PreviewTransport)
                if (!pending) setError('')
                setCheckedAt(Date.now())
              }}
            >
              <option value="normal">Обычная локальная отправка</option>
              <option value="slow">Медленная отправка</option>
              <option value="lost">Решение сохранено, ответ потерян</option>
              <option value="offline">Нет интернета</option>
              <option value="conflict">Конфликт версии</option>
              <option value="fallback">Резервная синхронизация</option>
            </select>
            <small>Имитация транспорта в DEV. Запросы к серверу не отправляются.</small>
          </label>
          {pending && (
            <small className="demo-request">
              Проверяем тот же UUID: {pending.request.requestId} · исходная версия{' '}
              {pending.request.expectedVersion}
            </small>
          )}
          <fieldset className="workspace" disabled={busy || !!pending}>
            <div className="buttons">
              {[
                'strategy',
                'routes',
                'setup',
                'battle',
                'muster',
                'live',
                'live-start',
                'logistics',
                'result',
                'aftermath',
                'chronicle',
                'finale',
                'war',
                'pact',
              ].map((m) => (
                <button className="quiet" key={m} onClick={() => load(m)}>
                  Сценарий {m}
                </button>
              ))}
            </div>
            <div className="buttons">
              <button
                className="quiet"
                onClick={() => {
                  setError('')
                  setAccessPreview('auth')
                }}
              >
                Экран входа
              </button>
              <button
                className="quiet"
                onClick={() => {
                  setError('')
                  setAccessPreview('campaigns')
                }}
              >
                Выбор кампании
              </button>
              <button
                className="quiet"
                onClick={() => {
                  setError('')
                  setAccessPreview('access')
                }}
              >
                Создание кампании
              </button>
              <button
                className="quiet"
                onClick={() => {
                  setError('')
                  setAccessPreview('loading')
                }}
              >
                Состояние загрузки
              </button>
            </div>
          </fieldset>
        </details>
        <fieldset className="workspace" disabled={busy || !!pending}>
          <ResultCorrection key={`${s.id}:${side}`} s={view} side={side} send={send} />
          {tab === 'catalog' && (
            <button
              className="quiet"
              onClick={async () => {
                const examples =
                  side === 'necrons'
                    ? [
                        await import('../tests/fixtures/NecronsExample.json'),
                        await import('../tests/fixtures/NecronTeamExample.json'),
                      ]
                    : [
                        await import('../tests/fixtures/DeathwatchExample.json'),
                        await import('../tests/fixtures/DeathwatchTeamExample.json'),
                      ]
                setImports(
                  examples.map((x, i) => ({
                    hash: `demo-${side}-${i}`,
                    data: parseNewRecruit(JSON.stringify(x.default), `Demo ${side} ${i + 1}.json`),
                    createdAt: 'local',
                  })),
                )
              }}
            >
              Загрузить обезличенные примеры для проверки
            </button>
          )}
          <div id="stage-panel">
            {tab === 'history' ? (
              <HistoryView
                key={`${s.id}:${historyBattle}`}
                s={view}
                side={side}
                initialBattle={historyBattle}
              />
            ) : tab === 'catalog' ? (
              <CatalogView key={`${s.id}:${side}`} s={view} side={side} send={send} api={api} />
            ) : s.phase === 'setup' ? (
              <SetupView s={view} side={side} send={send} />
            ) : tab === 'battle' ? (
              <BattleView s={view} side={side} send={send} />
            ) : tab === 'logistics' ? (
              <LogisticsView s={view} side={side} send={send} />
            ) : tab === 'roster' ? (
              <RosterView s={view} side={side} send={send} />
            ) : tab === 'rules' ? (
              <Suspense fallback={<ScreenLoading label="Загрузка свода правил…" />}>
                <ReferenceView s={view} />
              </Suspense>
            ) : tab === 'overview' ? (
              <OverviewView
                s={view}
                side={side}
                navigate={setTab}
                openHistory={(battle = '') => {
                  setHistoryBattle(battle)
                  setTab('history')
                }}
              />
            ) : tab === 'map' ? (
              <CampaignMap s={view} side={side} />
            ) : (
              <StrategyView s={view} side={side} send={send} />
            )}
          </div>
        </fieldset>
      </CampaignShell>
    </DraftUser.Provider>
  )
}
