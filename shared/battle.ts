import {
  SIDES,
  other,
  type Battle,
  type Command,
  type Context,
  type Muster,
  type SectorKey,
  type Side,
  type State,
} from './model.ts'
import {
  assert,
  bonus,
  BREACH,
  DEFENSIVE,
  home,
  intel,
  SECTORS,
  spend,
  STAGES,
  TACTICAL,
  tier,
} from './rules.ts'
import { underdog, validateMuster } from './muster.ts'
import { enhancementBearers, bindEnhancement } from './enhancements.ts'
import { createTable } from './table.ts'
export function declareBattle(
  s: State,
  sector: SectorKey | 'X',
  attacker: Side,
  raid: boolean,
  ctx: Context,
  type?: Battle['type'],
) {
  const defender = other(attacker),
    assault = sector !== 'X' && SECTORS[sector].home,
    kind = type ?? (assault ? 'assault' : s.players[defender].mf === sector ? 'field' : 'garrison'),
    caps =
      sector === 'X'
        ? { initial: 0, pool: 0, firstSlot: 3, breaches: 0, defAsset: false }
        : tier(s, sector)
  const attackForce = type ? 'mf' : (s.activation?.force ?? 'mf'),
    defenderForces: ('mf' | 'stf')[] =
      sector === 'X'
        ? ['mf']
        : ([
            ...(s.players[defender].mf === sector ? ['mf'] : []),
            ...(s.players[defender].stf === sector ? ['stf'] : []),
          ] as ('mf' | 'stf')[])
  const actualKind = !type && !assault && defenderForces.length ? 'field' : kind
  // Freeze all owned variants, including reserve/garrison choices, without copying
  // hundreds of unowned shopping options into every historical battle record.
  const owned = new Set(s.units.map((u) => u.catalogId))
  s.battle = {
    id: ctx.id(),
    number: s.battles + 1,
    sector,
    origin: attackForce === 'mf' ? s.players[attacker].mf : s.players[attacker].stf!,
    forces: { [attacker]: attackForce, [defender]: defenderForces[0] ?? 'mf' } as Record<
      Side,
      'mf' | 'stf'
    >,
    defenderForces,
    attacker,
    defender,
    type: actualKind,
    raid,
    al: STAGES[s.stage].al,
    stage: s.stage,
    snapshot: structuredClone({
      ...s.snapshot,
      catalog: s.snapshot.catalog.filter((c) => owned.has(c.id)),
    }),
    sectorSnapshot: sector === 'X' ? null : structuredClone(s.sectors[sector]),
    mission: null,
    options: [],
    missionChooser: attacker,
    missionPass: [],
    rerolled: false,
    usedMissions: [],
    lock: {},
    muster: {},
    interdict: {},
    assets: {},
    costs: {},
    ...caps,
    table: createTable(s, 'X', ctx),
    report: null,
    confirm: [],
    outcome: null,
    terminal: false,
    ending: null,
    casualties: [],
    salvage: { deathwatch: 0, necrons: 0 },
    salvageRerolled: [],
    eventOptions: [],
    event: null,
    eventChooser: defender,
    eventPass: [],
    eventRerolled: false,
    choices: [],
    before: structuredClone(s.units),
    beforeSupply: { deathwatch: s.players.deathwatch.supply, necrons: s.players.necrons.supply },
    effects: structuredClone(
      s.effects.filter(
        (e) =>
          e.scope === 'battle' ||
          e.scope === 'side_battle' ||
          e.code === '64' ||
          e.code === 'breach_plan',
      ),
    ),
    logistics: [],
    aftermathApplied: false,
    hiddenSignal: String(ctx.dice(5)),
    decoys: {},
  }
  const b = s.battle
  b.decoys = {}
  if (assault) {
    s.attrition = 0
    if (s.players[defender].integrity === 1) b.options = [`${sector}3`]
    else {
      const all = [`${sector}1`, `${sector}2`],
        used = s.cycles[sector] ?? []
      b.options = all.filter((m) => !used.includes(m))
      if (!b.options.length) {
        s.cycles[sector] = []
        b.options = all
      }
    }
    b.options = [b.options[ctx.dice(b.options.length) - 1]]
    s.players[defender].poolOverride = null
    const plan = s.effects.find(
      (e) => e.code === 'breach_plan' && e.side === attacker && e.data.target === sector,
    )
    if (plan) {
      b.breaches = Math.min(4, b.breaches + 1)
      s.effects = s.effects.filter((e) => e !== plan)
    }
  } else if (kind === 'encounter' || kind === 'WAR' || kind === 'PACT') b.options = [kind]
  else {
    const all = [`${sector}1`, `${sector}2`, `${sector}3`],
      used = s.cycles[sector] ?? []
    let available = all.filter((m) => !used.includes(m))
    if (!available.length) {
      s.cycles[sector] = []
      available = all
    }
    b.usedMissions = available
    const n = bonus(s, 'F', attacker) && !s.players[attacker].flags.relayMissionUsed ? 2 : 1
    if (n === 2) s.players[attacker].flags.relayMissionUsed = true
    for (let i = 0; i < n; i++) b.options.push(available[ctx.dice(available.length) - 1])
  }
  s.phase = 'mission'
  if (s.activation) {
    s.activation.mp = 0
    s.activation.actions = 0
  }
}
export function battleCommand(s: State, c: Command, ctx: Context) {
  const b = s.battle
  assert(b, 'Нет текущего боя')
  const side = ctx.actor,
    p = s.players[side]
  switch (c.type) {
    case 'defender_force':
      assert(
        s.phase === 'mission' &&
          side === b.defender &&
          b.defenderForces?.includes(c.payload.force as 'mf' | 'stf'),
        'Выбор defending Force закрыт',
      )
      b.forces![side] = c.payload.force as 'mf' | 'stf'
      return
    case 'choose_mission':
      assert(
        s.phase === 'mission' &&
          b.missionChooser === side &&
          b.options.includes(String(c.payload.code)),
        'Выбор миссии закрыт',
      )
      b.mission = String(c.payload.code)
      b.options = []
      b.table = createTable(s, b.mission, ctx)
      if (b.type === 'assault' && /[AK]2/.test(b.mission))
        b.pool += Math.floor((b.al * 0.1) / 5) * 5
      return
    case 'mission_reroll':
      assert(
        s.phase === 'mission' &&
          b.mission &&
          !b.rerolled &&
          side === (b.missionPass.length ? b.defender : b.attacker),
        'Не ваша очередь reroll',
      )
      {
        let options = b.usedMissions.filter((m) => m !== b.mission)
        if (b.type === 'assault') {
          assert(side === b.attacker, 'Внешнюю осаду меняет Attacker')
          assert(!/[AK]3/.test(b.mission), 'Финальная Home mission фиксирована')
          options = [`${b.sector}${b.mission.endsWith('1') ? '2' : '1'}`].filter(
            (m) => !(s.cycles[b.sector] ?? []).includes(m),
          )
        }
        assert(options.length > 0, 'Другой legal mission нет')
        spend(s, side, 1, 'intel')
        if (b.type === 'assault' && b.mission.endsWith('2'))
          b.pool -= Math.floor((b.al * 0.1) / 5) * 5
        b.mission = options[ctx.dice(options.length) - 1]
        b.rerolled = true
        if (b.type === 'assault' && b.mission.endsWith('2'))
          b.pool += Math.floor((b.al * 0.1) / 5) * 5
        b.table = createTable(s, b.mission, ctx)
      }
      return
    case 'mission_pass':
      assert(s.phase === 'mission' && b.mission && !b.options.length, 'Сначала выберите миссию')
      assert(
        !b.missionPass.includes(side) && side === (b.missionPass.length ? b.defender : b.attacker),
        'Не ваша очередь',
      )
      b.missionPass.push(side)
      if (b.missionPass.length === 2) s.phase = b.type === 'PACT' ? 'muster' : 'lock'
      return
    case 'recon_lock':
      assert(s.phase === 'lock' && b.lock[side] === undefined, 'Lock уже зафиксирован')
      {
        const lock = c.payload.use === true,
          free = b.effects.some(
            (e) =>
              (e.code === '34' || e.code === 'free_lock') && (e.side === null || e.side === side),
          )
        if (lock)
          spend(s, side, (free ? 0 : 1) + (b.effects.some((e) => e.code === '42') ? 1 : 0), 'intel')
        b.lock[side] = lock
        if (SIDES.every((s) => b.lock[s] !== undefined)) s.phase = 'muster'
      }
      return
    case 'commit_muster':
      {
        assert(s.phase === 'muster' && !b.muster[side], 'Commitment закрыт')
        const locks = SIDES.filter((s) => b.lock[s])
        if (locks.length === 1 && locks[0] === side)
          assert(!!b.muster[other(side)], 'Сначала раскрывается противник')
        const m = c.payload.muster as unknown as Muster
        const costs = validateMuster(s, side, m)
        b.muster[side] = structuredClone(m)
        Object.assign(b.costs, costs)
        if (p.enhancementStage !== b.stage) {
          p.enhancements = {}
          p.enhancementExtras = {}
          p.enhancementStage = b.stage
        }
        for (const v of m.picks)
          if (v.enhancement)
            bindEnhancement(p, v.enhancement, [
              ...new Set([...enhancementBearers(p, v.enhancement), v.id]),
            ])
        if (SIDES.every((side) => b.muster[side])) {
          if (b.effects.some((e) => e.code === '34') && SIDES.every((side) => b.lock[side]))
            for (const side of SIDES) intel(s, side, 1)
          s.effects = s.effects.filter((e) => e.code !== 'free_lock' && e.code !== '34')
          s.phase = b.type === 'PACT' ? 'battle' : 'interdict'
        }
      }
      return
    case 'interdict':
      assert(
        s.phase === 'interdict' && b.interdict[side] === undefined,
        'Interdict уже зафиксирован',
      )
      {
        const target = c.payload.asset === null ? null : String(c.payload.asset)
        assert(
          target === null || [...TACTICAL, ...BREACH].includes(target),
          'Недопустимый Interdict',
        )
        if (target) spend(s, side, 2, 'intel')
        b.interdict[side] = target
        if (SIDES.every((side) => b.interdict[side] !== undefined)) s.phase = 'assets'
      }
      return
    case 'commit_assets':
      {
        assert(s.phase === 'assets' && !b.assets[side], 'Assets уже зафиксированы')
        const a = c.payload.assets as Battle['assets'][Side]
        assert(
          a && Array.isArray(a.tactical) && Array.isArray(a.defensive) && Array.isArray(a.breach),
          'Неверные Assets',
        )
        const all = [...a.tactical, ...a.defensive, ...a.breach]
        assert(all.length === new Set(all).size, 'Дубли Assets между списками')
        assert(
          a.tactical.every((v) => TACTICAL.includes(v)) &&
            a.defensive.every((v) => DEFENSIVE.includes(v)) &&
            a.breach.every((v) => BREACH.includes(v)),
          'Неизвестный Asset',
        )
        assert(a.tactical.length <= underdog(b, side), 'Превышен Tactical budget')
        assert(
          a.defensive.length <= (side === b.defender && b.defAsset ? 1 : 0),
          'Нет Defensive Asset',
        )
        assert(a.breach.length <= (side === b.attacker ? b.breaches : 0), 'Превышен Breach budget')
        assert(!all.includes('barricades') || b.sector !== 'H', 'В H Barricades недоступен')
        assert(
          !a.breach.includes('suppression') ||
            b.muster[b.defender]!.picks.some((p) => p.role === 'pool'),
          'Нет committed Pool для Suppression',
        )
        const banned = b.interdict[other(side)]
        assert(
          !banned || ![...a.tactical, ...a.breach].includes(banned),
          'Asset запрещён Interdict',
        )
        b.assets[side] = structuredClone(a)
        if (SIDES.every((side) => b.assets[side])) s.phase = 'battle'
      }
      return
    default:
      assert(false, 'Неизвестная команда подготовки боя')
  }
}
