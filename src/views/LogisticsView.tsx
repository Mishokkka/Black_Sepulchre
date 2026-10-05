import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Package,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import type { SectorKey } from '../../shared/model'
import { ARMOURY, present, SECTORS, supplied } from '../../shared/rules'
import { logisticsForce } from '../../shared/logistics'
import { logisticsPreview } from '../../shared/logistics-preview'
import { logisticsJournal, rosterUnits, unitAttention } from '../../shared/roster'
import { historySummary } from '../../shared/history'
import { CatalogManager, STFManager } from './CampaignExtras'
import { ForceBudgets } from './ForceBudgets'
import { LogisticsAction } from './LogisticsAction'
import { RosterView } from './RosterView'
import { StatusBadge } from './StatusBadge'
import { UnitChoice } from './UnitChoice'
import { RuleHelp } from './RulesContext'
import { Check, labels, Options, phases, type Props } from './common'

export function LogisticsView({ s, side, send }: Props) {
  const p = s.players[side],
    force = logisticsForce(s, side),
    at = force === 'stf' ? p.stf! : p.mf
  const [catalog, setCatalog] = useState(''),
    [name, setName] = useState(''),
    [sector, setSector] = useState<SectorKey>(at),
    [location, setLocation] = useState(force === 'stf' ? 'stf' : 'field'),
    [local, setLocal] = useState(0),
    [drill, setDrill] = useState<string[]>([]),
    [requestedUnit, setRequestedUnit] = useState<{ id: string; request: number }>(),
    [confirmOpen, setConfirmOpen] = useState(false),
    [closeError, setCloseError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null),
    finish = useRef<HTMLButtonElement>(null)
  const ours =
    s.phase === 'logistics' &&
    !!(s.activation?.logistics.includes(side) || s.battle?.logistics.includes(side))
  const units = useMemo(() => rosterUnits(s, side), [s, side]),
    attention = useMemo(
      () =>
        units
          .map((u) => ({ u, issues: unitAttention(s, u) }))
          .filter((row) => row.issues.length > 0)
          .sort(
            (a, b) =>
              Number(!!b.u.flags.ammunitionDue) - Number(!!a.u.flags.ammunitionDue) ||
              b.u.damage - a.u.damage,
          ),
      [s, units],
    )
  const end = useMemo(() => logisticsPreview(s, side, 'end_logistics', {}), [s, side]),
    journal = useMemo(() => logisticsJournal(s, side), [s, side])
  const cat = s.snapshot.catalog.find((c) => c.id === catalog)
  useEffect(() => {
    if (confirmOpen && !dialog.current?.open) dialog.current?.showModal()
    else if (!confirmOpen && dialog.current?.open) dialog.current.close()
  }, [confirmOpen])
  const close = () => {
    setConfirmOpen(false)
    finish.current?.focus()
  }
  const transactions = (
    <div className="logistics-journal">
      {journal.rows.length ? (
        <ol>
          {journal.rows.map((row) => {
            const resource = row.resources?.find((r) => r.side === side),
              delta = resource ? resource.supply[1] - resource.supply[0] : null
            return (
              <li key={row.version}>
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{historySummary(row)}</span>
                <strong className={delta && delta > 0 ? 'success' : ''}>
                  {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                  <small> Supply</small>
                </strong>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="muted">
          {journal.known
            ? 'Операций в этой Logistics ещё нет.'
            : 'Журнал начала этого этапа недоступен.'}
        </p>
      )}
    </div>
  )
  return (
    <div className="logistics-workspace" id="logistics-panel">
      <section className="panel logistics-command">
        <div className="section-head">
          <div>
            <p className="eyebrow">СНАБЖЕНИЕ И ВОССТАНОВЛЕНИЕ</p>
            <h2>Logistics · {labels[side]}</h2>
          </div>
          <StatusBadge tone={ours ? 'ready' : 'info'}>
            {ours
              ? 'Ваше окно открыто'
              : s.phase === 'logistics'
                ? 'Ваше окно закрыто'
                : phases[s.phase]}
          </StatusBadge>
        </div>
        <p className="logistics-context">
          <ShieldCheck size={16} aria-hidden="true" />
          {force === 'stf' ? 'STF' : 'Main Force'} · {at} · {SECTORS[at].name}
          <StatusBadge tone={supplied(s, side, at) ? 'ready' : 'warning'}>
            {supplied(s, side, at) ? 'Supplied' : 'Unsupplied'}
          </StatusBadge>
          <RuleHelp topic="supply" />
        </p>
        <div className="logistics-wallets" aria-label="Бюджет Logistics">
          <div>
            <Wallet size={16} aria-hidden="true" />
            <span>Supply</span>
            <strong>{p.supply}</strong>
            <small>Общий остаток</small>
          </div>
          <div>
            <ShieldCheck size={16} aria-hidden="true" />
            <span className="rule-label">
              Recovery <RuleHelp topic="recovery" />
            </span>
            <strong>{p.recovery}</strong>
            <small>Резерв армии</small>
          </div>
          <div>
            <Package size={16} aria-hidden="true" />
            <span className="rule-label">
              Local · {at} <RuleHelp topic="local" />
            </span>
            <strong>{s.sectors[at].local}</strong>
            <small>Для защитников сектора</small>
          </div>
          {p.debt > 0 && (
            <div className="wallet-debt">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>Аварийный долг</span>
              <strong>{p.debt}</strong>
              <small>Доход сначала гасит долг</small>
            </div>
          )}
        </div>
        <p className="personal-recovery-note">
          Личный Recovery: {units.reduce((n, u) => n + u.recovery, 0)} · хранится у отдельных ID.
          Покупки и обслуживание применяются сразу.
        </p>
        <ForceBudgets s={s} side={side} />
      </section>
      <section className="panel attention-panel" aria-label="Требуют внимания">
        <div className="section-head">
          <div>
            <p className="eyebrow">ПЕРЕД ЗАВЕРШЕНИЕМ</p>
            <h2>
              Требуют внимания <span className="count-badge">{attention.length}</span>
            </h2>
          </div>
        </div>
        {attention.length ? (
          <div className="attention-list">
            {attention.map(({ u, issues }) => (
              <button
                className="quiet attention-row"
                key={u.id}
                onClick={() => setRequestedUnit({ id: u.id, request: Date.now() })}
              >
                <span>
                  <strong>{u.name}</strong>
                  <small>
                    {u.location === 'garrison'
                      ? 'Гарнизон'
                      : u.location === 'stf'
                        ? 'STF'
                        : 'Main Force'}{' '}
                    · сектор {present(s, u) ?? '—'}
                  </small>
                </span>
                <span className="attention-issues">
                  {issues.map((i) => (
                    <StatusBadge key={i.key} tone={i.tone}>
                      {i.label}
                    </StatusBadge>
                  ))}
                </span>
                <span className="attention-open">
                  Открыть <ArrowRight size={14} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="attention-clear">
            <CheckCircle2 size={24} aria-hidden="true" />
            <div>
              <strong>Армия не требует обслуживания</strong>
              <p>Повреждений, долгов и отложенных решений у ваших ID нет.</p>
            </div>
          </div>
        )}
        <small className="attention-note">
          Ammunition Debt нужно закрыть до завершения. Остальные отметки помогают выбрать, что
          обслужить сейчас.
        </small>
      </section>
      <RosterView s={s} side={side} send={send} requestedUnit={requestedUnit} embedded />
      <details className="panel logistics-purchases">
        <summary>
          <span>
            <p className="eyebrow">ПОПОЛНЕНИЕ</p>
            <strong>Приобрести новый отряд</strong>
          </span>
          <Package size={20} aria-hidden="true" />
        </summary>
        <fieldset disabled={!ours}>
          <div className="purchase-layout">
            <div>
              <p className="muted">
                Бесплатное снаряжение выбирается в New Recruit. Здесь — размер и платная
                комплектация.
              </p>
              <UnitChoice
                label="Купить отряд"
                side={side}
                catalog={s.snapshot.catalog}
                value={catalog}
                change={setCatalog}
                search
              />
              <label>
                Имя ID
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={cat?.datasheet}
                />
              </label>
              <Options
                label="Назначение"
                value={location}
                change={setLocation}
                items={['field', 'garrison', ...(p.stf ? ['stf'] : [])].map((id) => ({
                  id,
                  name: id === 'field' ? 'Main Force' : id === 'stf' ? 'STF' : 'Гарнизон',
                }))}
              />
              <Options
                label="Сектор покупки"
                value={sector}
                change={(v) => {
                  if (Object.hasOwn(SECTORS, v)) {
                    setSector(v as SectorKey)
                    setLocal(0)
                  }
                }}
                items={Object.values(s.sectors)
                  .filter((a) => a.owner === side)
                  .map((a) => ({ id: a.key, name: `${a.key} · Local ${a.local}` }))}
              />
              <label>
                Из Local Supply
                <input
                  type="number"
                  min="0"
                  max={s.sectors[sector]?.local ?? 0}
                  step="5"
                  value={local}
                  onChange={(e) => setLocal(Number(e.target.value))}
                />
              </label>
              <p className="muted">
                Любая доля Local создаёт Commission. Удалённо — один Core в Window, полностью за
                Local.
              </p>
            </div>
            <div className="purchase-review">
              {cat ? (
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="buy_unit"
                  payload={{
                    catalogId: catalog,
                    name: name || cat.datasheet,
                    location,
                    sector,
                    local,
                  }}
                  label="Купить отряд"
                />
              ) : (
                <div className="operation-placeholder">
                  <Package size={24} aria-hidden="true" />
                  <p>Выберите отряд, чтобы увидеть расход ресурсов и оставшийся лимит.</p>
                </div>
              )}
            </div>
          </div>
        </fieldset>
      </details>
      <details className="panel logistics-support">
        <summary>Подготовка · Stage Package, Veteran Drill и запасы</summary>
        <fieldset disabled={!ours}>
          <div className="support-grid">
            <div>
              <h3>Stage Package</h3>
              {s.snapshot.detachments
                .filter((d) => !d.side || d.side === side)
                .map((d) => (
                  <Check
                    key={d.id}
                    label={`${d.name} · ${d.dp} DP`}
                    value={p.package.includes(d.id)}
                    change={(v) =>
                      send('package', {
                        package: v ? [...p.package, d.id] : p.package.filter((id) => id !== d.id),
                      })
                    }
                  />
                ))}
            </div>
            <div>
              <h3>Veteran Drill</h3>
              <p className="muted">+1 XP до двух местных ID · 30 Supply.</p>
              {units
                .filter((u) => u.status === 'active' && present(s, u) === p.mf)
                .map((u) => (
                  <Check
                    key={u.id}
                    label={u.name}
                    value={drill.includes(u.id)}
                    change={(v) =>
                      setDrill(v ? [...drill, u.id] : drill.filter((id) => id !== u.id))
                    }
                  />
                ))}
              {drill.length > 0 ? (
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="drill"
                  payload={{ ids: drill }}
                  label="Провести Veteran Drill"
                  quiet
                />
              ) : (
                <small>Выберите один или два отряда.</small>
              )}
            </div>
            <div>
              <h3>Расходные предметы</h3>
              <p>{p.inventory.map((i) => ARMOURY[i]?.name ?? i).join(', ') || 'Запасы пусты'}</p>
              {['medicae', 'cache'].map((item) => (
                <LogisticsAction
                  key={item}
                  s={s}
                  side={side}
                  send={send}
                  type="buy_armoury"
                  payload={{ item }}
                  label={ARMOURY[item].name}
                  quiet
                />
              ))}
            </div>
          </div>
        </fieldset>
      </details>
      <STFManager s={s} side={side} send={send} />
      <CatalogManager s={s} side={side} send={send} />
      <section className="panel logistics-ledger">
        <div className="section-head">
          <div>
            <p className="eyebrow">УЖЕ ПРИМЕНЕНО</p>
            <h2>Операции этой Logistics</h2>
          </div>
          <span className="muted">{journal.rows.length} операций</span>
        </div>
        {transactions}
      </section>
      <section className="panel logistics-finish">
        <div>
          <h3>Завершить снабжение</h3>
          <p>
            {ours
              ? 'Проверьте выполненные операции и оставшиеся проблемы.'
              : s.phase === 'logistics'
                ? 'Ожидаем завершения снабжения другим командиром.'
                : `Сейчас — ${phases[s.phase]}.`}
          </p>
          {ours && !end.allowed && <p className="validation">{end.reason}</p>}
        </div>
        <button
          ref={finish}
          disabled={!ours}
          onClick={() => {
            setCloseError('')
            setConfirmOpen(true)
          }}
        >
          Проверить и завершить <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>
      <dialog
        ref={dialog}
        className="logistics-confirm"
        aria-labelledby="logistics-confirm-title"
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="section-head">
          <div>
            <p className="eyebrow">ЗАКРЫТИЕ ВАШЕГО ОКНА</p>
            <h2 id="logistics-confirm-title">Завершить Logistics</h2>
          </div>
          <button
            className="quiet icon-button"
            aria-label="Закрыть сводку Logistics"
            onClick={close}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p>
          Покупки и обслуживание для вашей стороны закроются. Выполненные операции ниже уже
          сохранены.
        </p>
        <div className="confirm-balance">
          <span>
            Supply осталось <strong>{p.supply}</strong>
          </span>
          <span>
            Recovery армии <strong>{p.recovery}</strong>
          </span>
          <span>
            Требуют внимания <strong>{attention.length}</strong>
          </span>
        </div>
        {transactions}
        {end.allowed ? (
          <p className="muted">
            {end.phase === 'logistics'
              ? 'Затем ожидаем другого командира.'
              : 'Затем откроется следующий этап кампании.'}
          </p>
        ) : (
          <p className="validation" role="status">
            {end.reason}
          </p>
        )}
        {closeError && (
          <p className="validation" role="alert">
            {closeError}
          </p>
        )}
        <div className="buttons confirm-actions">
          <button className="quiet" onClick={close}>
            Вернуться
          </button>
          <button
            disabled={!ours || !end.allowed}
            onClick={async () => {
              const ok = await send('end_logistics')
              if (ok !== false) close()
              else
                setCloseError(
                  'Команда не применена. Вернитесь к экрану и проверьте сообщение кампании.',
                )
            }}
          >
            Подтвердить и закрыть
          </button>
        </div>
      </dialog>
    </div>
  )
}
