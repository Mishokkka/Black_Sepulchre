import { SIDES, type Battle, type Report, type Side, type State } from './model.ts'
import { ARMOURY, armouryBlocked, assert, entry, integer } from './rules.ts'

export interface MissionInput {
  key: string
  label: string
  kind: 'check' | 'count' | 'unit'
  max?: number
  ids?: string[]
}

/** Only campaign-relevant tabletop facts. VP and ordinary dice stay at the table. */
export function missionInputs(s: State, b: Battle, r: Report): MissionInput[] {
  const fields: MissionInput[] = []
  const code = (b.mission ?? b.type).replace(/^K/, 'A')
  const check = (key: string, label: string) => fields.push({ key, label, kind: 'check' })
  const count = (key: string, label: string, max: number) =>
    fields.push({ key, label, kind: 'count', max })
  if (code === 'B2') check('choirB2', 'Провален тест у центрального Shrine: Choir +1')
  if (code === 'F2') check('choirF2', 'Провален тест при раскрытии настоящего Signal: Choir +1')
  if (code === 'G1') check('commune', 'COMMUNE успешно завершён: Choir +1')
  if (code === 'A3') check('claim', 'Атакующий успешно выполнил CLAIM')
  if (code === 'A2')
    check('extraEvacuation', 'Атакующий после второго HACK выбрал дополнительный Hard Evacuation')
  if (b.type === 'PACT') {
    check('pact_keys', 'На каждом из трёх Conduits записаны обе Keys')
    check('pact_failed', 'Произошло немедленное поражение по условиям PACT')
  }
  for (const side of SIDES) {
    const label = side === 'necrons' ? 'Necrons' : 'Deathwatch'
    const ids = r.units
      .filter((u) => u.entered && b.before.find((v) => v.id === u.id)?.side === side)
      .map((u) => u.id)
    const choose = (key: string, text: string, candidates = ids) =>
      fields.push({
        key: `${key}:${side}`,
        label: `${label}: ${text}`,
        kind: 'unit',
        ids: candidates,
      })
    if (code === 'A2') count(`hacks:${side}`, `${label}: боковых узлов взломано (по +1 Intel)`, 2)
    if (code === 'B1') {
      check(`centralIntel:${side}`, `${label}: первый PICK UP центра дал 3–6 (+1 Intel)`)
      for (const id of ids)
        check(
          `pickup:${id}`,
          `${b.before.find((u) => u.id === id)!.name}: успешно выполнил PICK UP`,
        )
    }
    if (['D2', 'E3', 'H2'].includes(code))
      count(
        `supplySixes:${side}`,
        `${label}: шестёрок на ${code === 'D2' ? 'первом PICK UP / DESTROY' : code === 'E3' ? 'SEARCH' : 'SHATTER'} (по +10 Supply)`,
        code === 'H2' ? 5 : code === 'E3' ? 6 : 4,
      )
    if (code === 'J2')
      count(`feeds:${side}`, `${label}: предметов доставлено через FEED (по +5 Supply)`, 4)
    if (code === 'I1')
      for (const id of ids)
        count(
          `nodeXP:${id}`,
          `${b.before.find((u) => u.id === id)!.name}: шестёрок при первом захвате Node (по +1 XP)`,
          4,
        )
    if (code === 'I3') {
      count(`scanSixes:${side}`, `${label}: шестёрок после SCAN (по +1 Intel)`, 3)
      check(
        `allScanned:${side}`,
        `${label}: просканированы все три Obelisk (+1 Fragment; Choir +1 за бой)`,
      )
    }
    if (b.table.objects.some((o) => o.id === 'index'))
      choose(
        'index',
        'кто выполнил EXTRACT INDEX (+1 XP, +1 Fragment, Casualty −1 при гибели)',
        ids.filter(
          (id) =>
            entry(
              s,
              b.before.find((u) => u.id === id)!,
              b.snapshot,
            ).character,
        ),
      )
    if (b.table.objects.some((o) => o.id === 'overlay') && b.number <= 14)
      choose('sync', 'кто выполнил SYNCHRONISE (+1 XP и +1 Intel)')
    if (b.type === 'WAR') {
      check(`override:${side}`, `${label}: успешно выполнен OVERRIDE ENGINE`)
      count(`seals:${side}`, `${label}: разных Conduits с собственным Seal record`, 3)
    }
    if (b.type === 'PACT') check(`prime:${side}`, `${label}: успешно выполнен PRIME ENGINE`)
  }
  if (b.table.objects.some((o) => o.id === 'overlay') && b.number >= 15)
    for (const side of SIDES)
      check(
        `anchor:${side}`,
        `${side === 'necrons' ? 'Necrons' : 'Deathwatch'}: свой LOCK ANCHOR и физический контроль в конце R5`,
      )
  for (const row of r.units.filter((u) => u.entered)) {
    const u = b.before.find((u) => u.id === row.id)!,
      p = b.muster[u.side]!.picks.find((p) => p.id === u.id)!
    if (
      u.flags.damagedArmoury &&
      u.armoury &&
      p.armoury &&
      !ARMOURY[u.armoury].consumable &&
      !armouryBlocked(s, u)
    )
      check(
        `damagedUsed:${u.id}`,
        `${u.name}: использовано повреждённое ${ARMOURY[u.armoury].name} (сайт бросит D6 сохранности предмета)`,
      )
  }
  return fields
}

export function validateTabletopFacts(s: State, b: Battle, r: Report) {
  const fields = missionInputs(s, b, r)
  for (const key of Object.keys(r.facts))
    if (/^(damagedUsed|nodeXP|pickup):/.test(key) && r.facts[key])
      assert(
        fields.some((f) => f.key === key),
        'Факт не относится к участвовавшему отряду',
      )
  for (const f of fields) {
    const v = r.facts[f.key]
    if (f.kind === 'count') integer(v ?? 0, 0, f.max!)
    else if (f.kind === 'check')
      assert(v === undefined || typeof v === 'boolean', `Подтвердите факт: ${f.label}`)
    else
      assert(
        v === undefined || v === '' || f.ids!.includes(String(v)),
        `Выберите участвовавший отряд: ${f.label}`,
      )
  }
  if (r.facts.extraEvacuation === true && /^[AK]2$/.test(b.mission ?? ''))
    assert(
      Number(r.facts[`hacks:${b.attacker}`]) === 2,
      'Дополнительный Asset требует два HACK атакующего',
    )
  const total = (key: string) =>
    SIDES.reduce((n, side) => n + Number(r.facts[`${key}:${side}`] ?? 0), 0)
  const code = b.mission
  if (code === 'B1') assert(total('centralIntel') <= 1, 'Первый PICK UP центра бывает один за бой')
  if (['D2', 'E3', 'H2'].includes(code ?? ''))
    assert(
      total('supplySixes') <= (code === 'H2' ? 5 : code === 'E3' ? 6 : 4),
      'Наград больше, чем объектов миссии',
    )
  if (code === 'J2') assert(total('feeds') <= 4, 'В миссии всего четыре предмета')
  if (code === 'I1')
    assert(
      r.units.reduce((n, u) => n + Number(r.facts[`nodeXP:${u.id}`] ?? 0), 0) <= 4,
      'Всего четыре первых захвата Node',
    )
  assert(total('anchor') <= 1, 'Anchor не может контролироваться обеими сторонами')
}

/** Replace derived rewards, never add to a previous submission. */
export function applyTabletopFacts(s: State, b: Battle, r: Report) {
  const t = b.table,
    code = (b.mission ?? b.type).replace(/^K/, 'A')
  for (const key of Object.keys(t.records))
    if (/^(intel:|supply10:|supply5:|xp:|index:|sync:|allScanned:|shatter6:|entered:)/.test(key))
      delete t.records[key]
  t.records.choirCommune = code === 'G1' && r.facts.commune === true
  t.records['fact:choirB2'] = code === 'B2' && r.facts.choirB2 === true
  t.records['fact:choirF2'] = code === 'F2' && r.facts.choirF2 === true
  const xp = (id: string, n: number) => {
    t.records[`xp:${id}`] = Number(t.records[`xp:${id}`] ?? 0) + n
  }
  for (const side of SIDES) {
    t.records[`intel:${side}`] =
      code === 'A2'
        ? Number(r.facts[`hacks:${side}`] ?? 0)
        : code === 'B1'
          ? Number(!!r.facts[`centralIntel:${side}`])
          : code === 'I3'
            ? Number(r.facts[`scanSixes:${side}`] ?? 0)
            : 0
    if (['D2', 'E3', 'H2'].includes(code))
      t.records[`supply10:${side}`] = Number(r.facts[`supplySixes:${side}`] ?? 0)
    if (code === 'H2') t.records[`shatter6:${side}`] = Number(r.facts[`supplySixes:${side}`] ?? 0)
    if (code === 'J2') t.records[`supply5:${side}`] = Number(r.facts[`feeds:${side}`] ?? 0)
    if (code === 'I3') t.records[`allScanned:${side}`] = r.facts[`allScanned:${side}`] === true
    for (const kind of ['index', 'sync']) {
      const f = missionInputs(s, b, r).find((f) => f.key === `${kind}:${side}`),
        id = String(r.facts[`${kind}:${side}`] ?? '')
      if (f && id) {
        t.records[`${kind}:${side}`] = id
        xp(id, 1)
        if (kind === 'sync')
          t.records[`intel:${side}`] = Number(t.records[`intel:${side}`] ?? 0) + 1
      }
    }
  }
  for (const row of r.units) {
    if (row.entered) t.records[`entered:${row.id}`] = 1
    if (code === 'I1' && row.entered) xp(row.id, Number(r.facts[`nodeXP:${row.id}`] ?? 0))
  }
  const anchor = t.objects.find((o) => o.id === 'overlay')
  if (anchor && b.number >= 15) {
    anchor.tag = SIDES.find((side) => r.facts[`anchor:${side}`] === true) ?? null
    r.facts.anchor_control = anchor.tag
  }
  t.vp = { ...r.vp }
  t.step = 'finished'
  t.round = r.withdrawal.length ? Number(r.facts.withdrawal_round) : 5
  delete t.records.withdrawalSide
  delete t.records.mutualWithdrawal
  if (r.withdrawal.length) t.records.withdrawalSide = r.withdrawal[0]
  if (r.withdrawal.length === 2) t.records.mutualWithdrawal = true
}
