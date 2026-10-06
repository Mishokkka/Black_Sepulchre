import { useMemo, useState } from 'react'
import { useBattleDraft } from '../lib/useBattleDraft'
import { isMusterDraft } from '../lib/drafts'
import type { Muster, Pick } from '../../shared/model'
import { ARMOURY, RELICS, STAGES, entry, unit } from '../../shared/rules'
import { enhancementChoices, preferredEnhancement } from '../../shared/enhancements'
import { defaultActiveHonours, honourEligible } from '../../shared/campaign-upgrades'
import { EnhancementChoice } from './EnhancementChoice'
import { rosterUnits } from '../../shared/roster'
import { musterPreview, musterCandidateReason, battleCommandError } from '../../shared/battle-ui'
import { Check, Options, type Props } from './common'
import { StatusBadge } from './StatusBadge'
import { MusterBudget } from './MusterBudget'
import { ConfirmDialog } from './ConfirmDialog'
import { RuleHelp } from './RulesContext'
import { HONOURS } from '../../shared/rules.generated'
export function MusterView({ s, side, send }: Props) {
  const b = s.battle!,
    p = s.players[side],
    draft = useBattleDraft<Muster>(
      s.id,
      b.id,
      'muster',
      s.version,
      { picks: [], rest: [], detachments: p.package.slice(0, 1), commander: '', dispositions: [] },
      isMusterDraft,
    ),
    m = draft.value,
    { picks, rest, detachments, commander, dispositions } = m
  const setPicks = (v: Pick[]) => draft.update((m) => ({ ...m, picks: v }))
  const setRest = (v: string[]) => draft.update((m) => ({ ...m, rest: v }))
  const setDetachments = (v: string[]) =>
    draft.update((m) => ({
      ...m,
      detachments: v,
      picks: m.picks.map((pick) => ({
        ...pick,
        paidOptions: (pick.paidOptions ?? []).filter((name) =>
          entry(s, unit(s, pick.id), b.snapshot).packageCosts?.some(
            (o) => o.optional && o.name === name && o.detachments.some((id) => v.includes(id)),
          ),
        ),
        enhancement: enhancementChoices(s, side, pick.id, b.snapshot, v, b.stage).some(
          (e) => e.id === pick.enhancement,
        )
          ? pick.enhancement
          : null,
      })),
    }))
  const setCommander = (v: string) => draft.update((m) => ({ ...m, commander: v }))
  const setDispositions = (v: string[]) => draft.update((m) => ({ ...m, dispositions: v }))
  const edit = (id: string, value: Partial<Pick>) =>
    draft.update((m) => ({
      ...m,
      picks: m.picks.map((p) => (p.id === id ? { ...p, ...value } : p)),
    }))
  const preview = useMemo(() => musterPreview(s, side, m), [s, side, m])
  const costs = preview.costs ?? {}
  const error = useMemo(
    () => preview.error || battleCommandError(s, side, 'commit_muster', { muster: m }),
    [preview.error, s, side, m],
  )
  const candidates = rosterUnits(s, side).filter(
    (u) =>
      u.location === (b.forces?.[side] === 'stf' ? 'stf' : 'field') ||
      (u.location === 'garrison' && u.sector === b.sector),
  )
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState(false)
  const visible = candidates.filter(
    (u) =>
      picks.some((p) => p.id === u.id) ||
      (u.name + ' ' + u.id).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru').trim()),
  )
  if (b.muster[side])
    return (
      <section className="panel" id="muster-panel">
        <h3>Ваш Muster проверен и запечатан</h3>
        <p>Состав неизменяем. Ожидается второй командир.</p>
      </section>
    )
  return (
    <section className="panel muster-builder" id="muster-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">БОЕВОЙ СОСТАВ</p>
          <h2 className="rule-label">
            Закрытый Muster <RuleHelp topic="preparation" />
          </h2>
        </div>
        <StatusBadge tone={error ? 'warning' : 'ready'}>{picks.length} выбрано</StatusBadge>
      </div>
      {draft.status}
      <p>
        Initial {b.initial} · Pool {b.pool} · первое прибытие R{b.firstSlot}. В Field defence
        гарнизон Initial заполняет свободный AL.
      </p>
      <div className="muster-layout">
        <div className="muster-candidates" id="muster-units">
          <label className="muster-search">
            Найти отряд
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя или ID"
            />
          </label>
          <p className="muted">
            Выбранные отряды остаются видны при поиске. RC — запись армии, Effective — стоимость на
            этот бой.
          </p>
          <div className="muster-unit-list">
            {visible.map((u) => {
              const pick = picks.find((p) => p.id === u.id),
                cat = entry(s, u, b.snapshot),
                reason = musterCandidateReason(s, side, u)
              return (
                <article
                  className={`muster-unit ${pick ? 'selected' : ''} ${reason ? 'unavailable' : ''}`}
                  key={u.id}
                  data-side={u.side}
                  id={`muster-unit-${u.id}`}
                >
                  <div className="muster-unit-main">
                    <Check
                      label={u.name}
                      disabled={!!reason && !pick}
                      value={!!pick}
                      change={(v) => {
                        if (v) {
                          setPicks([
                            ...picks,
                            {
                              id: u.id,
                              role: u.location === 'garrison' ? 'initial' : 'field',
                              formation: u.id,
                              transport: null,
                              reserve: false,
                              enhancement: preferredEnhancement(
                                s,
                                side,
                                u.id,
                                b.snapshot,
                                detachments,
                                b.stage,
                              ),
                              paidOptions: [],
                              honours: defaultActiveHonours(u, cat),
                              armoury: !!u.armoury,
                              relic: !!u.relic,
                              redemption: null,
                              redemptionDeed: null,
                              protocol: u.scars.some((c) => side === 'necrons' && c.id === 12)
                                ? 'HOLD'
                                : null,
                            },
                          ])
                          setRest(rest.filter((id) => id !== u.id))
                        } else setPicks(picks.filter((p) => p.id !== u.id))
                      }}
                    />
                    <strong className="muster-cost">
                      {pick ? (costs[u.id] ?? '—') : u.rc}
                      <small>{pick ? 'Effective' : 'RC'}</small>
                    </strong>
                    <StatusBadge tone={reason ? 'danger' : pick ? 'ready' : 'info'}>
                      {reason ? 'Недоступен' : pick ? 'В составе' : 'Доступен'}
                    </StatusBadge>
                    {reason && <p className="muster-unavailable-reason">{reason}</p>}
                    <small>
                      Damage {u.damage} · XP {u.xp}
                      {costs[u.id] !== undefined && ` · ${costs[u.id]} Effective`}
                    </small>
                    {!pick && !musterCandidateReason(s, side, u, true) && (
                      <Check
                        label="RESTING"
                        value={rest.includes(u.id)}
                        change={(v) =>
                          setRest(v ? [...rest, u.id] : rest.filter((id) => id !== u.id))
                        }
                      />
                    )}
                  </div>
                  <div className="muster-role">
                    {pick && (
                      <>
                        <select
                          aria-label={`Роль ${u.name}`}
                          value={pick.role}
                          onChange={(e) => edit(u.id, { role: e.target.value as Pick['role'] })}
                        >
                          {(u.location !== 'garrison' ? ['field'] : ['initial', 'pool']).map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                        <Check
                          label="Initial Reserves"
                          value={pick.reserve}
                          change={(v) => edit(u.id, { reserve: v })}
                        />
                      </>
                    )}
                  </div>
                  {pick && (
                    <details className="muster-settings">
                      <summary>Формация и транспорт</summary>
                      <div className="muster-settings-grid">
                        {pick && (
                          <>
                            <Options
                              label="Attached формация"
                              value={pick.formation}
                              change={(v) => edit(u.id, { formation: v })}
                              items={picks.map((v) => ({ id: v.id, name: unit(s, v.id).name }))}
                            />
                            <Options
                              label="Embarked в"
                              value={pick.transport ?? ''}
                              change={(v) => edit(u.id, { transport: v || null })}
                              items={picks
                                .filter((p) => entry(s, unit(s, p.id)).transport > 0)
                                .map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
                            />
                          </>
                        )}
                      </div>
                    </details>
                  )}
                  {pick && (
                    <details className="muster-settings">
                      <summary>Honours и улучшения</summary>
                      <div className="muster-settings-grid">
                        {pick && (
                          <>
                            {u.honours
                              .filter((id) => honourEligible(id, cat))
                              .map((id) => (
                                <Check
                                  key={id}
                                  label={HONOURS.find((h) => h.id === id)?.name ?? id}
                                  value={pick.honours.includes(id)}
                                  change={(v) =>
                                    edit(u.id, {
                                      honours: v
                                        ? [...pick.honours, id]
                                        : pick.honours.filter((h) => h !== id),
                                    })
                                  }
                                />
                              ))}
                            {u.armoury && (
                              <Check
                                label={ARMOURY[u.armoury].name}
                                value={pick.armoury}
                                change={(v) => edit(u.id, { armoury: v })}
                              />
                            )}{' '}
                            {u.relic && (
                              <Check
                                label={RELICS[u.relic].name}
                                value={pick.relic}
                                change={(v) => edit(u.id, { relic: v })}
                              />
                            )}{' '}
                            {(enhancementChoices(s, side, u.id, b.snapshot, detachments, b.stage)
                              .length > 0 ||
                              pick.enhancement) && (
                              <EnhancementChoice
                                label={`Улучшение: ${u.name}`}
                                value={pick.enhancement ?? ''}
                                change={(v) => edit(u.id, { enhancement: v || null })}
                                options={enhancementChoices(
                                  s,
                                  side,
                                  u.id,
                                  b.snapshot,
                                  detachments,
                                  b.stage,
                                )}
                                picks={picks}
                                unitId={u.id}
                                limit={b.type === 'PACT' ? 2 : STAGES[b.stage].enhancements}
                              />
                            )}{' '}
                            {(cat.packageCosts ?? [])
                              .filter(
                                (o) =>
                                  o.cost > 0 &&
                                  o.detachments.some((id) => detachments.includes(id)),
                              )
                              .map((o) =>
                                o.optional ? (
                                  <Check
                                    key={o.name}
                                    label={`${o.name} · +${o.cost} очков на бой`}
                                    value={(pick.paidOptions ?? []).includes(o.name)}
                                    change={(v) =>
                                      edit(u.id, {
                                        paidOptions: v
                                          ? [...(pick.paidOptions ?? []), o.name]
                                          : (pick.paidOptions ?? []).filter((n) => n !== o.name),
                                      })
                                    }
                                  />
                                ) : (
                                  <small key={o.name}>
                                    {o.name} · обязательные +{o.cost} очков в этом detachment
                                  </small>
                                ),
                              )}
                            {u.scars.length > 0 && (
                              <Options
                                label="Redemption Scar"
                                value={pick.redemption === null ? '' : String(pick.redemption)}
                                change={(v) => edit(u.id, { redemption: v ? Number(v) : null })}
                                items={u.scars.map((sc) => ({
                                  id: String(sc.id),
                                  name: `Scar ${sc.id}`,
                                }))}
                              />
                            )}
                            {pick.redemption !== null && (
                              <Options
                                label="Redemption Deed до commitment"
                                value={pick.redemptionDeed ?? ''}
                                change={(redemptionDeed) => edit(u.id, { redemptionDeed })}
                                items={[
                                  'HOLD',
                                  'BREAK',
                                  'HUNT',
                                  'ENDURE',
                                  'OPERATE',
                                  'EXTRACT',
                                ].map((id) => ({ id, name: id }))}
                              />
                            )}{' '}
                            {u.side === 'necrons' && u.scars.some((c) => c.id === 12) && (
                              <Options
                                label="Protocol Obsession"
                                value={pick.protocol ?? 'HOLD'}
                                change={(protocol) => edit(u.id, { protocol })}
                                items={['HOLD', 'HUNT'].map((id) => ({ id, name: id }))}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </article>
              )
            })}
          </div>
          {!visible.length && <p className="roster-empty">Нет отрядов по этому запросу.</p>}
        </div>
        <aside className="muster-budget" aria-label="Бюджет боевого состава">
          <MusterBudget preview={preview} picks={picks} s={s} />
        </aside>
      </div>
      <div className="form-grid muster-command" id="muster-command">
        <div>
          <h4 className="rule-label">
            Detachments на бой <RuleHelp topic="prices" label="Detachment Points" />
          </h4>
          {p.package.map((id) => (
            <Check
              key={id}
              label={s.snapshot.detachments.find((d) => d.id === id)!.name}
              value={detachments.includes(id)}
              change={(v) => {
                const next = v ? [...detachments, id] : detachments.filter((d) => d !== id)
                setDetachments(next)
              }}
            />
          ))}
          <p className="muted">
            Отключение detachment снимает его улучшения из этого состава и освобождает очки.
            Назначения Stage сохраняются до смены Package в Logistics или Doctrine Refit.
          </p>
        </div>
        <div>
          {(b.snapshot.dispositions ?? [])
            .filter((d) => d.side === side)
            .map((d) => (
              <Check
                key={d.id}
                label={d.name}
                value={dispositions.includes(d.id)}
                change={(v) =>
                  setDispositions(
                    v ? [...dispositions, d.id] : dispositions.filter((id) => id !== d.id),
                  )
                }
              />
            ))}
        </div>
        <Options
          label="Warlord / Garrison Commander"
          value={commander}
          change={setCommander}
          items={picks.map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
        />
      </div>
      <div className="phase-submit muster-submit">
        <p className={error ? 'validation' : 'success'}>
          {error || 'Состав прошёл проверки кампании.'}
        </p>
        <div className="buttons">
          <button className="primary" disabled={!!error} onClick={() => setConfirm(true)}>
            Проверить и запечатать
          </button>
          {['encounter', 'WAR', 'PACT'].includes(b.type) && (
            <span className="rule-label">
              <button className="quiet" onClick={() => send('emergency_muster')}>
                Emergency Muster
              </button>
              <RuleHelp topic="emergency" />
            </span>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Запечатать Muster?"
        confirm="Запечатать состав"
        disabled={!!error}
        onConfirm={() => send('commit_muster', { muster: m })}
      >
        <p>
          После отправки состав и настройки этого боя будут зафиксированы. Раскрытие сопернику
          следует правилам Recon Lock.
        </p>
        <p>
          <strong>
            {picks.length} отрядов · {preview.total ?? '—'} Effective
          </strong>{' '}
          · RESTING {rest.length}
        </p>
        <p>Командир: {s.units.find((u) => u.id === commander)?.name ?? 'не выбран'}</p>
        <MusterBudget preview={preview} picks={picks} s={s} compact />
        {error && <p className="validation">{error}</p>}
      </ConfirmDialog>
    </section>
  )
}
