import assert from 'node:assert/strict'
import test from 'node:test'
import { declareBattle } from '../shared/battle.ts'
import { createBattlefield } from '../shared/battlefield.ts'
import { createTable } from '../shared/table.ts'
import { battlefieldFilename } from '../src/lib/battlefield-export.ts'
import { missionObjectInfo, terrainInfo } from '../src/lib/battlefield-info.ts'
import { context, fixture } from './fixture.ts'

function setup(mission: string, stage = 0, version: 1 | 2 = 2) {
  const s = fixture()
  s.stage = stage
  declareBattle(s, 'F', 'deathwatch', false, context())
  s.battle!.mission = mission
  s.battle!.table = createTable(s, mission, context())
  return createBattlefield(s, s.battle!.table.objects, version)
}

test('terrain cards describe saved floors and goal areas without changing geometry', () => {
  for (const stage of [0, 1, 2]) {
    const plan = setup('H1', stage)
    const before = structuredClone(plan)
    const floor = plan.terrain.pieces.find((p) => p.platforms?.length)!
    const info = terrainInfo(floor)
    assert.match(info.title, /Руина с этажом/)
    assert.match(info.facts.find(([name]) => name === 'Площадка этажа')![1], /высота 3″/)
    assert.ok(info.rules?.some((rule) => /FLY\/MONSTER/.test(rule)))
    const area = plan.terrain.pieces.find((p) => p.objectiveId)!
    const object = plan.objects.find((o) => o.id === area.objectiveId)!
    const goal = missionObjectInfo(plan, [object], 1)
    assert.equal(goal.terrain, area)
    assert.match(goal.facts[1][1], /внутри её границы/)
    assert.doesNotMatch(goal.facts[1][1], /Ø40/)
    assert.deepEqual(plan, before)
  }
})

test('legacy ground-only pieces retain their own recipe in cards', () => {
  const legacy = setup('H1', 0, 1)
  for (const p of legacy.terrain.pieces) {
    const card = terrainInfo(p)
    assert.equal(card.terrain, p)
    assert.ok(!card.facts.some(([name]) => name === 'Площадка этажа'))
    assert.ok(!card.rules?.some((rule) => rule.includes('Plunging Fire')))
  }
})

test('coincident marker and interaction retain separate roles and marker diameter', () => {
  const plan = setup('F1')
  plan.objects = [
    { id: '1', kind: 'objective', x: 22, y: 15 },
    { id: 'overlay', kind: 'interaction', x: 22, y: 15 },
  ]
  const card = missionObjectInfo(plan, plan.objects, 1)
  assert.equal(card.title, 'Цель 1 / Echo Terminal')
  assert.match(card.facts[1][1], /Ø40 мм \(радиус 20 мм\)/)
  assert.match(card.facts[2][1], /Точка взаимодействия/)
  assert.equal(card.terrain, undefined)
  assert.match(card.summary, /собственные правила/)
})

test('only the moving mission object is described as moving', () => {
  for (const mission of ['B3', 'E1', 'C2']) {
    const plan = setup(mission)
    const moving = plan.objects.find((o) => o.id === '1')!
    assert.match(missionObjectInfo(plan, [moving], 1).summary, /движется/)
    const stationary = { id: 'overlay', kind: 'interaction' as const, x: 22, y: 15 }
    assert.doesNotMatch(missionObjectInfo(plan, [stationary], 1).summary, /движется/)
  }
})

test('F2 cards and export names use public starting data only', () => {
  const plan = setup('F2')
  for (const object of plan.objects) {
    const info = missionObjectInfo(plan, [object], 1)
    assert.match(info.summary, /не раскрывает скрытый выбор/)
    assert.doesNotMatch(JSON.stringify(info), /trueSignal|hiddenSignal/)
  }
  plan.terrain.code = '../../example:<invalid>code'
  const filename = battlefieldFilename(plan)
  assert.match(filename, /^Black-Sepulchre_F2_44x30_[a-z0-9_-]+\.png$/i)
  assert.doesNotMatch(filename, /[<>:/\\]/)
})
