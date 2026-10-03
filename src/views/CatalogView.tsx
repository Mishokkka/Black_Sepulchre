import { useEffect, useState } from 'react'
import type { CatalogUnit, Snapshot } from '../../shared/model'
import {
  cardFromImport,
  MAX_IMPORT_BYTES,
  modelCount,
  parseNewRecruit,
  sameDatasheet,
  validateCard,
  type DataProfile,
  type DatasheetCard,
  type SourceImport,
} from '../../shared/datasheets'
import {
  draftCatalog,
  referenceImport,
  snapshotWithCatalog,
  type ReferenceLibrary,
  type ReferenceSheet,
} from '../../shared/catalogue'
import type { Props } from './CampaignViews'
import { DatasheetView, ProfileTable } from './DatasheetView'
import { SnapshotManager } from './CampaignExtras'

export type LibraryAPI = (
  action: 'imports' | 'import_source',
  payload?: Record<string, unknown>,
) => Promise<{ imports?: LibraryEntry[]; import?: SourceImport; reused?: boolean }>
export interface LibraryEntry {
  hash: string
  data: SourceImport
  createdAt: string
}
interface Selection {
  source: SourceImport
  unitId: string
  reference?: ReferenceSheet
}
const weaponBase = (s: string) => s.replace(/^[➤►▶]\s*/, '').split(/\s+[–—-]\s+/)[0]
const csv = (s: string) =>
  s
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
function ListInput({
  label,
  values,
  change,
}: {
  label: string
  values: string[]
  change: (v: string[]) => void
}) {
  const [text, setText] = useState(values.join(', '))
  useEffect(() => {
    setText(values.join(', '))
  }, [values.join(',')])
  return (
    <label>
      {label}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = csv(text)
          if (JSON.stringify(next) !== JSON.stringify(values)) change(next)
        }}
      />
    </label>
  )
}

export function CatalogView({ s, side, send, api }: Props & { api: LibraryAPI }) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]),
    [preview, setPreview] = useState<SourceImport | null>(null),
    [raw, setRaw] = useState(''),
    [selected, setSelected] = useState<Selection | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [reference, setReference] = useState<ReferenceLibrary | null>(null),
    [draft, setDraft] = useState<Snapshot | null>(null),
    [baseVersion, setBaseVersion] = useState(s.version)
  const load = async () => {
    setBusy(true)
    try {
      setLibrary((await api('imports')).imports ?? [])
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let active = true
    api('imports')
      .then((r) => {
        if (active) setLibrary(r.imports ?? [])
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [api, side])
  const choose = (source: SourceImport, unitId: string, ref?: ReferenceSheet) => {
    setSelected({ source, unitId, reference: ref })
    setError('')
  }
  const units = (source: SourceImport) =>
    source.units
      .filter((u) => u.datasheet.toLowerCase().includes(search.toLowerCase()))
      .map((u) => (
        <div className="unit-row" key={u.id}>
          <div>
            <strong>{u.datasheet}</strong>
            <small>
              {modelCount(u)} моделей · {u.exportedPoints} pts в экспорте · копия {u.copyOrdinal}
            </small>
            <small>
              {u.models
                .flatMap((g) => g.equipment)
                .map((e) => `${e.count} × ${e.name}`)
                .join(' · ')}
            </small>
            {u.issues.map((i, j) => (
              <small className={i.blocking ? 'validation' : ''} key={j}>
                {i.message}
              </small>
            ))}
          </div>
          <button className="quiet" onClick={() => choose(source, u.id)}>
            Подготовить вариант
          </button>
        </div>
      ))
  const canPublish =
    !s.battle &&
    ['setup', 'strategy', 'logistics'].includes(s.phase) &&
    !s.snapshotProposal &&
    !s.correctionProposal
  const addConfiguration = (source: SourceImport) => {
    const next = structuredClone(draft ?? s.snapshot)
    for (const d of source.detachments.filter((d) => d.dp >= 1 && d.dp <= 3))
      if (!next.detachments.some((v) => (!v.side || v.side === side) && v.name === d.name))
        next.detachments.push({
          id: crypto.randomUUID(),
          name: d.name,
          dp: d.dp,
          side,
          requiredKeywords: [],
        })
    for (const d of source.dispositions)
      if (!next.dispositions?.some((v) => v.side === side && v.name === d.name))
        next.dispositions = [
          ...(next.dispositions ?? []),
          { id: crypto.randomUUID(), name: d.name, side },
        ]
    if (!draft) setBaseVersion(s.version)
    next.id = crypto.randomUUID()
    next.date = new Date().toISOString().slice(0, 10)
    next.approved = []
    setDraft(next)
    setNotice(
      'Detachments с DP 1–3 и Dispositions добавлены в черновик. Проверьте их требования в редакторе Snapshot подготовки. Активный Stage Package выбирается отдельно.',
    )
  }
  return (
    <>
      <section className="panel">
        <h2>Каталог и источники</h2>
        <p>
          Загрузите выбранные составы New Recruit. После проверки добавьте варианты в общий
          Snapshot; покупка отрядов и Refit доступны в Logistics.
        </p>
        {error && (
          <p role="alert" className="validation">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <fieldset disabled={busy}>
          <label>
            JSON New Recruit · один Force, до 2 МБ
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  if (f.size > MAX_IMPORT_BYTES) throw Error('Файл больше 2 МБ')
                  const text = await f.text(),
                    p = parseNewRecruit(text, f.name)
                  if (p.side !== side) throw Error('Загрузите экспорт своей фракции')
                  setRaw(text)
                  setPreview(p)
                  setError('')
                  setNotice('')
                } catch (e) {
                  setPreview(null)
                  setRaw('')
                  setError((e as Error).message)
                }
              }}
            />
          </label>
          {preview && (
            <div className="import-preview">
              <h3>
                {preview.source.filename} · {preview.units.length} вариантов
              </h3>
              <p>
                Каталог {preview.source.catalogueRevision} · система {preview.source.gameRevision} ·{' '}
                {preview.points} pts {preview.limit !== null ? `/ ${preview.limit}` : ''}
              </p>
              {preview.issues.map((i, j) => (
                <p className="muted" key={j}>
                  {i.message}
                </p>
              ))}
              <button
                onClick={async () => {
                  setBusy(true)
                  try {
                    const r = await api('import_source', {
                      text: raw,
                      filename: preview.source.filename,
                    })
                    setNotice(
                      r.reused
                        ? 'Этот файл уже сохранён.'
                        : 'Источник сохранён в библиотеке вашей стороны.',
                    )
                    setPreview(null)
                    setRaw('')
                    await load()
                  } catch (e) {
                    setError((e as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Сохранить источник в библиотеку
              </button>
              <details>
                <summary>Посмотреть составы перед сохранением</summary>
                {units(preview)}
              </details>
            </div>
          )}
          <label>
            Поиск datasheet
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Immortals, Veterans, …"
            />
          </label>
          <div className="buttons">
            <button className="quiet" onClick={load}>
              Обновить библиотеку
            </button>
            <small>{library.length} / 30 файлов вашей стороны</small>
          </div>
          {!library.length && (
            <p className="muted">Библиотека пуста. Загрузите ваши экспорты персонажей и команд.</p>
          )}
          {library.map((item) => (
            <details key={item.hash} className="source-file">
              <summary>
                {item.data.source.filename} · {item.data.units.length} составов · rev{' '}
                {item.data.source.catalogueRevision}
              </summary>
              <small>
                SHA-256 {item.hash} · {item.createdAt}
              </small>
              {item.data.issues.map((i, j) => (
                <p key={j}>{i.message}</p>
              ))}
              {(item.data.detachments.length > 0 || item.data.dispositions.length > 0) && (
                <details>
                  <summary>Конфигурация источника</summary>
                  <p>{item.data.detachments.map((d) => `${d.name}: ${d.dp} DP`).join('; ')}</p>
                  <p>{item.data.dispositions.map((d) => d.name).join('; ')}</p>
                  <button className="quiet" onClick={() => addConfiguration(item.data)}>
                    Добавить в черновик Snapshot
                  </button>
                </details>
              )}
              {units(item.data)}
            </details>
          ))}
        </fieldset>
      </section>
      <details className="panel">
        <summary>Wahapedia · остальные юниты и вооружение</summary>
        <p>
          Справочник из 142 datasheets. Это кандидаты для проверки: доступность для Deathwatch,
          wargear, цены и обновления официальных документов подтверждаются в Snapshot. Legends и
          союзники Imperial Agents пока не включены.
        </p>
        {!reference && (
          <button
            className="quiet"
            onClick={async () => {
              try {
                const r = await fetch(`${import.meta.env.BASE_URL}data/wahapedia.reference.json`)
                if (!r.ok) throw Error('Не удалось загрузить справочник')
                setReference(await r.json())
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          >
            Открыть справочник
          </button>
        )}
        {reference && (
          <>
            <p className="muted">
              Срез {reference.asOf}. Обновления:{' '}
              {reference.sourceUpdateAlerts.map((url, i) => (
                <span key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    официальный документ {i + 1}
                  </a>{' '}
                </span>
              ))}
            </p>
            {reference.datasheets
              .filter(
                (d) =>
                  d.campaignSide === side && d.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((d) => (
                <details key={d.id}>
                  <summary>
                    {d.name} · {d.weaponProfiles.length} профилей оружия
                  </summary>
                  <p>{[...d.keywords, ...d.factionKeywords].join(' · ')}</p>
                  <p>
                    {d.source.documents.join('; ')} ·{' '}
                    <a href={d.source.url} target="_blank" rel="noreferrer">
                      Datasheet и wargear
                    </a>
                  </p>
                  <ProfileTable
                    profiles={Object.values(referenceImport(d).profiles).filter(
                      (p) => p.type === 'Unit',
                    )}
                  />
                  <ProfileTable
                    profiles={Object.values(referenceImport(d).profiles).filter(
                      (p) => p.type !== 'Unit',
                    )}
                  />
                  <p>Способности: {d.references.abilities.join(', ') || '—'}</p>
                  <p>
                    Цены:{' '}
                    {d.pointTiers
                      .map(
                        (p) =>
                          `${p.models} моделей: ${p.points} pts (копии ${p.copyFrom}–${p.copyTo ?? '∞'})`,
                      )
                      .join('; ')}
                  </p>
                  {d.contextDependentKeywords.length > 0 && (
                    <p className="notice">
                      Контекстные keywords: {d.contextDependentKeywords.join(', ')}. Не добавляйте
                      их автоматически.
                    </p>
                  )}
                  <button
                    className="quiet"
                    onClick={() => {
                      const imp = referenceImport(d)
                      choose(imp, imp.units[0].id, d)
                    }}
                  >
                    Собрать вариант из справочника
                  </button>
                </details>
              ))}
          </>
        )}
      </details>
      {selected && (
        <TemplateEditor
          key={`${selected.source.source.hash ?? selected.source.source.catalogueId}:${selected.unitId}`}
          selection={selected}
          snapshot={draft ?? s.snapshot}
          onClose={() => setSelected(null)}
          onAdd={(c, target) => {
            try {
              const next = snapshotWithCatalog(
                draft ?? s.snapshot,
                c,
                target,
                new Date().toISOString().slice(0, 10),
                crypto.randomUUID(),
              )
              if (!draft) setBaseVersion(s.version)
              setDraft(next)
              setSelected(null)
              setNotice('Вариант добавлен в черновик Snapshot. Отправьте черновик после проверки.')
              setError('')
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        />
      )}
      {draft && (
        <section className="panel">
          <h2>Черновик Snapshot</h2>
          <p>
            {draft.catalog.length} вариантов · {draft.date}. Можно добавить ещё несколько составов
            перед отправкой.
          </p>
          <details>
            <summary>Просмотреть полный черновик</summary>
            <pre className="snapshot-preview">{JSON.stringify(draft, null, 2)}</pre>
          </details>
          {s.version !== baseVersion && (
            <p className="validation">
              Кампания изменилась после создания черновика. Сбросьте его и повторите обновление,
              чтобы сохранить новые решения.
            </p>
          )}
          {!canPublish && (
            <p className="notice">
              Snapshot доступен между боями; закончите текущий этап или согласуйте имеющееся
              предложение.
            </p>
          )}
          <div className="buttons">
            <button
              disabled={!canPublish || s.version !== baseVersion}
              onClick={async () => {
                const ok = await send(s.phase === 'setup' ? 'edit_snapshot' : 'propose_snapshot', {
                  snapshot: draft,
                })
                if (ok !== false) {
                  setDraft(null)
                  setNotice(
                    s.phase === 'setup'
                      ? 'Snapshot сохранён; оба командира заново подтверждают подготовку.'
                      : 'Snapshot предложен второму командиру.',
                  )
                }
              }}
            >
              {s.phase === 'setup' ? 'Сохранить Snapshot подготовки' : 'Предложить общий Snapshot'}
            </button>
            <button className="quiet" onClick={() => setDraft(null)}>
              Сбросить черновик
            </button>
          </div>
        </section>
      )}
      {s.snapshotProposal && <SnapshotManager s={s} side={side} send={send} />}
      <details className="panel">
        <summary>
          Варианты в действующем Snapshot (
          {s.snapshot.catalog.filter((c) => c.side === side).length})
        </summary>
        {s.snapshot.catalog
          .filter((c) => c.side === side)
          .map((c) => (
            <details key={c.id}>
              <summary>
                {c.datasheet} · {c.size} · {c.rc} RC
              </summary>
              <DatasheetView card={c.card} />
            </details>
          ))}
      </details>
    </>
  )
}

function TemplateEditor({
  selection,
  snapshot,
  onAdd,
  onClose,
}: {
  selection: Selection
  snapshot: Snapshot
  onAdd: (c: CatalogUnit, target: string | null) => void
  onClose: () => void
}) {
  const { source, unitId, reference } = selection,
    u = source.units.find((u) => u.id === unitId)!
  const [c, setC] = useState(() => {
      const c = draftCatalog(source, u, crypto.randomUUID())
      if (reference && reference.composition.length)
        c.card!.composition = {
          min: reference.composition.reduce((n, g) => n + g.min, 0),
          max: reference.composition.reduce((n, g) => n + g.max, 0),
        }
      return c
    }),
    [target, setTarget] = useState(''),
    [error, setError] = useState(''),
    [checked, setChecked] = useState(false),
    [json, setJson] = useState('')
  const card = c.card!,
    update = (patch: Partial<CatalogUnit>) => {
      setC({ ...c, ...patch })
      setChecked(false)
    },
    editCard = (f: (v: DatasheetCard) => void) => {
      const next = structuredClone(card)
      f(next)
      update({ card: next, models: modelCount(next) })
    }
  const peers = source.units.filter((v) => sameDatasheet(v.datasheet, u.datasheet)),
    allowed = new Set(
      peers.flatMap((v) => [
        ...v.profiles,
        ...v.equipment.flatMap((e) => e.profiles),
        ...v.models.flatMap((g) => [...g.stats, ...g.equipment.flatMap((e) => e.profiles)]),
      ]),
    )
  const pool = Object.fromEntries(
      Object.entries({ ...source.profiles, ...card.profiles }).filter(
        ([id]) => reference || allowed.has(id) || Object.hasOwn(card.profiles, id),
      ),
    ),
    stats = Object.entries(pool).filter(([, p]) => p.type === 'Unit'),
    weapons = Object.entries(pool).filter(([, p]) => /weapons/i.test(p.type)),
    groups = [...new Set(weapons.map(([, p]) => weaponBase(p.name)))]
  const options = snapshot.catalog.filter(
    (v) => v.side === c.side && sameDatasheet(v.datasheet, c.datasheet),
  )
  return (
    <section className="panel template-editor">
      <div className="section-head">
        <h2>{u.datasheet} · проверка варианта</h2>
        <button className="quiet" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <p>
        RC — цена базового размера. Номер копии в экспорте и платные опции Package проверяются
        отдельно. Количество оружия ниже — общее для группы моделей.
      </p>
      {card.composition && (
        <p
          className={
            c.models < card.composition.min || c.models > card.composition.max
              ? 'validation'
              : 'muted'
          }
        >
          Диапазон datasheet: {card.composition.min}–{card.composition.max} моделей · выбранный
          состав: {c.models}. При изменении официального документа диапазон можно уточнить в
          расширенном редакторе.
        </p>
      )}
      {u.copyOrdinal > 1 && (
        <p className="notice">
          Это копия №{u.copyOrdinal}; её цена {u.exportedPoints} pts может включать надбавку за
          повтор. Укажите базовый RC и цены копий.
        </p>
      )}
      {reference && (
        <p className="notice">
          Вооружение ещё не выбрано. Исходный состав:{' '}
          {reference.composition.map((g) => `${g.min}–${g.max} ${g.model}`).join('; ')}. Базовое
          снаряжение:{' '}
          {reference.defaultEquipment
            .map(
              (g) => `${g.carrier}: ${g.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}`,
            )
            .join('; ')}
          .
        </p>
      )}
      {u.issues.map((i, j) => (
        <p className="notice" key={j}>
          {i.message}
        </p>
      ))}
      <div className="form-grid">
        <label>
          Назначение
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setChecked(false)
            }}
          >
            <option value="">Новый вариант для покупки / Refit</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                Обновить {v.datasheet} · {v.size} · {v.rc} RC
              </option>
            ))}
          </select>
        </label>
        <label>
          Название варианта
          <input value={c.size} onChange={(e) => update({ size: e.target.value })} />
        </label>
        <label>
          Базовый RC
          <input
            type="number"
            min={5}
            max={3000}
            value={c.rc}
            onChange={(e) => update({ rc: Number(e.target.value) })}
          />
        </label>
        <ListInput
          label="OBC копий №1, 2, 3… (через запятую)"
          values={c.copyPrices.map(String)}
          change={(v) => update({ copyPrices: v.map(Number) })}
        />
        <label>
          Гарнизон
          <select
            value={c.garrison}
            onChange={(e) => update({ garrison: e.target.value as CatalogUnit['garrison'] })}
          >
            {['core', 'heavy', 'other', 'forbidden'].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Проверено по документу и версии
          <input
            value={card.reviewedAgainst}
            onChange={(e) =>
              editCard((v) => {
                v.reviewedAgainst = e.target.value
              })
            }
            placeholder="Faction Pack / MFM / errata, версия и дата"
          />
        </label>
      </div>
      <div className="buttons">
        {(['character', 'epic', 'battleline', 'ranged', 'restoration', 'unique'] as const).map(
          (k) => (
            <label className="check" key={k}>
              <input
                type="checkbox"
                checked={c[k]}
                onChange={(e) => update({ [k]: e.target.checked })}
              />
              {k}
            </label>
          ),
        )}
      </div>
      <ListInput
        label="Keywords отряда"
        values={card.unitKeywords}
        change={(values) => {
          const keys = values.map((k) => k.toUpperCase())
          editCard((v) => {
            v.unitKeywords = keys
          })
          setC((old) => ({ ...old, keywords: keys }))
        }}
      />
      {card.models.map((g, i) => (
        <div className="model-editor" key={g.id}>
          <div className="form-grid">
            <label>
              Группа моделей
              <input
                value={g.name}
                onChange={(e) =>
                  editCard((v) => {
                    v.models[i].name = e.target.value
                  })
                }
              />
            </label>
            <label>
              Моделей
              <input
                type="number"
                min={1}
                max={100}
                value={g.count}
                onChange={(e) =>
                  editCard((v) => {
                    v.models[i].count = Number(e.target.value)
                  })
                }
              />
            </label>
            <label>
              Statline
              <select
                value={g.stats[0] ?? ''}
                onChange={(e) =>
                  editCard((v) => {
                    v.models[i].stats = e.target.value ? [e.target.value] : []
                    v.models[i].profileOrigin = 'reviewed'
                    if (e.target.value) v.profiles[e.target.value] = pool[e.target.value]
                  })
                }
              >
                <option value="">Сопоставьте характеристики</option>
                {stats.map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name} · M {p.values.M} · T {p.values.T} · W {p.values.W}
                  </option>
                ))}
              </select>
            </label>
            <ListInput
              label="Keywords этих моделей"
              values={g.keywords}
              change={(keys) =>
                editCard((v) => {
                  v.models[i].keywords = keys.map((s) => s.toUpperCase())
                })
              }
            />
          </div>
          {g.equipment.map((e, j) => (
            <label className="equipment-count" key={j}>
              {e.name} · {e.profiles.length} профилей
              <input
                aria-label={`Количество ${g.name}: ${e.name}`}
                type="number"
                min={0}
                max={1000}
                value={e.count}
                onChange={(ev) =>
                  editCard((v) => {
                    v.models[i].equipment[j].count = Number(ev.target.value)
                  })
                }
              />
            </label>
          ))}
          <label>
            Добавить физическое оружие
            <select
              value=""
              onChange={(e) => {
                const name = e.target.value
                if (!name) return
                editCard((v) => {
                  const refs = weapons
                    .filter(([, p]) => weaponBase(p.name) === name)
                    .map(([id, p]) => {
                      v.profiles[id] = p
                      return id
                    })
                  v.models[i].equipment.push({ entryId: name, name, count: 1, profiles: refs })
                })
              }}
            >
              <option value="">Выберите оружие (режимы будут объединены)</option>
              {groups.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            className="quiet"
            disabled={card.models.length === 1}
            onClick={() =>
              editCard((v) => {
                v.models.splice(i, 1)
              })
            }
          >
            Удалить группу
          </button>
        </div>
      ))}
      <button
        className="quiet"
        onClick={() =>
          editCard((v) => {
            v.models.push({
              id: crypto.randomUUID(),
              entryId: u.entryId,
              name: 'Новая группа',
              count: 1,
              keywords: [],
              stats: [],
              abilities: [],
              equipment: [],
              profileOrigin: 'missing',
            })
          })
        }
      >
        Добавить группу моделей
      </button>
      {card.equipment.map((e, i) => (
        <label className="equipment-count" key={i}>
          Снаряжение отряда: {e.name}
          <input
            type="number"
            value={e.count}
            min={0}
            max={1000}
            onChange={(ev) =>
              editCard((v) => {
                v.equipment[i].count = Number(ev.target.value)
              })
            }
          />
        </label>
      ))}
      <details>
        <summary>Уточнить характеристики и профили</summary>
        <p>
          Изменения сохранятся в этом варианте Snapshot. Профили в исходном файле останутся
          прежними.
        </p>
        {Object.entries(card.profiles).map(([id, p]) => (
          <details key={id}>
            <summary>
              {p.name} · {p.type}
            </summary>
            <div className="form-grid">
              {Object.entries(p.values).map(([k, value]) => (
                <label key={k}>
                  {k}
                  {/description/i.test(k) ? (
                    <textarea
                      rows={4}
                      value={value}
                      onChange={(e) =>
                        editCard((v) => {
                          v.profiles[id].values[k] = e.target.value
                        })
                      }
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) =>
                        editCard((v) => {
                          v.profiles[id].values[k] = e.target.value
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          </details>
        ))}
      </details>
      <div className="form-grid">
        <ListInput
          label="Leader для (через запятую)"
          values={c.leaderFor}
          change={(v) => update({ leaderFor: v })}
        />
        <ListInput
          label="Support для (через запятую)"
          values={c.supportFor ?? []}
          change={(v) => update({ supportFor: v })}
        />
      </div>
      {card.paidOptions.map((p, i) => (
        <label key={i}>
          {p.name} · +{p.cost} OBC при выбранном Detachment
          <select
            value={c.packageCosts?.find((x) => x.name === p.name)?.detachments[0] ?? ''}
            onChange={(e) =>
              update({
                packageCosts: [
                  ...(c.packageCosts ?? []).filter((x) => x.name !== p.name),
                  ...(e.target.value
                    ? [{ name: p.name, cost: p.cost, detachments: [e.target.value] }]
                    : []),
                ],
              })
            }
          >
            <option value="">Укажите Package — не включать в базовый RC</option>
            {snapshot.detachments
              .filter((d) => !d.side || d.side === c.side)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
      ))}
      {c.transportRule && (
        <details>
          <summary>Проверить группы мест транспорта · {c.transport} мест</summary>
          <pre>{JSON.stringify(c.transportRule, null, 2)}</pre>
          <p>
            Это предложенная схема по datasheet; при необходимости измените её в расширенном
            редакторе.
          </p>
        </details>
      )}
      <details>
        <summary>Расширенный редактор варианта</summary>
        <p>
          Позволяет уточнить Co-Leaders, транспорт, дополнительные ссылки и любые поля карточки.
        </p>
        <button className="quiet" onClick={() => setJson(JSON.stringify(c, null, 2))}>
          Открыть JSON варианта
        </button>
        <textarea
          rows={12}
          aria-label="JSON варианта"
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        <button
          className="quiet"
          disabled={!json}
          onClick={() => {
            try {
              const next = JSON.parse(json) as CatalogUnit
              validateCard(
                { ...next.card!, reviewedAgainst: next.card?.reviewedAgainst || 'draft' },
                next.models,
              )
              if (next.side !== source.side) throw Error('Фракция не совпадает')
              setC(next)
              setChecked(false)
              setError('')
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        >
          Применить JSON к черновику
        </button>
      </details>
      <details>
        <summary>Просмотр карточки ({c.models} моделей)</summary>
        <DatasheetView card={card} />
      </details>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Проверены состав, wargear, keywords, роли, транспорт и актуальные цены. Вариант доступен
        моей фракции.
      </label>
      {error && (
        <p className="validation" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={!checked || !card.reviewedAgainst.trim()}
        onClick={() => {
          try {
            if (card.paidOptions.some((p) => !c.packageCosts?.some((x) => x.name === p.name)))
              throw Error(
                'Сопоставьте каждую платную опцию с Detachment; либо удалите неприменимую опцию в редакторе.',
              )
            if (
              reference &&
              weapons.length &&
              ![...card.equipment, ...card.models.flatMap((g) => g.equipment)].some(
                (e) => e.count > 0,
              )
            )
              throw Error('Сначала выберите вооружение')
            validateCard(card, c.models)
            onAdd(c, target || null)
            setError('')
          } catch (e) {
            setError((e as Error).message)
          }
        }}
      >
        Добавить проверенный вариант в черновик Snapshot
      </button>
    </section>
  )
}
