import { useState } from 'react'
import { startingArmy, startingArmyPreview } from '../../shared/setup'
import { enhancementChoices } from '../../shared/enhancements'
import { EnhancementChoice, enhancementEligibilityLabel } from './EnhancementChoice'
import { STOCK_BINDINGS } from '../../shared/enhancements.generated'
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
import { PackageEditor } from './PackageEditor'
export function SetupView({ s, side, send, members }: Props & { members?: Side[] | null }) {
  const [catalog, setCatalog] = useState('')
  const rows = s.units.filter(
    (u) => u.side === side && u.location === 'field' && u.status === 'active',
  )
  const choices = starterChoices(s, side)
  const selected = choices.find((c) => c.id === catalog)
  const preview = startingArmyPreview(s, side)
  const selectedEnhancements = preview.muster.picks.filter((p) => p.enhancement)
  const enhancementPoints = selectedEnhancements.reduce(
    (n, p) => n + (s.snapshot.enhancements.find((e) => e.id === p.enhancement)?.cost ?? 0),
    0,
  )
  const detachmentEnhancements = s.snapshot.enhancements.filter((e) =>
    s.players[side].package.includes(e.detachment),
  )
  const pantheon = s.players[side].package.some(
    (id) => s.snapshot.detachments.find((d) => d.id === id)?.name === 'Pantheon of Woe',
  )
  let armyProblem = '',
    effective = preview.effective
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
          <PackageEditor s={s} side={side} send={send} setup />
          <small>
            На старте выбирается один detachment любой стоимости DP. Его правила применяются в
            битвах за столом.
          </small>
          {s.battles === 0 && (
            <div className="setup-enhancements">
              <h3>Улучшения detachment · по желанию</h3>
              <p className="muted">
                На старте доступен один слот Enhancement. Назначьте улучшение подходящему отряду
                ниже или оставьте состав без него.
              </p>
              {s.flags.startingEnhancements !== 1 && (
                <button className="quiet" onClick={() => send('expand_starting_catalogue')}>
                  Добавить улучшения detachment
                </button>
              )}
              {detachmentEnhancements.length > 0 && (
                <details>
                  <summary>Доступные улучшения · {detachmentEnhancements.length}</summary>
                  <ul className="enhancement-catalogue">
                    {detachmentEnhancements.map((e) => (
                      <li key={e.id}>
                        <strong>
                          {e.name} · {e.cost} очков{e.upgrade ? ' · Upgrade' : ''}
                        </strong>
                        <small>{enhancementEligibilityLabel(e)}</small>
                      </li>
                    ))}
                  </ul>
                  <small>
                    Цены закреплены для принятых detachments кампании.{' '}
                    <a
                      href={detachmentEnhancements.find((e) => e.source)?.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Источник каталога
                    </a>
                  </small>
                </details>
              )}
              {pantheon && (
                <p className="notice">
                  Pantheon of Woe использует обязательные Necrodermal Bindings для C’tan:{' '}
                  {STOCK_BINDINGS.map((b) => `${b.name} +${b.cost}`).join(' · ')}. Они учитываются
                  автоматически в стоимости подходящего отряда. Epic Hero и TITANIC доступны с 1000
                  очков.
                </p>
              )}
            </div>
          )}
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
                {s.battles === 0 &&
                  (enhancementChoices(s, side, u.id, s.snapshot, s.players[side].package, 0)
                    .length > 0 ||
                    s.players[side].startingEnhancements?.[u.id]) && (
                    <EnhancementChoice
                      label={`Улучшение: ${u.name}`}
                      value={s.players[side].startingEnhancements?.[u.id] ?? ''}
                      change={(enhancement) =>
                        void send('setup_enhancement', {
                          id: u.id,
                          enhancement: enhancement || null,
                        })
                      }
                      options={enhancementChoices(
                        s,
                        side,
                        u.id,
                        s.snapshot,
                        s.players[side].package,
                        0,
                      )}
                      picks={preview.muster.picks}
                      unitId={u.id}
                      limit={1}
                    />
                  )}
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
            <p>
              Улучшения: {new Set(selectedEnhancements.map((p) => p.enhancement)).size} / 1 слот · +
              {enhancementPoints} Effective
            </p>
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
