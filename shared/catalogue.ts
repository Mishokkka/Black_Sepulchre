import type { CatalogUnit, Snapshot } from './model.ts'
import { SITE_RULES_SOURCE } from './snapshot.ts'
import {
  cardFromImport,
  keyword,
  modelCount,
  sameDatasheet,
  suggestedTransport,
  validateCard,
  type DataProfile,
  type ImportedUnit,
  type SourceImport,
} from './datasheets.ts'

export interface ReferenceSheet {
  id: string
  name: string
  campaignSide: 'deathwatch' | 'necrons'
  source: { url: string; documents: string[]; observedAt: string }
  modelProfiles: { name: string; base: string; values: Record<string, string> }[]
  weaponProfiles: {
    name: string
    type: string
    keywords: string[]
    range: string
    A: string
    skill: string
    S: string
    AP: string
    D: string
  }[]
  keywords: string[]
  factionKeywords: string[]
  contextDependentKeywords: string[]
  composition: { model: string; min: number; max: number }[]
  defaultEquipment: { carrier: string; items: { name: string; quantity: number }[] }[]
  pointTiers: { models: number; points: number; copyFrom: number; copyTo: number | null }[]
  priceContextResolved: boolean
  references: { abilities: string[]; attachmentTargets: { leader: string[]; support: string[] } }
  reviewIssues: string[]
}
export interface ReferenceLibrary {
  asOf: string
  sourceUpdateAlerts: string[]
  datasheets: ReferenceSheet[]
}

/** A reference supplies profiles; free equipment is managed in external New Recruit. */
export function referenceImport(d: ReferenceSheet): SourceImport {
  const profiles: Record<string, DataProfile> = {}
  d.modelProfiles.forEach(
    (p, i) =>
      (profiles[`m${i}`] = {
        sourceId: `${d.id}:m${i}`,
        name: p.name,
        type: 'Unit',
        values: { ...p.values, Base: p.base },
      }),
  )
  d.weaponProfiles.forEach(
    (p, i) =>
      (profiles[`w${i}`] = {
        sourceId: `${d.id}:w${i}`,
        name: p.name,
        type: p.type === 'melee' ? 'Melee Weapons' : 'Ranged Weapons',
        values: {
          Range: p.range,
          A: p.A,
          [p.type === 'melee' ? 'WS' : 'BS']: p.skill,
          S: p.S,
          AP: p.AP,
          D: p.D,
          Keywords: p.keywords.join(', '),
        },
      }),
  )
  d.references.abilities.forEach(
    (name, i) =>
      (profiles[`a${i}`] = {
        sourceId: `${d.id}:a${i}`,
        name,
        type: 'Abilities',
        values: { Reference: d.source.url },
      }),
  )
  const models = d.composition
    .filter((g) => g.min > 0)
    .map((g, i) => ({
      id: `g${i}`,
      entryId: d.id,
      name: g.model,
      count: g.min,
      keywords: [],
      stats:
        d.modelProfiles.length === 1
          ? ['m0']
          : d.modelProfiles.flatMap((p, j) => (sameDatasheet(p.name, g.model) ? [`m${j}`] : [])),
      abilities: [],
      equipment: [],
      profileOrigin: 'reviewed' as const,
    }))
  const n = models.reduce((n, g) => n + g.count, 0),
    price = d.pointTiers.find((p) => p.models === n && p.copyFrom === 1)?.points ?? 0
  return {
    schema: 'black-sepulchre.nr.v1',
    side: d.campaignSide,
    source: {
      filename: d.name,
      gameId: 'wh40k11',
      gameRevision: 'reference',
      catalogueId: d.id,
      catalogueRevision: d.source.observedAt,
      catalogueName: d.campaignSide,
      generator: 'Wahapedia',
      provider: 'Wahapedia',
      url: d.source.url,
    },
    profiles,
    units: [
      {
        id: d.id,
        entryId: d.id,
        datasheet: d.name,
        keywords: [...d.keywords, ...d.factionKeywords],
        models,
        profiles: d.references.abilities.map((_, i) => `a${i}`),
        equipment: [],
        rules: [],
        exportedPoints: price,
        selectedPoints: price,
        copyOrdinal: 1,
        paidOptions: [],
        leaderFor: d.references.attachmentTargets.leader,
        supportFor: d.references.attachmentTargets.support,
        issues: [
          {
            code: 'reference_loadout',
            blocking: false,
            message:
              'Бесплатное вооружение выбирается в New Recruit; здесь нужны размер, цена и характеристики моделей.',
          },
        ],
      },
    ],
    detachments: [],
    dispositions: [],
    issues: [
      {
        code: 'reference_review',
        blocking: false,
        message:
          'Справочный кандидат: доступность для Deathwatch, актуальность и контекст цены требуют проверки официального документа.',
      },
    ],
    points: price,
    limit: null,
  }
}

export function draftCatalog(source: SourceImport, u: ImportedUnit, id: string): CatalogUnit {
  const card = cardFromImport(source, u),
    keys = [...new Set([...u.keywords, ...u.models.flatMap((g) => g.keywords)].map(keyword))]
  card.reviewedAgainst = SITE_RULES_SOURCE
  if (source.source.provider === 'Wahapedia') card.profiles = structuredClone(source.profiles)
  // This malformed supplied example otherwise looks like a selectable 14-model variant.
  // A changed official composition can be recorded explicitly in a reviewed Snapshot.
  if (sameDatasheet(u.datasheet, 'Deathwatch Veterans')) card.composition = { min: 5, max: 10 }
  const transportRule = suggestedTransport(u.datasheet)
  return {
    id,
    side: source.side,
    datasheet: u.datasheet,
    size: `${modelCount(u)} моделей · вариант`,
    models: modelCount(u),
    rc: u.exportedPoints,
    copyPrices: [],
    keywords: keys,
    character: keys.includes('CHARACTER'),
    epic: keys.includes('EPIC HERO'),
    battleline: keys.includes('BATTLELINE'),
    garrison: 'other',
    leaderFor: u.leaderFor,
    supportFor: u.supportFor,
    transport: transportRule?.groups.reduce((n, g) => n + g.capacity, 0) ?? 0,
    transportRule,
    cargoKeywords: [],
    ranged: Object.values(card.profiles).some((p) => /ranged/i.test(p.type)),
    restoration: source.side === 'necrons',
    unique: keys.includes('EPIC HERO'),
    card,
  }
}

/** Enrichment keeps the existing catalog ID, so campaign IDs and starters stay linked. */
export function snapshotWithCatalog(
  snapshot: Snapshot,
  c: CatalogUnit,
  targetId: string | null,
  date: string,
  id: string,
): Snapshot {
  if (!c.card) throw Error('Нет карточки выбранного состава')
  validateCard(c.card, c.models)
  const next = structuredClone(snapshot)
  if (targetId) {
    const old = next.catalog.find((v) => v.id === targetId)
    if (!old || old.side !== c.side || !sameDatasheet(old.datasheet, c.datasheet))
      throw Error('Выберите тот же datasheet вашей стороны')
    next.catalog = next.catalog.map((v) =>
      v.id === targetId ? { ...structuredClone(c), id: old.id, datasheet: old.datasheet } : v,
    )
  } else {
    if (next.catalog.some((v) => v.id === c.id))
      throw Error('Этот ID уже есть в Snapshot; выберите обновление варианта')
    next.catalog.push(structuredClone(c))
  }
  next.id = id
  next.date = date
  next.approved = []
  const note =
    `${c.card.source.provider ?? 'New Recruit'}: ${c.card.source.catalogueName} revision ${c.card.source.catalogueRevision}; ${c.card.reviewedAgainst}`.slice(
      0,
      500,
    )
  if (!next.sources.includes(note)) next.sources = [...next.sources, note].slice(-30)
  return next
}
