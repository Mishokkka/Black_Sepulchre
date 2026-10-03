import {
  SIDES,
  type CatalogUnit,
  type Context,
  type Player,
  type SectorKey,
  type State,
  type Unit,
} from './model.ts'
import { ADJACENCY, home, integer, SECTORS, stageFor } from './rules.ts'
interface Legacy {
  campaign: {
    id: string
    name: string
    battle_count: number
    black_choir: number
    snapshot_date: string
    active_side: null | 'necrons' | 'deathwatch'
  }
  players: Record<string, unknown>[]
  sectors: Record<string, unknown>[]
  units: Record<string, unknown>[]
}
export function importLegacy(raw: Legacy, ctx: Context): State {
  if (
    raw.campaign.battle_count !== 0 ||
    raw.units.some(
      (u) =>
        Number(u.xp) > 0 ||
        Number(u.damage) > 0 ||
        ['honours', 'scars', 'armoury', 'relics'].some(
          (k) => Array.isArray(u[k]) && u[k].length > 0,
        ),
    )
  )
    throw Error(
      'Продолженная кампания требует отдельного перевода истории и улучшений. Исходные данные сохранены.',
    )
  const c = raw.campaign,
    catalog: CatalogUnit[] = [],
    units: Unit[] = []
  for (const u of raw.units) {
    const id = `${u.side}:${u.datasheet}:${u.size_label}`
    if (!catalog.some((c) => c.id === id))
      catalog.push({
        id,
        side: u.side as CatalogUnit['side'],
        datasheet: String(u.datasheet),
        size: String(u.size_label),
        models: Number(String(u.size_label).match(/\d+/)?.[0] ?? 1),
        rc: Number(u.reference_cost),
        copyPrices: [],
        keywords: (u.keywords ?? []) as string[],
        character: !!u.is_character,
        epic: !!u.is_epic_hero,
        battleline: !!u.is_battleline,
        garrison: (['core', 'heavy', 'other'].includes(String(u.garrison_class))
          ? u.garrison_class
          : !!u.is_character
            ? 'heavy'
            : 'forbidden') as CatalogUnit['garrison'],
        leaderFor: [],
        transport: 0,
        cargoKeywords: ['INFANTRY'],
        ranged: true,
        restoration: u.side === 'necrons',
        unique: !!u.is_epic_hero,
      })
    units.push({
      id: String(u.id),
      side: u.side as Unit['side'],
      name: String(u.name),
      catalogId: id,
      rc: Number(u.reference_cost),
      xp: Number(u.xp),
      damage: Number(u.damage),
      location: u.location_type as Unit['location'],
      sector: u.sector_key as SectorKey | null,
      status: (['active', 'archived', 'lost', 'displaced'].includes(String(u.status))
        ? u.status
        : 'active') as Unit['status'],
      honours: [],
      scars: [],
      armoury: null,
      relic: null,
      flags: { legacyImported: true },
      recovery: 0,
      evacDebt: 0,
      trauma: false,
    })
  }
  // Legacy advancement is retained in the immutable database backup. It must be reviewed,
  // rather than silently translated from percentage CR and obsolete effect names.
  const players = Object.fromEntries(
    SIDES.map((side) => {
      const p = raw.players.find((p) => p.side === side) ?? {}
      return [
        side,
        {
          supply: Number(p.supply ?? 100),
          intel: Number(p.intelligence ?? 1),
          recovery: Number(p.recovery_supply ?? 0),
          mf: (p.main_force_sector ?? home(side)) as SectorKey,
          fragments: Number(p.secret_fragments ?? 0),
          integrity: Number(p.fortress_integrity ?? 2),
          poolOverride: null,
          debt: 0,
          package: [`snapshot-detachment:${side}`],
          packageStage: stageFor(c.battle_count),
          enhancements: {},
          enhancementStage: stageFor(c.battle_count),
          inventory: [],
          relics: [],
          flags: {},
          prepared: false,
          investigation: 0,
          starter: units
            .filter((u) => u.side === side && u.location === 'field')
            .map((u) => u.catalogId),
          stf: null,
        } satisfies Player,
      ]
    }),
  ) as unknown as State['players']
  const sectors = Object.fromEntries(
    (Object.keys(ADJACENCY) as SectorKey[]).map((key) => {
      const a = raw.sectors.find((a) => a.sector_key === key),
        conditions = (a?.conditions ?? []) as string[]
      return [
        key,
        {
          key,
          owner: (a?.owner_side ?? null) as Unit['side'] | null,
          fortified: !!a?.fortified,
          ruined: conditions.includes('Ruined'),
          exhausted: conditions.includes('Exhausted') ? Number(a?.state_counter ?? 2) : 0,
          exhaustedAt: -1,
          sabotaged: conditions.includes('Sabotaged'),
          disrupted: conditions.includes('Disrupted'),
          contested: conditions.includes('Contested'),
          local: c.battle_count === 0 && ['B', 'C', 'I', 'J'].includes(key) ? 25 : 0,
          relayUntil: null,
        },
      ]
    }),
  ) as State['sectors']
  return {
    id: c.id,
    name: c.name,
    rules: '2.2.1',
    version: 0,
    phase: 'setup',
    battles: integer(c.battle_count),
    stage: stageFor(c.battle_count),
    active: c.active_side ?? (ctx.dice(2) === 1 ? 'deathwatch' : 'necrons'),
    choir: c.black_choir,
    window: 0,
    activation: null,
    players,
    sectors,
    units,
    snapshot: {
      id: 'snapshot-2026-09-30-import',
      date: c.snapshot_date,
      sources: [],
      catalog,
      enhancements: [],
      detachments: SIDES.map((side) => ({
        id: `snapshot-detachment:${side}`,
        name: `Укажите legal Detachment ${side}`,
        dp: 1,
        requiredKeywords: [],
        side,
      })),
      approved: [],
    },
    setupApproved: [],
    history: [],
    battle: null,
    effects: [],
    cycles: {},
    quiet: 0,
    quietActivations: 0,
    attrition: 0,
    activationCount: 0,
    pendingReaction: null,
    finalModes: {},
    winner: null,
    log: [],
    flags: { migrationReview: true },
  }
}
export function newUnit(
  s: State,
  side: Unit['side'],
  catalogId: string,
  name: string,
  ctx: Context,
): Unit {
  const c = s.snapshot.catalog.find((c) => c.id === catalogId && c.side === side)
  if (!c) throw Error('Datasheet не в Snapshot')
  return {
    id: ctx.id(),
    side,
    name,
    catalogId,
    rc: c.rc,
    xp: 0,
    damage: 0,
    location: 'field',
    sector: null,
    status: 'active',
    honours: [],
    scars: [],
    armoury: null,
    relic: null,
    flags: {},
    recovery: 0,
    evacDebt: 0,
    trauma: false,
  }
}
export function addEffect(
  s: State,
  code: string,
  side: Unit['side'] | null,
  scope: State['effects'][number]['scope'] = 'side_battle',
  data: State['effects'][number]['data'] = {},
) {
  const old = s.effects.find((e) => e.code === code && e.side === side)
  const expires =
    scope === 'activation'
      ? s.activationCount + (s.active === side ? 2 : 1)
      : s.battles + (s.battle?.aftermathApplied ? 2 : 1)
  if (old) {
    old.expires = Math.max(old.expires, expires)
    old.data = data
  } else s.effects.push({ code, side, scope, expires, data })
}
export function beginActivation(s: State) {
  s.phase = 'strategy'
  s.activationCount++
  const p = s.players[s.active]
  for (const a of Object.values(s.sectors)) {
    if (a.owner === s.active) {
      if (a.exhausted && a.exhaustedAt < s.activationCount) a.exhausted--
      a.disrupted = false
    }
  }
  p.flags.sectorB = false
  p.flags.sectorF = false
  p.flags.relayMissionUsed = false
  p.flags.gDiscountActivation = false
  s.activation = {
    number: s.activationCount,
    side: s.active,
    origin: p.mf,
    actions: s.effects.some((e) => e.code === '44' && e.side === s.active) ? 1 : 2,
    mp: 2,
    force: 'mf',
    forcedMarch: false,
    movedSpecial: false,
    logistics: [],
    discountUsed: false,
    emergencyRepair: false,
    purchases: 0,
    hadBattle: false,
  }
  s.effects = s.effects.filter((e) => !(e.code === '44' && e.side === s.active))
  const own = Object.values(s.sectors).filter((a) => a.owner === s.active).length,
    enemy = Object.values(s.sectors).filter((a) => a.owner && a.owner !== s.active).length
  if (enemy - own >= 4 && !p.flags.intelWindow) {
    p.intel = Math.max(p.intel, Math.min(6, p.intel + 1))
    p.flags.intelWindow = true
  }
}
export function finishActivation(s: State) {
  const act = s.activation!
  if (!act.hadBattle) {
    s.quietActivations++
    if (s.quietActivations % 2 === 0) s.quiet++
  }
  for (const a of Object.values(s.sectors))
    if (
      a.relayUntil !== null &&
      a.relayUntil <= s.activationCount &&
      (a.key !== 'F' || s.flags.relayOwner === act.side)
    )
      a.relayUntil = null
  s.effects = s.effects.filter(
    (e) => e.scope !== 'activation' || e.side !== act.side || e.expires > s.activationCount,
  )
  s.active = act.side === 'deathwatch' ? 'necrons' : 'deathwatch'
  beginActivation(s)
}
