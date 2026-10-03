import type { CatalogUnit, Side } from './model.ts'

export interface DataProfile {
  sourceId: string
  name: string
  type: string
  values: Record<string, string>
}
export interface Equipment {
  entryId: string
  name: string
  count: number
  profiles: string[]
}
export interface ModelGroup {
  id: string
  entryId: string
  name: string
  count: number
  keywords: string[]
  stats: string[]
  abilities: string[]
  equipment: Equipment[]
  profileOrigin: 'model' | 'unit' | 'missing' | 'reviewed'
}
export interface ImportIssue {
  code: string
  message: string
  blocking: boolean
}
export interface SourceInfo {
  filename: string
  gameId: string
  gameRevision: string
  catalogueId: string
  catalogueRevision: string
  catalogueName: string
  generator: string
  hash?: string
  provider?: 'New Recruit' | 'Wahapedia'
  url?: string
}
export interface ImportedUnit {
  id: string
  entryId: string
  datasheet: string
  keywords: string[]
  models: ModelGroup[]
  profiles: string[]
  equipment: Equipment[]
  rules: string[]
  exportedPoints: number
  selectedPoints: number
  copyOrdinal: number
  paidOptions: { name: string; cost: number }[]
  leaderFor: string[]
  supportFor: string[]
  issues: ImportIssue[]
}
export interface SourceImport {
  schema: 'black-sepulchre.nr.v1'
  side: Side
  source: SourceInfo
  profiles: Record<string, DataProfile>
  units: ImportedUnit[]
  detachments: { id: string; name: string; dp: number }[]
  dispositions: { id: string; name: string }[]
  issues: ImportIssue[]
  points: number
  limit: number | null
}
export interface DatasheetCard {
  source: SourceInfo
  sourceEntryId: string
  sourceSelectionId: string
  unitKeywords: string[]
  profiles: Record<string, DataProfile>
  models: ModelGroup[]
  unitProfiles: string[]
  equipment: Equipment[]
  rules: string[]
  exportedPoints: number
  copyOrdinal: number
  paidOptions: { name: string; cost: number }[]
  reviewedAgainst: string
  composition?: { min: number; max: number }
}
export interface CargoGroup {
  capacity: number
  all: string[]
  any: string[]
  exclude: string[]
  attachedTacticusCharacter?: boolean
}
export interface TransportRule {
  groups: CargoGroup[]
}

export const MAX_IMPORT_BYTES = 2_000_000
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message)
}
function obj(v: unknown): Record<string, unknown> {
  check(v && typeof v === 'object' && !Array.isArray(v), 'Неверная структура JSON')
  return v as Record<string, unknown>
}
function text(v: unknown, max = 250): string {
  check(typeof v === 'string' && v.length <= max, 'Некорректное текстовое поле экспорта')
  return v
}
function list(v: unknown, max = 10000): Record<string, unknown>[] {
  if (v === undefined) return []
  check(Array.isArray(v) && v.length <= max, 'Слишком большой список в экспорте')
  return v.map(obj)
}
function count(v: unknown, max = 1000): number {
  check(
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max,
    'Неверное количество',
  )
  return v
}
const qty = (n: Record<string, unknown>) => count(n.number ?? 1)
const pts = (n: Record<string, unknown>) =>
  list(n.costs).reduce((sum, c) => (c.name === 'pts' ? sum + count(c.value, 100000) : sum), 0)
export const keyword = (s: string) =>
  s
    .replace(/^Faction:\s*/i, '')
    .trim()
    .toUpperCase()
export const datasheetName = (s: string) => {
  const key = s
    .toUpperCase()
    .replace(/ARMOR/g, 'ARMOUR')
    .replace(/[’']/g, '')
    .replace(/[^A-Z0-9]/g, '')
  return (
    (
      {
        INTERCESSORS: 'INTERCESSORSQUAD',
        PRIMARISANCIENT: 'ANCIENT',
        PRIMARISAPOTHECARY: 'APOTHECARY',
      } as Record<string, string>
    )[key] ?? key
  )
}
export const sameDatasheet = (a: string, b: string) => datasheetName(a) === datasheetName(b)
export const modelCount = (u: { models: ModelGroup[] }) => u.models.reduce((n, g) => n + g.count, 0)
export function loadoutSignature(card: DatasheetCard): string {
  const gear = (es: Equipment[]) =>
    es
      .map((e) => [datasheetName(e.name), e.count])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return JSON.stringify([
    gear(card.equipment),
    card.models
      .map((g) => [
        g.count,
        [...g.keywords].sort(),
        g.stats.map((id) => datasheetName(card.profiles[id].name)),
        gear(g.equipment),
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ])
}

/** New Recruit quantities and costs are exported totals, never parent multipliers. */
export function parseNewRecruit(rawText: string, filename = 'NewRecruit.json'): SourceImport {
  check(
    new TextEncoder().encode(rawText).length <= MAX_IMPORT_BYTES,
    'JSON больше 2 МБ; разделите экспорт',
  )
  let raw: unknown
  try {
    raw = JSON.parse(rawText.replace(/^\uFEFF/, ''))
  } catch {
    throw Error('Файл не содержит корректный JSON')
  }
  const r = obj(obj(raw).roster)
  check(
    /Warhammer\s*40,?000.*11th/i.test(text(r.gameSystemName)),
    'Нужен экспорт Warhammer 40,000 11th Edition',
  )
  const forces = list(r.forces, 20)
  check(
    forces.length === 1,
    'Экспортируйте один Force: несколько Force нельзя объединить автоматически',
  )
  const f = forces[0],
    catalogueName = text(f.catalogueName)
  const side: Side = /Necrons/i.test(catalogueName) ? 'necrons' : 'deathwatch'
  check(
    side === 'necrons' || /Deathwatch/i.test(catalogueName),
    'Поддерживаются каталоги Necrons и Deathwatch',
  )
  let nodes = 0
  const walk = (
    n: Record<string, unknown>,
    visit: (n: Record<string, unknown>) => void,
    depth = 0,
  ) => {
    check(depth <= 24 && ++nodes <= 18000, 'Экспорт слишком сложный')
    visit(n)
    for (const c of list(n.selections)) walk(c, visit, depth + 1)
  }
  // Preflight bounds includes configuration nodes, hidden records and wrappers.
  walk(f, (n) => {
    qty(n)
    list(n.profiles, 1000)
  })
  nodes = 0
  const profilePool: Record<string, DataProfile> = {},
    profileKeys = new Map<string, string>()
  const add = (p: DataProfile): string => {
    const signature = JSON.stringify([p.name, p.type, p.values])
    const old = profileKeys.get(signature)
    if (old) return old
    check(profileKeys.size < 4000, 'Слишком много профилей')
    const id = `p${profileKeys.size}`
    profilePool[id] = p
    profileKeys.set(signature, id)
    return id
  }
  const profiles = (n: Record<string, unknown>, type?: string): string[] =>
    list(n.profiles, 1000)
      .filter((p) => !p.hidden && (!type || p.typeName === type))
      .map((p) => {
        const values: Record<string, string> = Object.create(null)
        for (const c of list(p.characteristics, 100))
          values[text(c.name, 100)] = text(c.$text ?? '', 20000)
        return add({ sourceId: text(p.id), name: text(p.name), type: text(p.typeName), values })
      })
  const configs = list(f.selections).filter((n) =>
    list(n.categories).some((c) => c.name === 'Configuration'),
  )
  const detRoot = configs.find((n) => n.name === 'Detachment')
  const detSelections = detRoot ? list(detRoot.selections) : []
  const detRuleIds = new Set<string>(),
    detProfileIds = new Set<string>()
  for (const d of detSelections)
    walk(d, (n) => {
      list(n.rules).forEach((p) => detRuleIds.add(text(p.id)))
      list(n.profiles).forEach((p) => detProfileIds.add(text(p.id)))
    })
  const equipment = (parent: Record<string, unknown>): Equipment[] => {
    const out: Equipment[] = []
    const visit = (n: Record<string, unknown>, depth = 0) => {
      check(depth <= 24, 'Слишком глубокая структура снаряжения')
      for (const c of list(n.selections)) {
        if (c.type === 'model') continue
        const ps = profiles(c).filter((id) => !detProfileIds.has(profilePool[id].sourceId))
        if (c.type === 'upgrade' && ps.length && qty(c) > 0)
          out.push({ entryId: text(c.entryId), name: text(c.name), count: qty(c), profiles: ps })
        visit(c, depth + 1)
      }
    }
    visit(parent)
    return out
  }
  const categories = (n: Record<string, unknown>) => [
    ...new Set(list(n.categories).map((c) => keyword(text(c.name)))),
  ]
  const units: ImportedUnit[] = [],
    ordinals = new Map<string, number>()
  for (const u of list(f.selections).filter((n) => n.type === 'unit' || n.type === 'model')) {
    check(
      units.length < 200 && qty(u) === 1,
      'Не более 200 отдельных подразделений; разделите сгруппированные копии',
    )
    const entryId = text(u.entryId, 1000),
      id = text(u.id),
      ordinal = (ordinals.get(entryId) ?? 0) + 1
    ordinals.set(entryId, ordinal)
    const common = u.type === 'unit' ? profiles(u, 'Unit') : []
    const models: ModelGroup[] = [],
      rules: string[] = [],
      paidOptions: ImportedUnit['paidOptions'] = []
    let selectedPoints = 0
    walk(u, (n) => {
      selectedPoints += pts(n)
      if (n !== u && pts(n) > 0) paidOptions.push({ name: text(n.name), cost: pts(n) })
      if (n.type === 'model' && qty(n) > 0) {
        const own = profiles(n, 'Unit'),
          stats = own.length ? own : common.length === 1 ? common : []
        models.push({
          id: text(n.id),
          entryId: text(n.entryId, 1000),
          name: text(n.name),
          count: qty(n),
          keywords: categories(n),
          stats,
          abilities: profiles(n).filter((id) => profilePool[id].type !== 'Unit'),
          equipment: equipment(n),
          profileOrigin: own.length ? 'model' : stats.length ? 'unit' : 'missing',
        })
      }
      for (const rule of list(n.rules))
        if (!rule.hidden && !detRuleIds.has(text(rule.id)))
          rules.push(
            add({
              sourceId: text(rule.id),
              name: text(rule.name),
              type: 'Rule',
              values: { Description: text(rule.description ?? '', 20000) },
            }),
          )
    })
    const unitProfiles =
      u.type === 'unit'
        ? profiles(u).filter((id) => !detProfileIds.has(profilePool[id].sourceId))
        : []
    // Model-root abilities belong to the unit, while its statline/equipment stays scoped.
    if (u.type === 'model')
      unitProfiles.push(...profiles(u).filter((id) => profilePool[id].type !== 'Unit'))
    const allProfiles = [
      ...unitProfiles,
      ...models.flatMap((g) => [...g.abilities, ...g.equipment.flatMap((e) => e.profiles)]),
    ]
    const role = (name: string) => [
      ...new Set(
        allProfiles
          .filter((id) => profilePool[id].name.toUpperCase() === name)
          .flatMap((id) =>
            Object.values(profilePool[id].values).flatMap((v) => {
              const bullets = [...v.matchAll(/^\s*[-*•]\s+(.+)$/gm)].map((m) => m[1])
              const inline = v.match(/following units:\s*([^\n.]+)/i)?.[1]?.split(',') ?? []
              return [...bullets, ...inline]
                .map((s) => s.replace(/[*_]/g, '').trim())
                .filter((s) => s && s.length <= 200)
            }),
          ),
      ),
    ]
    const issues: ImportIssue[] = []
    check(
      models.length > 0 && models.length <= 100 && modelCount({ models }) <= 100,
      'Не найден допустимый состав моделей',
    )
    for (const g of models)
      if (!g.stats.length)
        issues.push({
          code: 'missing_model_profile',
          blocking: true,
          message: `Нет характеристик модели: ${g.name}`,
        })
    if (sameDatasheet(String(u.name), 'Deathwatch Veterans') && modelCount({ models }) > 10)
      issues.push({
        code: 'composition_review',
        blocking: true,
        message:
          'В примере Veterans больше 10 моделей. Исправьте состав и количество оружия перед добавлением в каталог.',
      })
    if (paidOptions.length)
      issues.push({
        code: 'conditional_options',
        blocking: false,
        message: 'Есть платные выбранные опции; их стоимость не является базовым RC',
      })
    units.push({
      id,
      entryId,
      datasheet: text(u.name),
      keywords: categories(u),
      models,
      profiles: unitProfiles,
      equipment: u.type === 'unit' ? equipment(u) : [],
      rules: [...new Set(rules)],
      exportedPoints: pts(u),
      selectedPoints,
      copyOrdinal: ordinal,
      paidOptions,
      leaderFor: role('LEADER'),
      supportFor: role('SUPPORT'),
      issues,
    })
  }
  check(
    units.length && new Set(units.map((u) => u.id)).size === units.length,
    'Пустой список или повтор ID selection',
  )
  const detachments = detSelections.map((d) => ({
    id: text(d.entryId, 1000),
    name: text(d.name),
    dp: list(d.costs).reduce(
      (n, c) => (c.name === 'Detachment Points' ? n + count(c.value, 3) : n),
      0,
    ),
  }))
  const dispositions: SourceImport['dispositions'] = []
  for (const config of configs.filter((c) => /Disposition/i.test(String(c.name))))
    for (const d of list(config.selections))
      dispositions.push({ id: text(d.entryId, 1000), name: text(d.name) })
  const points = pts(r),
    limit = list(r.costLimits).find((c) => c.name === 'pts')?.value
  const issues: ImportIssue[] = [
    {
      code: 'source_review',
      blocking: false,
      message: 'Карточки и цены взяты из этой версии New Recruit',
    },
  ]
  if (limit !== undefined && points > count(limit, 100000))
    issues.push({
      code: 'points_limit',
      blocking: false,
      message: `Пример: ${points} pts при лимите ${limit}. Для каталога допустим; для боя нужен отдельный legal состав`,
    })
  if (detachments.length > 1)
    issues.push({
      code: 'multiple_detachments',
      blocking: false,
      message: 'Несколько Detachments — справочный набор, а не активный Package',
    })
  if (units.reduce((n, u) => n + u.selectedPoints, 0) !== points)
    issues.push({
      code: 'cost_total',
      blocking: false,
      message:
        'Сумма unit selections отличается от roster costs; проверьте конфигурационные платежи',
    })
  const result: SourceImport = {
    schema: 'black-sepulchre.nr.v1',
    side,
    source: {
      filename: filename.split(/[\\/]/).pop()!.slice(0, 160),
      gameId: text(r.gameSystemId),
      gameRevision: String(r.gameSystemRevision),
      catalogueId: text(f.catalogueId),
      catalogueRevision: String(f.catalogueRevision),
      catalogueName,
      generator: text(r.generatedBy ?? '', 500),
      provider: 'New Recruit',
    },
    profiles: profilePool,
    units,
    detachments,
    dispositions,
    issues,
    points,
    limit: limit === undefined ? null : count(limit, 100000),
  }
  check(
    new TextEncoder().encode(JSON.stringify(result)).length <= 1_500_000,
    'Справочник слишком большой; разделите экспорт',
  )
  return result
}

export function cardFromImport(source: SourceImport, unit: ImportedUnit): DatasheetCard {
  const refs = [
    ...unit.profiles,
    ...unit.rules,
    ...unit.equipment.flatMap((e) => e.profiles),
    ...unit.models.flatMap((g) => [
      ...g.stats,
      ...g.abilities,
      ...g.equipment.flatMap((e) => e.profiles),
    ]),
  ]
  return structuredClone({
    source: source.source,
    sourceEntryId: unit.entryId,
    sourceSelectionId: unit.id,
    unitKeywords: unit.keywords,
    models: unit.models,
    unitProfiles: unit.profiles,
    equipment: unit.equipment,
    rules: unit.rules,
    profiles: Object.fromEntries([...new Set(refs)].map((id) => [id, source.profiles[id]])),
    exportedPoints: unit.exportedPoints,
    copyOrdinal: unit.copyOrdinal,
    paidOptions: unit.paidOptions,
    reviewedAgainst: '',
  })
}
export function validateCard(card: DatasheetCard, models: number) {
  check(
    card && typeof card === 'object' && JSON.stringify(card).length <= 100000,
    'Карточка слишком большая',
  )
  check(
    typeof card.reviewedAgainst === 'string' &&
      card.reviewedAgainst.trim().length > 0 &&
      card.reviewedAgainst.length <= 500,
    'Укажите документ/версию проверки карточки',
  )
  check(
    Array.isArray(card.models) && modelCount(card) === models,
    'Количество моделей карточки не совпадает с каталогом',
  )
  if (card.composition) {
    count(card.composition.min, 100)
    count(card.composition.max, 100)
    check(
      card.composition.min > 0 && models >= card.composition.min && models <= card.composition.max,
      'Состав выходит за диапазон моделей datasheet',
    )
  }
  check(
    card.models.length <= 100 && card.source && typeof card.source === 'object',
    'Неверный источник/состав карточки',
  )
  for (const k of [
    'filename',
    'gameId',
    'gameRevision',
    'catalogueId',
    'catalogueRevision',
    'catalogueName',
    'generator',
  ] as const)
    text(card.source[k], 1000)
  if (card.source.url)
    check(
      /^https:\/\//i.test(card.source.url) && card.source.url.length <= 1000,
      'Неверный URL источника',
    )
  check(
    card.profiles && typeof card.profiles === 'object' && !Array.isArray(card.profiles),
    'Нет профилей карточки',
  )
  check(
    Array.isArray(card.unitKeywords) &&
      card.unitKeywords.every((k) => typeof k === 'string' && k.length <= 150),
    'Неверные keywords карточки',
  )
  for (const [id, p] of Object.entries(card.profiles)) {
    text(id)
    text(p.name)
    text(p.type)
    obj(p.values)
    for (const [k, v] of Object.entries(p.values)) {
      text(k, 100)
      text(v, 20000)
    }
  }
  const ref = (ids: string[]) => {
    check(Array.isArray(ids) && ids.length <= 4000, 'Неверная ссылка на профиль')
    ids.forEach((id) =>
      check(
        typeof id === 'string' && Object.hasOwn(card.profiles, id),
        'Не найден профиль карточки',
      ),
    )
  }
  const equipment = (es: Equipment[]) => {
    check(Array.isArray(es) && es.length <= 100, 'Неверное снаряжение')
    for (const e of es) {
      text(e.name)
      count(e.count, 1000)
      ref(e.profiles)
    }
  }
  for (const g of card.models) {
    text(g.name)
    count(g.count, 100)
    check(
      g.count > 0 &&
        Array.isArray(g.keywords) &&
        g.keywords.every((k) => typeof k === 'string' && k.length <= 150),
      'Неверная группа моделей',
    )
    check(
      g.stats.length > 0 && g.stats.every((id) => card.profiles[id]?.type === 'Unit'),
      'Сначала сопоставьте statline каждой модели',
    )
    ref(g.stats)
    ref(g.abilities)
    equipment(g.equipment)
  }
  ref(card.unitProfiles)
  ref(card.rules)
  equipment(card.equipment)
}
export function modelKeywords(c: CatalogUnit, g?: ModelGroup): string[] {
  if (!c.card || !g) return c.keywords
  const armour = ['TACTICUS', 'PHOBOS', 'GRAVIS', 'TERMINATOR', 'CENTURION']
  let base = c.card.unitKeywords.map(keyword)
  if (g.keywords.some((k) => armour.includes(keyword(k))))
    base = base.filter((k) => !armour.includes(k))
  return [...new Set([...base, ...g.keywords.map(keyword)])]
}
export function validateTransportRule(rule: TransportRule, capacity: number) {
  check(
    rule && Array.isArray(rule.groups) && rule.groups.length > 0 && rule.groups.length <= 10,
    'Неверные группы мест транспорта',
  )
  let sum = 0
  for (const g of rule.groups) {
    count(g.capacity, 100)
    check(g.capacity > 0, 'Нулевая вместимость группы')
    sum += g.capacity
    for (const v of [g.all, g.any, g.exclude])
      check(
        Array.isArray(v) &&
          v.length <= 30 &&
          v.every((k) => typeof k === 'string' && k.length <= 150),
        'Неверные ограничения транспорта',
      )
    check(
      g.attachedTacticusCharacter === undefined || typeof g.attachedTacticusCharacter === 'boolean',
      'Неверное исключение транспорта',
    )
  }
  check(sum === capacity, 'Вместимость должна равняться сумме групп мест')
}
/** Initial transport suggestions for variants from the supplied exports. */
export function suggestedTransport(name: string): TransportRule | undefined {
  const group = (
    capacity: number,
    all: string[],
    any: string[] = [],
    exclude: string[] = [],
    exception = false,
  ): CargoGroup => ({ capacity, all, any, exclude, attachedTacticusCharacter: exception })
  switch (datasheetName(name)) {
    case 'GHOSTARK':
      return {
        groups: [group(10, ['NECRON WARRIORS']), group(1, ['NECRONS', 'INFANTRY', 'CHARACTER'])],
      }
    case 'DROPPOD':
      return {
        groups: [
          group(
            12,
            ['ADEPTUS ASTARTES', 'INFANTRY'],
            [],
            ['JUMP PACK', 'WULFEN', 'GRAVIS', 'CENTURION', 'TERMINATOR'],
          ),
        ],
      }
    case 'IMPULSOR':
      return { groups: [group(7, ['INFANTRY'], ['TACTICUS', 'PHOBOS'], ['JUMP PACK'])] }
    case 'RHINO':
    case 'RAZORBACK':
      return {
        groups: [
          group(
            datasheetName(name) === 'RHINO' ? 12 : 6,
            ['ADEPTUS ASTARTES', 'INFANTRY'],
            [],
            ['JUMP PACK', 'WULFEN', 'PHOBOS', 'GRAVIS', 'CENTURION', 'TERMINATOR', 'TACTICUS'],
            true,
          ),
        ],
      }
    default:
      return undefined
  }
}
