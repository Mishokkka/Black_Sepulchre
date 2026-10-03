import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { command, project } from '../../../shared/engine.ts'
import { importLegacy } from '../../../shared/state.ts'
import type { Command, Context, State } from '../../../shared/model.ts'
import { parseNewRecruit, MAX_IMPORT_BYTES } from '../../../shared/datasheets.ts'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })
const die = (sides: number) => {
  const limit = Math.floor(0x100000000 / sides) * sides
  let n: number
  do {
    n = crypto.getRandomValues(new Uint32Array(1))[0]
  } while (n >= limit)
  return (n % sides) + 1
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405)
  try {
    const header = req.headers.get('Authorization') ?? ''
    if (!header.startsWith('Bearer ')) return json({ error: 'Войдите в аккаунт' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!,
      anon = Deno.env.get('SUPABASE_ANON_KEY')!,
      service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const auth = createClient(url, anon, { auth: { persistSession: false } }),
      { data, error } = await auth.auth.getUser(header.slice(7))
    if (error || !data.user) return json({ error: 'Сессия истекла' }, 401)
    const bytes = await req.text()
    if (new TextEncoder().encode(bytes).length > 2500000)
      return json({ error: 'Слишком большой запрос' }, 413)
    const body = JSON.parse(bytes),
      id = body.campaignId
    if (typeof id !== 'string' || !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(id))
      return json({ error: 'Неверный campaignId' }, 400)
    const db = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      actor = data.user.id
    const requestId = body.requestId ?? null
    if (
      requestId !== null &&
      (typeof requestId !== 'string' || !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(requestId))
    )
      return json({ error: 'Неверный requestId' }, 400)
    const loaded = await db.rpc('v221_load', {
      p_campaign: id,
      p_actor: actor,
      p_request: requestId,
    })
    if (loaded.error) return json({ error: 'Кампания недоступна' }, 403)
    if (body.action === 'imports') {
      const listed = await db.rpc('v221_list_imports', { p_campaign: id, p_actor: actor })
      if (listed.error) throw listed.error
      return json({ imports: listed.data, side: loaded.data.side })
    }
    if (body.action === 'import_source') {
      if (
        typeof body.text !== 'string' ||
        new TextEncoder().encode(body.text).length > MAX_IMPORT_BYTES
      )
        return json({ error: 'Нужен JSON не более 2 МБ' }, 400)
      const parsed = parseNewRecruit(
        body.text,
        typeof body.filename === 'string' ? body.filename : 'NewRecruit.json',
      )
      if (parsed.side !== loaded.data.side)
        return json({ error: 'Загрузите файл своей фракции' }, 403)
      parsed.source.hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.text))),
      )
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
      const saved = await db.rpc('v221_save_import', {
        p_campaign: id,
        p_actor: actor,
        p_hash: parsed.source.hash,
        p_data: parsed,
      })
      if (saved.error) throw saved.error
      return json({ import: saved.data.data, reused: saved.data.reused, side: loaded.data.side })
    }
    if (body.action) return json({ error: 'Неизвестное действие' }, 400)
    const ctx: Context = { actor: loaded.data.side, dice: die, id: () => crypto.randomUUID() }
    let state = loaded.data.state as State
    if (!state) {
      state = importLegacy(loaded.data.baseline, ctx)
      const init = await db.rpc('v221_initialize', {
        p_campaign: id,
        p_actor: actor,
        p_state: state,
      })
      if (init.error) throw init.error
      state = init.data
    }
    if (body.command) {
      if (!requestId || !Number.isSafeInteger(body.expectedVersion))
        return json({ error: 'Нужны requestId и expectedVersion' }, 400)
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(JSON.stringify(body.command)),
          ),
        ),
      )
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
      const receipt = loaded.data.receipt
      if (receipt) {
        if (receipt.actor !== actor || receipt.fingerprint !== fingerprint)
          return json({ error: 'requestId уже использован' }, 409)
        return json({
          state: project(state, ctx.actor),
          side: ctx.actor,
          replayed: true,
          commandVersion: receipt.version,
        })
      }
      if (state.version !== body.expectedVersion)
        return json(
          {
            error: 'Состояние изменилось. Обновите страницу.',
            code: 'STATE_CONFLICT',
            state: project(state, ctx.actor),
          },
          409,
        )
      const next = command(state, body.command as Command, ctx),
        saved = await db.rpc('v221_commit', {
          p_campaign: id,
          p_actor: actor,
          p_expected: state.version,
          p_request: requestId,
          p_fingerprint: fingerprint,
          p_command: body.command.type,
          p_state: next,
        })
      if (saved.error) {
        if (saved.error.code === '40001')
          return json(
            {
              error: 'Другой игрок уже изменил состояние. Повторите решение после обновления.',
              code: 'STATE_CONFLICT',
            },
            409,
          )
        throw saved.error
      }
      if (saved.data.replayed) {
        const latest = await db.rpc('v221_load', { p_campaign: id, p_actor: actor })
        state = latest.data.state
      } else state = next
    }
    return json({ state: project(state, ctx.actor), side: ctx.actor })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : ((error as { message?: string })?.message ?? 'Ошибка команды')
    return json({ error: message }, 400)
  }
})
