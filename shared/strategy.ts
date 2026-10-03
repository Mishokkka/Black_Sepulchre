import { other, type Command, type Context, type SectorKey, type State } from './model.ts'
import {
  ADJACENCY,
  assert,
  available,
  bonus,
  choir,
  credit,
  distance,
  entry,
  garrisonLegal,
  home,
  intel,
  integer,
  key,
  SECTORS,
  spend,
  STAGES,
  supplied,
  unit,
  up5,
} from './rules.ts'
import { addEffect } from './state.ts'
import { declareBattle } from './battle.ts'
export function setExhausted(s: State, sector: SectorKey) {
  s.sectors[sector].exhausted = 2
  s.sectors[sector].exhaustedAt = s.activationCount
}
export function capture(s: State, sector: SectorKey, side: Context['actor'], realBattle: boolean) {
  const a = s.sectors[sector],
    previous = a.owner
  a.owner = side
  a.contested = false
  if (a.fortified) {
    a.fortified = false
    a.ruined = true
  }
  a.local = 0
  if (realBattle) a.sabotaged = false
  a.disrupted = true
  if (sector === 'G' && previous === null) choir(s, 1)
  if (sector === 'I' && previous !== side) credit(s, side, 25)
}
export function strategic(s: State, c: Command, ctx: Context) {
  const side = ctx.actor,
    p = s.players[side],
    act = s.activation!
  assert(
    s.phase === 'strategy' && s.active === side && act,
    'Сейчас не ваша стратегическая Activation',
  )
  const from = act.force === 'stf' ? p.stf! : p.mf,
    al = STAGES[s.stage].al
  if (c.type === 'select_force') {
    assert(
      act.actions === 2 && act.mp === 2 && s.players[side].mf !== undefined,
      'Force выбирается до первого действия',
    )
    assert(c.payload.force === 'mf' || (c.payload.force === 'stf' && p.stf), 'STF не создан')
    assert(c.payload.force !== 'stf' || s.quiet < 3, 'Contact Clock требует Main Force')
    act.force = c.payload.force as 'mf' | 'stf'
    act.origin = act.force === 'mf' ? p.mf : p.stf!
    return
  }
  if (c.type === 'move' || c.type === 'attack') {
    const target = key(c.payload.target),
      friendly = s.sectors[target].owner === side,
      method = String(c.payload.method ?? 'normal'),
      raid = !!c.payload.raid
    assert(act.mp > 0, 'Нет MP')
    assert(target !== from, 'Force уже здесь')
    let cost = 0,
      mp = 1
    if (method === 'normal') assert(ADJACENCY[from].includes(target), 'Цель не соседняя')
    else if (method === 'deep' || method === 'hidden') {
      assert(
        !friendly && distance(from, target) === 2 && supplied(s, side, from),
        'Дальний hostile entry требует Supplied Origin и расстояния 2',
      )
      cost = method === 'deep' ? 2 : 1
      if (method === 'hidden')
        assert(
          s.effects.some((e) => e.code === '35' && e.side === side),
          'Нет Hidden Route',
        )
      if (bonus(s, 'G', side) && p.flags.gDiscountStage !== s.stage) {
        cost = Math.max(0, cost - 1)
        p.flags.gDiscountStage = s.stage
      }
      if (method === 'hidden')
        s.effects = s.effects.filter((e) => !(e.code === '35' && e.side === side))
    } else if (method === 'airlift') {
      assert(
        from === 'C' &&
          act.origin === 'C' &&
          bonus(s, 'C', side) &&
          !act.movedSpecial &&
          distance(from, target) <= 2,
        'Airlift недоступен',
      )
      if (friendly) assert(supplied(s, side, target), 'Airlift только в Supplied')
      else cost = 1
      act.movedSpecial = true
      if (s.effects.some((e) => e.code === 'airlift' && e.side === side)) {
        cost = 0
        s.effects = s.effects.filter((e) => !(e.code === 'airlift' && e.side === side))
      }
    } else if (method === 'glass') {
      assert(
        !friendly &&
          from === 'H' &&
          act.origin === 'H' &&
          bonus(s, 'H', side) &&
          !act.movedSpecial &&
          distance(from, target) === 2,
        'Glass Ambush недоступен',
      )
      act.movedSpecial = true
      cost = 1
    } else if (method === 'route') {
      const e = s.effects.find((e) => e.code === '64' && e.side === side)
      assert(
        act.force === 'mf' &&
          e &&
          e.data.origin === from &&
          e.data.target === target &&
          supplied(s, side, from),
        'Нет Route из физического Origin',
      )
      s.effects = s.effects.filter((v) => v !== e)
    } else assert(false, 'Неизвестный маршрут')
    if (
      ['deep', 'hidden', 'airlift', 'glass'].includes(method) &&
      !friendly &&
      s.effects.some((e) => e.code === '42')
    )
      cost++
    if (SECTORS[target].home && !friendly) {
      assert(
        act.force === 'mf' &&
          ADJACENCY[from].includes(target) &&
          al >= 1000 &&
          supplied(s, side, from),
        'Осада требует Supplied Main Force непосредственно рядом с Home и AL 1000',
      )
      assert(
        s.sectors.G.owner === side ||
          (s.choir >= 8 && p.fragments === 3) ||
          (al >= 1500 && s.attrition >= 4),
        'Нужен G, Reveal IV +3 Fragments либо War of Attrition',
      )
      if (p.flags.repeatAssault === s.activationCount) cost += 2
    }
    spend(s, side, cost, 'intel')
    if (friendly) {
      assert(c.type === 'move', 'По своему сектору только move')
      act.mp -= mp
      if (act.force === 'mf') p.mf = target
      else p.stf = target
      return
    }
    assert(c.type === 'attack', 'Для hostile entry объявите атаку')
    act.mp = 0
    act.actions = 0
    if (method === 'airlift' && ctx.dice(6) === 1) setExhausted(s, 'C')
    if (bonus(s, 'F', side) && !p.flags.sectorF) {
      p.flags.sectorF = true
    }
    if (bonus(s, 'F', other(side)) && !s.players[other(side)].flags.sectorF) {
      intel(s, other(side), 1, true)
      s.players[other(side)].flags.sectorF = true
    }
    const defenders = s.units.filter(
      (u) =>
        u.side === other(side) &&
        available(s, u) &&
        ((u.location === 'field' && s.players[u.side].mf === target) ||
          (u.location === 'stf' && s.players[u.side].stf === target) ||
          (u.location === 'garrison' && u.sector === target && garrisonLegal(s, u, target))),
    )
    if (!defenders.length) {
      assert(!raid, 'Пустой сектор нельзя рейдить')
      if (SECTORS[target].home) {
        s.attrition = 0
        s.players[other(side)].integrity--
        if (s.players[other(side)].integrity === 0) {
          s.sectors[target].owner = side
          s.winner = side
          s.phase = 'ending'
          s.flags.unmannedFinal = true
          return
        }
        s.players[other(side)].poolOverride = 60
      } else {
        capture(s, target, side, false)
        if (act.force === 'mf') p.mf = target
        else p.stf = target
      }
      s.phase = 'logistics'
      act.logistics = [side]
      return
    }
    declareBattle(s, target, side, raid, ctx)
    if (s.effects.some((e) => e.code === '55')) {
      intel(s, side, 1)
      s.effects = s.effects.filter((e) => e.code !== '55')
    }
    return
  }
  if (c.type === 'end_strategy') {
    s.phase = 'logistics'
    act.logistics = [side]
    return
  }
  assert(c.type === 'action', 'Неизвестная стратегическая команда')
  assert(act.actions > 0, 'Нет Actions')
  const action = String(c.payload.action),
    own = s.sectors[from].owner === side
  if (s.effects.some((e) => e.code === '23' && e.side === side)) {
    s.effects = s.effects.filter((e) => !(e.code === '23' && e.side === side))
    act.actions--
    if (ctx.dice(6) < 4) return
    act.actions++
  }
  switch (action) {
    case 'recon':
      spend(s, side, s.effects.some((e) => e.code === '42') ? 1 : 0, 'intel')
      assert(!p.flags.intelWindow, 'Recon доход Window уже использован')
      intel(s, side, 1, true)
      p.flags.intelWindow = true
      break
    case 'mobilise':
      assert(
        own && !SECTORS[from].home && supplied(s, side, from) && !p.flags.supplyWindow,
        'Mobilise недоступен',
      )
      credit(s, side, up5(al * 0.1))
      p.flags.supplyWindow = true
      setExhausted(s, from)
      break
    case 'fortify':
      assert(own && supplied(s, side, from) && !s.sectors[from].fortified, 'Fortify недоступен')
      spend(s, side, s.sectors[from].ruined ? up5(up5(al * 0.15) / 2) : up5(al * 0.15))
      s.sectors[from].fortified = true
      s.sectors[from].ruined = false
      break
    case 'repair':
      assert(own, 'Repair в своём секторе')
      if (c.payload.condition === 'exhausted') {
        assert(
          s.sectors[from].exhausted > 0 && s.sectors[from].exhaustedAt !== s.activationCount,
          'Свежий Exhausted нельзя ремонтировать',
        )
        s.sectors[from].exhausted = 0
      } else {
        assert(s.sectors[from].sabotaged, 'Нет Sabotaged')
        s.sectors[from].sabotaged = false
      }
      break
    case 'scavenge':
      assert(
        from === 'J' && bonus(s, 'J', side) && supplied(s, side, from) && !p.flags.supplyWindow,
        'Scavenge недоступен',
      )
      {
        const die = ctx.dice(6)
        credit(s, side, [0, 15, 15, 25, 25, 40][die - 1])
        p.flags.supplyWindow = true
      }
      break
    case 'forced_march':
      assert(!act.forcedMarch, 'Forced March уже был')
      act.forcedMarch = true
      act.mp++
      break
    case 'sabotage': {
      const target = key(c.payload.target)
      assert(
        ADJACENCY[from].includes(target) && s.sectors[target].owner === other(side),
        'Sabotage только соседнего enemy сектора',
      )
      const automatic = c.payload.automatic === true
      spend(
        s,
        side,
        (automatic ? 2 : 1) + (s.effects.some((e) => e.code === '42') ? 1 : 0),
        'intel',
      )
      s.pendingReaction = { side, target, automatic }
      s.phase = 'reaction'
      break
    }
    case 'siege_recon': {
      const target = home(other(side))
      assert(
        ADJACENCY[from].includes(target) && supplied(s, side, from) && !p.flags.siegeWindow,
        'Siege Recon недоступен',
      )
      spend(s, side, 2, 'intel')
      p.flags.siegeWindow = true
      addEffect(s, 'breach_plan', side, 'activation', { target })
      break
    }
    case 'investigate':
      assert(
        s.choir >= 4 &&
          ['G', 'D', 'E', 'F', 'H'].includes(from) &&
          own &&
          p.fragments < 3 &&
          !p.flags.investigateWindow,
        'Investigate недоступен',
      )
      spend(s, side, 1, 'intel')
      p.flags.investigateWindow = true
      if (p.investigation >= 2) {
        p.fragments++
        p.investigation = 0
      } else {
        const die = ctx.dice(6)
        if (die === 6) {
          p.fragments++
          p.investigation = 0
        } else {
          p.investigation++
          if (die === 3 || die === 4) intel(s, side, 1)
          if (die === 5) credit(s, side, 20)
        }
      }
      break
    case 'doctrine':
      assert(act.force === 'mf', 'Doctrine при Main Force')
      assert(own && supplied(s, side, from), 'Doctrine требует Supplied')
      spend(s, side, 25)
      setPackage(s, side, c.payload.package)
      break
    case 'reorganise': {
      assert(own, 'Reorganise в своём секторе')
      const u = unit(s, c.payload.id, side)
      assert(
        (u.location === 'field' && p.mf === from) ||
          u.sector === from ||
          (u.location === 'stf' && p.stf === from),
        'ID не при Force',
      )
      assert(!u.flags.commission, 'Сначала выкупить Commission')
      const target = String(c.payload.location)
      assert(['field', 'garrison', 'stf'].includes(target), 'Неверное назначение')
      if (target === 'garrison') assert(garrisonLegal(s, u, from), 'Категория гарнизона запрещена')
      else {
        assert(target === 'stf' ? p.stf === from : p.mf === from, 'Выбранная Force не здесь')
        const cap = target === 'stf' ? al * 0.75 : al * 1.5
        assert(
          s.units
            .filter(
              (v) =>
                v.id !== u.id && v.side === side && v.location === target && v.status === 'active',
            )
            .reduce((n, v) => n + v.rc, 0) +
            u.rc <=
            cap,
          'Field cap превышен',
        )
      }
      u.location = target as typeof u.location
      u.sector = target === 'garrison' ? from : null
      u.status = 'active'
      break
    }
    default:
      assert(false, 'Неизвестный Action')
  }
  act.actions--
}
export function setPackage(s: State, side: Context['actor'], value: unknown) {
  assert(
    Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 4 &&
      new Set(value).size === value.length,
    'Неверный Package',
  )
  const p = value.map((id) => s.snapshot.detachments.find((d) => d.id === id))
  assert(
    p.every((d) => d && (!d.side || d.side === side)),
    'Detachment отсутствует в Snapshot / другая фракция',
  )
  assert(
    s.stage < 2 ? p.length === 1 : p.reduce((n, d) => n + d!.dp, 0) <= STAGES[s.stage].dp,
    'Package превышает DP',
  )
  s.players[side].package = value as string[]
  s.players[side].packageStage = s.stage
}
