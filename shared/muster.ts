import { HONOURS } from './rules.generated.ts'
import { SIDES, type Battle, type Muster, type Side, type State } from './model.ts'
import { sameDatasheet, datasheetName } from './datasheets.ts'
import { validateCargo } from './transport.ts'
import { optionalPackageCost } from './unit-choices.ts'
import {
  assert,
  available,
  entry,
  garrisonLegal,
  present,
  STAGES,
  surcharge,
  unit,
} from './rules.ts'
export function validateMuster(
  s: State,
  side: Side,
  m: Muster,
  b: Battle = s.battle!,
): Record<string, number> {
  assert(
    m &&
      Array.isArray(m.picks) &&
      Array.isArray(m.rest) &&
      Array.isArray(m.detachments) &&
      Array.isArray(m.dispositions),
    'Неверный commitment',
  )
  assert(
    m.picks.length > 0 && m.picks.length <= 100 && m.rest.length <= 100,
    'Нужен хотя бы один legal ID',
  )
  const p = s.players[side],
    stage = STAGES[b.stage],
    limit = b.type === 'PACT' || b.forces?.[side] === 'stf' ? b.al / 2 : b.al
  const ids = m.picks.map((v) => v.id)
  assert(new Set(ids).size === ids.length, 'ID встречается дважды')
  assert(
    new Set(m.rest).size === m.rest.length && !m.rest.some((v) => ids.includes(v)),
    'RESTING пересекается с commitment',
  )
  const dp = m.detachments.map((id) => b.snapshot.detachments.find((d) => d.id === id))
  assert(
    dp.every(Boolean) &&
      dp.length > 0 &&
      new Set(m.detachments).size === dp.length &&
      m.detachments.every((id) => p.package.includes(id)),
    'Detachment вне Stage Package',
  )
  assert(
    limit < 1000 || b.type === 'PACT'
      ? dp.length === 1
      : dp.reduce((n, d) => n + d!.dp, 0) <= stage.dp,
    'Превышен Detachment budget',
  )
  const allowed = (id: string, role: string) => {
    const u = unit(s, id, side)
    assert(available(s, u), 'ID unavailable')
    const c = entry(s, u, b.snapshot)
    assert(c.side === side, 'Datasheet другой фракции')
    if (role === 'field') {
      assert(
        u.location === (b.forces?.[side] === 'stf' ? 'stf' : 'field'),
        'ID отсутствует в выбранной Force',
      )
      assert(
        !(b.type === 'garrison' && side === b.defender),
        'Defender Field Force не находится в секторе',
      )
    } else {
      assert(
        side === b.defender &&
          ['field', 'garrison', 'assault'].includes(b.type) &&
          u.location === 'garrison' &&
          u.sector === b.sector &&
          garrisonLegal(s, u, u.sector),
        'Недопустимый местный гарнизон',
      )
    }
    assert(!c.epic || limit >= 1000, 'Epic запрещён в малом формате')
    assert(!c.keywords.includes('TITANIC') || limit >= 1000, 'TITANIC запрещён в малом формате')
    assert(!u.flags.commission || role !== 'field', 'Commission нельзя перевести в Field')
    return u
  }
  const counts: Record<string, number> = {},
    costs: Record<string, number> = {},
    forms = new Map<string, typeof m.picks>()
  let enhancementCount = 0
  const enhIds = new Set<string>()
  for (const v of m.picks) {
    assert(
      ['field', 'initial', 'pool'].includes(v.role) &&
        typeof v.formation === 'string' &&
        v.formation.length <= 80,
      'Неверная роль/формация',
    )
    const u = allowed(v.id, v.role),
      c = entry(s, u, b.snapshot)
    counts[datasheetName(c.datasheet)] = (counts[datasheetName(c.datasheet)] ?? 0) + 1
    const f = forms.get(v.formation) ?? []
    f.push(v)
    forms.set(v.formation, f)
    assert(
      Array.isArray(v.honours) &&
        new Set(v.honours).size === v.honours.length &&
        v.honours.every((h) => u.honours.includes(h)),
      'Неверные active Honours',
    )
    const hs = v.honours.map((id) => HONOURS.find((h) => h.id === id))
    assert(
      hs.every(Boolean) && hs.filter((h) => h!.tier === 'Signature').length <= 1,
      'Неизвестный Honour / несколько Signature',
    )
    assert(
      hs.filter((h) => h!.tier === 'Major').length <= (u.xp >= 18 ? 2 : 1),
      'Слишком много Major',
    )
    assert(
      hs.filter((h) => h!.tier !== 'Signature').length <=
        Math.min(3, u.xp >= 12 ? 3 : u.xp >= 7 ? 2 : u.xp >= 3 ? 1 : 0),
      'Недостаточный ранг',
    )
    assert(
      hs.every(
        (h) =>
          (h!.tier !== 'Signature' || u.xp >= 18) &&
          (!h!.side || h!.side === side) &&
          (!h!.character || c.character),
      ),
      'Honour неприменимо',
    )
    assert(
      !c.epic || (!v.honours.length && !v.armoury && !v.relic),
      'Epic не получает Campaign upgrades',
    )
    if (v.enhancement) {
      const e = b.snapshot.enhancements.find((e) => e.id === v.enhancement)
      assert(
        e &&
          c.character &&
          !c.epic &&
          m.detachments.includes(e.detachment) &&
          e.eligible.every((k) => c.keywords.includes(k)),
        'Enhancement нелегален',
      )
      assert(!enhIds.has(e.id), 'Дубликат Enhancement')
      enhIds.add(e.id)
      enhancementCount++
      assert(
        !p.enhancements[e.id] || p.enhancements[e.id] === u.id || p.enhancementStage !== b.stage,
        'Enhancement закреплён за другим ID',
      )
    }
    assert(
      v.redemption === null || u.scars.some((c) => c.id === v.redemption),
      'Нет Scar для Redemption',
    )
    if (v.redemption !== null)
      assert(
        ['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].includes(v.redemptionDeed ?? ''),
        'Выберите подходящий Redemption Deed',
      )
    assert(
      (!u.scars.some((c) => c.id === 12) && side === 'necrons') ||
        v.protocol === 'HOLD' ||
        v.protocol === 'HUNT' ||
        side === 'deathwatch',
      'Выберите Protocol Obsession',
    )
    if (v.transport === null && c.transport > 0 && v.role !== 'field')
      assert(
        m.picks.some((cargo) => cargo.transport === v.id),
        'Garrison transport требует committed cargo',
      )
    if (v.role === 'pool' && side === 'necrons' && u.scars.some((c) => c.id === 9))
      assert(b.firstSlot + 1 <= 5, 'Scar задерживает Pool за R5')
  }
  assert(
    enhancementCount <= (b.type === 'PACT' ? 2 : stage.enhancements),
    'Слишком много Enhancements',
  )
  for (const [name, n] of Object.entries(counts)) {
    const variants = m.picks
      .map((v) => entry(s, unit(s, v.id), b.snapshot))
      .filter((c) => datasheetName(c.datasheet) === name)
    const c = variants[0]
    assert(
      n <=
        Math.min(
          ...variants.map((c) =>
            c.unique || c.epic
              ? 1
              : c.battleline
                ? limit < 1000
                  ? 2
                  : stage.battleline
                : limit < 1000
                  ? 1
                  : stage.copies,
          ),
        ),
      `Превышен лимит отдельных отрядов ${c.datasheet}`,
    )
  }
  for (const f of forms.values()) {
    assert(
      f.every(
        (v) => v.role === f[0].role && v.reserve === f[0].reserve && v.transport === f[0].transport,
      ),
      'Компоненты формации имеют разные роли/резервы/транспорт',
    )
    const body = f.filter((v) => !entry(s, unit(s, v.id), b.snapshot).character),
      leaders = f.filter((v) => entry(s, unit(s, v.id), b.snapshot).character)
    if (f.length > 1) {
      assert(body.length === 1 && leaders.length <= 2, 'Нелегальная Attached формация')
      const target = entry(s, unit(s, body[0].id), b.snapshot).datasheet
      const roles = leaders.map((v) => entry(s, unit(s, v.id), b.snapshot))
      const can = (c: (typeof roles)[number], role: 'leader' | 'support') =>
        (role === 'leader' ? c.leaderFor : (c.supportFor ?? [])).some((name) =>
          sameDatasheet(name, target),
        )
      assert(
        roles.every((c) => can(c, 'leader') || can(c, 'support')),
        'Leader/Support не присоединяется к Bodyguard',
      )
      if (roles.length === 2) {
        const mixed =
          (can(roles[0], 'leader') && can(roles[1], 'support')) ||
          (can(roles[1], 'leader') && can(roles[0], 'support'))
        const co =
          roles.every((c) => can(c, 'leader')) &&
          roles.some((c, i) =>
            (c.coLeaders ?? []).some((n) => sameDatasheet(n, roles[1 - i].datasheet)),
          )
        assert(mixed || co, 'Нужен один Leader и один Support либо явное исключение двух Leaders')
      }
    }
    if (limit < 1000)
      assert(
        f.reduce((n, v) => n + unit(s, v.id).rc, 0) <= limit * 0.4,
        'Attached/ID RC превышает 40% AL',
      )
  }
  for (const v of m.picks.filter((v) => v.transport)) {
    assert(v.transport !== v.id, 'Самоперевозка')
    const t = m.picks.find((t) => t.id === v.transport)
    assert(
      t && t.role === v.role && t.reserve === v.reserve && !t.transport,
      'Транспорт не committed вместе с грузом',
    )
    const c = entry(s, unit(s, t.id), b.snapshot),
      cargo = m.picks.filter((v) => v.transport === t.id)
    validateCargo(
      c,
      cargo.map((v) => ({
        catalog: entry(s, unit(s, v.id), b.snapshot),
        attachedTo: m.picks
          .filter(
            (p) => p.formation === v.formation && !entry(s, unit(s, p.id), b.snapshot).character,
          )
          .map((p) => entry(s, unit(s, p.id), b.snapshot))[0],
      })),
    )
  }
  for (const v of m.picks) {
    const u = unit(s, v.id),
      c = entry(s, u, b.snapshot),
      ordered = m.picks
        .filter((v) => sameDatasheet(entry(s, unit(s, v.id), b.snapshot).datasheet, c.datasheet))
        .sort((a, b) => a.id.localeCompare(b.id)),
      i = ordered.findIndex((x) => x.id === v.id)
    costs[v.id] =
      (c.copyPrices[i] ?? c.rc) +
      optionalPackageCost(c, v.paidOptions ?? [], m.detachments) +
      (v.enhancement ? b.snapshot.enhancements.find((e) => e.id === v.enhancement)!.cost : 0) +
      surcharge(s, u, v, m.picks)
  }
  const sum = (role: string) =>
      m.picks.filter((v) => v.role === role).reduce((n, v) => n + costs[v.id], 0),
    field = sum('field'),
    initial = sum('initial'),
    pool = sum('pool')
  assert(field <= limit, 'Field Effective выше AL')
  assert(pool <= (side === b.defender ? b.pool : 0), 'Pool выше Capacity')
  assert(
    initial <= (b.type === 'garrison' ? b.initial : limit - field),
    'Initial гарнизон превышает бюджет',
  )
  assert(side === b.defender || (!initial && !pool), 'Attacker не использует местный гарнизон')
  assert(
    m.picks
      .filter((v) => v.reserve && v.role !== 'pool')
      .reduce((n, v) => n + costs[v.id] - surcharge(s, unit(s, v.id), v, m.picks), 0) <=
      limit * 0.5,
    'Official Initial Reserves превышают 50% AL по OBC',
  )
  assert(
    m.picks.every(
      (v) => !v.reserve || !entry(s, unit(s, v.id), b.snapshot).keywords.includes('FORTIFICATION'),
    ),
    'FORTIFICATION не идёт в Reserves',
  )
  assert(
    new Set(m.dispositions).size === m.dispositions.length &&
      m.dispositions.every((id) =>
        b.snapshot.dispositions?.some((d) => d.id === id && d.side === side),
      ),
    'Disposition отсутствует в каталоге',
  )
  const commander = m.picks.find((v) => v.id === m.commander)
  assert(commander, 'Нужен Warlord / Garrison Commander')
  assert(
    entry(s, unit(s, commander.id), b.snapshot).character ||
      (b.type === 'garrison' && side === b.defender && commander.role === 'initial'),
    'Нелегальный Warlord',
  )
  for (const d of dp)
    assert(
      d!.requiredKeywords.every((k) =>
        m.picks.some((v) => entry(s, unit(s, v.id), b.snapshot).keywords.includes(k)),
      ),
      'Не выполнены требования Detachment',
    )
  for (const id of m.rest) {
    const u = unit(s, id, side)
    assert(
      available(s, u) &&
        ((u.location === (b.forces?.[side] === 'stf' ? 'stf' : 'field') &&
          !(b.type === 'garrison' && side === b.defender)) ||
          (u.location === 'garrison' && u.sector === b.sector && garrisonLegal(s, u, u.sector!))),
      'Нелегальный RESTING',
    )
  }
  return costs
}
export function revealAllowed(b: Battle, viewer: Side, owner: Side): boolean {
  if (viewer === owner) return true
  if (!b.muster[owner]) return false
  const locks = SIDES.filter((s) => b.lock[s])
  return !!b.muster[viewer] || (locks.length === 1 && locks[0] === viewer)
}
export function underdog(b: Battle, side: Side): number {
  if (
    !['field', 'encounter', 'WAR'].includes(b.type) ||
    SIDES.some((s) => b.muster[s]?.picks.some((p) => p.role !== 'field'))
  )
    return 0
  const sum = (s: Side) => (b.muster[s]?.picks ?? []).reduce((n, p) => n + b.costs[p.id], 0),
    own = sum(side),
    enemy = sum(side === 'deathwatch' ? 'necrons' : 'deathwatch')
  return enemy > own ? Math.min(3, Math.floor(((enemy - own) / enemy + 0.0000001) * 10)) : 0
}
