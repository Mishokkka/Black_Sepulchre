import { describeCommand } from './history.ts'
import { HONOURS } from './rules.generated.ts'
import {
  SIDES,
  other,
  type Command,
  type Context,
  type Muster,
  type Side,
  type Snapshot,
  type State,
  type View,
} from './model.ts'
import { assert, available, entry, integer, spend, STAGES, str } from './rules.ts'
import { beginActivation, finishActivation, newUnit } from './state.ts'
import { strategic, setPackage } from './strategy.ts'
import { battleCommand, declareBattle } from './battle.ts'
import { revealAllowed, validateMuster } from './muster.ts'
import { tableCommand } from './table.ts'
import { aftermathCommand } from './aftermath.ts'
import { inLogistics, logistics } from './logistics.ts'
import { acceptSiteRules, snapshotCommand } from './snapshot.ts'
import { validateCard, validateTransportRule } from './datasheets.ts'
import { expandStartingCatalogue, starterUnavailable } from './starting-catalogue.ts'
const STRATEGY = ['move', 'attack', 'action', 'end_strategy', 'select_force']
const PREP = [
  'defender_force',
  'choose_mission',
  'mission_reroll',
  'mission_pass',
  'recon_lock',
  'commit_muster',
  'interdict',
  'commit_assets',
]
const AFTER = [
  'request_correction',
  'approve_correction',
  'cancel_correction',
  'submit_result',
  'confirm_result',
  'choose_ending',
  'salvage_reroll',
  'choose_event',
  'event_reroll',
  'event_pass',
  'aftermath_choice',
  'preview_aftermath',
  'confirm_aftermath',
]
export function command(state: State, c: Command, context: Context): State {
  const s = structuredClone(state),
    dice: number[] = []
  acceptSiteRules(s)
  const ctx = {
    ...context,
    dice: (sides: number) => {
      const n = context.dice(sides)
      integer(n, 1, sides)
      dice.push(n)
      return n
    },
  }
  assert(
    c &&
      typeof c.type === 'string' &&
      c.payload &&
      typeof c.payload === 'object' &&
      !Array.isArray(c.payload),
    'Неверная команда',
  )
  assert(
    s.phase !== 'terminal' ||
      ['request_correction', 'approve_correction', 'cancel_correction'].includes(c.type),
    'Кампания завершена',
  )
  assert(
    !s.correctionProposal || ['approve_correction', 'cancel_correction'].includes(c.type),
    'Коррекция ожидает решения обоих; зависимые действия остановлены',
  )
  assert(
    !s.snapshotProposal ||
      [
        'save_catalog',
        'edit_snapshot',
        'propose_snapshot',
        'approve_snapshot',
        'cancel_snapshot',
      ].includes(c.type),
    'Сохраните или отмените изменения каталога',
  )
  assert(
    !s.pendingAftermath || c.type === 'confirm_aftermath',
    'Preview уже зафиксирован; подтвердите его',
  )
  if (c.type === 'accept_site_rules') {
    // The agreement was supplied by the campaign owner; no game resources change.
  } else if (c.type === 'expand_starting_catalogue') {
    assert(
      !s.battle && ['setup', 'strategy', 'logistics'].includes(s.phase),
      'Каталог расширяется между боями',
    )
    expandStartingCatalogue(s)
    validateSnapshot(s.snapshot)
  } else if (
    [
      'save_catalog',
      'edit_snapshot',
      'propose_snapshot',
      'approve_snapshot',
      'cancel_snapshot',
      'resolve_retired',
    ].includes(c.type)
  )
    snapshotCommand(s, c, ctx, validateSnapshot)
  else if (c.type === 'setup_package') {
    assert(s.phase === 'setup', 'Setup закрыт')
    setPackage(s, ctx.actor, c.payload.package)
    s.setupApproved = s.setupApproved.filter((side) => side !== ctx.actor)
  } else if (c.type === 'ready_army' || c.type === 'approve_setup') {
    assert(
      s.phase === 'setup' && !s.setupApproved.includes(ctx.actor),
      'Подготовка армии уже завершена',
    )
    const us = startingArmy(s, ctx.actor).units
    s.players[ctx.actor].starter = us.map((u) => u.catalogId)
    s.setupApproved.push(ctx.actor)
    if (SIDES.every((side) => s.setupApproved.includes(side))) {
      for (const side of SIDES) startingArmy(s, side)
      s.flags.migrationReview = false
      if (s.battles >= 17) s.phase = 'finale_mode'
      else beginActivation(s)
    }
  } else if (c.type === 'setup_unit') {
    assert(s.phase === 'setup', 'Setup закрыт')
    const u = s.units.find((u) => u.id === c.payload.id && u.side === ctx.actor)
    assert(u, 'Не ваш starter ID')
    if (c.payload.remove === true) u.status = 'archived'
    else {
      const cat = s.snapshot.catalog.find(
        (cat) => cat.id === c.payload.catalogId && cat.side === ctx.actor,
      )
      assert(cat, 'Нет datasheet')
      u.catalogId = cat.id
      u.rc = cat.rc
      u.status = 'active'
    }
    s.setupApproved = s.setupApproved.filter((side) => side !== ctx.actor)
  } else if (c.type === 'setup_add') {
    assert(s.phase === 'setup', 'Setup закрыт')
    const cat = s.snapshot.catalog.find(
      (cat) => cat.id === c.payload.catalogId && cat.side === ctx.actor,
    )
    assert(cat, 'Нет datasheet вашей фракции')
    assert(!starterUnavailable(s, ctx.actor, cat), starterUnavailable(s, ctx.actor, cat) ?? '')
    const u = newUnit(s, ctx.actor, str(c.payload.catalogId, 250), str(c.payload.name), ctx)
    s.units.push(u)
    s.players[ctx.actor].starter.push(u.catalogId)
    s.setupApproved = s.setupApproved.filter((side) => side !== ctx.actor)
  } else if (c.type === 'counter_sabotage') {
    assert(
      s.phase === 'reaction' && s.pendingReaction && ctx.actor === other(s.pendingReaction.side),
      'Нет вашей реакции',
    )
    const r = s.pendingReaction
    if (c.payload.counter === true) spend(s, ctx.actor, 1, 'intel')
    else if (r.automatic || ctx.dice(6) >= 4) s.sectors[r.target].sabotaged = true
    s.pendingReaction = null
    s.phase = 'strategy'
  } else if (c.type === 'end_logistics') {
    inLogistics(s, ctx.actor)
    assert(s.players[ctx.actor].package.length > 0, 'Закрепите Package')
    assert(
      !s.units.some((u) => u.side === ctx.actor && u.status === 'active' && u.flags.ammunitionDue),
      'Закройте Ammunition Debt',
    )
    if (s.activation)
      s.activation.logistics = s.activation.logistics.filter((side) => side !== ctx.actor)
    if (s.battle) s.battle.logistics = s.battle.logistics.filter((side) => side !== ctx.actor)
    for (const u of s.units.filter((u) => u.side === ctx.actor)) delete u.flags.systemicBattle
    for (const k of [
      'discountDLogistics',
      'discountHomeLogistics',
      'foundryLogistics',
      'emergencyRepairLogistics',
    ])
      s.players[ctx.actor].flags[k] = false
    if (!(s.battle?.logistics.length || s.activation?.logistics.length)) {
      s.battle = null
      if (s.battles >= 17) {
        s.phase = 'finale_mode'
        s.finalModes = {}
      } else if (s.quiet >= 3 && !s.activation?.hadBattle) {
        declareBattle(s, 'X', s.active, false, ctx, 'encounter')
      } else finishActivation(s)
    }
  } else if (c.type === 'finale_mode') {
    assert(
      s.phase === 'finale_mode' &&
        !s.finalModes[ctx.actor] &&
        ['PACT', 'WAR'].includes(String(c.payload.mode)),
      'Режим уже выбран',
    )
    s.finalModes[ctx.actor] = c.payload.mode as 'PACT' | 'WAR'
    if (SIDES.every((side) => s.finalModes[side]))
      declareBattle(
        s,
        'X',
        s.active,
        false,
        ctx,
        SIDES.every((side) => s.finalModes[side] === 'PACT') ? 'PACT' : 'WAR',
      )
  } else if (c.type === 'emergency_muster') {
    emergency(s, ctx)
  } else if (c.type === 'enable_stf') {
    inLogistics(s, ctx.actor)
    assert(s.phase === 'logistics' && s.battles >= 8, 'STF после 8 боёв')
    s.flags[`stfVote:${ctx.actor}`] = c.payload.enabled === true
    s.flags.stfEnabled = SIDES.every((side) => s.flags[`stfVote:${side}`])
  } else if (STRATEGY.includes(c.type)) strategic(s, c, ctx)
  else if (PREP.includes(c.type)) battleCommand(s, c, ctx)
  else if (c.type === 'choose_ending' && s.flags.unmannedFinal) {
    assert(s.phase === 'ending' && s.winner === ctx.actor, 'Ending выбирает победитель')
    const ending = String(c.payload.ending)
    assert(
      ['PURGE', 'SEIZE', 'SEAL', 'FEED'].includes(ending) &&
        (!(ending === 'SEAL') || s.players[ctx.actor].fragments === 3) &&
        (!(ending === 'FEED') || s.choir === 8),
      'Ending недоступен',
    )
    s.flags.finalEnding = ending
    s.phase = 'terminal'
    s.activation = null
  } else if (AFTER.includes(c.type)) aftermathCommand(s, c, ctx)
  else if (c.type.startsWith('table_') || c.type === 'echo_wounds') tableCommand(s, c, ctx)
  else logistics(s, c, ctx)
  s.version = state.version + 1
  s.log.push(describeCommand(state, s, c, ctx.actor, dice))
  assertInvariants(s)
  return s
}
export function startingArmy(s: State, side: Side) {
  const us = s.units.filter(
    (u) => u.side === side && u.location === 'field' && u.status === 'active',
  )
  const setupBattle = {
    al: 500,
    stage: 0,
    type: 'field',
    snapshot: s.snapshot,
    defender: other(side),
    attacker: side,
    pool: 0,
    initial: 0,
  } as unknown as NonNullable<State['battle']>
  const setupMuster: Muster = {
    picks: us.map((u) => ({
      id: u.id,
      role: 'field',
      formation: u.id,
      transport: null,
      reserve: false,
      enhancement: null,
      honours: [],
      armoury: false,
      relic: false,
      redemption: null,
      protocol: 'HOLD',
    })),
    rest: [],
    detachments: s.players[side].package,
    commander: us.find((u) => entry(s, u).character)?.id ?? '',
    dispositions: [],
  }
  const costs = s.battles === 0 ? validateMuster(s, side, setupMuster, setupBattle) : {}
  const price = s.battles === 0 ? Object.values(costs).reduce((n, c) => n + c, 0) : 0
  assert(
    s.battles > 0 || (price >= 470 && price <= 500),
    'Стартовый состав должен быть 470–500 Effective',
  )
  for (const u of us)
    assert(
      s.snapshot.catalog.some((c) => c.id === u.catalogId),
      'Юнит отсутствует в каталоге',
    )
  return { units: us, effective: price }
}

function validateSnapshot(s: Snapshot) {
  assert(
    s &&
      typeof s.id === 'string' &&
      s.id.length <= 150 &&
      typeof s.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
      Array.isArray(s.sources) &&
      s.sources.length <= 30 &&
      s.sources.every((v) => typeof v === 'string' && v.length <= 500),
    'Неверные данные каталога',
  )
  assert(
    Array.isArray(s.catalog) &&
      s.catalog.length > 0 &&
      s.catalog.length <= 500 &&
      new Set(s.catalog.map((c) => c.id)).size === s.catalog.length,
    'Неверный каталог',
  )
  for (const c of s.catalog) {
    str(c.id, 250)
    str(c.datasheet)
    str(c.size)
    assert(
      SIDES.includes(c.side) && ['core', 'heavy', 'other', 'forbidden'].includes(c.garrison),
      'Неверная фракция/категория',
    )
    integer(c.rc, 5, 3000)
    integer(c.models, 1, 100)
    integer(c.transport, 0, 100)
    for (const field of ['copyPrices', 'keywords', 'leaderFor', 'cargoKeywords'] as const)
      assert(Array.isArray(c[field]), 'Неверный catalog field')
    c.copyPrices.forEach((n) => integer(n, 5, 3000))
    if (c.supportFor)
      assert(
        Array.isArray(c.supportFor) &&
          c.supportFor.every((v) => typeof v === 'string' && v.length <= 250),
        'Неверные цели Support',
      )
    if (c.card) validateCard(c.card, c.models)
    if (c.transportRule) validateTransportRule(c.transportRule, c.transport)
    if (c.packageCosts) {
      assert(
        Array.isArray(c.packageCosts) &&
          c.packageCosts.length <= 20 &&
          new Set(c.packageCosts.map((p) => p.name)).size === c.packageCosts.length,
        'Неверные платные опции Package',
      )
      for (const p of c.packageCosts) {
        str(p.name)
        integer(p.cost, 0, 300)
        assert(
          p.optional === undefined || typeof p.optional === 'boolean',
          'Неверный тип платной опции',
        )
        assert(
          Array.isArray(p.detachments) &&
            p.detachments.length > 0 &&
            p.detachments.every((id) =>
              s.detachments.some((d) => d.id === id && (!d.side || d.side === c.side)),
            ),
          'Платная опция вне Package',
        )
      }
    }
    for (const b of ['character', 'epic', 'battleline', 'ranged', 'restoration', 'unique'] as const)
      assert(typeof c[b] === 'boolean', 'Неверный datasheet flag')
  }
  assert(
    Array.isArray(s.enhancements) &&
      s.enhancements.length <= 100 &&
      new Set(s.enhancements.map((e) => e.id)).size === s.enhancements.length,
    'Неверные Enhancements',
  )
  assert(
    Array.isArray(s.detachments) &&
      s.detachments.length > 0 &&
      s.detachments.length <= 100 &&
      new Set(s.detachments.map((d) => d.id)).size === s.detachments.length,
    'Неверные Detachments',
  )
  if (s.dispositions)
    assert(
      s.dispositions.length <= 30 &&
        s.dispositions.every(
          (d) => SIDES.includes(d.side) && typeof d.id === 'string' && typeof d.name === 'string',
        ),
      'Неверные Dispositions',
    )
  for (const d of s.detachments) {
    str(d.id)
    str(d.name)
    integer(d.dp, 1, 3)
    assert(Array.isArray(d.requiredKeywords), 'Неверные требования')
  }
  for (const e of s.enhancements) {
    str(e.id)
    str(e.name)
    integer(e.cost, 0, 300)
    assert(
      Array.isArray(e.eligible) && s.detachments.some((d) => d.id === e.detachment),
      'Enhancement вне Detachment',
    )
  }
}
function minimal(s: State, side: Side, restore: boolean): Muster | null {
  const b = s.battle!
  let best: Muster | null = null,
    bestRC = Infinity
  const candidates = s.units
    .filter(
      (u) =>
        u.side === side &&
        u.location === 'field' &&
        u.status === 'active' &&
        !u.flags.commission &&
        (restore || available(s, u)),
    )
    .sort((a, b) => a.rc - b.rc)
  const test = structuredClone(s)
  if (restore)
    for (const u of test.units) {
      if (u.damage === 3) u.damage = 2
      u.evacDebt = 0
      u.flags.outOfAction = false
    }
  const search = (i: number, ids: string[], rc: number) => {
    if (rc >= bestRC) return
    for (const id of s.players[side].package) {
      const commander = ids.find(
        (id) =>
          entry(
            s,
            s.units.find((u) => u.id === id)!,
          ).character,
      )
      if (commander) {
        const m: Muster = {
          picks: ids.map((id) => ({
            id,
            role: 'field',
            formation: id,
            transport: null,
            reserve: false,
            enhancement: null,
            honours: [],
            armoury: false,
            relic: false,
            redemption: null,
            protocol: 'HOLD',
          })),
          rest: [],
          detachments: [id],
          commander,
          dispositions: [],
        }
        try {
          validateMuster(test, side, m, b)
          best = m
          bestRC = rc
          return
        } catch {
          /* Continue the bounded branch search. */
        }
      }
    }
    for (let j = i; j < candidates.length; j++) {
      const u = candidates[j]
      if (rc + u.rc >= bestRC || rc + u.rc > (b.type === 'PACT' ? b.al / 2 : b.al)) continue
      search(j + 1, [...ids, u.id], rc + u.rc)
    }
  }
  search(0, [], 0)
  return best
}
function emergency(s: State, ctx: Context) {
  const b = s.battle!,
    side = ctx.actor
  assert(
    b &&
      ['encounter', 'PACT', 'WAR'].includes(b.type) &&
      ['lock', 'muster'].includes(s.phase) &&
      !b.muster[side] &&
      !s.players[side].flags[`emergency:${b.id}`],
    'Emergency Muster только перед обязательным боем',
  )
  assert(!minimal(s, side, false), 'Обычный legal состав существует')
  let m = minimal(s, side, true)
  const recruits: string[] = []
  if (!m) {
    for (const catalogId of s.players[side].starter) {
      const u = newUnit(
        s,
        side,
        catalogId,
        entry(s, { catalogId } as (typeof s.units)[number]).datasheet,
        ctx,
      )
      s.units.push(u)
      recruits.push(u.id)
    }
    m = minimal(s, side, true)
    assert(m, 'Стартовый шаблон требует совместной коррекции Snapshot')
  }
  let cost = 0
  const wanted = new Set(m.picks.map((p) => p.id))
  s.units = s.units.filter((u) => !recruits.includes(u.id) || wanted.has(u.id))
  for (const pick of m.picks) {
    const u = s.units.find((u) => u.id === pick.id)!
    if (recruits.includes(u.id)) cost += u.rc
    if (u.damage === 3) {
      cost += Math.max(10, upCost(u.rc))
      u.damage = 2
      u.flags.paidWindow = true
    }
    cost += u.evacDebt
    u.evacDebt = 0
    if (u.flags.outOfAction) {
      cost += 25
      u.flags.outOfAction = false
    }
  }
  const p = s.players[side],
    paid = Math.min(cost, p.supply)
  p.supply -= paid
  p.debt += cost - paid
  p.flags[`emergency:${b.id}`] = true
  b.table.records[`emergency_ids:${side}`] = m.picks.map((v) => v.id).join(',')
}
const upCost = (rc: number) => Math.ceil((rc * 0.15) / 5) * 5
export function project(state: State, side: Side): View {
  const s = structuredClone(state) as State
  const preview = s.pendingAftermath
  s.pendingAftermath = null
  const correctionAvailable = !!s.rollback
  s.rollback = null
  s.resultBase = null
  const clean = (b: State['battle']) => {
    if (!b) return
    b.hiddenSignal = ''
    delete b.table.records.trueSignal
    if (!b.table.records['decoyShown:' + other(side)]) delete b.decoys[other(side)]
    if (b.type === 'PACT' && s.phase === 'muster' && !b.muster[side]) {
      delete b.muster[other(side)]
    } else if (!revealAllowed(b, side, other(side))) delete b.muster[other(side)]
    if (!b.muster[other(side)]) {
      for (const u of b.before.filter((u) => u.side !== side)) delete b.costs[u.id]
      s.players[other(side)].enhancements = {}
    }
    if (s.phase === 'lock') delete b.lock[other(side)]
    if (s.phase === 'interdict') delete b.interdict[other(side)]
    if (s.phase === 'assets') delete b.assets[other(side)]
  }
  clean(s.battle)
  s.history.forEach(clean)
  for (const l of s.log)
    if (
      ['attack', 'choose_mission', 'mission_reroll', 'finale_mode', 'end_logistics'].includes(
        l.command,
      )
    )
      l.dice = []
  const modes: View['finalModes'] = {}
  for (const who of SIDES) if (s.finalModes[who]) modes[who] = s.finalModes[who]
  if (s.phase === 'finale_mode' && s.finalModes[other(side)]) modes[other(side)] = 'sealed'
  if (s.phase === 'finale_mode') s.finalModes = {}
  s.flags.correctionAvailable = correctionAvailable
  const result = { ...s, finalModes: modes } as View
  if (preview)
    (result as View & { preview: unknown }).preview = {
      players: preview.players,
      units: preview.units,
      sectors: preview.sectors,
      phase: preview.phase,
      battles: preview.battles,
      choir: preview.choir,
    }
  return result
}
export function assertInvariants(s: State) {
  assert(s.choir >= 0 && s.choir <= 8, 'Choir вне границ')
  assert(new Set(s.units.map((u) => u.id)).size === s.units.length, 'Дубликат Persistent ID')
  for (const side of SIDES) {
    const p = s.players[side]
    for (const n of [p.supply, p.intel, p.debt, p.recovery, p.fragments, p.integrity]) integer(n)
    assert(p.recovery <= 100 && p.fragments <= 3 && p.integrity <= 2, 'Ресурс выше cap')
  }
  for (const u of s.units) {
    integer(u.damage, 0, 3)
    integer(u.xp)
    assert(u.scars.length <= 3, 'Больше трёх Scars')
    assert(
      u.honours.every((id) => HONOURS.some((h) => h.id === id)),
      'Неизвестное Honour',
    )
  }
  for (const a of Object.values(s.sectors)) integer(a.local)
}
