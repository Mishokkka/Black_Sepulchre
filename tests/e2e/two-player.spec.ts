import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { declareBattle } from '../../shared/battle'
import { command } from '../../shared/engine'
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
    const [a, b] = pages
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
    // Concurrent UI clicks use two sessions and the same initial version. A conflict is a valid outcome.
    await Promise.all(
      pages.map((p) => p.getByRole('button', { name: 'Армия готова', exact: true }).click()),
    )
    await expect.poll(async () => (await load(0)).setupApproved.length).toBeGreaterThanOrEqual(1)
    for (const p of pages) {
      await refresh(p)
      const retry = p.getByRole('button', { name: 'Армия готова', exact: true })
      if (await retry.isVisible()) {
        await expect(retry).toBeEnabled()
        await retry.click()
      }
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
    // Lose the acknowledgement after a real successful commit, then reload and replay the UUID.
    const sentIds: string[] = []
    let dropped = false
    await a.route('**/functions/v1/campaign-engine', async (route) => {
      const body = route.request().postDataJSON()
      if (body?.command?.type !== 'recon_lock') return route.continue()
      sentIds.push(body.requestId)
      if (!dropped) {
        dropped = true
        const committed = await route.fetch()
        expect(committed.status()).toBe(200)
        return route.abort('failed')
      }
      return route.continue()
    })
    await a.getByRole('button', { name: 'Использовать Recon Lock', exact: true }).click()
    await expect(a.getByRole('button', { name: 'Проверить прежнюю отправку' })).toBeVisible()
    const committedVersion = (await load(0)).version
    await a.reload()
    await expect(a.getByRole('button', { name: 'Проверить прежнюю отправку' })).toBeVisible()
    const replayed = a.waitForResponse(
      (r) => r.request().postDataJSON()?.command?.type === 'recon_lock' && r.status() === 200,
    )
    await a.getByRole('button', { name: 'Проверить прежнюю отправку' }).click()
    expect((await (await replayed).json()).replayed).toBe(true)
    await expect(a.getByRole('button', { name: 'Проверить прежнюю отправку' })).toHaveCount(0)
    expect((await load(0)).version).toBe(committedVersion)
    expect(sentIds).toHaveLength(2)
    expect(sentIds[0]).toBe(sentIds[1])
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
    expect(errors).toEqual([])
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()))
    // The local stack is disposable. Keep campaign records for debugging; each run uses unique accounts.
    await Promise.all(accounts.map((a) => admin.auth.admin.deleteUser(a.id)))
  }
})
