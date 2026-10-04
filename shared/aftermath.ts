import { maximumReady } from './readiness.ts'
import { savedDie } from './random.ts'
import { EVENTS, SCARS } from './rules.generated.ts'
import {
  SIDES,
  other,
  type Battle,
  type Choice,
  type Command,
  type Context,
  type Report,
  type SectorKey,
  type Side,
  type State,
  type Unit,
} from './model.ts'
import {
  assert,
  available,
  bonus,
  choir,
  credit,
  entry,
  garrisonLegal,
  healCost,
  home,
  intel,
  integer,
  present,
  RANDOM_ARMOURY,
  RELICS,
  SECTORS,
  spend,
  stageFor,
  STAGES,
  supplied,
  unit,
  up5,
  ADJACENCY,
  down5,
} from './rules.ts'
import { addEffect, beginActivation, finishActivation } from './state.ts'
import { capture, setExhausted } from './strategy.ts'
export function outcome(s: State, r: Report): Battle['outcome'] {
  const b = s.battle!,
    t = b.table
  if (b.type === 'PACT')
    return !t.records.immediateFailure &&
      t.objects
        .filter((o) => !['engine', 'overlay', 'index'].includes(o.id))
        .every((o) => o.keys.length === 2) &&
      SIDES.every((side) => !!t.primes[side] && r.facts[`prime_valid:${side}`] === true)
      ? 'both_win'
      : 'both_lose'
  if (b.type === 'WAR') {
    const candidates = SIDES.filter(
      (side) =>
        t.records[`override:${side}`] &&
        t.objects.filter((o) => o.tag !== undefined && o.data[`hack:${side}`]).length >= 2 &&
        r.facts[`engine_alive_oc:${side}`] === true,
    )
    return candidates.length === 1
      ? candidates[0]
      : candidates.length === 2 && r.vp.deathwatch !== r.vp.necrons
        ? r.vp.deathwatch > r.vp.necrons
          ? 'deathwatch'
          : 'necrons'
        : 'both_lose'
  }
  if (r.withdrawal.length === 2) return 'draw'
  if (r.withdrawal.length === 1) return other(r.withdrawal[0])
  if (/[AK]3/.test(b.mission!))
    return t.records.claim && r.facts.throne_control === b.attacker ? b.attacker : b.defender
  return r.vp.deathwatch === r.vp.necrons
    ? 'draw'
    : r.vp.deathwatch > r.vp.necrons
      ? 'deathwatch'
      : 'necrons'
}
function validateReport(s: State, r: Report) {
  const b = s.battle!
  assert(
    r &&
      r.vp &&
      Array.isArray(r.units) &&
      Array.isArray(r.withdrawal) &&
      r.facts &&
      r.retreat &&
      typeof r.narrative === 'string' &&
      r.narrative.length <= 5000,
    'Неверный отчёт',
  )
  for (const side of SIDES) {
    integer(r.vp[side], 0, 50)
    assert(r.vp[side] === b.table.vp[side], 'VP должны совпадать с журналом миссии')
  }
  assert(
    new Set(r.withdrawal).size === r.withdrawal.length &&
      r.withdrawal.every((v) => SIDES.includes(v)),
    'Неверный отход',
  )
  const recorded = b.table.records.mutualWithdrawal
    ? [...SIDES]
    : b.table.records.withdrawalSide
      ? [b.table.records.withdrawalSide]
      : []
  assert(
    [...r.withdrawal].sort().join() === recorded.sort().join(),
    'Отход должен совпадать с журналом',
  )
  if (r.withdrawal.length)
    assert(
      !['WAR', 'PACT'].includes(b.type) &&
        b.table.round >= 3 &&
        b.table.round <= 5 &&
        r.facts.withdrawal_timing_valid === true,
      'Подтвердите Command и Movement той же очереди хода',
    )
  const picks = SIDES.flatMap((side) => b.muster[side]!.picks),
    ids = picks.map((v) => v.id)
  assert(
    r.units.length === ids.length &&
      new Set(r.units.map((u) => u.id)).size === r.units.length &&
      r.units.every((u) => ids.includes(u.id)),
    'Нужны факты по каждому committed ID',
  )
  for (const u of r.units) {
    assert(
      typeof u.entered === 'boolean' &&
        typeof u.destroyed === 'boolean' &&
        typeof u.distinguished === 'boolean' &&
        typeof u.withdrawn === 'boolean' &&
        Array.isArray(u.casualtySources),
      'Неверные факты ID',
    )
    const committed = picks.find((p) => p.id === u.id)!
    if (committed.role === 'pool' || committed.reserve) {
      const arrived = !!b.table.records[`entered:${u.id}`]
      assert(u.entered === arrived, 'Участие резервов должно совпадать с прибытием')
      if (committed.role === 'pool') assert(!u.destroyed || u.entered, 'Не вошедший Pool не погиб')
      else if (!arrived) assert(u.destroyed, 'Initial Reserves не вошли до конца R3 и уничтожены')
    } else assert(u.entered, 'Initial deployment участвует в бою')
    assert(
      !u.withdrawn || (u.entered && !u.destroyed && r.withdrawal.includes(unit(s, u.id).side)),
      'Эвакуирован только участвовавший и не уничтоженный ID уходящей стороны',
    )
    if (committed.transport) {
      const parent = r.units.find((v) => v.id === committed.transport)!
      assert(u.entered === parent.entered, 'Груз участвует, если вошёл его транспорт')
    }
    if (r.withdrawal.includes(unit(s, u.id).side) && u.entered && !u.withdrawn)
      assert(u.destroyed, 'Оставшийся на столе ID уничтожен после эвакуационной Movement')
    assert(
      !u.deed || ['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].includes(u.deed),
      'Неизвестный Deed',
    )
    assert(!u.deed || u.entered, 'Нет Deed без участия')
    assert(
      new Set(u.casualtySources).size === u.casualtySources.length &&
        u.casualtySources.every((v) =>
          ['c1_debris', 'd1_toxic', 'j3_reactor', 'no_recovery'].includes(v),
        ),
      'Неизвестный Casualty источник',
    )
    for (const source of u.casualtySources)
      assert(
        (source === 'no_recovery' && r.facts.no_recovery_source === true) ||
          (source === 'c1_debris' &&
            b.mission === 'C1' &&
            entry(s, unit(s, u.id)).keywords.includes('VEHICLE')) ||
          (source === 'd1_toxic' && b.mission === 'D1') ||
          (source === 'j3_reactor' && b.mission === 'J3'),
        'Источник не относится к этому бою',
      )
  }
  for (const side of SIDES) {
    const us = r.units.filter((u) => unit(s, u.id).side === side)
    assert(us.filter((u) => u.distinguished).length <= 1, 'Один Distinguished на сторону')
    const formDeeds = new Set<string>()
    for (const u of us) {
      const card = unit(s, u.id),
        pick = picks.find((p) => p.id === u.id)!
      if (u.distinguished)
        assert(
          u.entered &&
            pick.role === 'field' &&
            card.damage < 2 &&
            !entry(s, card).epic &&
            !card.scars.some(
              (c) =>
                (card.side === 'deathwatch' && c.id === 8) ||
                (card.side === 'necrons' && c.id === 12),
            ),
          'ID не eligible Distinguished',
        )
      if (u.deed) {
        assert(!formDeeds.has(pick.formation), 'Один общий Deed исходной формации')
        formDeeds.add(pick.formation)
      }
    }
  }
  for (const v of Object.values(r.retreat))
    assert(v === undefined || Object.hasOwn(SECTORS, v), 'Неизвестный отход')
  if (r.garrisonRetreat)
    assert(Object.hasOwn(SECTORS, r.garrisonRetreat), 'Неизвестный гарнизонный отход')
  if (r.facts.stores_id) {
    const pick = picks.find((p) => p.id === r.facts.stores_id)
    assert(
      pick &&
        pick.role !== 'field' &&
        unit(s, pick.id).side === b.defender &&
        b.assets[b.defender]?.defensive.includes('stores') &&
        r.units.some((u) => u.id === pick.id && u.entered && u.destroyed),
      'Hardened Stores требует участвовавший уничтоженный гарнизонный ID',
    )
  }
  // Reject missing/illegal destinations before either player locks the result.
  const test = structuredClone(s)
  test.battle!.report = r
  test.battle!.outcome = outcome(test, r)
  if (test.battle!.outcome === b.attacker && !b.raid && b.sector !== 'X' && b.type !== 'assault')
    test.sectors[b.sector].owner = b.attacker
  retreat(test, { actor: b.attacker, dice: () => 1, id: () => '' })
}
export function aftermathCommand(s: State, c: Command, ctx: Context) {
  const side = ctx.actor
  if (c.type === 'request_correction') {
    assert(s.rollback && !s.correctionProposal, 'Нет сохранённого результата')
    const test = structuredClone(s.rollback.base)
    test.battle!.table.vp = (c.payload.report as Report).vp
    validateReport(test, c.payload.report as Report)
    s.correctionProposal = { report: structuredClone(c.payload.report as Report), approved: [side] }
    return
  }
  if (c.type === 'cancel_correction') {
    assert(s.correctionProposal, 'Нет коррекции')
    s.correctionProposal = null
    return
  }
  if (c.type === 'approve_correction') {
    assert(
      s.rollback && s.correctionProposal && !s.correctionProposal.approved.includes(side),
      'Нет нового предложения',
    )
    s.correctionProposal.approved.push(side)
    if (s.correctionProposal.approved.length === 2) {
      const old = s.rollback.battle,
        base = structuredClone(s.rollback.base),
        report = s.correctionProposal.report,
        version = s.version,
        log = s.log
      Object.assign(s, base)
      s.version = version
      s.log = log
      s.correctionProposal = null
      s.rollback = null
      s.pendingAftermath = null
      s.resultBase = null
      const b = s.battle!
      b.report = report
      b.table.vp = report.vp
      Object.assign(
        b.table.records,
        Object.fromEntries(
          Object.entries(old.table.records).filter(([k]) => k.startsWith('dice:')),
        ),
      )
      b.table.records.revisionEvent = old.event ?? ''
      for (const who of SIDES) {
        b.table.records[`revisionSalvage:${who}`] = old.salvage[who]
        spend(s, who, Number(old.table.records[`rerollIntel:${who}`] ?? 0), 'intel')
      }
      b.salvageRerolled = [...old.salvageRerolled]
      b.eventRerolled = old.eventRerolled
      b.confirm = []
      b.outcome = outcome(s, report)
      s.phase = 'result'
    }
    return
  }
  const b = s.battle!
  assert(b, 'Нет боя')
  switch (c.type) {
    case 'submit_result': {
      assert(
        (s.phase === 'battle' && b.table.step === 'finished') || s.phase === 'result',
        'Отчёт после завершения стола',
      )
      const r = c.payload.report as unknown as Report
      validateReport(s, r)
      b.report = structuredClone(r)
      b.confirm = [side]
      b.outcome = outcome(s, r)
      s.phase = 'result'
      return
    }
    case 'confirm_result':
      assert(s.phase === 'result' && b.report && !b.confirm.includes(side), 'Нет нового результата')
      b.confirm.push(side)
      if (b.confirm.length === 2) {
        s.resultBase = null
        s.rollback = null
        s.resultBase = structuredClone(s)
        b.terminal =
          ['WAR', 'PACT'].includes(b.type) ||
          (b.type === 'assault' &&
            b.outcome === b.attacker &&
            s.players[b.defender].integrity === 1)
        if (b.terminal) {
          s.winner = b.outcome as State['winner']
          s.phase = b.outcome === 'both_win' || b.outcome === 'both_lose' ? 'aftermath' : 'ending'
          if (s.phase === 'aftermath') {
            prepareCasualties(s, ctx)
            for (const who of SIDES) {
              const ids = b
                .report!.units.filter(
                  (r) =>
                    r.entered &&
                    unit(s, r.id).side === who &&
                    (b.outcome === 'both_win' || !r.destroyed),
                )
                .map((r) => r.id)
              if (ids.length)
                b.choices.push({
                  key: `epilogue:${who}`,
                  side: who,
                  kind: b.outcome === 'both_win' ? 'keeper' : 'evac_scene',
                  label:
                    b.outcome === 'both_win'
                      ? 'Keeper of the Pact'
                      : 'Выживший для сцены эвакуации',
                  options: ['title'],
                  unitIds: ids,
                  sectorKeys: [],
                })
            }
          }
        } else prepareAftermath(s, ctx)
      }
      return
    case 'choose_ending': {
      assert(s.phase === 'ending' && s.winner === side, 'Ending выбирает победитель')
      const ending = String(c.payload.ending)
      assert(['PURGE', 'SEIZE', 'SEAL', 'FEED'].includes(ending), 'Неизвестный ending')
      assert(ending !== 'SEAL' || s.players[side].fragments === 3, 'SEAL требует 3 Fragments')
      assert(ending !== 'FEED' || s.choir === 8, 'FEED требует Reveal IV')
      b.ending = ending
      s.phase = 'aftermath'
      prepareCasualties(s, ctx)
      if (ending === 'SEAL')
        for (const who of SIDES) {
          const ids = b
            .report!.units.filter((r) => r.entered && unit(s, r.id).side === who)
            .map((r) => r.id)
          if (ids.length)
            b.choices.push({
              key: `seal:${who}`,
              side: who,
              kind: 'seal',
              label: 'ID для эпилога SEAL',
              options: ['seal'],
              unitIds: ids,
              sectorKeys: [],
            })
        }
      return
    }
    case 'salvage_reroll':
      assert(
        s.phase === 'aftermath' &&
          !b.terminal &&
          b.eventPass.length < 2 &&
          !b.salvageRerolled.includes(side),
        'Salvage reroll закрыт',
      )
      spend(s, side, 1, 'intel')
      b.table.records[`rerollIntel:${side}`] =
        Number(b.table.records[`rerollIntel:${side}`] ?? 0) + 1
      b.salvage[side] = ctx.dice(6)
      b.salvageRerolled.push(side)
      return
    case 'choose_event':
      assert(
        s.phase === 'aftermath' &&
          !b.terminal &&
          side === b.eventChooser &&
          b.eventOptions.includes(String(c.payload.code)),
        'Выбор D66 закрыт',
      )
      b.event = String(c.payload.code)
      b.eventOptions = []
      b.eventChooser = b.table.records.eventRerollFirst as Side
      return
    case 'event_reroll':
      assert(
        s.phase === 'aftermath' &&
          b.event &&
          b.eventPass.length < 2 &&
          !b.eventOptions.length &&
          !b.eventRerolled &&
          side === (b.eventPass.length ? other(b.eventChooser) : b.eventChooser),
        'Не ваша очередь D66 reroll',
      )
      spend(s, side, 2, 'intel')
      b.table.records[`rerollIntel:${side}`] =
        Number(b.table.records[`rerollIntel:${side}`] ?? 0) + 2
      b.event = rollEvent(s, ctx, 'reroll')
      b.eventRerolled = true
      return
    case 'event_pass':
      assert(
        s.phase === 'aftermath' &&
          b.event &&
          !b.eventOptions.length &&
          !b.eventPass.includes(side) &&
          side === (b.eventPass.length ? other(b.eventChooser) : b.eventChooser),
        'Не ваша очередь',
      )
      b.eventPass.push(side)
      if (b.eventPass.length === 2) buildChoices(s, ctx)
      return
    case 'aftermath_choice': {
      assert(
        s.phase === 'aftermath' && (b.terminal || b.eventPass.length === 2),
        'Сначала закройте окно D66',
      )
      const ch = b.choices.find((ch) => ch.key === c.payload.key && ch.side === side)
      assert(ch && ch.value === undefined, 'Выбор уже закрыт')
      const value = String(c.payload.value)
      assert(ch.options.includes(value), 'Недопустимый вариант')
      if (
        ch.unitIds.length &&
        !['skip', 'intel', 'supply', 'cache', 'inventory', 'relic'].includes(value)
      ) {
        assert(ch.unitIds.includes(String(c.payload.unit)), 'ID не eligible')
        ch.unit = String(c.payload.unit)
      }
      if (ch.sectorKeys.length && value !== 'skip') {
        assert(ch.sectorKeys.includes(c.payload.sector as SectorKey), 'Сектор не eligible')
        ch.sector = c.payload.sector as SectorKey
      }
      if (['31', '56'].includes(ch.kind) && value !== 'skip') spend(s, side, 10)
      ch.value = value
      return
    }
    case 'preview_aftermath':
      assert(
        s.phase === 'aftermath' &&
          (b.terminal || b.eventPass.length === 2) &&
          b.choices.every((ch) => ch.value !== undefined),
        'Закройте все решения',
      )
      if (!b.table.records.aftermathReady) {
        if (!b.table.records.finalDice) finalDice(s, ctx)
        if (b.choices.some((ch) => ch.value === undefined)) return
        const preview = structuredClone(s)
        preview.pendingAftermath = null
        applyAftermath(preview, ctx)
        const resolved = preview.battle ?? preview.history.at(-1)!
        Object.assign(
          b.table.records,
          Object.fromEntries(
            Object.entries(resolved.table.records).filter(([k]) => k.startsWith('dice:')),
          ),
        )
        s.pendingAftermath = preview
        b.table.records.aftermathReady = true
        b.confirm = []
      }
      return
    case 'confirm_aftermath':
      assert(
        s.phase === 'aftermath' &&
          b.table.records.aftermathReady &&
          s.pendingAftermath &&
          !b.confirm.includes(side),
        'Сначала preview',
      )
      b.confirm.push(side)
      if (b.confirm.length === 2) {
        const ready = s.pendingAftermath,
          base = s.resultBase,
          log = s.log
        Object.assign(s, ready)
        s.log = log
        s.pendingAftermath = null
        s.resultBase = null
        if (base) {
          base.resultBase = null
          base.rollback = null
          s.rollback = { base, battle: structuredClone(b) }
        }
      }
      return
    default:
      assert(false, 'Неизвестная команда aftermath')
  }
}
function prepareCasualties(s: State, ctx: Context) {
  const b = s.battle!
  b.casualties = []
  for (const r of b.report!.units) {
    if (!r.destroyed && (!r.entered || b.ending !== 'PURGE')) continue
    const u = unit(s, r.id),
      pick = b.muster[u.side]!.picks.find((v) => v.id === u.id)!
    let modifier =
      (u.damage === 2 ? -1 : 0) -
      r.casualtySources.length +
      (b.ending === 'PURGE' ? 1 : 0) +
      (r.withdrawn ? 1 : 0)
    if (b.table.records[`index:${u.side}`] === u.id) modifier--
    if (b.effects.some((e) => e.code === '63' && e.data.unit === u.id)) modifier--
    if (
      u.side === 'necrons' &&
      u.scars.some((c) => c.id === 9) &&
      (pick.role === 'pool' || pick.reserve)
    )
      modifier++
    const asset = b.assets[u.side]
    if (asset?.defensive.includes('stores') && b.report!.facts.stores_id === u.id) modifier++
    if (
      (asset?.tactical.includes('evacuation') ||
        (u.side === b.attacker && b.assets[b.attacker]?.breach.includes('extraction'))) &&
      b.report!.facts[`first_destroyed:${u.side}`] === u.id &&
      !entry(s, u).character
    )
      modifier++
    b.casualties.push({
      id: u.id,
      die: savedDie(s, ctx, `cas:${u.id}`, 6),
      modifier,
      critical: 0,
      scarRolls: [],
    })
  }
  s.phase = 'aftermath'
  b.beforeSupply = { deathwatch: s.players.deathwatch.supply, necrons: s.players.necrons.supply }
}
function prepareAftermath(s: State, ctx: Context) {
  const b = s.battle!
  prepareCasualties(s, ctx)
  for (const side of SIDES)
    b.salvage[side] = Number(
      b.table.records[`revisionSalvage:${side}`] ?? savedDie(s, ctx, `salvage:${side}`, 6),
    )
  const n = b.sector === 'D' ? (b.mission === 'D3' ? 3 : 2) : 1
  for (let i = 0; i < n; i++) b.eventOptions.push(rollEvent(s, ctx, String(i)))
  b.eventChooser =
    b.outcome === 'draw' ? b.defender : b.outcome === b.attacker ? b.defender : b.attacker
  if (n > 1) b.eventChooser = b.outcome === 'draw' ? b.defender : (b.outcome as Side)
  else {
    b.event = b.eventOptions[0]
    b.eventOptions = []
  }
  b.table.records.eventRerollFirst = b.outcome === 'draw' ? b.defender : other(b.outcome as Side)
  if (b.table.records.revisionEvent) {
    b.event = String(b.table.records.revisionEvent)
    b.eventOptions = []
    b.eventChooser = b.table.records.eventRerollFirst as Side
  }
}
function rollEvent(s: State, ctx: Context, index = '0') {
  const code = `${savedDie(s, ctx, `event:${index}:tens`, 6)}${savedDie(s, ctx, `event:${index}:ones`, 6)}`
  if (code === '64' && !Object.values(s.sectors).some((a) => a.owner && !SECTORS[a.key].home)) {
    const codes = Object.keys(EVENTS).filter((c) => c !== '64')
    return codes[savedDie(s, ctx, `event:${index}:fallback`, 35) - 1]
  }
  return code
}
function lesser(s: State, ctx: Context): Side {
  const b = s.battle!
  const n = (side: Side, non = false) =>
    Object.values(s.sectors).filter((a) => a.owner === side && (!non || !SECTORS[a.key].home))
      .length
  return n('deathwatch') !== n('necrons')
    ? n('deathwatch') < n('necrons')
      ? 'deathwatch'
      : 'necrons'
    : n('deathwatch', true) !== n('necrons', true)
      ? n('deathwatch', true) < n('necrons', true)
        ? 'deathwatch'
        : 'necrons'
      : b.beforeSupply.deathwatch !== b.beforeSupply.necrons
        ? b.beforeSupply.deathwatch < b.beforeSupply.necrons
          ? 'deathwatch'
          : 'necrons'
        : savedDie(s, ctx, 'lesserTie', 2) === 1
          ? 'deathwatch'
          : 'necrons'
}
function buildChoices(original: State, ctx: Context) {
  const s = structuredClone(original),
    b = original.battle!
  s.battle = b
  if (b.outcome === b.attacker && !b.raid && b.sector !== 'X' && b.type !== 'assault')
    s.sectors[b.sector].owner = b.attacker
  const e = b.event!,
    winner = SIDES.includes(b.outcome as Side) ? (b.outcome as Side) : null
  b.eventChooser = b.table.records.eventRerollFirst as Side
  b.choices = []
  const add = (
    kind: string,
    side: Side,
    label: string,
    options: string[],
    ids: string[] = [],
    sectors: SectorKey[] = [],
  ) =>
    b.choices.push({
      key: `${kind}:${side}`,
      side,
      kind,
      label,
      options,
      unitIds: ids,
      sectorKeys: sectors,
    })
  const eligible = (side: Side, pred: (u: Unit) => boolean = () => true) =>
    b.before.filter((u) => u.side === side && u.status === 'active' && pred(u)).map((u) => u.id)
  const played = (side: Side, pred: (u: Unit) => boolean = () => true) =>
    b
      .report!.units.filter((r) => r.entered && unit(s, r.id).side === side && pred(unit(s, r.id)))
      .map((r) => r.id)
  for (const side of SIDES) {
    if (b.salvage[side] === 6) add('salvage', side, 'Salvage 6', ['supply', 'intel'])
    const sectors = Object.values(s.sectors)
      .filter((a) => a.owner === side && !SECTORS[a.key].home && supplied(s, side, a.key))
      .map((a) => a.key)
    if (sectors.length)
      add('deposit', side, '25 Local Supply', ['deposit'], [], [...new Set(sectors)])
    if (b.outcome === side && side === b.defender) {
      const ids = played(side, (u) => u.location === 'garrison' && u.sector === b.sector)
      if (ids.length) add('defenceRecovery', side, '10 личного Recovery', ['recovery'], ids)
    }
  }
  if (e === '11') add(e, lesser(s, ctx), 'Silent Survivors', ['intel', 'supply'])
  if (e === '12' && winner) add(e, winner, 'Munitorum Cache', ['supply', 'cache'])
  if (e === '13')
    for (const side of SIDES)
      if (['G', ...ADJACENCY.G].some((k) => s.sectors[k as SectorKey].owner === side)) {
        const ids = eligible(
          side,
          (u) =>
            !entry(s, u).epic &&
            !u.armoury &&
            !u.scars.some((c) => side === 'deathwatch' && c.id === 4),
        )
        add(e, side, 'Ward либо Intel', ['intel', ...(ids.length ? ['ward'] : [])], ids)
      }
  if (e === '14')
    for (const side of SIDES) {
      const ids = b.casualties.filter((c) => unit(s, c.id).side === side).map((c) => c.id)
      if (ids.length) add(e, side, 'Recovery Crew: raw +1', ['crew'], ids)
    }
  if (e === '16' && winner) {
    const item = RANDOM_ARMOURY[savedDie(s, ctx, 'damagedArmoury', 6) - 1]
    b.table.records.damagedArmoury = item
    const ids = eligible(
      winner,
      (u) =>
        !entry(s, u).epic &&
        !u.armoury &&
        !u.scars.some((c) => winner === 'deathwatch' && c.id === 4),
    )
    add(
      e,
      winner,
      'Damaged Armoury',
      [
        'supply',
        ...(ids.length ? ['item'] : []),
        ...(['medicae', 'cache'].includes(item) ? ['inventory'] : []),
      ],
      ids,
    )
  }
  if (e === '24') {
    const ids = eligible(
      'necrons',
      (u) => u.damage > 0 || b.report!.units.some((r) => r.id === u.id && r.destroyed),
    )
    if (ids.length) add(e, 'necrons', 'Living Metal Dust', ['heal'], ids)
  }
  if (e === '31')
    for (const side of SIDES) {
      const ids = eligible(side, (u) => u.xp < 3)
      if (ids.length) add(e, side, 'Stragglers: 10 Supply', ['skip', 'xp'], ids)
    }
  if (e === '32') add(e, winner ?? lesser(s, ctx), 'Captured Servitor', ['supply', 'intel'])
  if (e === '33') {
    const ids = eligible('necrons')
    if (ids.length) add(e, 'necrons', 'Xenos Script', ['xp'], ids)
  }
  if (e === '41')
    for (const side of SIDES) {
      const ids = eligible(side, (u) => !!u.armoury)
      add(e, side, 'Ammunition Rot', ['supply', ...(ids.length ? ['block'] : [])], ids)
    }
  if (e === '52')
    for (const side of SIDES) {
      const sector = s.players[side].mf
      if (s.sectors[sector].owner === side && !SECTORS[sector].home)
        add(e, side, 'Mutual Atrocity', ['skip', 'supply'], [], [sector])
    }
  if (e === '53' && s.sectors.G.owner === 'deathwatch')
    add(e, 'deathwatch', 'Unmarked Kill Team', ['intel', 'supply'])
  if (e === '54' && s.sectors.G.owner === 'necrons')
    add(e, 'necrons', 'Tomb Echo', ['intel', 'supply'])
  if (e === '56')
    for (const side of SIDES) {
      const ids = eligible(side, (u) => u.scars.length > 0)
      if (ids.length) add(e, side, 'Corpse Ledger: 10 Supply', ['skip', 'ledger'], ids)
    }
  if (e === '63')
    for (const side of SIDES) {
      const ids = eligible(side, (u) => entry(s, u).character)
      if (ids.length) add(e, side, 'Names in Static', ['name'], ids)
    }
  if (e === '64') {
    const sectors = Object.values(s.sectors).filter((a) => a.owner && !SECTORS[a.key].home),
      origin = sectors[savedDie(s, ctx, 'routeOrigin', sectors.length) - 1]
    b.table.records.routeOrigin = origin.key
    add(
      e,
      origin.owner!,
      'Route target D/E/F/H',
      ['route'],
      [],
      (['D', 'E', 'F', 'H'] as SectorKey[]).filter((k) => k !== origin.key),
    )
  }
  if (b.mission === 'B1' && winner) {
    const ids = played(winner, (u) =>
      b.table.actions.some((a) => a.actor === u.id && a.kind === 'PICK UP' && a.success),
    )
    if (ids.length) add('B1', winner, 'Reliquary Hunt XP', ['xp'], ids)
  }
  if (b.mission === 'D2' && winner)
    add(
      'D2',
      winner,
      'Harvest Line',
      ['supply', 'heal'],
      played(
        winner,
        (u) => u.damage > 0 || b.report!.units.find((r) => r.id === u.id)?.destroyed === true,
      ),
    )
  if (b.mission === 'G1' && winner) add('G1', winner, 'Pilgrimage reward', ['intel', 'relic'])
  if (b.mission === 'I1' && winner === 'necrons') {
    const ids = played(winner, (u) =>
      entry(s, u).keywords.some((k) => ['CANOPTEK', 'INFANTRY'].includes(k)),
    )
    if (ids.length) add('I1', winner, 'Awakening Pits', ['heal'], ids)
  }
  if (b.mission === 'J1' && winner) add('J1', winner, 'Assembly Line', ['supply', 'cache'])
}
function finalDice(s: State, ctx: Context) {
  const b = s.battle!
  for (const c of b.casualties) {
    if (b.choices.some((ch) => ch.kind === '14' && ch.unit === c.id)) c.modifier++
    const u = unit(s, c.id),
      raw = c.die + c.modifier
    if (raw <= 0 && entry(s, u).character) c.critical = savedDie(s, ctx, `critical:${u.id}`, 6)
    if (c.critical === 1 && !entry(s, u).epic)
      b.choices.push({
        key: `critical:${c.id}`,
        side: u.side,
        kind: 'critical',
        label: `${u.name}: Lost либо Evacuation`,
        options: ['lost', 'evac'],
        unitIds: [u.id],
        sectorKeys: [],
      })
  }
  b.table.records.finalDice = true
}
function addScar(s: State, u: Unit, ctx: Context) {
  if (u.scars.length >= 3) {
    u.trauma = true
    u.damage = 3
    return
  }
  const c = entry(s, u),
    legal = SCARS[u.side].filter(
      (v) =>
        !u.scars.some((sc) => sc.id === v.id) &&
        !(u.side === 'deathwatch' && v.id === 6 && !c.keywords.includes('PSYKER')) &&
        !(u.side === 'deathwatch' && [5, 10].includes(v.id) && !c.ranged) &&
        !(u.side === 'necrons' && v.id === 2 && !c.restoration),
    )
  if (!legal.length) {
    u.trauma = true
    u.damage = 3
    return
  }
  const roll = savedDie(s, ctx, `scar:${u.id}:${u.scars.length}`, legal.length),
    n = legal[(roll - 1) % legal.length].id
  u.scars.push({ id: n, progress: false, redemption: 0 })
  if (u.side === 'deathwatch' && n === 7) u.flags.ammunitionDue = true
}
function applyAftermath(s: State, ctx: Context) {
  const b = s.battle!,
    r = b.report!,
    winner = SIDES.includes(b.outcome as Side) ? (b.outcome as Side) : null,
    code = b.mission!,
    choice = (kind: string, side: Side) =>
      b.choices.find((c) => c.kind === kind && c.side === side),
    exists = (id: string) => s.units.find((u) => u.id === id && u.status === 'active')
  assert(!b.aftermathApplied, 'Afternath уже применён')
  b.aftermathApplied = true
  if (b.type === 'assault' && winner === b.attacker) {
    s.players[b.defender].integrity--
    if (s.players[b.defender].integrity === 0) s.sectors[b.sector as SectorKey].owner = b.attacker
  } else if (winner === b.attacker && b.sector !== 'X' && !['WAR', 'PACT'].includes(b.type)) {
    if (b.raid) s.sectors[b.sector].sabotaged = true
    else capture(s, b.sector, b.attacker, true)
  } else if (b.outcome === 'draw' && b.sector !== 'X') s.sectors[b.sector].contested = true
  if (b.ending === 'SEAL')
    for (const ch of b.choices.filter((ch) => ch.kind === 'seal'))
      if (ch.unit) {
        const u = unit(s, ch.unit)
        u.status = 'sealed'
        u.relic = null
        u.armoury = null
      }
  for (const c of b.casualties) {
    const u = exists(c.id)
    if (!u) continue
    const raw = c.die + c.modifier,
      total = Math.max(1, Math.min(6, raw)),
      before = u.damage
    let extraXP = 0
    if (total === 1) {
      u.damage = Math.min(3, u.damage + 2)
      addScar(s, u, ctx)
    }
    if (total === 2) u.damage = Math.min(3, u.damage + 2)
    if (total === 3) u.damage = Math.min(3, u.damage + 1)
    if (total >= 5) extraXP++
    if (c.critical === 1) {
      const ch = b.choices.find((ch) => ch.key === `critical:${u.id}`)
      if (entry(s, u).epic || ch?.value === 'evac') {
        u.damage = 3
        addScar(s, u, ctx)
        u.evacDebt = Math.max(25, up5(u.rc * 0.5))
      } else {
        u.status = 'lost'
        u.armoury = null
        u.relic = null
      }
    }
    if (c.critical === 2) {
      u.damage = 3
      addScar(s, u, ctx)
    }
    if (c.critical === 3) {
      u.damage = 3
      u.flags.systemicBattle = b.number
    }
    if (c.critical === 4) {
      u.damage = 3
      u.flags.outOfAction = true
      u.flags.outOfActionGranted = b.number
    }
    if (c.critical === 5) extraXP++
    if (c.critical === 6) u.damage = Math.max(before, u.damage - 1)
    const ur = r.units.find((v) => v.id === u.id)!,
      pick = b.muster[u.side]!.picks.find((v) => v.id === u.id)!
    if (
      u.status === 'active' &&
      u.armoury === 'medicae' &&
      pick.armoury &&
      ur.usedMedicae === true &&
      u.damage > before &&
      !u.scars.some((sc) => u.side === 'deathwatch' && sc.id === 4) &&
      !b.effects.some((e) => e.code === '41' && e.data.unit === u.id)
    ) {
      u.damage--
      u.armoury = null
    }
    u.xp += extraXP
  }
  for (const ur of r.units.filter((v) => v.entered)) {
    const u = exists(ur.id)
    if (!u) continue
    const old = b.before.find((u) => u.id === ur.id)!,
      pick = b.muster[u.side]!.picks.find((v) => v.id === u.id)!
    let xp = old.scars.some(
      (c) => (old.side === 'deathwatch' && c.id === 11) || (old.side === 'necrons' && c.id === 11),
    )
      ? 0
      : 1
    if (ur.deed) {
      if (
        !old.scars.some((c) => old.side === 'necrons' && c.id === 12) ||
        ur.deed === pick.protocol
      )
        xp++
      if (old.side === 'necrons' && old.scars.some((c) => c.id === 12) && ur.deed === pick.protocol)
        xp++
    }
    if (ur.distinguished) xp++
    if (ur.signatureXP && pick.honours.includes('memory_of_eternity') && !ur.destroyed) xp++
    if (
      ur.scarBonus &&
      old.side === 'deathwatch' &&
      old.scars.some((c) => c.id === 3) &&
      ur.deed === 'HUNT'
    )
      xp++
    if (old.side === 'deathwatch' && old.scars.some((c) => c.id === 12) && !ur.destroyed) xp++
    xp += Number(b.table.records[`xp:${u.id}`] ?? 0)
    if (b.effects.some((e) => e.code === '63' && e.data.unit === u.id) && !ur.destroyed) xp++
    u.xp += xp
    for (const sc of u.scars) {
      const shortAuto =
        (u.side === 'deathwatch' &&
          sc.id === 11 &&
          ['ENDURE', 'OPERATE', 'EXTRACT'].includes(ur.deed ?? '')) ||
        (u.side === 'necrons' && sc.id === 11 && ['OPERATE', 'EXTRACT'].includes(ur.deed ?? ''))
      if (shortAuto) {
        u.scars = u.scars.filter((c) => c !== sc)
        continue
      }
      if (pick.redemption === sc.id && ur.deed && pick.redemptionDeed === ur.deed) {
        sc.redemption++
        const short =
          (u.side === 'deathwatch' &&
            sc.id === 11 &&
            ['ENDURE', 'OPERATE', 'EXTRACT'].includes(ur.deed)) ||
          (u.side === 'necrons' && sc.id === 11 && ['OPERATE', 'EXTRACT'].includes(ur.deed))
        const commandScar =
          (u.side === 'deathwatch' && sc.id === 8) || (u.side === 'necrons' && sc.id === 6)
        if (
          short ||
          (sc.redemption >= 2 && (!commandScar || ['OPERATE', 'EXTRACT'].includes(ur.deed)))
        )
          u.scars = u.scars.filter((c) => c !== sc)
      }
    }
    if (u.scars.length < 3) u.trauma = false
    if (u.side === 'deathwatch' && u.scars.some((c) => c.id === 7)) u.flags.ammunitionDue = true
    if (u.flags.stageDeedStage === b.stage && u.flags.stageDeed === ur.deed) {
      u.flags.stageDeedProgress = Number(u.flags.stageDeedProgress ?? 0) + 1
      if (Number(u.flags.stageDeedProgress) >= 2) u.flags.stageDeedTitle = true
    }
  }
  if (!b.terminal) {
    for (const ur of r.units.filter((v) => v.entered && v.destroyed)) {
      const old = b.before.find((u) => u.id === ur.id)!
      if (old.xp >= 18) credit(s, other(old.side), 20)
      if (old.side === 'deathwatch' && old.scars.some((c) => c.id === 12))
        credit(s, other(old.side), 10)
    }
    retreat(s, ctx)
  }
  if (b.terminal) {
    for (const ch of b.choices.filter((c) => ['keeper', 'evac_scene'].includes(c.kind))) {
      const u = s.units.find((u) => u.id === ch.unit)
      if (u) u.flags[ch.kind] = true
    }
    s.winner = b.outcome as State['winner']
    s.phase = 'terminal'
    if (b.ending === 'SEIZE')
      for (const u of s.units) if (u.xp >= 18 && u.status === 'active') u.flags.choirTouched = true
    s.battles++
    s.history.push(structuredClone(b))
    s.battle = null
    s.activation = null
    return
  }
  for (const side of SIDES) {
    const ch = choice('salvage', side),
      die = b.salvage[side]
    if (die === 6 && ch?.value === 'intel') intel(s, side, 1)
    else credit(s, side, [0, 10, 15, 20, 25, 20][die - 1])
    intel(s, side, Number(b.table.records[`intel:${side}`] ?? 0))
    credit(
      s,
      side,
      Number(b.table.records[`supply10:${side}`] ?? 0) * 10 +
        Number(b.table.records[`supply5:${side}`] ?? 0) * 5,
    )
    if (b.table.records[`index:${side}`])
      s.players[side].fragments = Math.min(3, s.players[side].fragments + 1)
  }
  applyEvent(s, ctx)
  if (winner) {
    const supply: Record<string, number> = { B3: 15, C2: 20, E1: 25, I2: 15 }
    credit(s, winner, supply[code] ?? 0)
    if (['F1', 'H1'].includes(code) || (code === 'I1' && winner === 'deathwatch'))
      intel(s, winner, 1)
    if (code === 'C3') addEffect(s, 'airlift', winner, 'activation')
    if (code === 'F2') addEffect(s, 'free_lock', winner)
    for (const ch of b.choices.filter((ch) => ['B1', 'D2', 'G1', 'I1', 'J1'].includes(ch.kind))) {
      const u = ch.unit ? exists(ch.unit) : undefined
      if (ch.value === 'xp' && u) u.xp++
      if (ch.value === 'heal' && u) u.damage = Math.max(u.trauma ? 2 : 0, u.damage - 1)
      if (ch.value === 'supply') credit(s, ch.side, ch.kind === 'D2' ? 25 : 20)
      if (ch.value === 'intel') intel(s, ch.side, 1)
      if (ch.value === 'cache') s.players[ch.side].inventory.push('cache')
      if (ch.value === 'relic')
        s.players[ch.side].relics.push(
          Object.keys(RELICS)[savedDie(s, ctx, `relic:${ch.side}`, 6) - 1],
        )
    }
  }
  if (code === 'G2') choir(s, 1)
  if (code === 'G3') choir(s, 2)
  if (
    b.table.records.choirCommune ||
    b.table.records['fact:choirB2'] ||
    b.table.records['fact:choirF2'] ||
    SIDES.some((side) => Number(b.table.records[`shatter6:${side}`] ?? 0) >= 2)
  )
    choir(s, 1)
  if (code === 'I3') {
    let any = false
    for (const side of SIDES)
      if (b.table.records[`allScanned:${side}`]) {
        s.players[side].fragments = Math.min(3, s.players[side].fragments + 1)
        any = true
      }
    if (any) choir(s, 1)
  }
  if (b.sector === 'G') {
    if (s.flags.gTableBattle) choir(s, 1)
    s.flags.gTableBattle = true
  }
  if (code === 'E2' && winner === b.attacker) setExhausted(s, 'E')
  if (code === 'F3' && winner === b.attacker && !b.raid) {
    s.sectors.F.relayUntil = s.activationCount + 2
    s.flags.relayOwner = s.sectors.F.owner
  }
  if (code === 'J3') {
    setExhausted(s, 'J')
    s.sectors.J.sabotaged = true
  }
  if (
    b.sector !== 'X' &&
    b.sectorSnapshot?.sabotaged &&
    !(b.raid && winner === b.attacker) &&
    code !== 'J3'
  )
    s.sectors[b.sector].sabotaged = false
  for (const side of SIDES) {
    credit(s, side, 100 + (b.outcome === 'draw' ? 10 : winner === side ? 20 : 0))
    if (winner && winner !== side) intel(s, side, 1)
    if (bonus(s, 'E', side) && supplied(s, side, 'E')) credit(s, side, up5(b.al * 0.02))
    if (
      winner === side &&
      bonus(s, 'B', side) &&
      b.sector !== 'X' &&
      ADJACENCY.B.includes(b.sector) &&
      !s.players[side].flags.sectorB
    ) {
      intel(s, side, 1, true)
      s.players[side].flags.sectorB = true
    }
    if (winner === 'deathwatch' && ['I', 'K'].includes(b.sector) && side === 'deathwatch')
      intel(s, side, 1, true)
    const ch = choice('defenceRecovery', side)
    if (ch?.unit && exists(ch.unit)) {
      const u = exists(ch.unit)!
      u.recovery = Math.min(20, u.recovery + 10)
    }
    if (Number(s.players[side].flags.catchupBattles ?? 0) > 0) {
      s.players[side].recovery = Math.min(100, s.players[side].recovery + 25)
      s.players[side].flags.catchupBattles = Number(s.players[side].flags.catchupBattles) - 1
    }
  }
  s.battles++
  const next = stageFor(s.battles)
  if (next > s.stage) {
    s.stage = next
    for (const side of SIDES) credit(s, side, 100)
  }
  for (const side of SIDES) {
    const ch = choice('deposit', side)
    if (ch?.sector && s.sectors[ch.sector].owner === side && supplied(s, side, ch.sector))
      s.sectors[ch.sector].local = Math.min(
        up5(STAGES[s.stage].al * 0.25),
        s.sectors[ch.sector].local + 25,
      )
    s.players[side].flags.supplyWindow = false
    s.players[side].flags.intelWindow = false
    s.players[side].flags.remoteWindow = false
    s.players[side].flags.investigateWindow = false
    s.players[side].flags.siegeWindow = false
    const resting = b.muster[side]!.rest
    let khepra = false
    for (const id of resting) {
      const u = exists(id)
      if (!u) continue
      const n =
        side === 'necrons' && present(s, u) === 'I' && bonus(s, 'I', side) && !khepra ? 2 : 1
      if (n === 2) khepra = true
      u.damage = Math.max(u.trauma ? 2 : 0, u.damage - n)
    }
  }
  s.window++
  for (const u of s.units) {
    u.flags.paidWindow = false
    u.flags.overhaulWindow = false
    u.flags.rehabWindow = false
    const old = b.before.find((v) => v.id === u.id)
    if (
      old?.flags.outOfAction &&
      ((old.location === (b.forces?.[old.side] === 'stf' ? 'stf' : 'field') &&
        !(b.type === 'garrison' && old.side === b.defender)) ||
        (old.location === 'garrison' && old.sector === b.sector))
    )
      u.flags.outOfAction = false
  }
  if (s.battles === 12) choir(s, 0, 2)
  if (s.battles === 14) choir(s, 0, 4)
  if (s.battles === 16) choir(s, 0, 8)
  if (s.battles >= 4 && s.battles % 4 === 0) catchup(s)
  if (b.number >= 15 && b.number <= 17)
    for (const side of SIDES) {
      const anchor = b.table.objects.find((o) => o.id === 'overlay')
      if (
        !s.players[side].prepared &&
        ((anchor?.tag === side && r.facts.anchor_control === side) ||
          (b.type === 'assault' && winner === side))
      ) {
        s.players[side].prepared = true
        s.players[side].recovery = Math.min(100, s.players[side].recovery + 20)
      }
    }
  s.quiet = 0
  s.quietActivations = 0
  s.attrition = b.type === 'assault' ? 0 : s.attrition + 1
  if (b.type === 'assault' && winner === b.attacker) s.players[b.defender].poolOverride = 60
  if (b.type === 'assault' && winner === b.defender)
    s.players[b.attacker].flags.repeatAssault = s.activationCount + 2
  if (b.sector !== 'X') {
    s.cycles[b.sector] = [...(s.cycles[b.sector] ?? []), code]
  }
  s.effects = s.effects.filter(
    (e) =>
      !b.effects.some(
        (old) => old.code === e.code && old.side === e.side && old.expires === e.expires,
      ),
  )
  s.effects = s.effects.filter(
    (e) =>
      e.code !== '64' || (e.data.origin && s.sectors[e.data.origin as SectorKey].owner === e.side),
  )
  s.phase = 'logistics'
  b.logistics = [...SIDES]
  if (s.activation) {
    s.activation.hadBattle = true
    s.activation.logistics = [...SIDES]
  }
  s.history.push(structuredClone(b))
}
function retreat(s: State, ctx: Context) {
  const b = s.battle!,
    r = b.report!,
    target = b.sector
  if (['WAR', 'PACT', 'encounter'].includes(b.type)) return
  const evacuate = (side: Side) => {
    const force = b.forces?.[side] ?? 'mf'
    if (force === 'mf') s.players[side].mf = home(side)
    else s.players[side].stf = home(side)
    s.players[side].supply = Math.max(0, s.players[side].supply - 25)
    const ids = r.units
        .filter(
          (v) =>
            v.entered &&
            unitBefore(s, v.id)?.side === side &&
            unitBefore(s, v.id)?.location === (b.forces?.[side] === 'stf' ? 'stf' : 'field'),
        )
        .map((v) => v.id),
      n = Math.min(ids.length, savedDie(s, ctx, `evacCount:${side}`, 3))
    for (let i = 0; i < n; i++) {
      const k = savedDie(s, ctx, `evacId:${side}:${i}`, ids.length) - 1,
        id = ids.splice(k, 1)[0],
        u = s.units.find((u) => u.id === id && u.status === 'active')
      if (u) u.damage = Math.min(3, u.damage + 1)
    }
  }
  const move = (side: Side, at: SectorKey) => {
    if (b.forces?.[side] === 'stf') s.players[side].stf = at
    else s.players[side].mf = at
  }
  const position = (side: Side) =>
    b.forces?.[side] === 'stf' ? s.players[side].stf : s.players[side].mf
  if (b.type === 'assault' || b.outcome !== b.attacker || b.raid) {
    if (s.sectors[b.origin].owner === b.attacker) move(b.attacker, b.origin)
    else {
      const connected: SectorKey[] = [],
        queue: SectorKey[] = [b.origin],
        seen = new Set<SectorKey>()
      let nearest: SectorKey[] = []
      while (queue.length && !nearest.length) {
        const layer = queue.splice(0)
        for (const at of layer) {
          if (seen.has(at)) continue
          seen.add(at)
          if (at !== b.origin && s.sectors[at].owner === b.attacker) nearest.push(at)
          else
            for (const next of ADJACENCY[at])
              if (!seen.has(next) && s.sectors[next].owner === b.attacker) queue.push(next)
        }
      }
      connected.push(...nearest)
      const adjacent = connected
      if (adjacent.length) {
        const chosen = r.retreat[b.attacker]
        assert(chosen && adjacent.includes(chosen), 'Выберите доступный отход Attacker')
        move(b.attacker, chosen)
      } else evacuate(b.attacker)
    }
  } else move(b.attacker, target as SectorKey)
  if (
    ((b.outcome === b.attacker && !b.raid) || r.withdrawal.length === 2) &&
    position(b.defender) === target &&
    b.type !== 'assault'
  ) {
    const adjacent = ADJACENCY[target as SectorKey].filter(
        (k) => s.sectors[k].owner === b.defender,
      ),
      chosen = r.retreat[b.defender]
    if (adjacent.length) {
      assert(chosen && adjacent.includes(chosen), 'Выберите соседний свой сектор для Defender')
      move(b.defender, chosen)
    } else evacuate(b.defender)
  }
  if (
    ((b.outcome === b.attacker && !b.raid) || r.withdrawal.length === 2) &&
    b.type !== 'assault' &&
    b.defenderForces?.length === 2
  ) {
    const dest = position(b.defender)!
    if (b.forces?.[b.defender] === 'stf') s.players[b.defender].mf = dest
    else s.players[b.defender].stf = dest
  }
  if (b.outcome === b.attacker && !b.raid && b.type !== 'assault') {
    const adjacent = ADJACENCY[target as SectorKey].filter((k) => s.sectors[k].owner === b.defender)
    const selected = r.garrisonRetreat
    const hasGarrison = s.units.some(
      (u) =>
        u.side === b.defender &&
        u.location === 'garrison' &&
        u.sector === target &&
        !['lost', 'archived', 'sealed'].includes(u.status),
    )
    assert(
      !hasGarrison || !adjacent.length || (selected && adjacent.includes(selected)),
      'Выберите единый гарнизонный отход',
    )
    const dest = adjacent.length ? selected! : home(b.defender)
    for (const u of s.units.filter(
      (u) =>
        u.side === b.defender &&
        u.location === 'garrison' &&
        u.sector === target &&
        !['lost', 'archived', 'sealed'].includes(u.status),
    )) {
      u.sector = dest
      if (!adjacent.length && savedDie(s, ctx, `garrisonEvac:${u.id}`, 6) <= 3)
        u.damage = Math.min(3, u.damage + 1)
      u.status = garrisonLegal(s, u, dest) ? 'active' : 'displaced'
    }
  }
}
function unitBefore(s: State, id: string) {
  return s.battle!.before.find((u) => u.id === id)
}
function applyEvent(s: State, ctx: Context) {
  const b = s.battle!,
    e = b.event!,
    win = SIDES.includes(b.outcome as Side) ? (b.outcome as Side) : null,
    ch = (kind: string, side: Side) => b.choices.find((c) => c.kind === kind && c.side === side),
    live = (id: string | undefined) =>
      id ? s.units.find((u) => u.id === id && u.status === 'active') : undefined
  const giveItem = (
    side: Side,
    item: string,
    id: string | undefined,
    compensation: number,
    damaged = false,
  ) => {
    const u = live(id)
    if (u && !u.armoury && !entry(s, u).epic) {
      u.armoury = item
      if (damaged) u.flags.damagedArmoury = true
    } else credit(s, side, compensation)
  }
  if (e === '11') {
    const c = b.choices.find((c) => c.kind === e)!
    if (c.value === 'intel') intel(s, c.side, 1)
    else {
      credit(s, c.side, 25)
      choir(s, 1)
    }
  }
  if (e === '12')
    for (const side of SIDES) {
      if (ch(e, side)?.value === 'cache') s.players[side].inventory.push('cache')
      else credit(s, side, 20)
    }
  if (e === '13')
    for (const c of b.choices.filter((c) => c.kind === e)) {
      if (c.value === 'ward') giveItem(c.side, 'ward', c.unit, 0)
      else intel(s, c.side, 1)
    }
  if (e === '15' || e === '61') choir(s, 1)
  if (e === '16' && win) {
    const c = ch(e, win)!
    if (c.value === 'supply') credit(s, win, 20)
    else if (c.value === 'inventory')
      s.players[win].inventory.push(String(b.table.records.damagedArmoury))
    else giveItem(win, String(b.table.records.damagedArmoury), c.unit, 20, true)
  }
  if (e === '21' && win) {
    intel(s, other(win), 1)
    addEffect(s, e, other(win))
  }
  if (['22', '25', '26', '34', '36', '42', '46', '62', '65'].includes(e))
    addEffect(s, e, null, 'battle')
  if (e === '25' && win) credit(s, win, 10)
  if (e === '23') for (const side of SIDES) addEffect(s, e, side, 'activation')
  if (e === '24') {
    credit(s, 'deathwatch', 20)
    const u = live(ch(e, 'necrons')?.unit)
    if (u) u.damage = Math.max(u.trauma ? 2 : 0, u.damage - 1)
  }
  if (e === '31')
    for (const c of b.choices.filter((c) => c.kind === e && c.value === 'xp')) {
      const u = live(c.unit)
      if (u) u.xp++
    }
  if (e === '32') {
    const c = b.choices.find((c) => c.kind === e)!
    if (c.value === 'supply') {
      credit(s, c.side, 25)
      intel(s, other(c.side), 1)
    } else {
      intel(s, c.side, 1)
      credit(s, other(c.side), 25)
    }
  }
  if (e === '33') {
    intel(s, 'deathwatch', 1)
    const u = live(ch(e, 'necrons')?.unit)
    if (u) u.xp++
    if (s.sectors.I.owner === 'deathwatch' || s.sectors.K.owner === 'deathwatch')
      credit(s, 'deathwatch', 10)
  }
  if (e === '35') for (const side of SIDES) addEffect(s, e, side)
  if (e === '41')
    for (const side of SIDES) {
      const c = ch(e, side)!
      if (c.value === 'block' && live(c.unit))
        addEffect(s, e, side, 'side_battle', { unit: c.unit! })
      else s.players[side].supply = Math.max(0, s.players[side].supply - 10)
    }
  if (e === '43') {
    if (s.flags.corpseUnresolved) {
      s.flags.corpseUnresolved = false
      choir(s, 2, 4)
    } else s.flags.corpseUnresolved = true
  }
  if (e === '44') {
    const n = (side: Side) => Object.values(s.sectors).filter((a) => a.owner === side).length
    if (n('deathwatch') !== n('necrons'))
      addEffect(s, e, n('deathwatch') > n('necrons') ? 'deathwatch' : 'necrons', 'activation')
  }
  if (e === '45')
    for (const side of SIDES)
      if (savedDie(s, ctx, `theft:${side}`, 6) <= 2)
        s.players[side].supply = Math.max(
          0,
          s.players[side].supply - down5(b.beforeSupply[side] * 0.1),
        )
  if (e === '51') {
    const n = (side: Side) =>
        b.report!.units.filter((u) => u.destroyed && unitBefore(s, u.id)?.side === side).length,
      side =
        n('deathwatch') === n('necrons')
          ? lesser(s, ctx)
          : n('deathwatch') > n('necrons')
            ? 'deathwatch'
            : 'necrons'
    s.players[side].recovery = Math.min(100, s.players[side].recovery + 25)
    choir(s, 1)
  }
  if (e === '52')
    for (const c of b.choices.filter((c) => c.kind === e && c.value === 'supply')) {
      const at = s.players[c.side].mf
      if (s.sectors[at].owner === c.side && !SECTORS[at].home) {
        credit(s, c.side, 20)
        setExhausted(s, at)
      }
    }
  if (e === '53') {
    credit(s, 'necrons', 15)
    if (ch(e, 'deathwatch')?.value === 'supply') credit(s, 'deathwatch', 20)
    else intel(s, 'deathwatch', 1)
  }
  if (e === '54') {
    credit(s, 'deathwatch', 15)
    if (ch(e, 'necrons')?.value === 'supply') credit(s, 'necrons', 20)
    else intel(s, 'necrons', 1)
  }
  if (e === '55') addEffect(s, e, null, 'route')
  if (e === '56')
    for (const c of b.choices.filter((c) => c.kind === e && c.value === 'ledger')) {
      const u = live(c.unit)
      if (u && u.scars.length) u.flags.rehabLedger = true
    }
  if (e === '63')
    for (const c of b.choices.filter((c) => c.kind === e))
      if (live(c.unit)) addEffect(s, e, c.side, 'side_battle', { unit: c.unit! })
  if (e === '64') {
    const c = b.choices.find((c) => c.kind === e)!
    if (c.sector)
      addEffect(s, e, c.side, 'route', {
        origin: b.table.records.routeOrigin as string,
        target: c.sector,
      })
  }
  if (e === '65') choir(s, 1)
  if (e === '66') {
    choir(s, 2)
    const next = s.choir < 2 ? 2 : s.choir < 4 ? 4 : s.choir < 6 ? 6 : 8
    choir(s, 0, next)
    for (const side of SIDES) intel(s, side, 1)
  }
}
function catchup(s: State) {
  const al = STAGES[s.stage].al
  const resources = (side: Side) => {
    const us = s.units.filter(
      (u) => u.side === side && !['lost', 'archived', 'sealed'].includes(u.status),
    )
    return Math.max(
      0,
      s.players[side].supply +
        Object.values(s.sectors)
          .filter((a) => a.owner === side)
          .reduce((n, a) => n + a.local, 0) +
        us.reduce((n, u) => n + u.rc - u.damage * healCost(u.rc) - u.evacDebt, 0) -
        s.players[side].debt,
    )
  }
  const values = Object.fromEntries(
    SIDES.map((side) => [side, { resources: resources(side), ready: maximumReady(s, side) }]),
  ) as Record<Side, { resources: number; ready: number }>
  for (const side of SIDES) {
    const low =
        values[other(side)].resources - values[side].resources >= 250 &&
        values[other(side)].ready - values[side].ready >= al * 0.1,
      p = s.players[side]
    p.flags.catchupBattles = low && p.flags.catchupLow ? 4 : 0
    p.flags.catchupLow = low
    p.flags.catchupResources = values[side].resources
    p.flags.catchupReady = values[side].ready
  }
}
