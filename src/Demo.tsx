import { Suspense, useState, useCallback } from 'react'
import { fixture, context } from '../tests/fixture'
import { command, project } from '../shared/engine'
import { declareBattle } from '../shared/battle'
import type { Side, State } from '../shared/model'
import {
  CampaignMap,
  LogisticsView,
  RosterView,
  SetupView,
  StrategyView,
  ReferenceView,
} from './views/CampaignViews'
import { BattleView } from './views/BattleView'
import type { Send } from './App'
import { CatalogView, type LibraryAPI, type LibraryEntry } from './views/CatalogView'
import { parseNewRecruit } from '../shared/datasheets'
export default function Demo() {
  const [s, setS] = useState(() => fixture(true)),
    [side, setSide] = useState<Side>('deathwatch'),
    [tab, setTab] = useState('strategy'),
    [error, setError] = useState('')
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
    try {
      setS(command(s, { type, payload }, context(side)))
      setError('')
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  const load = (mode: string) => {
    const next = fixture(true)
    if (mode === 'setup') {
      next.phase = 'setup'
      next.setupApproved = []
    }
    if (mode === 'battle') {
      next.players.deathwatch.mf = 'D'
      next.players.necrons.mf = 'F'
      declareBattle(next, 'F', 'deathwatch', false, context())
    }
    if (mode === 'logistics') {
      next.phase = 'logistics'
      next.activation!.logistics = ['deathwatch', 'necrons']
    }
    setS(next)
    setTab(mode === 'battle' ? 'battle' : mode === 'logistics' ? 'logistics' : 'strategy')
  }
  return (
    <main className="content" style={{ margin: 0, width: '100%' }}>
      <header>
        <div>
          <p className="eyebrow">ЛОКАЛЬНАЯ ПРОВЕРКА · БАЗА НЕ ИЗМЕНЯЕТСЯ</p>
          <h1>The Black Sepulchre</h1>
        </div>
        <select
          aria-label="Сторона проверки"
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
        >
          <option value="deathwatch">Deathwatch</option>
          <option value="necrons">Necrons</option>
        </select>
      </header>
      <div className="buttons">
        {['strategy', 'battle', 'logistics', 'roster', 'rules', 'map', 'catalog'].map((t) => (
          <button className="quiet" key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        {['setup', 'battle', 'logistics'].map((m) => (
          <button className="quiet" key={m} onClick={() => load(m)}>
            Сценарий {m}
          </button>
        ))}
      </div>
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
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <p>
        {s.phase} · State {s.version} · Supply {s.players[side].supply}
      </p>
      {tab === 'catalog' ? (
        <CatalogView s={view} side={side} send={send} api={api} />
      ) : s.phase === 'setup' ? (
        <SetupView s={view} side={side} send={send} />
      ) : tab === 'battle' ? (
        <BattleView s={view} side={side} send={send} />
      ) : tab === 'logistics' ? (
        <LogisticsView s={view} side={side} send={send} />
      ) : tab === 'roster' ? (
        <RosterView s={view} side={side} send={send} />
      ) : tab === 'rules' ? (
        <Suspense fallback={<p>Загрузка…</p>}>
          <ReferenceView s={view} />
        </Suspense>
      ) : tab === 'map' ? (
        <CampaignMap s={view} side={side} />
      ) : (
        <StrategyView s={view} side={side} send={send} />
      )}
    </main>
  )
}
