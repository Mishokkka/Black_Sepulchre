import { useState } from 'react'
import { startingArmy } from '../../shared/setup'
import { starterChoices } from '../../shared/starting-catalogue'
import { entry } from '../../shared/rules'
import { modelLabel } from '../../shared/unit-choices'
import { UnitChoice } from './UnitChoice'
import { DatasheetView } from './DatasheetView'
import { Options, type Props } from './common'
import { SetupReadiness } from './SetupReadiness'
import type { Side } from '../../shared/model'
export function SetupView({ s, side, send, members }: Props & { members?: Side[] | null }) {
  const [catalog, setCatalog] = useState('')
  const rows = s.units.filter(
    (u) => u.side === side && u.location === 'field' && u.status === 'active',
  )
  const choices = starterChoices(s, side)
  const selected = choices.find((c) => c.id === catalog)
  let armyProblem = '',
    effective = rows.reduce((n, u) => n + u.rc, 0)
  try {
    effective = startingArmy(s, side).effective
  } catch (error) {
    armyProblem = error instanceof Error ? error.message : 'Проверьте состав'
  }
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">ПОДГОТОВКА КАМПАНИИ</p>
          <h2>Подготовьте стартовую армию</h2>
          <p>
            Играем по правилам 2.2.1 и текущим ценам сайта. Они уже приняты для вашей дружеской
            кампании. Выберите стартовый состав и detachment, затем отметьте готовность.
          </p>
        </div>
      </section>
      <SetupReadiness s={s} members={members} />
      <section className="panel">
        <h2>Ваш бесплатный старт</h2>
        <p>
          470–500 Effective. Нужен CHARACTER во главе армии. Один отряд — не дороже 200 RC; максимум
          две копии Battleline и одна остальных datasheet.
        </p>
        <Options
          label="Стартовый detachment"
          value={s.players[side].package[0] ?? ''}
          change={(id) => {
            if (id) void send('setup_package', { package: [id] })
          }}
          items={s.snapshot.detachments
            .filter((d) => !d.side || d.side === side)
            .map((d) => ({ id: d.id, name: `${d.name} · ${d.dp} DP` }))}
        />
        <small>
          На старте выбирается один detachment любой стоимости DP. Его правила применяются в битвах
          за столом.
        </small>
        {rows.map((u) => (
          <div className="unit-row" key={u.id}>
            <div>
              <strong>{u.name}</strong>
              <small>
                {entry(s, u).datasheet} · {modelLabel(entry(s, u).models)} · {u.rc} RC
              </small>
              <UnitChoice
                label={`Отряд: ${u.name}`}
                fixedDatasheet={entry(s, u).datasheet}
                side={side}
                value={u.catalogId}
                change={(id) => {
                  if (id) void send('setup_unit', { id: u.id, catalogId: id })
                }}
                catalog={s.snapshot.catalog.filter(
                  (c) => !c.epic && !c.keywords.includes('TITANIC') && c.rc <= 200,
                )}
              />
            </div>
            <button
              className="quiet"
              onClick={() => send('setup_unit', { id: u.id, remove: true })}
            >
              Убрать из старта
            </button>
          </div>
        ))}
        <p>
          Всего: <strong>{effective} Effective / 500</strong>
        </p>
        {armyProblem ? (
          <p className="notice">{armyProblem}</p>
        ) : (
          <p className="success">Стартовая армия подходит по правилам кампании.</p>
        )}
        <h3>Добавить другой отряд</h3>
        <p className="muted">
          Выберите тип отряда и размер. Бесплатное снаряжение собирается в New Recruit.
        </p>
        <UnitChoice
          label="Добавить отряд"
          side={side}
          catalog={choices}
          value={catalog}
          change={setCatalog}
          search
        />
        <button
          className="quiet"
          disabled={!selected}
          onClick={() =>
            send('setup_add', {
              catalogId: catalog,
              name: selected!.datasheet,
            })
          }
        >
          Добавить в старт
        </button>
        {selected && (
          <details className="choice">
            <summary>Характеристики отряда</summary>
            <DatasheetView card={selected.card} />
          </details>
        )}
        <button
          disabled={!!armyProblem || s.setupApproved.includes(side)}
          onClick={() => send('ready_army')}
        >
          {s.setupApproved.includes(side) ? 'Армия готова · ждём второго игрока' : 'Армия готова'}
        </button>
      </section>
    </>
  )
}
