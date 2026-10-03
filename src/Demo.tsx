import { Suspense, useState } from 'react'
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
export default function Demo() {
  const [s, setS] = useState(fixture),
    [side, setSide] = useState<Side>('deathwatch'),
    [tab, setTab] = useState('strategy'),
    [error, setError] = useState('')
  const view = project(s, side) as unknown as State
  const send: Send = async (type, payload = {}) => {
    try {
      setS(command(s, { type, payload }, context(side)))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const load = (mode: string) => {
    const next = fixture()
    if (mode === 'setup') next.phase = 'setup'
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
        {['strategy', 'battle', 'logistics', 'roster', 'rules', 'map'].map((t) => (
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
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <p>
        {s.phase} · State {s.version} · Supply {s.players[side].supply}
      </p>
      {s.phase === 'setup' ? (
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
