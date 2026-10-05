import { useState } from 'react'
import { SIDES, type Side } from '../../shared/model'
import { reportSideSummary } from '../../shared/battle-ui'
import { labels, type Props } from './common'
import { StatusBadge } from './StatusBadge'
import { ConfirmDialog } from './ConfirmDialog'
import { ReportView } from './ReportView'

export function ResultView({ s, side, send }: Props) {
  const b = s.battle!,
    [editingResult, setEditingResult] = useState(false),
    [confirm, setConfirm] = useState(false)
  if (!b.report) return null
  const outcome =
    b.outcome === 'draw'
      ? 'Ничья'
      : b.outcome === 'both_win'
        ? 'CONCORDAT'
        : b.outcome === 'both_lose'
          ? 'Общее поражение'
          : b.outcome
            ? 'Победа ' + labels[b.outcome]
            : 'Исход не определён'
  return (
    <section className="panel result-review" id="result-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">ОТЧЁТ НА ПОДТВЕРЖДЕНИИ</p>
          <h2>{outcome}</h2>
        </div>
        <StatusBadge tone={b.confirm.includes(side) ? 'info' : 'warning'}>
          {b.confirm.includes(side) ? 'Вы подтвердили' : 'Нужна ваша проверка'}
        </StatusBadge>
      </div>
      <p>
        Проверьте счёт, потери и направления отхода. Casualty и награды рассчитываются после
        согласования результата.
      </p>
      <div className="result-sides">
        {SIDES.map((who) => {
          const stats = reportSideSummary(b, b.report!, who)
          return (
            <div className="result-side" key={who} data-side={who}>
              <div className="section-head">
                <h3>{labels[who]}</h3>
                <strong className="result-vp">
                  {b.report!.vp[who]} <small>VP</small>
                </strong>
              </div>
              <div className="result-counts">
                <span>
                  Участвовали <b>{stats.entered}</b>
                </span>
                <span>
                  Уничтожены <b>{stats.destroyed}</b>
                </span>
                <span>
                  Эвакуированы <b>{stats.withdrawn}</b>
                </span>
                <span>
                  Deeds <b>{stats.deeds}</b>
                </span>
              </div>
              <ul className="result-units">
                {stats.rows.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>{b.before.find((u) => u.id === r.id)?.name ?? r.id}</strong>
                      <small>
                        {r.deed ? 'Deed ' + r.deed : 'Без Deed'}
                        {r.usedMedicae ? ' · Medicae' : ''}
                        {r.casualtySources.length ? ' · ' + r.casualtySources.join(', ') : ''}
                      </small>
                    </div>
                    <div className="result-unit-badges">
                      <StatusBadge
                        tone={
                          r.destroyed
                            ? 'danger'
                            : r.withdrawn
                              ? 'warning'
                              : !r.entered
                                ? 'info'
                                : 'ready'
                        }
                      >
                        {r.destroyed
                          ? 'Уничтожен'
                          : r.withdrawn
                            ? 'Эвакуирован'
                            : !r.entered
                              ? 'Не вошёл'
                              : 'Выжил'}
                      </StatusBadge>
                      {r.distinguished && <StatusBadge tone="warning">Distinguished</StatusBadge>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="result-retreat">
                Отход Force: <strong>{b.report!.retreat[who] ?? 'не указан / не требуется'}</strong>
              </p>
              <StatusBadge tone={b.confirm.includes(who) ? 'ready' : 'info'}>
                {b.confirm.includes(who) ? 'Подтверждено' : 'Ожидает подтверждения'}
              </StatusBadge>
            </div>
          )
        })}
      </div>
      {b.report.narrative && (
        <blockquote className="result-narrative">{b.report.narrative}</blockquote>
      )}
      <details>
        <summary>Условия победы, спасение и направления отхода</summary>
        {SIDES.map((who) => (
          <p key={who}>
            {labels[who]}: отход в {b.report?.retreat[who] ?? '—'}
            {b.type === 'PACT' &&
              ` · Channeler после Final Pulse: ${b.report?.facts[`prime_valid:${who}`] ? 'условия выполнены' : 'условия не выполнены'}`}
            {b.type === 'WAR' &&
              ` · живая модель с OC у Engine: ${b.report?.facts[`engine_alive_oc:${who}`] ? 'да' : 'нет'}`}
            {b.report?.facts[`first_destroyed:${who}`]
              ? ` · первый уничтоженный: ${s.units.find((u) => u.id === b.report?.facts[`first_destroyed:${who}`])?.name ?? '—'}`
              : ''}
          </p>
        ))}
        <p>Отход гарнизона: {b.report?.garrisonRetreat ?? '—'}</p>
        {/[AK]3/.test(b.mission ?? '') && (
          <p>
            Throne после hazards: {labels[b.report?.facts.throne_control as Side] ?? 'без контроля'}
          </p>
        )}
        {!!b.report?.facts.anchor_control && (
          <p>Anchor: {labels[b.report!.facts.anchor_control as Side]}</p>
        )}
        {!!b.report?.facts.stores_id && (
          <p>Hardened Stores: {s.units.find((u) => u.id === b.report?.facts.stores_id)?.name}</p>
        )}
      </details>

      <div className="phase-submit result-submit">
        <p>
          {b.confirm.includes(side)
            ? 'Ожидается подтверждение второго командира.'
            : 'Второе подтверждение запускает расчёт последствий.'}
        </p>
        <div className="buttons">
          <button
            className="primary"
            disabled={b.confirm.includes(side)}
            onClick={() => setConfirm(true)}
          >
            Проверить и подтвердить
          </button>
          <button className="quiet" onClick={() => setEditingResult(!editingResult)}>
            {editingResult ? 'Закрыть исправление' : 'Исправить отчёт'}
          </button>
        </div>
      </div>
      {editingResult && (
        <>
          <p className="muted">Новая отправка снимает прежнее подтверждение второго игрока.</p>
          <ReportView
            key={b.id + ':' + side + ':' + b.confirm.join(',')}
            s={s}
            side={side}
            send={send}
          />
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Подтвердить результат?"
        confirm="Подтвердить результат и потери"
        disabled={b.confirm.includes(side)}
        onConfirm={() => send('confirm_result')}
      >
        <p>
          <strong>
            {outcome} · {b.report.vp.deathwatch} : {b.report.vp.necrons} VP
          </strong>
        </p>
        {SIDES.map((who) => {
          const stats = reportSideSummary(b, b.report!, who)
          return (
            <p key={who}>
              {labels[who]}: уничтожены {stats.destroyed}, эвакуированы {stats.withdrawn}, Deeds{' '}
              {stats.deeds}.
            </p>
          )
        })}
        <p>
          После подтверждения обоих игроков движок сохранит броски потерь и перейдёт к последствиям
          боя. Они ещё не применены к армии.
        </p>
      </ConfirmDialog>
    </section>
  )
}
