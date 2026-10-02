export type Side = 'necrons' | 'deathwatch'

export const STAGES = [
  { battles:'0–1', armyLimit:500, rosterCap:750, dp:'1 detachment', enhancements:1, field:'44×30"' },
  { battles:'2–3', armyLimit:750, rosterCap:1125, dp:'1 detachment', enhancements:1, field:'44×44"' },
  { battles:'4–5', armyLimit:1000, rosterCap:1500, dp:'2 DP', enhancements:2, field:'44×60"' },
  { battles:'6–7', armyLimit:1250, rosterCap:1875, dp:'2 DP', enhancements:2, field:'44×60"' },
  { battles:'8–9', armyLimit:1500, rosterCap:2250, dp:'2 DP', enhancements:3, field:'44×60"' },
  { battles:'10–11', armyLimit:1750, rosterCap:2625, dp:'3 DP', enhancements:4, field:'44×60"' },
  { battles:'12+', armyLimit:2000, rosterCap:3000, dp:'3 DP', enhancements:4, field:'44×60"' },
] as const

export const ADJACENCY: Record<string,string[]> = {
  A:['B','C'], B:['A','D','G'], C:['A','E','G'], D:['B','F','G'], E:['C','H','G'],
  F:['D','I','G'], G:['B','C','D','E','F','H','I','J'], H:['E','J','G'], I:['F','K','G'],
  J:['H','K','G'], K:['I','J']
}

export const SECTOR_META = {
  A:{name:'Watch Fortress Tenebris',class:'Home Stronghold'},
  B:{name:'Basilica Ossuary',class:'Ordinary'},
  C:{name:'Orbital Ossuary Lift',class:'Strategic Node'},
  D:{name:'Fleshworks IX',class:'Ordinary'},
  E:{name:'Ash Meridian',class:'Strategic Node'},
  F:{name:'Noctis Relay',class:'Strategic Node'},
  G:{name:'Cathedral of Black Glass',class:'Strategic Node'},
  H:{name:'Glass Wastes',class:'Ordinary'},
  I:{name:'Necropolis Khepra',class:'Ordinary'},
  J:{name:'Canoptek Foundry',class:'Strategic Node'},
  K:{name:'Sepulchre of the Nameless King',class:'Home Stronghold'},
} as const

export const MISSIONS = [
 ['A1','Cut the Shield','Прорыв'],['A2','The Long Vigil','Осада'],['A3','Sever the Vigil','Декапитация'],
 ['B1','Reliquary Hunt','Поиск'],['B2','Bone Choir','Контроль'],['B3','Procession of the Dead','Движущаяся цель'],
 ['C1','Falling Sky','Катастрофа'],['C2','Counterweight','Сопровождение'],['C3','Zero-G Breach','Манёвр'],
 ['D1','Vat Breach','Саботаж'],['D2','Harvest Line','Эвакуация'],['D3','Red Conveyor','Зона'],
 ['E1','Armoured Train','Движущаяся цель'],['E2','Break the Rails','Саботаж'],['E3','Black Freight','Лут'],
 ['F1','Kill the Signal','Хак'],['F2','Ghost Frequency','Скрытая цель'],['F3','Last Transmission','Асимметрия'],
 ['G1','Pilgrimage into Glass','Контроль'],['G2','Beneath the Altar','Спуск'],['G3','The Black Choir','Катастрофа'],
 ['H1','Mirror March','Обман'],['H2','Buried in Glass','Поиск'],['H3','Heat Death','Сжимающаяся зона'],
 ['I1','Awakening Pits','Контроль'],['I2','Tomb Street','Удержание'],['I3','Name of the Dead','Сканирование'],
 ['J1','Assembly Line','Контроль'],['J2','Machine Hunger','Движущиеся цели'],['J3','Kill Switch','Таймер'],
 ['K1','Break the Seal','Осада'],['K2','Command Crypt','Осада'],['K3','The Nameless Throne','Финал'],
] as const

export function stageIndexForBattles(b:number){ return b>=12 ? 6 : Math.floor(b/2) }
export function campaignSurcharge(rc:number,cr:number){ return Math.ceil((rc*cr/100)/5)*5 }
export function recoveryCost(rc:number){ return Math.max(10,Math.ceil((rc*.15)/5)*5) }
export function fortifyCost(limit:number){ return Math.ceil((limit*.15)/5)*5 }
export function mobiliseGain(limit:number){ return Math.ceil((limit*.10)/5)*5 }
export function garrisonCaps(limit:number,sectorClass:string,fortified:boolean,penalty=false){
 let initial=sectorClass==='Home Stronghold'?1:sectorClass==='Strategic Node'?.75:.5
 let reserve=sectorClass==='Home Stronghold'?.75:sectorClass==='Strategic Node'?.35:.25
 if(fortified){initial=Math.max(initial,1);reserve=Math.max(reserve,.5)}
 if(penalty)reserve=Math.max(0,reserve-.10)
 return {initial:Math.floor(limit*initial/5)*5,reserve:Math.floor(limit*reserve/5)*5}
}


export const D66_EVENTS: Record<string,{name:string;effect:string}> = {
 '11':{name:'The Silent Survivors',effect:'Игрок с меньшим числом секторов выбирает: +1 Intel или +25 Supply; при выборе Supply BLACK CHOIR +1.'},
 '12':{name:'Munitorum Cache',effect:'Каждый игрок получает +20 Supply. Победитель может вместо этого получить Recovery Cache.'},
 '13':{name:'Blackglass Shards',effect:'Player, контролирующий G или adjacent G sector, получает Blackglass Ward бесплатно; если слот/предмет не нужен, +1 Intel.'},
 '14':{name:'Recovery Crew',effect:'Каждый выбирает один уничтоженный unit: его Casualty Roll улучшается на +1 задним числом, максимум 6; Scar от отменённого Catastrophic Loss удаляется.'},
 '15':{name:'Empty Coffins',effect:'BLACK CHOIR +1.'},
 '16':{name:'Damaged Relic',effect:'Победитель получает случайный Minor Armoury item. После первого использования на D6=1 предмет уничтожается.'},
 '21':{name:'Vox From the Dead',effect:'Проигравший получает +1 Intel. В следующей битве его первый failed Battle-shock можно перебросить.'},
 '22':{name:'Ash Rain',effect:'Следующая tabletop battle: Ash Storm в battle round 3; ranged attacks дальше 24" невозможны до конца раунда.'},
 '23':{name:'The Missing Hour',effect:'В следующую Strategic Activation каждый тайно записывает первое Strategic Action; на 4+ оно срабатывает, на 1–3 теряется без оплаты ресурса.'},
 '24':{name:'Living Metal Dust',effect:'Necrons бесплатно снимают 1 Damage одному unit. Deathwatch получает +20 Supply.'},
 '25':{name:'Bone Bloom',effect:'Следующая battle: центральный objective окружён 5" Difficult Ground. Победитель +10 Supply.'},
 '26':{name:'Machine Hymn',effect:'В следующей battle первый VEHICLE/MONSTER, который должен стать Battle-shocked, получает D3 mortal wounds и считается прошедшим test.'},
 '31':{name:'Stragglers',effect:'Каждый может заплатить 10 Supply и дать одному Recruit unit +1 XP.'},
 '32':{name:'Captured Servitor',effect:'Победитель выбирает +25 Supply или +1 Intel; проигравший получает оставшуюся награду. При Draw выбирает игрок с меньшим числом секторов.'},
 '33':{name:'Xenos Script',effect:'Deathwatch +1 Intel. Necrons: одному unit +1 XP. Если Deathwatch контролирует I или K, также +10 Supply.'},
 '34':{name:'Auspex Ghost',effect:'В следующей battle оба получают Recon Lock бесплатно. Если оба используют его, армии раскрываются одновременно и каждый получает +1 Intel после Muster.'},
 '35':{name:'Hidden Route',effect:'До конца следующей tabletop battle каждый один раз может объявить атаку на сектор в двух связях за 1 Intel.'},
 '36':{name:'Broken Map',effect:'Бонусы Noctis Relay и Orbital Ossuary Lift отключены до конца следующей tabletop battle.'},
 '41':{name:'Ammunition Rot',effect:'Каждый платит 10 Supply или выбирает unit, который не может использовать Campaign Armoury item в следующей battle.'},
 '42':{name:'Noosphere Static',effect:'Recon, Recon Lock и Sabotage стоят на 1 Intel дороже до конца следующей tabletop battle.'},
 '43':{name:'Reanimating Corpse',effect:'Поставьте UNRESOLVED. Если 43 выпадет снова, BLACK CHOIR +2 и Reveal II открывается, если ещё не открыт.'},
 '44':{name:'False Orders',effect:'Игрок с большим числом секторов получает на 1 Strategic Action меньше в следующую Activation; при равенстве эффекта нет.'},
 '45':{name:'Contaminated Supply',effect:'Каждый бросает D6. На 1–2 теряет 10% текущего Supply, округляя вниз до 5; на 3–6 ничего.'},
 '46':{name:'Delayed Reinforcements',effect:'В следующей battle первый campaign-granted Reserve или Garrison Reinforcement каждой стороны прибывает на один round позже.'},
 '51':{name:'The Wrong Bodies',effect:'Игрок, потерявший больше units, получает +25 Recovery Supply. BLACK CHOIR +1.'},
 '52':{name:'Mutual Atrocity',effect:'Каждый независимо выбирает: +20 Supply и один свой сектор Exhausted, или ничего.'},
 '53':{name:'Unmarked Kill Team',effect:'Deathwatch +1 Intel; Necrons +15 Supply. Если Deathwatch контролирует G, он может вместо Intel получить +20 Supply.'},
 '54':{name:'Tomb Echo',effect:'Necrons +1 Intel; Deathwatch +15 Supply. Если Necrons контролируют G, они могут вместо Intel получить +20 Supply.'},
 '55':{name:'Ceasefire That Never Was',effect:'Следующий игрок, объявивший атаку, получает +1 Intel после выбора сектора.'},
 '56':{name:'The Corpse Ledger',effect:'Каждый может выбрать unit с Battle Scar и заплатить 10 Supply: следующий Rehabilitation roll получает +1.'},
 '61':{name:'Choir Beneath the Floor',effect:'BLACK CHOIR +1; новый Reveal открывается немедленно.'},
 '62':{name:'Nine Seconds Repeated',effect:'Следующая battle: в начале round 2 повторите эффект round 1 одной sector Catastrophe, если применимо; иначе каждый +1 CP.'},
 '63':{name:'Names in the Static',effect:'Каждый называет CHARACTER. Если выжил следующую battle, +1 XP; если уничтожен, Casualty Roll -1.'},
 '64':{name:'The Door Behind the Door',effect:'SECRET ROUTE на случайный non-home sector. До следующего захвата владелец один раз считает любой сектор рядом с G соседним для movement/attack.'},
 '65':{name:'Black Sun',effect:'BLACK CHOIR +1. Следующая battle: round 4 без Benefit of Cover по всему полю.'},
 '66':{name:'The Mouth Opens',effect:'BLACK CHOIR +2. Откройте следующий неоткрытый Reveal независимо от значения. Каждый +1 Intel.'},
}

export const BLACK_CHOIR_REVEALS = [
 {threshold:2,label:'Reveal I',effect:'Отмечайте Resonance events в Battle Log.'},
 {threshold:4,label:'Reveal II',effect:'Открывается Strategic Action Investigate Choir.'},
 {threshold:6,label:'Reveal III',effect:'Stronghold missions получают Secret Objective Extract the Index.'},
 {threshold:8,label:'Reveal IV',effect:'Контроль G можно заменить 3 Secret Fragments.'},
] as const


export const BATTLE_HONOURS = [
 {code:'hard_lessons',name:'Hard Lessons',category:'SURVIVORS',tier:'Minor',cr:5,effect:'Один раз за battle перебросьте один failed Saving Throw этого unit.'},
 {code:'dig_in',name:'Dig In',category:'SURVIVORS',tier:'Minor',cr:5,effect:'Пока unit контролирует objective и не Battle-shocked, +1 к его Battle-shock tests.'},
 {code:'hold_fast',name:'Hold Fast',category:'SURVIVORS',tier:'Minor',cr:5,effect:'Пока unit в range objective и не Battle-shocked, +1 OC каждой model, максимум +1/model.'},
 {code:'last_line',name:'Last Line',category:'SURVIVORS',tier:'Major',cr:10,effect:'Один раз за battle, когда unit становится Below Half-strength, сделайте Battle-shock test; при успехе до конца round игнорируйте negative OC modifiers.'},
 {code:'kill_confirmed',name:'Kill Confirmed',category:'EXECUTIONERS',tier:'Minor',cr:5,effect:'Один раз за phase перебросьте один Hit roll против enemy unit, уже потерявшего wound/model в battle.'},
 {code:'measured_fire',name:'Measured Fire',category:'EXECUTIONERS',tier:'Minor',cr:5,effect:'Один раз за battle один weapon profile игнорирует Benefit of Cover в Shooting phase.'},
 {code:'finisher',name:'Finisher',category:'EXECUTIONERS',tier:'Minor',cr:5,effect:'Один раз за battle перебросьте один Wound roll против Below Half-strength enemy unit.'},
 {code:'extermination_pattern',name:'Extermination Pattern',category:'EXECUTIONERS',tier:'Major',cr:10,effect:'Один раз за battle один weapon profile получает Sustained Hits 1 до конца activation; не складывается с уже имеющимся Sustained Hits.'},
 {code:'forced_march_honour',name:'Forced March',category:'HUNTERS',tier:'Minor',cr:5,effect:'Один раз за battle вместо Advance roll используйте 6.'},
 {code:'pathfinders',name:'Pathfinders',category:'HUNTERS',tier:'Minor',cr:5,effect:'Перед первым battle round Scout 3", если его нет; не работает на VEHICLE/MONSTER.'},
 {code:'pursuit',name:'Pursuit',category:'HUNTERS',tier:'Minor',cr:5,effect:'Один раз за battle перебросьте Charge roll против enemy unit, уже потерявшего wounds/models.'},
 {code:'relentless_track',name:'Relentless Track',category:'HUNTERS',tier:'Major',cr:10,effect:'Один раз за battle после enemy Normal Move в 9" сделайте Normal Move до 3", заканчивая не ближе 6".'},
 {code:'shock_presence',name:'Shock Presence',category:'LINEBREAKERS',tier:'Minor',cr:5,effect:'После успешного Charge до конца round unit получает +1 OC.'},
 {code:'breach_discipline',name:'Breach Discipline',category:'LINEBREAKERS',tier:'Minor',cr:5,effect:'Один раз за battle unit игнорирует один campaign/mission movement penalty от Rough Ground, debris или sector hazard.'},
 {code:'take_the_ground',name:'Take the Ground',category:'LINEBREAKERS',tier:'Minor',cr:5,effect:'Если unit закончил ваш turn на objective, который в начале turn контролировал opponent, +1 к следующему Battle-shock test до конца вашей следующей Command phase.'},
 {code:'no_step_back',name:'No Step Back',category:'LINEBREAKERS',tier:'Major',cr:10,effect:'Один раз за battle автоматически пройдите Desperate Escape или аналогичный test для всего unit.'},
 {code:'mission_experts',name:'Mission Experts',category:'SPECIALISTS',tier:'Minor',cr:5,effect:'Один раз за battle Named Action этого unit завершается немедленно после старта, если mission не запрещает.'},
 {code:'field_engineers',name:'Field Engineers',category:'SPECIALISTS',tier:'Minor',cr:5,effect:'Один раз за battle после interaction с objective/terminal оставьте marker. Первый enemy Named Action на нём завершается в конце следующего enemy turn вместо обычного timing.'},
 {code:'secure_extract',name:'Secure and Extract',category:'SPECIALISTS',tier:'Minor',cr:5,effect:'Unit может начать Named Action после Advance как campaign exception; до конца turn всё равно не может Shoot/Charge.'},
 {code:'operational_mastery',name:'Operational Mastery',category:'SPECIALISTS',tier:'Major',cr:10,effect:'Один раз за battle unit может начать Named Action и оставаться eligible to shoot; до конца Shooting phase -1 Hit.'},
 {code:'command_presence',name:'Command Presence',category:'COMMAND',tier:'Minor',cr:5,character:true,effect:'Только CHARACTER. Attached Unit получает +1 к одному Battle-shock test за round.'},
 {code:'contingency_orders',name:'Contingency Orders',category:'COMMAND',tier:'Minor',cr:5,character:true,effect:'Только CHARACTER. Один раз за battle после определения первого хода бесплатно переместите Attached Unit в Strategic Reserves, если setup позволяет.'},
 {code:'calculated_risk',name:'Calculated Risk',category:'COMMAND',tier:'Minor',cr:5,character:true,effect:'Только CHARACTER. Один раз за battle после Advance/Charge roll перебросьте один die.'},
 {code:'field_commander',name:'Field Commander',category:'COMMAND',tier:'Major',cr:10,character:true,effect:'Только CHARACTER. Один раз за battle после Stratagem на Attached Unit: D6, на 5+ получите 1CP с core limits.'},
] as const

export const SIGNATURE_HONOURS = [
 {code:'purge_protocol_absolute',side:'deathwatch',name:'Purge Protocol: Absolute',cr:15,effect:'Один раз за battle выберите видимый XENOS unit; до конца phase перебрасывайте по одному Hit и Wound roll в каждой activation против этой цели.'},
 {code:'watch_endures',side:'deathwatch',name:'The Watch Endures',cr:15,effect:'Первый раз за battle, когда unit должен быть уничтожен, оставьте одну model с 1 wound; затем unit Battle-shocked.'},
 {code:'black_spear_veteran',side:'deathwatch',name:'Black Spear Veteran',cr:15,effect:'Один раз за battle после Normal Move выполняйте Mission Action без запрета Shooting, но не Charge.'},
 {code:'protocol_inevitable',side:'necrons',name:'Protocol: Inevitable',cr:15,effect:'Один раз за battle после failed Saving Throw уменьшите Damage атаки до 0; затем -1" Move до конца следующего хода.'},
 {code:'ancient_murder_logic',side:'necrons',name:'Ancient Murder-Logic',cr:15,effect:'Один раз за Fight phase один melee weapon profile получает +1 Attack на model, максимум +5 attacks.'},
 {code:'memory_eternity',side:'necrons',name:'Memory of Eternity',cr:15,effect:'Один раз за battle после failed Battle-shock считайте test успешным; если unit выжил, +1 XP после battle.'},
] as const


export const CAMPAIGN_ARMOURY = [
 {code:'field_medicae',name:'Field Medicae / Repair Node',cost:40,cr:0,effect:'Одноразово после Casualty Roll уменьшите полученный Damage на 1.'},
 {code:'reinforced_plating',name:'Reinforced Plating',cost:60,cr:5,effect:'Один раз за battle уменьшите Damage одной успешной атаки по model на 1, минимум 1.'},
 {code:'tactical_relay',name:'Tactical Relay',cost:50,cr:5,effect:'Один раз за battle +1 к одному броску, напрямую связанному с Mission Action/sector rule.'},
 {code:'reserve_beacon',name:'Reserve Beacon',cost:60,cr:5,effect:'Один раз за battle перебросьте Charge roll unit в turn, когда он прибыл из Reserves/Garrison Reinforcements.'},
 {code:'recovery_cache',name:'Recovery Cache',cost:35,cr:0,effect:'Одноразово: следующий paid recovery 1 Damage стоит половину, округляя вверх до 5.'},
 {code:'blackglass_ward',name:'Blackglass Ward',cost:70,cr:5,effect:'Один раз за battle перебросьте Battle-shock test, вызванный Black Glass/Black Choir.'},
 {code:'combat_auspex',name:'Combat Auspex',cost:40,cr:5,effect:'Один раз за battle одна Shooting activation игнорирует Benefit of Cover; до следующей Command phase unit +1 к одному Battle-shock test.'},
] as const

export const CAMPAIGN_RELICS = [
 {roll:1,code:'blackglass_shard',name:'Blackglass Shard',cr:5,tier:'Minor',effect:'Один раз за battle перебросьте один Battle-shock test.'},
 {roll:2,code:'chronal_sliver',name:'Chronal Sliver',cr:5,tier:'Minor',effect:'Один раз за battle перебросьте Advance или Charge roll.'},
 {roll:3,code:'ossuary_key',name:'Ossuary Key',cr:5,tier:'Minor',effect:'Один раз за battle после успешного Named Action получите +1 VP, не выше mission maximum.'},
 {roll:4,code:'blackglass_lens',name:'Blackglass Lens',cr:5,tier:'Minor',effect:'Один раз за battle один ranged weapon profile unit игнорирует Benefit of Cover до конца activation.'},
 {roll:5,code:'mnemonic_crown',name:'Mnemonic Crown',cr:10,tier:'Major',effect:'Один раз за battle после завершения Named Action unit получает +1 OC до конца следующей Command phase.'},
 {roll:6,code:'anchor_fragment',name:'Anchor Fragment',cr:10,tier:'Major',effect:'Один раз за battle после enemy Normal Move в 9" unit может переместиться до 3", заканчивая не ближе 6" от enemy.'},
] as const


export const TACTICAL_ASSETS = [
 {code:'Prepared Barricades',effect:'После setup поставьте до двух small barricades полностью в своей deployment zone.'},
 {code:'Smoke Screen',effect:'Один раз за battle выбранный unit получает Benefit of Cover против Shooting до конца phase.'},
 {code:'Emergency Coordinates',effect:'После deployment переместите один INFANTRY unit до 3", оставаясь legal.'},
 {code:'Field Reserves',effect:'Получите +1 CP в начале battle round 2.'},
 {code:'Booby-trapped Objective',effect:'Выберите objective вне enemy deployment. Первый enemy unit, закончивший move в его range, на 4+ получает D3 mortal wounds.'},
 {code:'Hard Evacuation',effect:'Первый уничтоженный non-CHARACTER после battle получает +1 Casualty Roll.'},
] as const

export const DEFENSIVE_ASSETS = [
 {code:'Prepared Barricades',effect:'После terrain setup поставьте две небольшие barricade pieces полностью в Defender half, не ближе 3" к objective.'},
 {code:'Mine Corridor',effect:'После deployment отметьте полосу 9×3" вне deployment zones и objectives. Первый enemy unit, который Advance/Charge через неё, получает D3 mortal wounds на 4+.'},
 {code:'Reserve Beacon',effect:'Первый Garrison Reinforcement в battle один раз может перебросить Charge roll в ход прибытия.'},
 {code:'Hardened Stores',effect:'После battle один участвовавший garrison unit получает +1 к Casualty Roll.'},
] as const

export const BREACH_ASSETS = [
 {code:'Suppression Window',effect:'Один раз за battle в начале Defender Movement phase задержите один Garrison Reinforcement на round.'},
 {code:'Breach Charge',effect:'Один ваш unit один раз за battle игнорирует Benefit of Cover до конца своей Shooting или Fight activation.'},
 {code:'Infiltration Route',effect:'После deployment, до определения первого turn, один ваш INFANTRY unit полностью вне Engagement Range может сделать Normal Move до 6". Не может закончить в enemy deployment zone или Engagement Range.'},
 {code:'Extraction Beacon',effect:'После battle один уничтоженный Attacker non-CHARACTER получает +1 Casualty Roll.'},
] as const
