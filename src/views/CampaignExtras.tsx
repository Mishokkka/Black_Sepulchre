import { useState } from 'react'
import type { Snapshot } from '../../shared/model'
import { home, STAGES } from '../../shared/rules'
import { Check, type Props } from './CampaignViews'
import { labels } from '../App'
export function CatalogManager({ s, send }: Props) {
  const [text, setText] = useState(''),
    [error, setError] = useState('')
  const canSave = !s.battle && ['setup', 'strategy', 'logistics'].includes(s.phase)
  return (
    <details className="panel">
      <summary>Расширенные настройки каталога</summary>
      <p>
        Изменения сохраняются сразу для обоих игроков между боями. Объявленный бой сохраняет свои
        цены и карточки. Для обычного добавления юнита используйте редактор во вкладке «Каталог».
      </p>
      {s.snapshotProposal && (
        <div className="notice">
          <p>В старом интерфейсе осталось несохранённое обновление каталога.</p>
          <button disabled={!canSave} onClick={() => send('approve_snapshot')}>
            Сохранить обновление
          </button>
          <button className="quiet" onClick={() => send('cancel_snapshot')}>
            Отменить
          </button>
        </div>
      )}
      <button className="quiet" onClick={() => setText(JSON.stringify(s.snapshot, null, 2))}>
        Открыть текущий каталог для редактирования
      </button>
      {text && (
        <>
          <textarea
            aria-label="Каталог юнитов"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <button
            disabled={!canSave}
            onClick={async () => {
              try {
                const snapshot = JSON.parse(text) as Snapshot
                const ok = await send('save_catalog', { snapshot })
                if (ok !== false) {
                  setText('')
                  setError('')
                }
              } catch {
                setError('Проверьте JSON каталога')
              }
            }}
          >
            Сохранить каталог
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
