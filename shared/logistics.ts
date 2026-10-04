import { HONOURS } from './rules.generated.ts'
import { SIDES, type Command, type Context, type State } from './model.ts'
import {
  ARMOURY,
  assert,
  bonus,
  down5,
  entry,
  garrisonLegal,
  home,
  integer,
  key,
  present,
  RELICS,
  SECTORS,
  spend,
  STAGES,
  str,
  supplied,
  unit,
  up5,
  credit,
} from './rules.ts'
import { newUnit } from './state.ts'
import { setPackage } from './strategy.ts'
import { sameDatasheet } from './datasheets.ts'
export function inLogistics(s: State, side: Context['actor']) {
  assert(
    s.phase === 'logistics' &&
      (s.activation?.logistics.includes(side) || s.battle?.logistics.includes(side)),
    'Сейчас не ваша Logistics',
  )
}
export function logisticsForce(s: State, side: Context['actor']) {
  return (s.activation?.side === side ? s.activation.force : s.battle?.forces?.[side]) ?? 'mf'
}
export function logistics(s: State, c: Command, ctx: Context) {
  const side = ctx.actor,
    p = s.players[side],
    from = logisticsForce(s, side) === 'stf' ? p.stf! : p.mf,
    act = s.activation,
    al = STAGES[s.stage].al
  inLogistics(s, side)
  const local = (u: ReturnType<typeof unit>, needSupply = true) => {
    const mainOnly = [
        'commission_buyout',
        'buy_armoury',
        'assign_armoury',
        'discard_armoury',
        'assign_relic',
        'transfer_relic',
        'transfer_enhancement',
      ].includes(c.type),
      at = from
    assert(
      u.location === 'garrison'
        ? at === p.mf
        : u.location === (logisticsForce(s, side) === 'stf' ? 'stf' : 'field'),
      'Обслуживание только выбранной Force; гарнизон требует Main Force',
    )
    assert(
      present(s, u) === at && s.sectors[at].owner === side,
      'ID должен быть при своей Force в своём секторе',
    )
    if (mainOnly)
      assert(
        logisticsForce(s, side) === 'mf',
        'Armoury / Relics только Main Force или местному гарнизону',
      )
    if (needSupply) assert(supplied(s, side, at), 'Требуется Supplied')
  }
  switch (c.type) {
    case 'package':
      assert(
        p.packageStage !== s.stage ||
          JSON.stringify(c.payload.package) === JSON.stringify(p.package),
        'Вне новой Stage смена требует Doctrine Refit',
      )
      setPackage(s, side, c.payload.package)
      return
    case 'buy_unit': {
      const at = key(c.payload.sector ?? from),
        location = String(c.payload.location ?? 'field')
      assert(['field', 'garrison', 'stf'].includes(location), 'Неверное назначение')
      assert(
        s.sectors[at].owner === side && supplied(s, side, at),
        'Покупки только в своём Supplied',
      )
      const u = newUnit(s, side, str(c.payload.catalogId, 250), str(c.payload.name), ctx),
        cat = entry(s, u),
        amount = integer(c.payload.local ?? 0)
      u.location = location as typeof u.location
      u.sector = location === 'garrison' ? at : null
      assert(!SECTORS[at].home || amount === 0, 'В Home нет Local')
      assert(amount <= s.sectors[at].local, 'Недостаточно Local Supply')
      assert(amount === 0 || location === 'garrison', 'Local только для защитников')
      assert(
        location !== 'garrison' || !(act?.side === side && act.forcedMarch),
        'Forced March запрещает гарнизонные покупки',
      )
      let cost = u.rc
      if (location === 'garrison') {
        assert(garrisonLegal(s, u, at, true), 'Юнит не legal для гарнизона/цены')
        if (
          at === 'J' &&
          bonus(s, 'J', side) &&
          p.flags.foundryActivation !== s.activationCount &&
          (cat.keywords.includes('VEHICLE') ||
            (side === 'necrons' && cat.keywords.some((k) => ['MONSTER', 'CANOPTEK'].includes(k))))
        ) {
          cost -= Math.min(25, down5(cost * 0.1))
          p.flags.foundryActivation = s.activationCount
        }
      }
      if (at !== from || (location === 'garrison' && at !== p.mf)) {
        assert(
          location === 'garrison' &&
            !p.flags.remoteWindow &&
            bonus(s, at, side) &&
            cat.garrison === 'core' &&
            !cat.epic &&
            !cat.character &&
            !cat.keywords.some((k) => ['VEHICLE', 'MONSTER', 'TRANSPORT'].includes(k)) &&
            u.rc <= al * 0.25 &&
            amount === cost,
          'Удалённо один Core, полностью Local',
        )
        p.flags.remoteWindow = true
      } else {
        assert(
          location !== 'field' ||
            (from === p.mf &&
              (act?.side === side ? act.force : s.battle?.forces?.[side]) !== 'stf'),
          'Покупки при выбранной Force',
        )
        if (location === 'field')
          assert(
            s.units
              .filter(
                (v) =>
                  v.side === side &&
                  v.location === 'field' &&
                  !['lost', 'archived', 'sealed'].includes(v.status),
              )
              .reduce((n, v) => n + v.rc, 0) +
              u.rc <=
              al * 1.5,
            'Field cap превышен',
          )
        if (location === 'stf')
          assert(
            p.stf === from &&
              (act?.side === side ? act.force : s.battle?.forces?.[side]) === 'stf' &&
              s.units
                .filter((v) => v.side === side && v.location === 'stf' && v.status === 'active')
                .reduce((n, v) => n + v.rc, 0) +
                u.rc <=
                al * 0.75,
            'STF cap / location',
          )
      }
      assert(amount <= cost, 'Local больше стоимости')
      if (s.sectors[at].disrupted) {
        const used = Number(p.flags[`disruptedBuy:${at}:${s.activationCount}`] ?? 0)
        assert(used + u.rc <= al * 0.25, 'Disrupted: общие новые покупки ≤25% AL')
        p.flags[`disruptedBuy:${at}:${s.activationCount}`] = used + u.rc
      }
      spend(s, side, cost - amount)
      s.sectors[at].local -= amount
      u.flags.commission = amount > 0
      s.units.push(u)
      return
    }
    case 'commission_buyout': {
      const u = unit(s, c.payload.id, side)
      local(u)
      assert(u.flags.commission, 'Нет Commission')
      spend(s, side, u.rc)
      u.flags.commission = false
      return
    }
    case 'recover': {
      const u = unit(s, c.payload.id, side)
      local(u, false)
      assert(u.damage > 0 && (!u.trauma || u.damage > 2), 'Damage нельзя снизить')
      assert(u.flags.systemicBattle !== s.battles, 'Systemic Failure в текущем aftermath')
      const isSupplied = supplied(s, side, from),
        over = c.payload.overhaul === true
      if (!isSupplied) {
        assert(
          u.location === 'field' && !p.flags.emergencyRepairLogistics && !over,
          'Unsupplied: один Emergency Field Repair',
        )
        p.flags.emergencyRepairLogistics = true
      }
      if (over) {
        assert(
          isSupplied && u.flags.paidWindow && !u.flags.overhaulWindow,
          'Overhaul после обычного шага, один за Window',
        )
        u.flags.overhaulWindow = true
      } else {
        assert(!u.flags.paidWindow, 'Обычный платный шаг Window использован')
        u.flags.paidWindow = true
      }
      let percent = over || !isSupplied ? 0.25 : 0.15
      const d = from === 'D' && bonus(s, 'D', side) && !over && !p.flags.discountDLogistics
      if (d) {
        percent = 0.1
        p.flags.discountDLogistics = true
      }
      let cost = Math.max(over || !isSupplied ? 15 : 10, up5(u.rc * percent))
      if (
        ((from === 'A' && side === 'deathwatch' && entry(s, u).keywords.includes('INFANTRY')) ||
          (from === 'K' && side === 'necrons')) &&
        !p.flags.discountHomeLogistics
      ) {
        cost = Math.max(10, cost - 5)
        p.flags.discountHomeLogistics = true
      }
      if (c.payload.cache === true) {
        assert(u.armoury === 'cache' || p.inventory.includes('cache'), 'Нет Recovery Cache')
        if (u.armoury === 'cache') u.armoury = null
        else p.inventory.splice(p.inventory.indexOf('cache'), 1)
        cost = Math.max(0, cost - 30)
      }
      const personal = Math.min(u.recovery, cost)
      u.recovery -= personal
      cost -= personal
      const pool = Math.min(p.recovery, cost)
      p.recovery -= pool
      cost -= pool
      spend(s, side, cost)
      u.damage--
      return
    }
    case 'rehabilitate': {
      const u = unit(s, c.payload.id, side)
      local(u)
      const sc = u.scars.find((sc) => sc.id === c.payload.scar)
      assert(sc && !u.flags.rehabWindow, 'Scar отсутствует / Rehab Window закрыто')
      const deep = c.payload.deep === true
      spend(s, side, Math.max(deep ? 20 : 10, up5(u.rc * (deep ? 0.35 : 0.2))))
      u.flags.rehabWindow = true
      const pass = deep || sc.progress || ctx.dice(6) + (u.flags.rehabLedger ? 1 : 0) >= 3
      u.flags.rehabLedger = false
      if (pass) {
        u.scars = u.scars.filter((c) => c !== sc)
        u.trauma = false
      } else sc.progress = true
      return
    }
    case 'pay_evac': {
      const u = unit(s, c.payload.id, side)
      local(u)
      assert(u.evacDebt > 0, 'Нет долга')
      spend(s, side, u.evacDebt)
      u.evacDebt = 0
      return
    }
    case 'disband': {
      const u = unit(s, c.payload.id, side)
      local(u)
      credit(
        s,
        side,
        u.flags.commission
          ? 0
          : u.damage === 0
            ? down5(u.rc * 0.5)
            : u.damage < 3
              ? down5(u.rc * 0.25)
              : 0,
      )
      u.status = 'archived'
      u.relic = null
      u.armoury = null
      for (const [e, id] of Object.entries(p.enhancements))
        if (id === u.id) delete p.enhancements[e]
      return
    }
    case 'claim_honour': {
      const u = unit(s, c.payload.id, side)
      local(u)
      const cat = entry(s, u),
        h = HONOURS.find((h) => h.id === c.payload.honour)
      assert(!u.retiredCatalog, 'Сначала выберите Successor исчезнувшего datasheet')
      assert(
        h &&
          !cat.epic &&
          !u.honours.includes(h.id) &&
          (!h.side || h.side === side) &&
          (!h.character || cat.character),
        'Honour неприменимо',
      )
      const pending = String(u.flags.pendingHonours ?? '')
        .split(',')
        .filter(Boolean)
      const replacement = u.honours.find(
        (id) =>
          pending.includes(id) &&
          (HONOURS.find((v) => v.id === id)?.tier === 'Signature') === (h.tier === 'Signature'),
      )
      if (replacement) {
        u.honours = u.honours.filter((id) => id !== replacement)
        u.flags.pendingHonours = pending.filter((id) => id !== replacement).join(',')
      }
      if (h.tier === 'Signature')
        assert(
          u.xp >= 18 &&
            !u.honours.some((id) => HONOURS.find((h) => h.id === id)?.tier === 'Signature'),
          'Signature slot закрыт',
        )
      else
        assert(
          u.honours.filter((id) => HONOURS.find((h) => h.id === id)?.tier !== 'Signature').length <
            (u.xp >= 12 ? 3 : u.xp >= 7 ? 2 : u.xp >= 3 ? 1 : 0),
          'Нет свободного regular slot',
        )
      u.honours.push(h.id)
      return
    }
    case 'buy_armoury': {
      const item = str(c.payload.item),
        a = ARMOURY[item]
      assert(a, 'Неизвестный Armoury')
      if (c.payload.id) {
        const u = unit(s, c.payload.id, side)
        local(u)
        assert(
          !entry(s, u).epic &&
            !u.armoury &&
            !u.scars.some((sc) => side === 'deathwatch' && sc.id === 4),
          'Slot закрыт',
        )
        spend(s, side, a.cost)
        u.armoury = item
      } else {
        assert(
          a.consumable &&
            logisticsForce(s, side) === 'mf' &&
            s.sectors[from].owner === side &&
            supplied(s, side, from),
          'В inventory только Consumables при MF Supplied',
        )
        spend(s, side, a.cost)
        p.inventory.push(item)
      }
      return
    }
    case 'assign_armoury': {
      const u = unit(s, c.payload.id, side)
      local(u)
      const item = str(c.payload.item)
      assert(
        !u.armoury &&
          !entry(s, u).epic &&
          p.inventory.includes(item) &&
          !u.scars.some((sc) => side === 'deathwatch' && sc.id === 4),
        'Нет inventory / slot',
      )
      p.inventory.splice(p.inventory.indexOf(item), 1)
      u.armoury = item
      return
    }
    case 'discard_armoury': {
      const u = unit(s, c.payload.id, side)
      local(u)
      u.armoury = null
      u.flags.damagedArmoury = false
      return
    }
    case 'assign_relic': {
      const u = unit(s, c.payload.id, side)
      local(u)
      const item = str(c.payload.item)
      assert(!entry(s, u).epic && p.relics.includes(item) && RELICS[item], 'Нет Relic / Epic')
      p.relics.splice(p.relics.indexOf(item), 1)
      if (u.relic) p.relics.push(u.relic)
      u.relic = item
      return
    }
    case 'transfer_relic': {
      const fromU = unit(s, c.payload.from, side),
        toU = unit(s, c.payload.to, side)
      local(fromU)
      local(toU)
      assert(fromU.relic && !toU.relic && !entry(s, toU).epic, 'Relic отсутствует / slot закрыт')
      spend(s, side, 10)
      toU.relic = fromU.relic
      fromU.relic = null
      return
    }
    case 'refit': {
      const u = unit(s, c.payload.id, side)
      local(u)
      const old = entry(s, u),
        next = s.snapshot.catalog.find(
          (cat) =>
            cat.id === c.payload.catalogId &&
            cat.side === side &&
            sameDatasheet(cat.datasheet, old.datasheet),
        )
      assert(next, 'Произвольная смена datasheet запрещена')
      const kind = String(c.payload.kind ?? 'loadout'),
        diff = Math.max(0, next.rc - u.rc)
      assert(
        kind === 'size' ? next.models !== old.models : next.models === old.models,
        'Размер меняется через изменение размера; вооружение того же размера — через Refit loadout',
      )
      let cost = diff
      assert(
        !(diff > 0 && u.location === 'garrison' && act?.side === side && act.forcedMarch),
        'Forced March запрещает гарнизонные покупки и расширения',
      )
      if (
        kind === 'size' &&
        u.location === 'garrison' &&
        u.sector === 'J' &&
        diff > 0 &&
        bonus(s, 'J', side) &&
        p.flags.foundryActivation !== s.activationCount &&
        (next.keywords.includes('VEHICLE') ||
          (side === 'necrons' && next.keywords.some((k) => ['MONSTER', 'CANOPTEK'].includes(k))))
      ) {
        cost -= Math.min(25, down5(diff * 0.1))
        p.flags.foundryActivation = s.activationCount
      }
      if (diff > 0 && s.sectors[present(s, u)].disrupted) {
        const k = `disruptedBuy:${present(s, u)}:${s.activationCount}`,
          used = Number(p.flags[k] ?? 0)
        assert(used + diff <= al * 0.25, 'Disrupted: новые покупки/расширения ≤25% AL')
        p.flags[k] = used + diff
      }
      if (kind === 'size') {
        if (next.models > old.models) {
          assert(u.flags.sizeStage !== s.stage, 'Размер уже увеличивался на Stage')
          u.flags.sizeStage = s.stage
        }
        spend(s, side, cost)
      } else {
        assert(kind === 'loadout', 'Неверный Refit')
        spend(s, side, (u.flags.loadoutStage === s.stage ? 5 : 0) + diff)
        u.flags.loadoutStage = s.stage
      }
      if (u.location === 'field' && diff > 0)
        assert(
          s.units
            .filter((v) => v.side === side && v.location === 'field' && v.status === 'active')
            .reduce((n, v) => n + v.rc, 0) -
            u.rc +
            next.rc <=
            al * 1.5,
          'Field cap превышен',
        )
      u.catalogId = next.id
      u.rc = next.rc
      if (u.location === 'stf' && diff > 0)
        assert(
          s.units
            .filter(
              (v) =>
                v.side === side &&
                v.location === 'stf' &&
                !['lost', 'archived', 'sealed'].includes(v.status),
            )
            .reduce((n, v) => n + v.rc, 0) <=
            al * 0.75,
          'STF cap превышен',
        )
      if (u.location === 'garrison')
        assert(garrisonLegal(s, u, u.sector!, true), 'Новый размер не legal для гарнизона')
      return
    }
    case 'transfer_enhancement': {
      const e = str(c.payload.enhancement),
        to = unit(s, c.payload.to, side)
      local(to)
      assert(
        p.enhancements[e] && entry(s, to).character && !entry(s, to).epic,
        'Enhancement не закреплено / target',
      )
      if (p.enhancementStage === s.stage) spend(s, side, 15)
      p.enhancements[e] = to.id
      p.enhancementStage = s.stage
      return
    }
    case 'drill': {
      assert(
        Array.isArray(c.payload.ids) &&
          c.payload.ids.length > 0 &&
          c.payload.ids.length <= 2 &&
          new Set(c.payload.ids).size === c.payload.ids.length,
        'До двух разных ID',
      )
      for (const id of c.payload.ids) {
        const u = unit(s, id, side)
        local(u)
        assert(!entry(s, u).epic && u.flags.drillStage !== s.stage, 'ID уже Drill / Epic')
        u.xp++
        u.flags.drillStage = s.stage
      }
      spend(s, side, 30)
      return
    }
    case 'ammunition_choice': {
      const u = unit(s, c.payload.id, side)
      local(u)
      assert(u.flags.ammunitionDue, 'Нет Ammunition Debt')
      if (c.payload.pay === true) {
        spend(s, side, 5)
        u.flags.ammunitionPenalty = false
      } else u.flags.ammunitionPenalty = true
      u.flags.ammunitionDue = false
      return
    }
    case 'stage_deed': {
      const u = unit(s, c.payload.id, side)
      local(u)
      assert(
        !entry(s, u).epic && u.flags.stageDeedStage !== s.stage && s.battles === s.stage * 2,
        'Deed of Stage до первого боя',
      )
      assert(['HOLD', 'EXTRACT', 'OPERATE'].includes(String(c.payload.deed)), 'Выберите Deed')
      assert(
        !s.units.some((v) => v.side === side && v.flags.stageDeedStage === s.stage),
        'Один ID Stage',
      )
      u.flags.stageDeedStage = s.stage
      u.flags.stageDeed = String(c.payload.deed)
      u.flags.stageDeedProgress = 0
      return
    }
    case 'create_stf':
      assert(
        s.battles >= 8 && !p.stf && s.flags.stfEnabled && p.mf === home(side),
        'STF: общее решение, после 8 боёв, Home',
      )
      spend(s, side, 250)
      p.stf = p.mf
      return
    default:
      assert(false, 'Неизвестная Logistics команда')
  }
}
