import { useState } from 'react'
import type { Snapshot } from '../../shared/model'
import { home, STAGES } from '../../shared/rules'
import { Check, type Props } from './CampaignViews'
import { labels } from '../App'
export function SnapshotManager({ s, side, send }: Props) {
  const [text, setText] = useState(''),
    [error, setError] = useState('')
  return (
    <details className="panel">
      <summary>Season Snapshot · согласованное обновление</summary>
      <p>
        Новый каталог вступит в силу после подтверждения обоими. Цены того же состава
        пересчитываются бесплатно. Исчезнувший datasheet сохраняет ID, опыт и прежний RC до выбора
        successor либо архива. Объявленный бой использует свой неизменяемый Snapshot.
      </p>
      {s.snapshotProposal ? (
        <>
          <p>
            Предложен {s.snapshotProposal.snapshot.id} · {s.snapshotProposal.snapshot.date}
          </p>
          <p>Подтверждения: {s.snapshotProposal.approved.map((v) => labels[v]).join(', ')}</p>
          <pre className="snapshot-preview">
            {JSON.stringify(s.snapshotProposal.snapshot, null, 2)}
          </pre>
          <div className="buttons">
            <button
              disabled={s.snapshotProposal.approved.includes(side)}
              onClick={() => send('approve_snapshot')}
            >
              Принять общий Snapshot
            </button>
            <button className="quiet" onClick={() => send('cancel_snapshot')}>
              Отклонить предложение
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="quiet" onClick={() => setText(JSON.stringify(s.snapshot, null, 2))}>
            Открыть текущий каталог для обновления
          </button>
          <textarea
            aria-label="Новый Snapshot"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <button
            disabled={!!s.battle || !text}
            onClick={() => {
              try {
                const snapshot = JSON.parse(text) as Snapshot
                setError('')
                send('propose_snapshot', { snapshot })
              } catch {
                setError('Проверьте JSON каталога')
              }
            }}
          >
            Предложить обоим игрокам
          </button>
        </>
      )}
    </details>
  )
}
export function STFManager({ s, side, send }: Props) {
  const p = s.players[side]
  return (
    <details className="panel">
      <summary>Optional Strike Task Force</summary>
      <p>
        После 8 боёв, по общему согласию. Пустой roster за 250 Supply в Home. RC cap{' '}
        {STAGES[s.stage].al * 0.75}, deployment {STAGES[s.stage].al * 0.5}. Один ход Force на
        игрока; STF не заменяет MF в кризисе и осадах.
      </p>
      <Check
        label="Согласен включить STF для этой кампании"
        value={s.flags[`stfVote:${side}`] === true}
        change={(enabled) => send('enable_stf', { enabled })}
      />
      <p>{s.flags.stfEnabled ? 'Оба согласны' : 'Ожидается согласие обоих'}</p>
      {p.stf ? (
        <p>Ваша STF: {p.stf}</p>
      ) : (
        <button
          disabled={!s.flags.stfEnabled || s.battles < 8 || p.mf !== home(side) || p.supply < 250}
          onClick={() => send('create_stf')}
        >
          Создать пустую STF · 250 Supply
        </button>
      )}
    </details>
  )
}
