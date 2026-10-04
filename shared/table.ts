import {
  SIDES,
  other,
  type Command,
  type Context,
  type MissionObject,
  type Side,
  type State,
  type TableState,
} from './model.ts'
import { ARMOURY, assert, entry, integer, STAGES, unit } from './rules.ts'
export function createTable(s: State, mission: string, ctx: Context): TableState {
  const stage = STAGES[s.stage],
    l = ['WAR', 'PACT'].includes(mission) ? 60 : stage.l,
    w = ['WAR', 'PACT'].includes(mission) ? 44 : stage.w,
    d = ['WAR', 'PACT'].includes(mission) ? 12 : stage.d,
    g = w - 2 * d
  const layouts: Record<string, [number, number][]> = {
    THREE: [
      [l * 0.25, w * 0.5],
      [l * 0.5, w * 0.5],
      [l * 0.75, w * 0.5],
    ],
    FOUR: [
      [l * 0.3, w * 0.5 - g / 4],
      [l * 0.7, w * 0.5 - g / 4],
      [l * 0.3, w * 0.5 + g / 4],
      [l * 0.7, w * 0.5 + g / 4],
    ],
    CROSS: [
      [l * 0.5, w * 0.5],
      [l * 0.25, w * 0.5],
      [l * 0.75, w * 0.5],
      [l * 0.5, d / 2],
      [l * 0.5, w - d / 2],
    ],
    TRIANGLE: [
      [l * 0.5, w * 0.5 - g / 4],
      [l * 0.3, w * 0.5 + g / 4],
      [l * 0.7, w * 0.5 + g / 4],
    ],
    FINAL: [
      [l * 0.2, w - d - 2],
      [l * 0.4, w - d - 2],
      [l * 0.6, w - d - 2],
      [l * 0.8, w - d - 2],
      [l * 0.5, w - d / 2],
    ],
    SHORT: [
      [l * 0.5, w * 0.2],
      [l * 0.5, w * 0.4],
      [l * 0.5, w * 0.6],
      [l * 0.5, w * 0.8],
    ],
    SIX: [...Array(2)].flatMap((_, j) =>
      [0.25, 0.5, 0.75].map((x) => [l * x, w * 0.5 + ((j ? 1 : -1) * g) / 4] as [number, number]),
    ),
  }
  layouts.FIVE = [...layouts.FOUR, [l * 0.5, w * 0.5]]
  const code = mission.replace(/^K/, 'A'),
    mapping: Record<string, string> = {
      A1: 'THREE',
      A2: 'THREE',
      A3: 'FINAL',
      B1: 'FIVE',
      B2: 'CROSS',
      B3: 'MOVING',
      C1: 'CROSS',
      C2: 'PLATFORM',
      C3: 'SHORT',
      D1: 'THREE',
      D2: 'FOUR',
      D3: 'THREE',
      E1: 'MOVING',
      E2: 'FIVE',
      E3: 'SIX',
      F1: 'THREE',
      F2: 'FIVE',
      F3: 'THREE',
      G1: 'CROSS',
      G2: 'TRIANGLE',
      G3: 'CROSS',
      H1: 'CROSS',
      H2: 'FIVE',
      H3: 'CENTER',
      I1: 'FIVE',
      I2: 'THREE',
      I3: 'THREE',
      J1: 'FOUR',
      J2: 'FOUR',
      J3: 'THREE',
      encounter: 'CROSS',
      WAR: 'CRISIS',
      PACT: 'CRISIS',
    }
  const layout = mapping[code] ?? 'CROSS'
  let coords =
    layouts[layout] ??
    (layout === 'MOVING'
      ? [[0, w * 0.5]]
      : layout === 'PLATFORM' || layout === 'CENTER'
        ? [[l * 0.5, w * 0.5]]
        : [
            [18, 22],
            [42, 22],
            [30, 22],
          ])
  const objective = [
      'B2',
      'C1',
      'C3',
      'D3',
      'F1',
      'G1',
      'G3',
      'H1',
      'I2',
      'I3',
      'J1',
      'encounter',
      'WAR',
    ].includes(code),
    items = ['B1', 'D2', 'J2'].includes(code)
  let objects: MissionObject[] = coords.map(([x, y], i) => ({
    id: String(i + 1),
    x,
    y,
    kind: objective ? 'objective' : items ? 'item' : 'interaction',
    tag: null,
    control: null,
    disabled: false,
    carrier: null,
    keys: [],
    revealed: false,
    data: {},
  }))
  if (code === 'A2') objects[1].kind = 'objective'
  if (code === 'I1') objects[4].kind = 'objective'
  if (code === 'J3') objects[1].y = w * 0.5 - g / 4
  if (['WAR', 'PACT', 'J2', 'J3'].includes(code))
    objects.push({
      id: 'engine',
      x: l * 0.5,
      y: w * 0.5,
      kind: 'interaction',
      tag: null,
      control: null,
      disabled: false,
      carrier: null,
      keys: [],
      revealed: false,
      data: {},
    })
  if (
    s.battles >= 12 &&
    s.battles < 17 &&
    !/^[AK]/.test(mission) &&
    !['WAR', 'PACT'].includes(mission)
  )
    objects.push({
      id: 'overlay',
      x: l * 0.5,
      y: w * 0.5,
      kind: 'interaction',
      tag: null,
      control: null,
      disabled: false,
      carrier: null,
      keys: [],
      revealed: false,
      data: {},
    })
  if (s.choir >= 6 && /^[AK]/.test(mission))
    objects.push({
      id: 'index',
      x: l * 0.5,
      y: w * 0.5,
      kind: 'interaction',
      tag: null,
      control: null,
      disabled: false,
      carrier: null,
      keys: [],
      revealed: false,
      data: {},
    })
  const records: TableState['records'] = {}
  if (code === 'F2') records.trueSignal = s.battle?.hiddenSignal ?? String(ctx.dice(5))
  if (code === 'H3') records.safeRadius = 18
  return {
    round: 1,
    turn: s.active,
    first: s.active,
    step: 'start',
    vp: { deathwatch: 0, necrons: 0 },
    objects,
    actions: [],
    records,
    instability: 0,
    primes: {},
    echoes:
      code === 'PACT' ? [0, 1, 2].map(() => ({ wounds: 10, muted: false, blocked: false })) : [],
    notes: [],
    receipts: [],
  }
}
const addVP = (t: TableState, side: Side, n: number) => {
  t.vp[side] = Math.min(50, t.vp[side] + n)
}
function once(t: TableState, k: string) {
  if (t.records[k]) return false
  t.records[k] = true
  return true
}
function tally(t: TableState, k: string) {
  t.records[k] = Number(t.records[k] ?? 0) + 1
  return Number(t.records[k])
}
const codeOf = (s: State) => s.battle!.mission!.replace(/^K/, 'A')
const mainObjects = (t: TableState) =>
  t.objects.filter((o) => !['engine', 'overlay', 'index'].includes(o.id))
export function actionsFor(s: State, object: MissionObject): string[] {
  const code = codeOf(s)
  if (object.disabled) return []
  if (object.id === 'overlay') return [s.battles < 14 ? 'SYNCHRONISE' : 'LOCK ANCHOR']
  if (object.id === 'index') return ['EXTRACT INDEX']
  if (object.id === 'engine')
    return code === 'PACT'
      ? ['PRIME ENGINE']
      : code === 'WAR'
        ? ['OVERRIDE ENGINE']
        : code === 'J3'
          ? ['ARM', 'DISARM']
          : ['FEED']
  const map: Record<string, string[]> = {
    A1: ['BREACH'],
    A2: object.id === '2' ? [] : ['HACK'],
    A3: object.id === '5' ? ['CLAIM'] : ['DISABLE'],
    B1: ['PICK UP', 'DELIVER', 'DROP'],
    C2: [],
    D1: ['OVERLOAD'],
    D2: ['PICK UP', 'DELIVER', 'DESTROY', 'DROP'],
    E1: ['BOARD'],
    E2: ['DEMOLISH'],
    E3: ['SEARCH', 'DESTROY CARGO'],
    F1: ['HACK'],
    F2: ['SCAN'],
    F3: object.id === '2' ? ['UPLOAD'] : ['HACK'],
    G1: object.id === '1' ? ['COMMUNE'] : [],
    G2: ['CONTROL'],
    G3: object.id === '1' ? ['LISTEN'] : [],
    H2: ['SHATTER'],
    I1: object.id === '5' ? [] : ['CONTROL'],
    I3: ['SCAN'],
    J1: ['SHUTDOWN'],
    J2: ['PICK UP', 'DELIVER', 'DROP'],
    J3: ['OVERRIDE'],
    WAR: ['SEAL CONDUIT'],
    PACT: ['ENCODE'],
  }
  return map[code] ?? []
}
export function tableCommand(s: State, c: Command, ctx: Context) {
  assert(s.phase === 'battle' && s.battle, 'Идёт другой этап')
  const b = s.battle!,
    t = b.table,
    side = ctx.actor,
    code = codeOf(s),
    p = c.payload
  assert(t.step !== 'finished', 'Бой уже окончен')
  switch (c.type) {
    case 'table_decoy': {
      assert(
        code === 'H1' && t.round === 1 && t.step === 'start' && !b.decoys[side],
        'Decoy выбирается после deployment до первого хода',
      )
      const pick = b.muster[side]!.picks.find((v) => v.id === p.actor)
      assert(
        pick && entry(s, unit(s, pick.id)).keywords.includes('INFANTRY'),
        'Decoy требует INFANTRY формацию',
      )
      b.decoys[side] = pick.formation
      return
    }
    case 'table_decoy_reveal':
      assert(
        code === 'H1' &&
          b.decoys[side] &&
          !t.records[`decoyShown:${side}`] &&
          p.attacksFinished === true,
        'Decoy раскрыть после всех ranged атак enemy unit дальше 12',
      )
      t.records[`decoyShown:${side}`] = true
      t.notes.push(`${side}: Decoy ${b.decoys[side]}, legal Normal Move до 3 вне Engagement.`)
      return
    case 'table_pool_arrival': {
      assert(
        t.step === 'movement' && t.turn === side && !t.records.withdrawalSide,
        'Pool входит в своей Movement до Action, не при Withdrawal',
      )
      assert(
        !t.actions.some((a) => a.side === side && a.round === t.round),
        'Pool arrival до Named Actions',
      )
      assert(!t.records[`poolSlot:${side}:${t.round}`], 'Слот этого раунда потрачен')
      const extra = b.effects.some((e) => e.code === '46') ? 1 : 0
      assert(t.round >= b.firstSlot + extra && t.round <= 5, 'Ещё нет слота')
      const pick = b.muster[side]!.picks.find((v) => v.id === p.actor && v.role === 'pool')
      assert(pick, 'Нет Pool ID')
      assert(!pick.transport, 'Груз входит только со своим транспортом')
      const roots = b.muster[side]!.picks.filter(
          (v) => v.role === 'pool' && v.formation === pick.formation,
        ),
        rootIds = roots.map((v) => v.id)
      const group = b.muster[side]!.picks.filter(
        (v) =>
          v.role === 'pool' &&
          (v.formation === pick.formation || rootIds.includes(v.transport ?? '')),
      )
      assert(
        group.every((v) => !t.records[`entered:${v.id}`]),
        'ID уже на столе',
      )
      assert(
        group.every(
          (v) =>
            t.round >=
            b.firstSlot +
              extra +
              (unit(s, v.id).side === 'necrons' && unit(s, v.id).scars.some((c) => c.id === 9)
                ? 1
                : 0),
        ),
        'Scar задерживает пакет',
      )
      t.records[`poolSlot:${side}:${t.round}`] = true
      if (p.placed === true) {
        assert(p.legalIngress === true, 'Подтвердите legal ingress')
        for (const v of group) t.records[`entered:${v.id}`] = t.round
        t.notes.push('Груз прибывшего транспорта не высаживается до следующего собственного хода.')
      }
      return
    }
    case 'table_reserve_arrival': {
      assert(
        t.step === 'movement' &&
          t.turn === side &&
          !t.records.withdrawalSide &&
          t.round >= 2 &&
          t.round <= 3,
        'Initial Reserves входят в Movement R2–3',
      )
      const pick = b.muster[side]!.picks.find(
        (v) => v.id === p.actor && v.reserve && v.role !== 'pool',
      )
      assert(pick && !pick.transport, 'Выберите корень committed reserve package')
      const group = b.muster[side]!.picks.filter(
        (v) => v.formation === pick.formation || v.transport === pick.id,
      )
      assert(
        group.every((v) => !t.records[`entered:${v.id}`]) && p.legalIngress === true,
        'Пакет уже вошёл или placement не legal',
      )
      for (const v of group) t.records[`entered:${v.id}`] = t.round
      return
    }
    case 'table_suppression':
      assert(
        side === b.attacker &&
          b.assets[side]?.breach.includes('suppression') &&
          t.turn === b.defender &&
          t.step === 'movement' &&
          t.round >= b.firstSlot + (b.effects.some((e) => e.code === '46') ? 1 : 0) &&
          t.round <= 5 &&
          !t.records[`poolSlot:${b.defender}:${t.round}`] &&
          !t.records.suppressionUsed &&
          b.muster[b.defender]!.picks.some(
            (v) => v.role === 'pool' && !t.records[`entered:${v.id}`],
          ),
        'Нет существующего слота для Suppression',
      )
      t.records[`poolSlot:${b.defender}:${t.round}`] = true
      t.records.suppressionUsed = true
      return
    case 'table_first':
      assert(t.step === 'start' && t.round === 1, 'Первый игрок уже определён')
      assert(SIDES.includes(p.side as Side), 'Неизвестная сторона')
      t.first = p.side as Side
      t.turn = t.first
      return
    case 'table_controls': {
      assert(Array.isArray(p.controls) && p.controls.length <= 12, 'Неверные факты контроля')
      for (const row of p.controls as { id: string; side: Side | null }[]) {
        const o = t.objects.find((o) => o.id === row.id)
        assert(
          o && !o.disabled && (row.side === null || SIDES.includes(row.side)),
          'Недопустимый объект/контроль',
        )
        if (
          code === 'A2' &&
          o.id === '2' &&
          o.control &&
          row.side &&
          o.control !== row.side &&
          once(t, `a2Control:${t.round}`)
        )
          t.notes.push('Смена контроля Array: все формации в 6 проходят Battle-shock.')
        o.control = row.side
      }
      return
    }
    case 'table_extra_asset': {
      assert(
        code === 'A2' && side === b.attacker && t.records.a2ExtraAsset && !t.records.a2AssetChosen,
        'Нет дополнительного Asset',
      )
      const id = String(p.asset)
      assert(
        ['smoke', 'reserves', 'evacuation'].includes(id) && !(id === 'reserves' && t.round >= 2),
        'Asset недоступен',
      )
      assert(!Object.values(b.assets[side]!).flat().includes(id), 'Asset уже выбран')
      b.assets[side]!.tactical.push(id)
      t.records.a2AssetChosen = true
      return
    }
    case 'table_use': {
      const pick = b.muster[side]!.picks.find((v) => v.id === p.actor),
        id = String(p.item)
      assert(pick, 'Нет committed actor')
      const u = unit(s, pick.id)
      if (pick.armoury && u.armoury === id)
        assert(
          !u.scars.some((v) => side === 'deathwatch' && v.id === 4) &&
            !b.effects.some((e) => e.code === '41' && e.side === side && e.data.unit === u.id),
          'Armoury заблокировано на этот бой',
        )
      assert(
        pick.honours.includes(id) ||
          (pick.armoury && u.armoury === id) ||
          (pick.relic && u.relic === id),
        'Улучшение не активно',
      )
      assert(once(t, `use:${side}:${pick.id}:${id}`), 'Использование уже потрачено')
      if (pick.armoury && u.armoury === id && u.flags.damagedArmoury && !ARMOURY[id].consumable) {
        const die = ctx.dice(6)
        t.records[`damagedArmoury:${u.id}`] = die
        u.flags.damagedArmoury = false
        if (die === 1) u.armoury = null
        t.notes.push(
          `${u.name}: Damaged Relic D6 = ${die}; ${die === 1 ? 'предмет исчез после использования' : 'предмет сохранился'}.`,
        )
      }
      return
    }
    case 'table_hazard_ack':
      t.receipts.push(`R${t.round}:${t.step}`)
      return
    case 'table_fact': {
      const name = String(p.name)
      assert(
        /^[a-zA-Z0-9_:. -]{1,150}$/.test(name) &&
          !['trueSignal', 'safeRadius'].includes(name) &&
          !name.startsWith('reward:') &&
          !name.startsWith('action:'),
        'Недопустимый факт',
      )
      assert(
        typeof p.value === 'boolean' ||
          (typeof p.value === 'string' && p.value.length <= 120) ||
          (typeof p.value === 'number' &&
            Number.isFinite(p.value) &&
            p.value >= 0 &&
            p.value <= 100),
        'Недопустимое значение',
      )
      t.records[`fact:${name}`] = p.value as boolean | string | number
      if (name.startsWith('prime_invalid:')) delete t.primes[name.split(':')[1] as Side]
      return
    }
    case 'echo_wounds': {
      assert(code === 'PACT', 'Echo только в PACT')
      const i = integer(p.index, 0, 2)
      t.echoes[i].wounds = integer(p.wounds, 0, 10)
      t.echoes[i].blocked = p.blocked === true
      t.echoes[i].muted = p.muted === true || t.echoes[i].muted
      return
    }
    case 'table_action':
      startAction(s, p, ctx)
      return
    case 'table_complete':
      completeAction(s, p, ctx)
      return
    case 'table_suppress_prepare': {
      assert(
        code === 'PACT' &&
          t.turn === side &&
          t.step === 'shooting' &&
          !t.records[`suppress:${side}:${t.round}`],
        'Suppress один раз в собственной Shooting',
      )
      const pick = b.muster[side]!.picks.find((v) => v.id === p.actor)
      assert(
        pick &&
          p.eligible === true &&
          p.inRange === true &&
          p.visible === true &&
          !t.actions.some(
            (a) => a.formation === pick.formation && a.side === side && a.round === t.round,
          ),
        'Не выполнены eligibility / Engine 18 LoS / без Action',
      )
      assert(p.mode === 'instability' || p.mode === 'mute', 'Неизвестный режим')
      if (p.mode === 'mute') {
        const i = integer(p.index, 0, 2)
        assert(
          t.echoes[i].wounds > 0 && p.echoVisible === true,
          'Echo должна быть live и visible в 18',
        )
        t.records[`suppressTarget:${side}:${t.round}`] = i
      }
      t.records[`suppressMode:${side}:${t.round}`] = String(p.mode)
      t.records[`suppressActor:${side}:${t.round}`] = pick.id
      return
    }
    case 'table_suppress': {
      assert(
        code === 'PACT' && t.turn === side && t.step === 'shooting',
        'Suppress в своей Shooting',
      )
      const u = unit(s, p.actor, side),
        pick = b.muster[side]!.picks.find((v) => v.id === u.id)
      assert(
        pick && p.eligible === true && p.inRange === true && p.visible === true,
        'Нет eligibility / Engine в 18 и LoS',
      )
      assert(
        !t.actions.some((a) => a.actor === u.id && a.side === side && a.round === t.round),
        'Actor выполнял Action',
      )
      assert(once(t, `suppress:${side}:${t.round}`), 'Suppress уже использован')
      assert(
        t.records[`suppressActor:${side}:${t.round}`] === u.id,
        'Сначала объявите режим и цель до броска',
      )
      const die = integer(p.die, 1, 6),
        mode = String(t.records[`suppressMode:${side}:${t.round}`])
      assert(mode === 'instability' || mode === 'mute', 'Выберите эффект до броска')
      if (mode === 'mute') {
        const i = integer(t.records[`suppressTarget:${side}:${t.round}`], 0, 2)
        assert(t.echoes[i].wounds > 0, 'Echo не live')
        if (die >= 3) t.echoes[i].muted = true
      } else if (die >= 3) t.instability = Math.max(0, t.instability - 1)
      return
    }
    case 'table_withdrawal':
      assert(
        (!['WAR', 'PACT'].includes(b.type) &&
          t.round >= 3 &&
          t.step === 'command' &&
          t.turn === side) ||
          (!['WAR', 'PACT'].includes(b.type) &&
            t.records.withdrawalSide &&
            t.records.withdrawalSide !== side &&
            t.step === 'movement'),
        'Withdrawal в Command с R3 или немедленный взаимный ответ',
      )
      if (t.records.withdrawalSide) {
        assert(!t.records.mutualWithdrawal, 'Ответ уже принят')
        t.records.mutualWithdrawal = true
      } else {
        t.records.withdrawalSide = side
        t.step = 'movement'
      }
      t.notes.push(
        'Эвакуация до конца этой Movement. Новых Pool arrivals нет; remaining на столе уничтожены.',
      )
      return
    case 'table_advance':
      assert(
        t.turn === side || ['start', 'end_round', 'hazards'].includes(t.step),
        'Сейчас ход другой стороны',
      )
      advance(s, ctx)
      return
    default:
      assert(false, 'Неизвестная команда стола')
  }
}
function startAction(s: State, p: Record<string, unknown>, ctx: Context) {
  const b = s.battle!,
    t = b.table,
    side = ctx.actor,
    code = codeOf(s),
    u = unit(s, p.actor, side),
    pick = b.muster[side]!.picks.find((v) => v.id === u.id),
    o = t.objects.find((o) => o.id === p.object),
    kind = String(p.kind)
  assert(!t.records.withdrawalSide, 'Во время эвакуации Actions закрыты')
  assert(pick && o && actionsFor(s, o).includes(kind), 'Actor/action/object недоступны')
  assert(t.turn === side && t.step === 'movement', 'Action в конце своей Movement')
  assert(p.eligible === true && p.inRange === true, 'Проверьте core eligibility и range')
  const core = ['CLAIM', 'OVERRIDE ENGINE', 'PRIME ENGINE'].includes(kind)
  if (p.advanced === true || p.actionShoot === true) {
    assert(!core, 'CORE запрещает ускорения')
    const required = p.advanced === true ? 'secure_and_extract' : 'operational_mastery'
    assert(
      pick.honours.includes(required) ||
        (p.actionShoot === true && pick.honours.includes('black_spear_veteran')),
      'Нет кампанийного разрешения',
    )
    assert(once(t, `honour:${u.id}:${required}`), 'Honour уже израсходовано')
  }
  assert(
    pick.role === 'pool' || pick.reserve ? t.records[`entered:${pick.id}`] : true,
    'Actor ещё не прибыл',
  )
  if (['A1', 'A3', 'D1', 'E2', 'F3'].includes(code))
    assert(side === b.attacker, 'Действие только Attacker')
  assert(
    !t.actions.some(
      (a) => a.formation === pick.formation && a.side === side && a.round === t.round,
    ),
    'Формация уже начинала Action',
  )
  assert(
    !t.actions.some(
      (a) => a.side === side && a.object === o.id && a.kind === kind && a.round === t.round,
    ),
    'Action этого типа уже начинался здесь',
  )
  if (['HACK', 'CONTROL', 'SEAL CONDUIT', 'LOCK ANCHOR'].includes(kind))
    assert(o.tag !== side, 'Own-tag Action закрыт')
  if (kind === 'HACK' && ['A2', 'F3'].includes(code))
    assert(!o.data[`hack:${side}`], 'Этот узел уже взломан вашей стороной')
  if (['CLAIM', 'OVERRIDE ENGINE', 'SEAL CONDUIT', 'LOCK ANCHOR'].includes(kind))
    assert(o.control === side, 'Нужен физический контроль при старте')
  if (kind === 'CLAIM')
    assert(t.round >= 3 && mainObjects(t).filter((o) => o.disabled).length >= 2, 'CLAIM ещё закрыт')
  if (kind === 'OVERRIDE ENGINE')
    assert(
      t.round >= 4 && mainObjects(t).filter((o) => o.tag === side).length >= 2,
      'Нужны R4 и два current tags',
    )
  if (kind === 'PRIME ENGINE')
    assert(
      t.round >= 4 && mainObjects(t).every((o) => o.keys.length === 2),
      'Нужны R4 и три stable Seals',
    )
  if (kind === 'ENCODE') {
    assert(!o.keys.includes(side), 'Ключ уже записан')
    assert(
      !t.actions.some((a) => a.kind === 'ENCODE' && a.side === side && a.round === t.round),
      'Максимум один начатый ENCODE за ход',
    )
  }
  if (kind === 'COMMUNE') assert(t.round >= 3 && !t.records.commune, 'COMMUNE недоступен')
  if (kind === 'LISTEN')
    assert(Number(t.records[`listen:${side}`] ?? 0) < 2, 'Два LISTEN уже выполнены')
  if (kind === 'SHATTER')
    assert(
      (o.id !== '5' || t.round >= 3) &&
        !t.actions.some((a) => a.kind === 'SHATTER' && a.side === side && a.round === t.round),
      'SHATTER пока недоступен',
    )
  if (kind === 'SCAN' && code === 'F2') assert(!o.revealed, 'Signal раскрыт')
  if (kind === 'SCAN' && code === 'I3')
    assert(!o.data[`scan:${side}`], 'Obelisk уже SCAN этой стороной')
  if (kind === 'UPLOAD')
    assert(
      mainObjects(t).some((o) => o.id !== '2' && o.data[`hack:${side}`]),
      'Сначала HACK Power Node',
    )
  if (kind === 'DESTROY CARGO')
    assert(Number(t.records.searched ?? 0) >= 3, 'Cargo ещё не volatile')
  if (kind === 'EXTRACT INDEX')
    assert(
      entry(s, u, b.snapshot).character && !t.records[`index:${side}`],
      'Index требует CHARACTER / один раз',
    )
  if (kind === 'SYNCHRONISE') assert(!t.records[`sync:${side}`], 'SYNCHRONISE уже выполнен')
  if (kind === 'LOCK ANCHOR') assert(t.round >= 2, 'Anchor с R2')
  if (kind === 'ARM')
    assert(
      mainObjects(t).filter((o) => o.data[`override:${side}`]).length >= 2 && o.tag !== side,
      'Нужны два overrides / нельзя ARM свой Armed',
    )
  if (kind === 'DISARM') assert(o.tag !== null, 'Reactor Unarmed')
  if (kind === 'PICK UP') {
    assert(o.kind === 'item' && !o.carrier, 'Предмет уже несут')
    assert(
      !t.objects.some(
        (o) =>
          o.carrier &&
          b.muster[side]!.picks.find((v) => v.id === o.carrier)?.formation === pick.formation,
      ),
      'Формация уже несёт предмет',
    )
  }
  if (kind === 'DELIVER' || kind === 'DROP') {
    assert(
      o.carrier === u.id && p.deliveryEligible === true,
      'Требуется bearer и зона/edge/DROP placement',
    )
  }
  if (kind === 'DESTROY') assert(!o.carrier, 'Нельзя DESTROY переносимый предмет')
  if (kind === 'FEED')
    assert(
      t.objects.some((o) => o.carrier === u.id),
      'Нет Scrap у bearer',
    )
  const a = {
    id: ctx.id(),
    side,
    actor: u.id,
    formation: pick.formation,
    object: o.id,
    kind,
    round: t.round,
    pending: true,
    success: false,
    started: t.actions.length,
  }
  t.actions.push(a)
}
function commandScore(s: State) {
  const b = s.battle!,
    t = b.table,
    side = t.turn,
    code = codeOf(s),
    own = mainObjects(t).filter((o) => !o.disabled && o.control === side).length,
    enemy = mainObjects(t).filter((o) => !o.disabled && o.control === other(side)).length,
    center = t.objects.find((o) => o.x === STAGES[s.stage].l / 2 && o.y === STAGES[s.stage].w / 2)
  if (t.round < 2) return
  let n = 0
  if (code === 'B2')
    n = (own > 0 ? 3 : 0) + (own > enemy ? 3 : 0) + (center?.control === side ? 2 : 0)
  if (code === 'C1') n = (own > enemy ? 5 : 0) + (center?.control === side ? 3 : 0)
  if (['F1', 'J1'].includes(code)) n = Math.min(9, own * 3)
  if (code === 'H1') n = (own >= 2 ? 5 : 0) + (own > enemy ? 5 : 0)
  addVP(t, side, n)
}
function roundScore(s: State) {
  const b = s.battle!,
    t = b.table,
    code = codeOf(s),
    os = mainObjects(t),
    st = STAGES[s.stage],
    scoreControl = (o: MissionObject, n: number) => {
      if (o.control) addVP(t, o.control, n)
    }
  if (['B3', 'E1'].includes(code)) {
    const o = os[0]
    o.x = Math.min(st.l, o.x + (st.l === 60 ? 12 : 9))
    t.notes.push(
      `Объект переместился в (${o.x}, ${o.y}); отметьте фактический Area OC у новой позиции перед завершением hazards.`,
    )
    t.records.movingNeedsScore = true
    return
  }
  if (code === 'C2') {
    const o = os[0]
    if (o.control && !o.disabled) {
      const d = o.control === b.attacker ? -1 : 1
      o.y = Math.max(0, Math.min(st.w, o.y + d * 6))
      addVP(t, o.control, 5)
      if (o.y === 0 || o.y === st.w) {
        addVP(t, o.control, 20)
        o.disabled = true
      }
    }
  }
  if (code === 'A2') scoreControl(os[1], 5)
  if (code === 'C3')
    for (const side of SIDES) {
      addVP(t, side, Math.min(12, os.filter((o) => o.control === side).length * 4))
      addVP(t, side, Math.min(4, Number(t.records[`fact:stripKills:${side}:${t.round}`] ?? 0) * 2))
    }
  if (code === 'D3') os.forEach((o, i) => scoreControl(o, i === 1 ? 5 : 3))
  if (code === 'F2') {
    const o = os.find((o) => o.kind === 'objective')
    if (o) scoreControl(o, 5)
  }
  if (code === 'F3' && !t.records.upload) addVP(t, b.defender, 5)
  if (code === 'G1') os.forEach((o, i) => scoreControl(o, i === 0 ? 6 : 2))
  if (code === 'G2')
    for (const side of SIDES) {
      const n = os.filter((o) => o.tag === side).length
      if (n >= 2) addVP(t, side, 6)
      if (n === 3 && once(t, `threeTags:${side}`)) addVP(t, side, 10)
    }
  if (code === 'G3')
    for (const side of SIDES)
      addVP(t, side, Math.min(9, os.filter((o) => o.control === side).length * 3))
  if (code === 'H3') {
    scoreControl(os[0], 5)
    for (const side of SIDES)
      addVP(
        t,
        side,
        Math.min(4, Number(t.records[`fact:outsideKills:${side}:${t.round}`] ?? 0) * 2),
      )
    if (t.round === 5)
      for (const side of SIDES) if (t.records[`fact:warlordSafe:${side}`]) addVP(t, side, 10)
    t.records.safeRadius = Number(t.records.safeRadius) - 3
  }
  if (code === 'I1') {
    for (const side of SIDES)
      addVP(t, side, os.filter((o) => o.id !== '5' && o.tag === side).length * 2)
    scoreControl(os[4], 4)
  }
  if (code === 'I2')
    for (const side of SIDES)
      addVP(
        t,
        side,
        Math.min(
          15,
          os.filter(
            (o) => o.control === side && t.records[`fact:lanePresence:${side}:${o.id}:${t.round}`],
          ).length * 5,
        ),
      )
  if (code === 'I3' && t.round >= 3) scoreControl(os[1], 2)
  if (code === 'J2')
    for (const o of os.filter((o) => !o.disabled && !o.carrier)) {
      const dx = st.l / 2 - o.x,
        dy = st.w / 2 - o.y,
        dist = Math.hypot(dx, dy)
      if (dist <= 5) o.disabled = true
      else {
        o.x += (dx / dist) * 4
        o.y += (dy / dist) * 4
      }
    }
  if (code === 'WAR' && t.round >= 2)
    for (const side of SIDES) {
      addVP(t, side, os.filter((o) => o.tag === side && o.control === side).length * 3)
      if (
        t.round >= 4 &&
        t.records[`override:${side}`] &&
        t.objects.find((o) => o.id === 'engine')!.control === side
      )
        addVP(t, side, 6)
    }
  if (code === 'encounter') os.forEach((o, i) => scoreControl(o, i === 0 ? 4 : 2))
  if (t.round === 5) {
    if (['A1', 'D1'].includes(code)) addVP(t, b.defender, os.filter((o) => !o.disabled).length * 10)
    if (code === 'E2') addVP(t, b.defender, os.filter((o) => !o.disabled).length * 8)
    if (code === 'A3')
      addVP(
        t,
        b.defender,
        os.filter((o) => o.id !== '5' && !o.disabled).length * 5 + (t.records.claim ? 0 : 20),
      )
    if (code === 'F3' && !t.records.upload) addVP(t, b.defender, 15)
    if (['B1', 'D2'].includes(code))
      for (const o of os.filter((o) => !o.disabled && o.carrier)) {
        const side = unit(s, o.carrier).side
        if (t.records[`fact:carrierAlive:${o.carrier}`] === true)
          addVP(t, side, code === 'B1' && o.id === '5' ? 10 : 5)
      }
    if (code === 'J3') {
      const reactor = t.objects.find((o) => o.id === 'engine')!
      if (reactor.tag) {
        addVP(t, reactor.tag, 10)
        t.notes.push('Armed Reactor: уничтожить все формации в 9; Casualty -1.')
      }
    }
  }
}
function startRound(s: State) {
  const b = s.battle!,
    t = b.table,
    code = codeOf(s)
  t.notes = []
  if (code === 'PACT') {
    t.instability += 2
    if (t.instability >= 12) {
      t.records.immediateFailure = true
      t.step = 'finished'
      return
    }
    if (t.round > 1) {
      t.notes.push(
        `Pulse Instability ${t.instability}: примените соответствующую строку. Затем восстановите погибшие Echo у unstable Seals.`,
      )
      for (let i = 0; i < 3; i++) {
        t.echoes[i].muted = false
        if (t.echoes[i].wounds === 0 && t.objects[i].keys.length < 2 && !t.echoes[i].blocked)
          t.echoes[i].wounds = 10
        t.echoes[i].blocked = false
      }
    }
  } else if (code === 'WAR' && t.round >= 2)
    t.notes.push('Conduit D3: в 4 каждой формации на 4+ D3 mortal wounds.')
  else t.notes.push('Примените только hazard начала этого раунда с карточки миссии.')
  if (b.number >= 15 && b.number <= 17 && !/^[AK]/.test(b.mission!) && [3, 5].includes(t.round))
    t.notes.push(
      b.number === 17
        ? 'Anchor: всем формациям в 6 по 1 mortal wound.'
        : 'Anchor: всем формациям в 6 Battle-shock.',
    )
  if (t.round === 2)
    for (const who of SIDES)
      if (b.assets[who]?.tactical.includes('reserves'))
        t.notes.push(`${who}: Field Reserves +1 CP по обычному лимиту.`)
  for (const e of b.effects) {
    if (e.code === '22' && t.round === 3) t.notes.push('Ash Rain: R3 ranged targets только до 24.')
    if (e.code === '65' && t.round === 4) t.notes.push('Black Sun: R4 нет Cover.')
    if (e.code === '62' && t.round === 2)
      t.notes.push(
        'Nine Seconds: повторить явно заданный hazard R1; если его нет — обеим сторонам +1 CP по core limits.',
      )
  }
}
function advance(s: State, ctx: Context) {
  const b = s.battle!,
    t = b.table,
    code = codeOf(s)
  switch (t.step) {
    case 'start':
      if (code === 'H1' && t.round === 1)
        assert(
          SIDES.every((side) => b.decoys[side]),
          'Оба тайно выбирают Decoy',
        )
      startRound(s)
      if (!t.records.immediateFailure) {
        t.turn = t.first
        t.step = 'command'
      }
      return
    case 'command':
      if (!(t.round === 5 && t.turn !== t.first)) commandScore(s)
      t.step = 'movement'
      return
    case 'movement':
      if (t.records.withdrawalSide) {
        const side = t.records.withdrawalSide as Side
        t.vp[side] = Math.min(25, t.vp[side])
        if (t.records.mutualWithdrawal) t.vp[other(side)] = Math.min(25, t.vp[other(side)])
        t.step = 'finished'
      } else t.step = 'shooting'
      return
    case 'shooting':
      t.step = 'end_turn'
      return
    case 'end_turn':
      for (const a of t.actions.filter(
        (a) => a.round === t.round && a.side === t.turn && a.pending && a.kind !== 'COMMUNE',
      ))
        a.pending = false
      if (t.round === 5 && t.turn !== t.first) commandScore(s)
      if (t.turn === t.first) {
        t.turn = other(t.first)
        t.step = 'command'
      } else t.step = 'end_round'
      return
    case 'end_round':
      for (const a of t.actions.filter((a) => a.round === t.round && a.pending)) a.pending = false
      if (code === 'H3')
        for (const who of SIDES)
          t.records[`fact:beforeHazardKills:${who}:${t.round}`] =
            t.records[`fact:outsideKills:${who}:${t.round}`] ?? 0
      roundScore(s)
      t.step = 'hazards'
      t.notes.push('Разрешите end-round hazards и уничтожение, затем проверьте итоговые факты.')
      if (code === 'PACT' && t.round >= 2)
        t.notes.push('Echo phase: слева направо, затем Final Pulse в R5.')
      if (['WAR', 'PACT'].includes(code) && t.round === 5)
        t.notes.push('Final Pulse: в 3 Engine каждой формации 1 MW до gate.')
      return
    case 'hazards':
      if (t.records.movingNeedsScore) {
        const o = mainObjects(t)[0]
        if (o.control) {
          addVP(t, o.control, code === 'B3' ? 7 : 6)
          if (o.x === STAGES[s.stage].l && once(t, 'movingExit'))
            addVP(t, o.control, code === 'B3' ? 15 : 10)
        }
        delete t.records.movingNeedsScore
      }
      if (code === 'H3')
        for (const side of SIDES)
          addVP(
            t,
            side,
            Math.max(
              0,
              Math.min(4, Number(t.records[`fact:outsideKills:${side}:${t.round}`] ?? 0) * 2) -
                Math.min(
                  4,
                  Number(
                    t.records[`fact:beforeHazardKills:${side}:${t.round}`] ??
                      t.records[`fact:outsideKills:${side}:${t.round}`] ??
                      0,
                  ) * 2,
                ),
            ),
          )
      if (
        code === 'PACT' &&
        t.round < 5 &&
        mainObjects(t).some((o) => o.keys.length < 2) &&
        !t.records[`key:${t.round}`]
      )
        t.instability++
      if (t.instability >= 12) {
        t.records.immediateFailure = true
        t.step = 'finished'
        return
      }
      if (t.round === 5) t.step = 'finished'
      else {
        t.round++
        t.step = 'start'
      }
      return
    default:
      assert(false, 'Нельзя перейти дальше')
  }
}
function completeAction(s: State, p: Record<string, unknown>, ctx: Context) {
  const b = s.battle!,
    t = b.table,
    side = ctx.actor,
    code = codeOf(s),
    a = t.actions.find((a) => a.id === p.id),
    o = t.objects.find((o) => o.id === a?.object)
  assert(a && o && a.side === side && a.pending, 'Action закрыт')
  assert(a.round === t.round, 'Action истёк')
  assert(
    a.kind === 'COMMUNE' ? t.step === 'end_round' : t.step === 'end_turn' && t.turn === side,
    'Ещё не completion timing',
  )
  a.pending = false
  if (p.success !== true) {
    if (a.kind === 'UPLOAD' && once(t, 'failedUpload'))
      t.notes.push('Первый провал UPLOAD: Battle-shock всем в 6 Array.')
    return
  }
  assert(
    p.alive === true && p.inRange === true && p.notShocked === true && p.stationary === true,
    'Completion требует живого, стационарного actor в range без Battle-shock',
  )
  const jamOwner = t.records[`jamOwner:${o.id}`],
    jamUntil = Number(t.records[`jamUntil:${o.id}`] ?? 0)
  if (jamOwner && jamOwner !== side && jamUntil >= t.round) {
    assert(o.control === side, 'Field Engineers Jam требует контроля при completion')
    delete t.records[`jamOwner:${o.id}`]
  }
  if (['CLAIM', 'OVERRIDE ENGINE', 'SEAL CONDUIT', 'LOCK ANCHOR', 'COMMUNE'].includes(a.kind))
    assert(o.control === side, 'Нет физического контроля при completion')
  if (a.kind === 'OVERRIDE ENGINE')
    assert(mainObjects(t).filter((o) => o.tag === side).length >= 2, 'Tags утрачены')
  if (a.kind === 'ENCODE')
    assert(t.echoes[Number(o.id) - 1].wounds === 0, 'Echo должна погибнуть к completion')
  if (a.kind === 'PRIME ENGINE')
    assert(
      mainObjects(t).every((o) => o.keys.length === 2),
      'Seals не stable',
    )
  a.success = true
  let bonusRoll = false
  if (p.ruinsBonus === true) {
    assert(
      s.sectors.B.owner === side &&
        !s.sectors.B.exhausted &&
        !s.sectors.B.sabotaged &&
        !s.sectors.B.disrupted &&
        !s.sectors.B.contested &&
        p.inRuins === true &&
        !t.records[`ruinsBonus:${side}`],
      'B bonus недоступен',
    )
    t.records[`ruinsBonus:${side}`] = true
    bonusRoll = true
  }
  const k = `reward:${side}:${o.id}:${a.kind}`,
    first = once(t, k),
    die = () => Math.min(6, integer(p.die, 1, 6) + (bonusRoll ? 1 : 0)),
    reward = (n: number) => {
      if (first) addVP(t, side, n)
    }
  const relicPick = b.muster[side]!.picks.find((v) => v.id === a.actor)!
  if (relicPick.honours.includes('field_engineers')) {
    t.records[`jamOwner:${o.id}`] = side
    t.records[`jamUntil:${o.id}`] = t.round + 1
  }
  if (
    unit(s, a.actor).relic === 'key' &&
    relicPick.relic &&
    code !== 'PACT' &&
    !['CLAIM', 'OVERRIDE ENGINE', 'PRIME ENGINE'].includes(a.kind)
  )
    addVP(t, side, 1)
  if (['BREACH', 'OVERLOAD', 'DEMOLISH', 'DISABLE', 'SHUTDOWN', 'DESTROY'].includes(a.kind)) {
    assert(!o.disabled, 'Объект уже удалён')
    o.disabled = true
    reward(a.kind === 'DEMOLISH' ? 8 : ['DISABLE', 'SHUTDOWN', 'DESTROY'].includes(a.kind) ? 5 : 10)
    if (
      ['A1', 'D1'].includes(code) &&
      mainObjects(t).every((o) => o.disabled) &&
      once(t, 'allDisabled')
    )
      addVP(t, b.attacker, 10)
    if (code === 'A3' && mainObjects(t).filter((o) => o.disabled).length >= 2)
      t.objects.find((o) => o.id === '5')!.kind = 'objective'
    if (code === 'A3' && mainObjects(t).filter((o) => o.disabled).length === 4)
      t.records.defAssetDisabled = true
    if (a.kind === 'SHUTDOWN' && once(t, `shutdownHazard:${t.round}`) && die() === 1)
      t.notes.push('SHUTDOWN hazard: каждой формации в 3 D3 mortal wounds.')
    t.notes.push('Примените hazard/тесты карточки после отключения.')
    if (a.kind === 'DESTROY' && once(t, `opened:${o.id}`)) {
      const n = die()
      if (n === 6) tally(t, `supply10:${side}`)
      if (n === 1) t.notes.push('Bearer проходит Battle-shock.')
    }
    return
  }
  if (a.kind === 'PICK UP') {
    o.carrier = a.actor
    if (((code === 'B1' && o.id === '5') || code === 'D2') && once(t, `opened:${o.id}`)) {
      const n = die()
      if (code === 'B1') {
        if (n <= 2) t.notes.push('Носитель Battle-shocked.')
        else tally(t, `intel:${side}`)
      } else {
        if (n === 1) t.notes.push('Носитель Battle-shocked.')
        if (n === 6) tally(t, `supply10:${side}`)
      }
    }
    return
  }
  if (a.kind === 'DROP') {
    o.carrier = null
    o.x = Number(p.x ?? o.x)
    o.y = Number(p.y ?? o.y)
    return
  }
  if (a.kind === 'DELIVER' || a.kind === 'FEED') {
    const item = a.kind === 'FEED' ? t.objects.find((o) => o.carrier === a.actor)! : o
    item.disabled = true
    item.carrier = null
    addVP(
      t,
      side,
      a.kind === 'FEED' ? 5 : code === 'B1' ? (o.id === '5' ? 13 : 8) : code === 'D2' ? 10 : 8,
    )
    if (a.kind === 'FEED') tally(t, `supply5:${side}`)
    return
  }
  if (
    a.kind === 'HACK' ||
    a.kind === 'CONTROL' ||
    a.kind === 'LOCK ANCHOR' ||
    a.kind === 'SEAL CONDUIT'
  ) {
    o.tag = side
    o.data[`hack:${side}`] = true
    reward(code === 'G2' ? 6 : code === 'WAR' || a.kind === 'LOCK ANCHOR' ? 0 : 5)
    if (code === 'A2' && first) {
      tally(t, `intel:${side}`)
      if (side === b.attacker) {
        const n = tally(t, 'attackerA2Hacks')
        if (n === 1) t.notes.push('Defender +1 CP по обычному лимиту.')
        if (n === 2) t.records.a2ExtraAsset = true
      }
    }
    if (code === 'I1' && once(t, `firstNode:${o.id}`)) {
      const n = die()
      if (n === 1) t.notes.push('Actor Battle-shocked.')
      if (n === 6) tally(t, `xp:${a.actor}`)
    }
    if (code === 'G2' && once(t, `shear:${t.round}`))
      t.notes.push('Shear: enemy выбирает формацию в 3 Node; на 4+ D3 MW.')
    return
  }
  if (a.kind === 'OVERRIDE') {
    o.data[`override:${side}`] = true
    reward(6)
    return
  }
  if (a.kind === 'ARM') {
    o.tag = side
    reward(12)
    return
  }
  if (a.kind === 'DISARM') {
    o.tag = null
    reward(8)
    return
  }
  if (a.kind === 'CLAIM') {
    assert(!t.records.claim, 'CLAIM уже был')
    t.records.claim = true
    reward(20)
    return
  }
  if (a.kind === 'OVERRIDE ENGINE') {
    t.records[`override:${side}`] = true
    return
  }
  if (a.kind === 'ENCODE') {
    o.keys.push(side)
    t.records[`key:${t.round}`] = true
    if (o.keys.length === 2) t.instability = Math.max(0, t.instability - 2)
    return
  }
  if (a.kind === 'PRIME ENGINE') {
    t.primes[side] = a.actor
    return
  }
  if (a.kind === 'COMMUNE') {
    assert(!t.records.commune, 'COMMUNE уже был')
    t.records.commune = true
    addVP(t, side, 8)
    t.records.choirCommune = true
    return
  }
  if (a.kind === 'LISTEN') {
    tally(t, `listen:${side}`)
    addVP(t, side, 5)
    return
  }
  if (a.kind === 'EXTRACT INDEX') {
    t.records[`index:${side}`] = a.actor
    tally(t, `xp:${a.actor}`)
    return
  }
  if (a.kind === 'SYNCHRONISE') {
    t.records[`sync:${side}`] = true
    tally(t, `intel:${side}`)
    tally(t, `xp:${a.actor}`)
    if (die() >= 4) t.notes.push('SYNCHRONISE: формация Battle-shocked.')
    return
  }
  if (a.kind === 'BOARD') {
    if (once(t, `board:${side}:${a.formation}`) && Number(t.records[`board:${side}`] ?? 0) < 3) {
      tally(t, `board:${side}`)
      addVP(t, side, 4)
    }
    return
  }
  if (a.kind === 'UPLOAD') {
    if (first) addVP(t, b.attacker, 25)
    t.records.upload = true
    return
  }
  if (a.kind === 'SEARCH' || a.kind === 'SHATTER') {
    o.disabled = true
    const n = die()
    if (a.kind === 'SEARCH') {
      tally(t, 'searched')
      addVP(t, side, n === 1 ? 0 : n <= 4 ? 5 : 8)
    } else {
      addVP(t, side, n === 1 ? 0 : n <= 3 ? 5 : n <= 5 ? 7 : 10)
      if (p.die === 6) tally(t, `shatter6:${side}`)
    }
    if (n === 6) tally(t, `supply10:${side}`)
    if (n === 1) t.notes.push('D3 mortal wounds bearer; награды completion сохраняются.')
    return
  }
  if (a.kind === 'DESTROY CARGO') {
    o.disabled = true
    t.notes.push('В 3 Cargo: каждой формации на 4+ D3 MW.')
    return
  }
  if (a.kind === 'SCAN') {
    if (code === 'F2') {
      o.revealed = true
      if (o.id === t.records.trueSignal) {
        o.kind = 'objective'
        addVP(t, side, 10)
        for (const v of mainObjects(t)) v.revealed = true
        t.notes.push('Настоящий Signal: actor тестирует Battle-shock, провал отметьте choirF2.')
      } else addVP(t, side, 3)
    } else {
      reward(8)
      o.data[`scan:${side}`] = true
      if (mainObjects(t).every((o) => o.data[`scan:${side}`]) && once(t, `allScanned:${side}`))
        addVP(t, side, 10)
      const n = die()
      if (n <= 2) t.notes.push('Actor: -1 Battle-shock до конца боя.')
      if (n === 6) tally(t, `intel:${side}`)
    }
    return
  }
}
