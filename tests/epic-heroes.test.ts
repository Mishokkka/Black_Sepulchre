import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command } from '../shared/engine.ts'
import { campaignChoices } from '../shared/unit-choices.ts'
import { logisticsPreview } from '../shared/logistics-preview.ts'
import { epicHeroPurchaseReason } from '../shared/epic-heroes.ts'
import { SIDES, type Side } from '../shared/model.ts'
import { stageFor } from '../shared/rules.ts'

function logistics(side: Side, battles: number) {
  const s = fixture(true)
  s.battles = battles
  s.stage = stageFor(battles)
  s.phase = 'logistics'
  s.activation!.side = side
  s.activation!.logistics = [side]
  s.players[side].supply = 1000
  return s
}

test('Both factions have selectable Epic Heroes with the correct faction, unique and Epic flags', () => {
  const s = fixture(true)
  const expected = {
    deathwatch: ['Watch Captain Artemis'],
    necrons: [
      'Illuminor Szeras',
      'Imotekh The Stormlord',
      'Nekrosor Ammentar',
      'Orikan The Diviner',
      'The Silent King',
      'Trazyn The Infinite',
    ],
  }
  for (const side of SIDES) {
    const heroes = campaignChoices(s.snapshot.catalog, side).filter((c) => c.epic)
    for (const name of expected[side])
      assert(
        heroes.some((c) => c.datasheet === name),
        `${side}: ${name} missing`,
      )
    for (const hero of heroes) {
      assert.equal(hero.side, side)
      assert.equal(hero.unique, true)
      assert(hero.keywords.includes('EPIC HERO'))
      assert.equal(epicHeroPurchaseReason(4, hero), null)
    }
  }
})

test('Every Epic Hero is rejected at 0–3 completed battles and purchasable by its own side after the fourth', () => {
  const catalog = fixture(true).snapshot.catalog
  for (const side of SIDES)
    for (const hero of campaignChoices(catalog, side).filter((c) => c.epic)) {
      for (const battles of [0, 1, 2, 3, 4]) {
        const s = logistics(side, battles)
        const payload = {
          catalogId: hero.id,
          name: hero.datasheet,
          location: 'field',
          sector: s.players[side].mf,
          local: 0,
        }
        const before = structuredClone(s)
        const preview = logisticsPreview(s, side, 'buy_unit', payload)
        assert.equal(preview.allowed, battles >= 4, `${hero.datasheet}, battles=${battles}`)
        if (battles < 4) {
          assert.throws(
            () => command(s, { type: 'buy_unit', payload }, context(side)),
            /после четвёртого завершённого боя/,
          )
        } else {
          const next = command(s, { type: 'buy_unit', payload }, context(side))
          assert.equal(next.units.length, s.units.length + 1)
          assert.equal(next.units.at(-1)!.catalogId, hero.id)
          assert.equal(next.players[side].supply, s.players[side].supply - hero.rc)
        }
        assert.deepEqual(s, before, 'Preview/rejection must not spend Supply or change the roster')
      }
    }
})

test('An advanced Stage or many strategic activations cannot bypass the four completed battle gate', () => {
  for (const side of SIDES) {
    const s = logistics(side, 3)
    s.stage = 6
    s.activationCount = 100
    const hero = s.snapshot.catalog.find((c) => c.side === side && c.epic)!
    assert.throws(
      () =>
        command(
          s,
          {
            type: 'buy_unit',
            payload: { catalogId: hero.id, name: hero.datasheet, location: 'field' },
          },
          context(side),
        ),
      /сейчас завершено 3 из 4/,
    )
  }
})

test('The purchase gate also protects STF, while unlocked Heroes remain forbidden in garrisons', () => {
  for (const side of SIDES) {
    const s = logistics(side, 3)
    s.players[side].stf = s.players[side].mf
    s.activation!.force = 'stf'
    const hero = s.snapshot.catalog.find((c) => c.side === side && c.epic)!
    assert.throws(
      () =>
        command(
          s,
          {
            type: 'buy_unit',
            payload: { catalogId: hero.id, name: hero.datasheet, location: 'stf' },
          },
          context(side),
        ),
      /после четвёртого/,
    )
    const unlocked = logistics(side, 4)
    assert.throws(
      () =>
        command(
          unlocked,
          {
            type: 'buy_unit',
            payload: { catalogId: hero.id, name: hero.datasheet, location: 'garrison' },
          },
          context(side),
        ),
      /гарнизона/,
    )
  }
})

test('Ordinary units can still be purchased before the fourth battle', () => {
  for (const side of SIDES) {
    const s = logistics(side, 0)
    const ordinary = s.snapshot.catalog.find((c) => c.side === side && !c.epic && c.rc <= 100)!
    const next = command(
      s,
      {
        type: 'buy_unit',
        payload: { catalogId: ordinary.id, name: ordinary.datasheet, location: 'field' },
      },
      context(side),
    )
    assert.equal(next.units.length, s.units.length + 1)
    assert.equal(next.players[side].supply, s.players[side].supply - ordinary.rc)
  }
})
