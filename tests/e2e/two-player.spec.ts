import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { declareBattle } from '../../shared/battle'
import { createBattlefield } from '../../shared/battlefield'
import { command } from '../../shared/engine'
import { createTable } from '../../shared/table'
import { stageFor } from '../../shared/rules'
import type { Side, State } from '../../shared/model'

const url = process.env.E2E_SUPABASE_URL!,
  key = process.env.E2E_SUPABASE_ANON_KEY!
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
  throw Error('Local stack required')
const admin = createClient(url, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const refresh = (p: Page) =>
  p.getByRole('button', { name: 'Обновить состояние', exact: true }).first().click()
const stateResponse = (p: Page) =>
  p.waitForResponse(
    (r) =>
      r.url().endsWith('/functions/v1/campaign-engine') &&
      r.request().method() === 'POST' &&
      !r.request().postDataJSON()?.command &&
      r.status() === 200,
  )

test('Two real Auth accounts create/join, submit sealed choices, resolve a race and reload one shared version', async ({
  browser,
}) => {
  test.setTimeout(180000)
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const pages = await Promise.all(contexts.map((c) => c.newPage()))
  const accounts: {
    id: string
    email: string
    password: string
    api: SupabaseClient
  }[] = []
  const errors: string[] = []
  pages.forEach((p) => p.on('pageerror', (e) => errors.push(e.message)))
  try {
    for (let i = 0; i < 2; i++) {
      const email = `commander-${randomUUID()}@example.test`,
        password = `Campaign-${randomUUID()}!`
      const user = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (user.error || !user.data.user) throw user.error ?? Error('No user')
      const api = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const login = await api.auth.signInWithPassword({ email, password })
      if (login.error) throw login.error
      accounts.push({ id: user.data.user.id, email, password, api })
      await pages[i].goto('/Black_Sepulchre/')
      await pages[i].getByLabel('Электронная почта', { exact: true }).fill(email)
      await pages[i].getByLabel('Пароль', { exact: true }).fill(password)
      await pages[i].getByRole('button', { name: 'Войти', exact: true }).click()
      await expect(pages[i].getByRole('heading', { name: 'Ваша кампания' })).toBeVisible()
    }
    let [a, b] = pages
    await a.getByRole('radio', { name: 'Necrons', exact: true }).check()
    await a.getByLabel('Название кампании', { exact: true }).fill('Two-player E2E')
    await a.getByRole('button', { name: 'Создать кампанию', exact: true }).click()
    await expect(a.getByRole('heading', { name: 'Подготовьте стартовую армию' })).toBeVisible()
    const inviteButton = a.getByRole('button', { name: /^Код: / })
    await expect(inviteButton).toHaveText(/^Код: [A-Z0-9]{10}$/)
    const invite = (await inviteButton.innerText()).replace('Код: ', '').trim()
    await b.getByRole('button', { name: 'По приглашению', exact: true }).click()
    await b.getByLabel('Код приглашения', { exact: true }).fill(invite.toLowerCase())
    await b.getByRole('button', { name: 'Присоединиться', exact: true }).click()
    await expect(b.getByRole('heading', { name: 'Подготовьте стартовую армию' })).toBeVisible()
    await refresh(a)
    await expect(a.getByLabel('Связь и синхронизация')).toContainText('Второй игрок присоединился')
    await expect(b.getByLabel('Готовность кампании')).toContainText('✓ Стартовый состав подходит')
    const { data: memberships, error } = await accounts[0].api
      .from('campaign_members')
      .select('campaign_id,side')
    if (error) throw error
    const id = memberships![0].campaign_id
    const load = async (i: number) => {
      const r = await accounts[i].api.functions.invoke('campaign-engine', {
        body: { campaignId: id },
      })
      if (r.error) throw r.error
      return r.data.state as State
    }
    // Choose an optional starter enhancement through the real UI and versioned Edge command.
    const initial = await load(0)
    const veil = initial.snapshot.enhancements.find((e) => e.name === 'Veil of Darkness')!
    const bearer = initial.units.find(
      (u) =>
        u.side === 'necrons' &&
        initial.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
    )!
    await a.getByLabel(`Улучшение: ${bearer.name}`, { exact: true }).selectOption(veil.id)
    await expect
      .poll(async () => (await load(0)).players.necrons.startingEnhancements?.[bearer.id])
      .toBe(veil.id)
    await expect(a.getByLabel('Бюджет стартовой армии')).toContainText('495')
    expect((await load(0)).players.necrons.enhancements).toEqual({})
    await a.reload()
    await expect(a.getByLabel(`Улучшение: ${bearer.name}`, { exact: true })).toHaveValue(veil.id)
    const hand = initial.snapshot.detachments.find((d) => d.name === 'Hand of the Dynasty')!
    await a.getByLabel('Стартовый detachment', { exact: true }).selectOption(hand.id)
    await expect(a.locator('.package-impact')).toContainText('refund 20 очков Effective')
    await expect(a.getByLabel('Бюджет стартовой армии')).toContainText('495')
    expect((await load(0)).players.necrons.package).toEqual([veil.detachment])
    await a.getByRole('button', { name: 'Применить detachment', exact: true }).click()
    await expect.poll(async () => (await load(0)).players.necrons.package).toEqual([hand.id])
    expect((await load(0)).players.necrons.startingEnhancements).toEqual({})
    expect((await load(0)).players.necrons.supply).toBe(initial.players.necrons.supply)
    await expect(a.getByLabel('Бюджет стартовой армии')).toContainText('475')
    await a.getByLabel('Стартовый detachment', { exact: true }).selectOption(veil.detachment)
    await a.getByRole('button', { name: 'Применить detachment', exact: true }).click()
    await expect
      .poll(async () => (await load(0)).players.necrons.package)
      .toEqual([veil.detachment])
    await expect(a.getByLabel(`Улучшение: ${bearer.name}`, { exact: true })).toHaveValue('')
    await a.getByLabel(`Улучшение: ${bearer.name}`, { exact: true }).selectOption(veil.id)
    await expect
      .poll(async () => (await load(0)).players.necrons.startingEnhancements?.[bearer.id])
      .toBe(veil.id)
    await refresh(b)
    const readyVersion = (await load(0)).version
    for (const p of pages)
      await expect(p.getByLabel('Связь и синхронизация')).toContainText(
        `Версия состояния: ${readyVersion}`,
      )
    // Concurrent UI clicks use two sessions and the same initial version. A conflict is a valid outcome.
    const readyResponses = pages.map((p) =>
      p.waitForResponse(
        (r) =>
          r.url().endsWith('/functions/v1/campaign-engine') &&
          r.request().method() === 'POST' &&
          r.request().postDataJSON()?.command?.type === 'ready_army',
      ),
    )
    await Promise.all(
      pages.map((p) => p.getByRole('button', { name: 'Армия готова', exact: true }).click()),
    )
    for (const response of await Promise.all(readyResponses))
      expect([200, 409]).toContain(response.status())
    await expect.poll(async () => (await load(0)).setupApproved.length).toBeGreaterThanOrEqual(1)
    for (const [i, p] of pages.entries()) {
      const side: Side = i === 0 ? 'necrons' : 'deathwatch'
      const current = await load(i)
      if (current.setupApproved.includes(side)) continue
      await refresh(p)
      // A refresh click does not await its response or React's state update. Retrying earlier
      // can send the losing session's previous version and cause a second legitimate conflict.
      await expect(p.getByLabel('Связь и синхронизация')).toContainText(
        `Версия состояния: ${current.version}`,
      )
      const retry = p.getByRole('button', { name: 'Армия готова', exact: true })
      await expect(retry).toBeEnabled()
      await retry.click()
      await expect.poll(async () => (await load(i)).setupApproved).toContain(side)
    }
    await expect.poll(async () => (await load(0)).phase).toBe('strategy')

    // A single privileged fixture transition places this isolated campaign at Recon Lock.
    // Subsequent decisions go through the real UI -> Auth -> Edge -> Postgres commit path.
    const current = await load(0),
      seeded = structuredClone(current)
    seeded.players.deathwatch.mf = 'D'
    seeded.players.necrons.mf = 'F'
    seeded.active = 'deathwatch'
    const ctx = (actor: Side) => ({ actor, dice: (n: number) => Math.min(n, 4), id: randomUUID })
    declareBattle(seeded, 'F', 'deathwatch', false, ctx('deathwatch'))
    let ready = command(
      seeded,
      { type: 'choose_mission', payload: { code: seeded.battle!.options[0] } },
      ctx(seeded.battle!.missionChooser),
    )
    for (const actor of ['deathwatch', 'necrons'] as Side[])
      ready = command(ready, { type: 'mission_pass', payload: {} }, ctx(actor))
    ready.version = current.version + 1
    const seed = await admin.rpc('v221_commit', {
      p_campaign: id,
      p_actor: accounts[0].id,
      p_expected: current.version,
      p_request: randomUUID(),
      p_fingerprint: 'test-fixture-only',
      p_command: 'e2e_fixture',
      p_state: ready,
    })
    if (seed.error) throw seed.error
    for (const p of pages) {
      await refresh(p)
      await p.getByRole('button', { name: 'Текущий бой', exact: true }).click()
      await expect(p.getByRole('heading', { name: 'Recon Lock' })).toBeVisible()
    }
    // Lose both the acknowledgement and automatic retry; reload replays the same UUID.
    const sentIds: string[] = []
    let dropped = 0
    await contexts[0].route('**/functions/v1/campaign-engine', async (route) => {
      const body = route.request().postDataJSON()
      if (body?.command?.type !== 'recon_lock') return route.continue()
      sentIds.push(body.requestId)
      if (dropped++ < 2) {
        const committed = await route.fetch()
        expect(committed.status()).toBe(200)
        return route.abort('failed')
      }
      return route.continue()
    })
    await a.getByRole('button', { name: 'Использовать Recon Lock', exact: true }).click()
    await expect.poll(() => sentIds.length).toBe(2)
    await expect(a.getByRole('button', { name: 'Восстановить доступ к действиям' })).toBeEnabled()
    const committedVersion = (await load(0)).version
    await a.close()
    a = await contexts[0].newPage()
    pages[0] = a
    a.on('pageerror', (e) => errors.push(e.message))
    const replayed = a.waitForResponse(
      (r) => r.request().postDataJSON()?.command?.type === 'recon_lock' && r.status() === 200,
    )
    await a.goto('/Black_Sepulchre/')
    expect((await (await replayed).json()).replayed).toBe(true)
    await expect(a.getByRole('button', { name: 'Проверить прежнюю отправку' })).toHaveCount(0)
    expect((await load(0)).version).toBe(committedVersion)
    expect(sentIds).toHaveLength(3)
    expect(new Set(sentIds).size).toBe(1)
    const hiddenResponse = stateResponse(b)
    await refresh(b)
    const hidden = (await (await hiddenResponse).json()).state
    expect(hidden.battle.lock).not.toHaveProperty('necrons')
    expect(hidden.phase).toBe('lock')
    await b.getByRole('button', { name: 'Без Lock', exact: true }).click()
    await expect.poll(async () => (await load(0)).phase).toBe('muster')
    for (const i of [0, 1]) {
      const state = await load(i)
      expect(state.battle!.lock).toEqual({ necrons: true, deathwatch: false })
    }
    const version = (await load(0)).version
    for (const p of pages) {
      const response = stateResponse(p)
      await p.reload()
      const state = (await (await response).json()).state
      expect(state.version).toBe(version)
      expect(state.phase).toBe('muster')
      await expect(p.getByLabel('Связь и синхронизация')).toContainText('Состояние проверено')
    }
    await contexts[0].setOffline(true)
    await expect(a.getByLabel('Связь и синхронизация')).toContainText('Оффлайн')
    await contexts[0].setOffline(false)
    await expect(a.getByLabel('Связь и синхронизация')).toContainText('Состояние проверено')

    // Select two mission types through the real Edge endpoint, then compare the
    // persisted public setup across both sessions and a full browser reload.
    for (const mission of ['I2', 'F2']) {
      const current = await load(0),
        selection = structuredClone(current)
      selection.phase = 'mission'
      selection.battle!.mission = null
      selection.battle!.options = [mission]
      selection.battle!.missionPass = []
      delete selection.battle!.battlefield
      selection.version = current.version + 1
      const seeded = await admin.rpc('v221_commit', {
        p_campaign: id,
        p_actor: accounts[0].id,
        p_expected: current.version,
        p_request: randomUUID(),
        p_fingerprint: `terrain-fixture-${mission}`,
        p_command: 'e2e_terrain_fixture',
        p_state: selection,
      })
      if (seeded.error) throw seeded.error
      const request = {
        campaignId: id,
        requestId: randomUUID(),
        expectedVersion: selection.version,
        command: { type: 'choose_mission', payload: { code: mission } },
      }
      const selected = await accounts[1].api.functions.invoke('campaign-engine', { body: request })
      if (selected.error) throw selected.error
      const views = await Promise.all([load(0), load(1)])
      const setup = views[0].battle!.battlefield!
      expect(setup.mission).toBe(mission)
      expect(setup.version).toBe(2)
      expect(views[1].battle!.battlefield).toEqual(setup)
      const stored = await admin.rpc('v221_load', { p_campaign: id, p_actor: accounts[0].id })
      if (stored.error) throw stored.error
      expect(stored.data.state.battle.battlefield).toEqual(setup)
      expect(setup.objects.every((o) => Object.keys(o).sort().join(',') === 'id,kind,x,y')).toBe(
        true,
      )
      expect(JSON.stringify(setup)).not.toContain('trueSignal')
      if (mission === 'F2')
        for (const view of views) {
          expect(view.battle!.hiddenSignal).toBe('')
          expect(view.battle!.table.records).not.toHaveProperty('trueSignal')
        }
      const replay = await accounts[1].api.functions.invoke('campaign-engine', { body: request })
      if (replay.error) throw replay.error
      expect(replay.data.replayed).toBe(true)
      expect(replay.data.state.version).toBe(views[0].version)
      expect(replay.data.state.battle.battlefield).toEqual(setup)
      for (const p of pages) {
        await refresh(p)
        await expect(p.getByLabel('Связь и синхронизация')).toContainText(
          `Версия состояния: ${views[0].version}`,
        )
        await p.getByRole('button', { name: 'Текущий бой', exact: true }).click()
        const plan = p.locator('.battlefield-plan')
        await expect(plan.locator('h3')).toContainText(setup.terrain.code)
        if (!(await plan.locator('.terrain-details').evaluate((e) => e.hasAttribute('open'))))
          await plan.getByText('Размеры и координаты для расстановки').click()
        const dense = setup.terrain.pieces.find((piece) => piece.platforms?.length)!
        expect(dense.profile).toEqual({
          wallHeight: 4,
          maxWallThickness: 0.45,
          elevatedFloors: 1,
        })
        const recipe = plan
          .getByLabel(`Описание террейна ${dense.id}`, { exact: true })
          .locator('..')
        if (!(await recipe.evaluate((e) => e.hasAttribute('open'))))
          await recipe.locator('summary').click()
        await expect(recipe).toHaveAttribute('open', '')
        await expect(recipe).toContainText('Высота физических стен — 4″')
        await expect(recipe.locator('li')).toHaveCount(dense.walls!.length)
        await expect(recipe).toContainText('Этаж +3″')
        await expect(plan.locator('.terrain-platform')).toHaveCount(2)
        const terrainTarget = plan.getByRole('button', {
          name: `Открыть: ${dense.id} · Руина с этажом`,
          exact: true,
        })
        await terrainTarget.focus()
        await terrainTarget.press('Enter')
        const card = p.getByRole('dialog', { name: `${dense.id} · Руина с этажом` })
        await expect(card).toBeVisible()
        await expect(card).toContainText('высота 3″')
        await expect(card.getByLabel('Свойства террейна')).toContainText('Obscuring')
        await p.keyboard.press('Escape')
        await expect(card).toHaveCount(0)
        await expect(terrainTarget).toBeFocused()
        if (mission === 'I2') {
          await expect(plan.locator('td').filter({ hasText: /^Objective: область / })).toHaveCount(
            3,
          )
          await expect(plan.locator('table').first()).toContainText('4.33')
          if (p === pages[0]) {
            const pending = p.waitForEvent('download')
            await plan.getByRole('button', { name: 'Скачать карту PNG', exact: true }).click()
            const download = await pending
            expect(download.suggestedFilename()).toBe(
              `Black-Sepulchre_I2_44x30_${setup.terrain.code}.png`,
            )
            const png = await readFile((await download.path())!)
            expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            expect(png.readUInt32BE(16)).toBeGreaterThan(1000)
            expect(png.readUInt32BE(20)).toBeGreaterThan(1000)
            expect(png.length).toBeGreaterThan(15000)
          }
        }
      }
      await a.reload()
      await expect(a.getByLabel('Связь и синхронизация')).toContainText(
        `Версия состояния: ${views[0].version}`,
      )
      await a.getByRole('button', { name: 'Текущий бой', exact: true }).click()
      await expect(a.locator('.battlefield-plan h3')).toContainText(setup.terrain.code)
    }

    // Seed only this disposable campaign's tabletop. All events and agreement use real clients.
    const beforeTable = await load(0),
      live = structuredClone(beforeTable),
      battle = live.battle!
    battle.mission = 'F1'
    battle.table = createTable(live, 'F1', ctx('deathwatch'))
    battle.battlefield = createBattlefield(live, battle.table.objects)
    for (const side of ['deathwatch', 'necrons'] as Side[]) {
      const units = live.units.filter((u) => u.side === side)
      battle.muster[side] = {
        picks: units.map((u) => ({
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
          protocol: null,
        })),
        rest: [],
        detachments: live.players[side].package,
        commander: units[0].id,
        dispositions: [],
      }
      battle.assets[side] = { tactical: [], defensive: [], breach: [] }
    }
    live.phase = 'battle'
    live.version = beforeTable.version + 1
    const tableSeed = await admin.rpc('v221_commit', {
      p_campaign: id,
      p_actor: accounts[0].id,
      p_expected: beforeTable.version,
      p_request: randomUUID(),
      p_fingerprint: 'test-table-fixture-only',
      p_command: 'e2e_table_fixture',
      p_state: live,
    })
    if (tableSeed.error) throw tableSeed.error
    await refresh(b)
    await b.getByRole('button', { name: 'Текущий бой', exact: true }).click()
    await expect(b.getByRole('button', { name: 'Завершить шаг', exact: true })).toHaveCount(0)
    await expect(b.getByLabel('Начальная расстановка и координаты объектов миссии')).toBeVisible()
    await refresh(a)
    await a.getByRole('button', { name: 'Текущий бой', exact: true }).click()
    await expect(a.getByLabel('Начальная расстановка и координаты объектов миссии')).toBeVisible()
    const aPlan = a.locator('.battlefield-plan'),
      bPlan = b.locator('.battlefield-plan')
    await expect(aPlan.locator('h3')).toHaveText(await bPlan.locator('h3').innerText())
    await aPlan.getByText('Размеры и координаты для расстановки').click()
    await bPlan.getByText('Размеры и координаты для расстановки').click()
    const aTerrain = aPlan.locator('table').first().locator('tbody tr')
    const bTerrain = bPlan.locator('table').first().locator('tbody tr')
    expect(await aTerrain.count()).toBeGreaterThanOrEqual(6)
    expect(await aTerrain.allTextContents()).toEqual(await bTerrain.allTextContents())
    await b.getByText('Внести результат боя', { exact: true }).click()
    await b.getByLabel('VP Deathwatch', { exact: true }).fill('20')
    await b.getByLabel('VP Necrons', { exact: true }).fill('20')
    await b.getByRole('button', { name: 'Отправить результат на подтверждение обоими' }).click()
    await expect.poll(async () => (await load(0)).phase).toBe('result')
    const reported = await load(0)
    expect(reported.battle!.report!.tabletop).toBe(true)
    expect(reported.battle!.report!.vp).toEqual({ deathwatch: 20, necrons: 20 })
    expect(reported.battle!.table.actions).toHaveLength(0)
    expect(reported.battle!.confirm).toEqual(['deathwatch'])
    await refresh(a)
    await a.getByRole('button', { name: 'Текущий бой', exact: true }).click()
    await a.getByRole('button', { name: 'Проверить и подтвердить', exact: true }).click()
    await a.getByRole('button', { name: 'Подтвердить результат и потери', exact: true }).click()
    await expect.poll(async () => (await load(0)).phase).toBe('aftermath')
    await expect(
      a.getByRole('heading', { name: 'После боя: потери, добыча и награды' }),
    ).toBeVisible()

    // Seed 3 completed battles in this disposable campaign; purchases use the real Edge guard.
    const priorLogistics = await load(0),
      lockedHeroes = structuredClone(priorLogistics)
    lockedHeroes.battle = null
    lockedHeroes.phase = 'logistics'
    lockedHeroes.battles = 3
    lockedHeroes.stage = stageFor(3)
    lockedHeroes.activation!.logistics = ['deathwatch', 'necrons']
    for (const side of ['deathwatch', 'necrons'] as Side[]) lockedHeroes.players[side].supply = 1000
    const seedLogistics = async (state: State, previous: State) => {
      state.version = previous.version + 1
      const seeded = await admin.rpc('v221_commit', {
        p_campaign: id,
        p_actor: accounts[0].id,
        p_expected: previous.version,
        p_request: randomUUID(),
        p_fingerprint: 'test-epic-fixture-only',
        p_command: 'e2e_epic_fixture',
        p_state: state,
      })
      if (seeded.error) throw seeded.error
    }
    await seedLogistics(lockedHeroes, priorLogistics)
    for (const i of [0, 1]) {
      const side: Side = i === 0 ? 'necrons' : 'deathwatch'
      const hero = lockedHeroes.snapshot.catalog.find((c) => c.side === side && c.epic)!
      const p = pages[i]
      await refresh(p)
      await p.getByRole('button', { name: 'Logistics', exact: true }).click()
      await p.getByText('Приобрести новый отряд', { exact: true }).click()
      await p.getByLabel('Показать только Epic Heroes', { exact: true }).check()
      await expect(p.getByLabel('Доступ Epic Heroes', { exact: true })).toContainText('3/4')
      const option = p
        .getByLabel('Купить отряд', { exact: true })
        .locator('option')
        .filter({ hasText: hero.datasheet })
      // Native <option> uses its disabled property; Playwright's ARIA matcher treats it as enabled.
      await expect(option).toHaveJSProperty('disabled', true)
      const failed = await accounts[i].api.functions.invoke('campaign-engine', {
        body: {
          campaignId: id,
          requestId: randomUUID(),
          expectedVersion: lockedHeroes.version,
          command: {
            type: 'buy_unit',
            payload: {
              catalogId: hero.id,
              name: hero.datasheet,
              location: 'field',
              sector: lockedHeroes.players[side].mf,
            },
          },
        },
      })
      expect(failed.error).toBeTruthy()
      const message = await failed.error!.context.json()
      expect(message.error).toContain('после четвёртого завершённого боя')
      expect((await load(i)).version).toBe(lockedHeroes.version)
      expect((await load(i)).players[side].supply).toBe(1000)
    }
    const unlockedHeroes = structuredClone(lockedHeroes)
    unlockedHeroes.battles = 4
    unlockedHeroes.stage = stageFor(4)
    await seedLogistics(unlockedHeroes, lockedHeroes)
    for (const i of [0, 1]) {
      const side: Side = i === 0 ? 'necrons' : 'deathwatch',
        p = pages[i]
      const hero = unlockedHeroes.snapshot.catalog.find((c) => c.side === side && c.epic)!
      await refresh(p)
      await expect(p.getByLabel('Доступ Epic Heroes', { exact: true })).toContainText(
        'открыты для покупки',
      )
      await p
        .getByLabel('Купить отряд', { exact: true })
        .selectOption({ label: `${hero.datasheet} · Epic Hero` })
      await expect(p.getByRole('button', { name: 'Купить отряд', exact: true })).toBeEnabled()
      await p.getByRole('button', { name: 'Купить отряд', exact: true }).click()
      await expect
        .poll(async () => (await load(i)).units.filter((u) => u.catalogId === hero.id).length)
        .toBe(1)
      expect((await load(i)).players[side].supply).toBe(1000 - hero.rc)
    }
    expect(errors).toEqual([])
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()))
    // The local stack is disposable. Keep campaign records for debugging; each run uses unique accounts.
    await Promise.all(accounts.map((a) => admin.auth.admin.deleteUser(a.id)))
  }
})
