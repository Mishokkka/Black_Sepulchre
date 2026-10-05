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
import { CheckCircle2, Shield, Trash2 } from 'lucide-react'
import { RuleHelp } from './RulesContext'
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
      <div className="setup-workspace">
        <section className="panel setup-composition">
          <h2>Ваш бесплатный старт</h2>
          <p>
            470–500 Effective. Нужен CHARACTER во главе армии. Один отряд — не дороже 200 RC;
            максимум две копии Battleline и одна остальных datasheet.
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
            На старте выбирается один detachment любой стоимости DP. Его правила применяются в
            битвах за столом.
          </small>
          {rows.map((u) => (
            <article className="setup-unit" key={u.id}>
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
                aria-label={`Убрать из старта: ${u.name}`}
                onClick={() => send('setup_unit', { id: u.id, remove: true })}
              >
                <Trash2 size={16} /> Убрать из старта
              </button>
            </article>
          ))}
          <div className="setup-add">
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
          </div>
        </section>
        <aside className="panel setup-budget" aria-label="Бюджет стартовой армии">
          <p className="eyebrow">БЕСПЛАТНЫЙ СТАРТ</p>
          <h2>
            Ваш состав <RuleHelp topic="prices" />
          </h2>
          <p className="setup-total">
            <strong>{effective}</strong>
            <span>Effective</span>
          </p>
          <div className="setup-budget-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, effective / 5)}%` }} />
          </div>
          <p className="muted">Допустимо 470–500 Effective</p>
          <div className="setup-budget-facts">
            <p>
              <Shield size={16} /> {rows.length} отрядов в стартовой армии
            </p>
            <p>Один detachment · любой стоимости DP</p>
            <p>CHARACTER во главе армии</p>
          </div>
          {armyProblem ? (
            <p className="notice" role="status">
              {armyProblem}
            </p>
          ) : (
            <p className="success" role="status">
              <CheckCircle2 size={18} /> Стартовая армия подходит по правилам кампании.
            </p>
          )}
          <button
            disabled={!!armyProblem || s.setupApproved.includes(side)}
            onClick={() => send('ready_army')}
          >
            {s.setupApproved.includes(side) ? 'Армия готова · ждём второго игрока' : 'Армия готова'}
          </button>
          <small>
            Когда оба командира отметят готовность, начнётся первый ход. Изменение состава потребует
            подтвердить готовность заново.
          </small>
        </aside>
      </div>
    </>
  )
}
