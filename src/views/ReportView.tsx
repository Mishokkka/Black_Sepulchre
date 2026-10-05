import { reportRetreatPlan } from '../../shared/aftermath'
import { SIDES, type Side, type Report, type UnitResult } from '../../shared/model'
import {
  initialReport,
  reportFields,
  firstDestroyedCandidates,
  storesCandidates,
  cleanReport,
} from '../../shared/report-form'
import { battleCommandError } from '../../shared/battle-ui'
import { useBattleDraft } from '../lib/useBattleDraft'
import { isReportDraft } from '../lib/drafts'
import { Check, Options, labels, type Props } from './common'
export function ReportView({
  s,
  side,
  send,
  correction = false,
}: Props & { correction?: boolean }) {
  const b = correction ? (s.battle?.aftermathApplied ? s.battle : s.history.at(-1))! : s.battle!,
    draft = useBattleDraft<Report>(
      s.id,
      b.id,
      correction ? 'correction' : 'report',
      s.version,
      initialReport(b),
      (v): v is Report =>
        isReportDraft(v) &&
        v.units.length === initialReport(b).units.length &&
        new Set(v.units.map((u) => u.id)).size === v.units.length &&
        v.units.every((u) => b.before.some((old) => old.id === u.id)),
    ),
    report = draft.value,
    { units: rows, facts, narrative, vp, retreat, garrisonRetreat } = report
  const setFacts = (v: Record<string, unknown>) => draft.update((r) => ({ ...r, facts: v }))
  const setNarrative = (v: string) => draft.update((r) => ({ ...r, narrative: v }))
  const setVP = (v: Report['vp']) => draft.update((r) => ({ ...r, vp: v }))
  const setRetreat = (v: Report['retreat']) => draft.update((r) => ({ ...r, retreat: v }))
  const setGarrisonRetreat = (v: Report['garrisonRetreat']) =>
    draft.update((r) => ({ ...r, garrisonRetreat: v }))
  const plan = reportRetreatPlan(s, b, report)
  const missingRetreat =
    SIDES.some((who) => plan.force[who]?.length && !plan.force[who]!.includes(retreat[who]!)) ||
    (plan.garrison && plan.garrison.length > 0 && !plan.garrison.includes(garrisonRetreat!))
  const edit = (id: string, value: Partial<UnitResult>) =>
    draft.update((r) => ({
      ...r,
      units: r.units.map((row) => (row.id === id ? { ...row, ...value } : row)),
    }))
  const submitted = cleanReport(s, b, {
    ...report,
    vp: correction ? vp : b.table.vp,
    withdrawal: b.table.records.mutualWithdrawal
      ? [...SIDES]
      : b.table.records.withdrawalSide
        ? [b.table.records.withdrawalSide as Side]
        : [],
    facts: {
      ...facts,
      withdrawal_timing_valid:
        !!b.table.records.withdrawalSide || !!b.table.records.mutualWithdrawal,
    },
  })
  const submitError = battleCommandError(
    s,
    side,
    correction ? 'request_correction' : 'submit_result',
    { report: submitted },
  )
  return (
    <section className="panel report-builder" id="report-panel">
      <h3>{correction ? 'Новая ревизия результата' : 'Итог и потери по ID'}</h3>
      {draft.status}
      {correction && (
        <>
          <p>
            Оба согласуют откат всех зависимых решений к исходному результату. Сохранённые dice
            повторно не бросаются; доход пересчитывается один раз.
          </p>
          {SIDES.map((who) => (
            <label key={who}>
              VP {labels[who]}
              <input
                type="number"
                min="0"
                max="50"
                value={vp[who]}
                onChange={(e) => setVP({ ...vp, [who]: Number(e.target.value) })}
              />
            </label>
          ))}
        </>
      )}
      <p>
        VP {b.table.vp.deathwatch} : {b.table.vp.necrons}. Участие и прибытие перенесены из хода
        боя. Отметьте потери, Deed и Distinguished; применимые бонусы появятся сами.
      </p>
      <nav className="report-checklist" aria-label="Разделы отчёта">
        <a href="#report-losses">
          1 · Потери <strong>{rows.filter((r) => r.destroyed).length}</strong>
        </a>
        <a href="#report-facts">2 · Факты миссии</a>
        <a href="#report-retreat">
          3 · Отход <strong>{missingRetreat ? 'нужен выбор' : 'проверен'}</strong>
        </a>
        <a href="#report-story">
          4 · История <small>необязательно</small>
        </a>
      </nav>
      <div className="report-section" id="report-losses">
        <h4>1 · Потери и Deeds</h4>
        {rows.map((r) => {
          const fields = reportFields(s, b, r)
          if (!r.entered)
            return (
              <details className="report-row" key={r.id}>
                <summary>
                  {fields.u.name} · не прибыл{r.destroyed ? ' · Initial Reserve потерян' : ''}
                </summary>
                <p>Участие зафиксировано в ходе боя; награды за участие не применяются.</p>
                {fields.medicae && (
                  <Check
                    label="Medicae при новом Damage"
                    value={r.usedMedicae ?? false}
                    change={(v) => edit(r.id, { usedMedicae: v })}
                  />
                )}
              </details>
            )
          return (
            <div className="report-row" key={r.id}>
              <strong>{s.units.find((u) => u.id === r.id)?.name ?? r.id}</strong>
              <div className="buttons">
                <small>Участвовал · {labels[fields.u.side]}</small>
                {fields.withdrawn && (
                  <Check
                    label="Эвакуирован со стола"
                    value={r.withdrawn}
                    change={(v) => edit(r.id, { withdrawn: v })}
                  />
                )}
                <Check
                  label="Уничтожен"
                  value={r.destroyed}
                  change={(v) => edit(r.id, { destroyed: v })}
                />
                {fields.distinguished && (
                  <Check
                    label="Distinguished"
                    value={r.distinguished}
                    change={(v) => edit(r.id, { distinguished: v })}
                  />
                )}
                {fields.medicae && (
                  <Check
                    label="Medicae при новом Damage"
                    value={r.usedMedicae ?? false}
                    change={(v) => edit(r.id, { usedMedicae: v })}
                  />
                )}
              </div>
              <Options
                label="Deed, максимум один на исходную формацию"
                value={r.deed ?? ''}
                change={(v) => edit(r.id, { deed: (v || null) as UnitResult['deed'] })}
                items={['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].map((id) => ({
                  id,
                  name: id,
                }))}
              />
              {fields.memory && (
                <Check
                  label="Memory of Eternity использовано, bearer выжил"
                  value={r.signatureXP ?? false}
                  change={(v) => edit(r.id, { signatureXP: v })}
                />
              )}
              {fields.hunt && (
                <Check
                  label="Scar Driven to Hunt: objective XENOS target"
                  value={r.scarBonus ?? false}
                  change={(v) => edit(r.id, { scarBonus: v })}
                />
              )}
              {fields.hazard && (
                <Check
                  label="Погиб именно от mission hazard: Casualty −1"
                  value={r.casualtySources.includes(
                    b.mission === 'C1'
                      ? 'c1_debris'
                      : b.mission === 'D1'
                        ? 'd1_toxic'
                        : 'j3_reactor',
                  )}
                  change={(v) =>
                    edit(r.id, {
                      casualtySources: v
                        ? [
                            b.mission === 'C1'
                              ? 'c1_debris'
                              : b.mission === 'D1'
                                ? 'd1_toxic'
                                : 'j3_reactor',
                          ]
                        : r.casualtySources.filter((source) => source === 'no_recovery'),
                    })
                  }
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="report-section" id="report-facts">
        <h4>2 · Факты миссии и спасение</h4>
        {b.type === 'PACT' &&
          SIDES.map((who) => (
            <Check
              key={who}
              label={`${labels[who]}: Channeler жив, OC >0, не BS, без move, в 3 Engine после Final Pulse`}
              value={facts[`prime_valid:${who}`] === true}
              change={(v) => setFacts({ ...facts, [`prime_valid:${who}`]: v })}
            />
          ))}
        {b.type === 'WAR' &&
          SIDES.map((who) => (
            <Check
              key={who}
              label={`${labels[who]}: живая модель с OC >0 в 3 Engine после Final Pulse`}
              value={facts[`engine_alive_oc:${who}`] === true}
              change={(v) => setFacts({ ...facts, [`engine_alive_oc:${who}`]: v })}
            />
          ))}
        {/[AK]3/.test(b.mission!) && (
          <Check
            label="Attacker контролирует Throne в конце R5 после hazards"
            value={facts.throne_control === b.attacker}
            change={(v) => setFacts({ ...facts, throne_control: v ? b.attacker : b.defender })}
          />
        )}
        {SIDES.map(
          (who) =>
            firstDestroyedCandidates(s, b, report, who).length > 0 && (
              <Options
                key={who}
                label={`Первый уничтоженный ID ${labels[who]} · Hard Evacuation / Extraction`}
                value={String(facts[`first_destroyed:${who}`] ?? '')}
                change={(v) => setFacts({ ...facts, [`first_destroyed:${who}`]: v })}
                items={firstDestroyedCandidates(s, b, report, who).map((r) => ({
                  id: r.id,
                  name: s.units.find((u) => u.id === r.id)!.name,
                }))}
              />
            ),
        )}
        {storesCandidates(b, report).length > 0 && (
          <Options
            label="Hardened Stores: один уничтоженный ID"
            value={String(facts.stores_id ?? '')}
            change={(v) => setFacts({ ...facts, stores_id: v })}
            items={storesCandidates(b, report).map((r) => ({
              id: r.id,
              name: s.units.find((u) => u.id === r.id)!.name,
            }))}
          />
        )}
        {b.table.objects.some((o) => o.id === 'overlay') && (
          <Options
            label="Контроль Anchor в конце R5 (если есть overlay)"
            value={String(facts.anchor_control ?? '')}
            change={(v) => setFacts({ ...facts, anchor_control: v || null })}
            items={SIDES.map((id) => ({ id, name: labels[id] }))}
          />
        )}
      </div>
      <div className="report-section" id="report-retreat">
        <h4>3 · Направления отхода</h4>
        {SIDES.map(
          (who) =>
            plan.force[who] &&
            (plan.force[who]!.length > 0 ? (
              <Options
                key={who}
                label={`Выберите отход ${labels[who]}`}
                value={retreat[who] ?? ''}
                change={(v) => setRetreat({ ...retreat, [who]: v || undefined })}
                items={plan.force[who]!.map((id) => ({ id, name: id }))}
              />
            ) : (
              <p key={who} className="notice">
                {labels[who]}: нет доступного своего сектора. Движок рассчитает аварийную эвакуацию
                в Home.
              </p>
            )),
        )}
        {plan.garrison &&
          (plan.garrison.length > 0 ? (
            <Options
              label="Единый отход захваченного гарнизона"
              value={garrisonRetreat ?? ''}
              change={(v) => setGarrisonRetreat((v as Report['garrisonRetreat']) || null)}
              items={plan.garrison.map((id) => ({ id, name: id }))}
            />
          ) : (
            <p className="notice">Гарнизон эвакуируется в Home автоматически.</p>
          ))}
        {missingRetreat && (
          <p className="notice">
            Следующий шаг: выберите доступный отход выше, затем отправьте отчёт.
          </p>
        )}
      </div>
      <div className="report-section" id="report-story">
        <h4>4 · История боя</h4>
        <label>
          История боя
          <textarea
            maxLength={5000}
            rows={3}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
        </label>
      </div>
      <div className="phase-submit report-submit">
        <p className={submitError ? 'validation' : 'success'}>
          {submitError ||
            (correction
              ? 'Поля ревизии заполнены. Сервер проверит её по исходному состоянию; для отката нужно согласие второго игрока.'
              : 'Отчёт прошёл проверки. После отправки потребуется подтверждение второго игрока.')}
        </p>
        <button
          className="primary"
          disabled={!!submitError || !!missingRetreat}
          onClick={async () => {
            if (
              await send(correction ? 'request_correction' : 'submit_result', { report: submitted })
            )
              draft.clear()
          }}
        >
          Отправить результат на подтверждение обоими
        </button>
      </div>
    </section>
  )
}
