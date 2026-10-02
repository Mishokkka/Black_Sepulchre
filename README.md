# The Black Sepulchre Campaign Command

Веб-приложение для ведения двухигроковой нарративной кампании Warhammer 40,000 11e по правилам **The Black Sepulchre**.

Это не просто трекер. Цель проекта: перенести максимально возможную часть кампанийной логики в приложение так, чтобы два игрока могли вести кампанию без ручного пересчёта Supply, Damage, XP, Campaign Rating, гарнизонов, перемещений, результатов боя и большинства post-battle процедур.

Production: https://mishokkka.github.io/Black_Sepulchre/

Repository: `Mishokkka/Black_Sepulchre`

Reference rules PDF: `Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf`

Canonical extracted text: `docs/Black_Sepulchre_v2.0_source.txt`

Supabase project ref: `xjmzsnvztqhjttcxeknf`

Current campaign snapshot date in DB: `2026-09-30`.

---

## 1. Что считать источником истины

При разработке используйте такой приоритет:

1. `Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf` в корне репозитория.
2. `docs/Black_Sepulchre_v2.0_source.txt`, автоматически извлечённый из того же PDF для поиска и аудита. При расхождении верстки с текстом PDF имеет приоритет.
3. Явные решения владельца проекта, зафиксированные после v2.0.
4. Серверная логика Supabase RPC.
5. Клиентский UI.

Если UI и RPC расходятся, **RPC должен защищать правила**. Клиент не должен иметь возможность записать нелегальное состояние только потому, что кнопка или форма это позволила.

Не переносите кампанийную бизнес-логику только в React. Всё, что меняет ресурсы, владение секторами, Damage, XP, Campaign Rating, состав roster, battle outcome или состояние activation, должно проверяться на сервере.

**Старый PDF v1.2.1 не является источником правил и не должен использоваться для разработки или аудита.** Исторические реализации, появившиеся до полной сверки, должны проверяться по v2.0 source перед изменением.

---

## 2. Стек

Frontend:

- React 19
- TypeScript
- Vite
- Lucide React
- один SPA без отдельного backend-сервера

Backend:

- Supabase Postgres
- Supabase Auth
- Row Level Security
- Realtime
- PostgreSQL RPC functions, большая часть mutating-функций использует `SECURITY DEFINER`

Hosting:

- GitHub Pages
- ветка `main` является исходником
- GitHub Action собирает `dist` и force-push публикуемого build в `gh-pages`

---

## 3. Быстрый старт для нового разработчика / handoff

Клонировать репозиторий и установить зависимости:

```bash
git clone https://github.com/Mishokkka/Black_Sepulchre.git
cd Black_Sepulchre
npm install
npm run dev
```

Проверка production build:

```bash
npm run build
```

Build обязан проходить до push/merge.

### Supabase environment

Клиент читает:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Если переменные не заданы, `src/lib/supabase.ts` использует встроенные production fallback values.

Это удобно для production GitHub Pages, но важно для разработки: **локальный frontend по умолчанию подключается к production Supabase**. Если нужно экспериментировать с destructive/несовместимыми изменениями, используйте отдельный Supabase branch/project и задайте env variables.

Publishable key является клиентским ключом и не является секретом. Service-role key в репозитории отсутствует и появляться там не должен.

---

## 4. Deployment

Workflow: `.github/workflows/deploy.yml`.

На каждый push в `main`:

1. checkout;
2. Node 22;
3. `npm install`;
4. `npm run build`;
5. содержимое `dist` публикуется в `gh-pages`.

Vite base path: `/Black_Sepulchre/`.

GitHub Pages должен быть настроен на:

- Source: Deploy from a branch
- Branch: `gh-pages`
- Folder: `/(root)`

После изменения frontend обязательно проверить последний workflow run. Успешный build в `main` ещё не означает, что Pages deployment уже завершился: GitHub запускает отдельный Pages job.

---

## 5. Структура репозитория

```text
.
├─ .github/workflows/deploy.yml
├─ .github/workflows/extract-rules-source.yml
├─ Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf
├─ docs/
│  └─ Black_Sepulchre_v2.0_source.txt
├─ README.md
├─ package.json
├─ vite.config.ts
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ styles.css
   ├─ types.ts
   ├─ lib/
   │  └─ supabase.ts
   ├─ data/
   │  └─ campaign.ts
   └─ components/
      ├─ StrategicPanel.tsx
      ├─ SpecialMovementPanel.tsx
      ├─ ReactionPanel.tsx
      ├─ ReorganisePanel.tsx
      ├─ BattleCenter.tsx
      ├─ BattleAssets.tsx
      ├─ LogisticsPanel.tsx
      ├─ LogisticsUpgrades.tsx
      ├─ ForceDoctrinePanel.tsx
      ├─ MissionRewardControls.tsx
      ├─ HonourClaims.tsx
      ├─ EventsPanel.tsx
      └─ D66ChoiceControls.tsx
```

### Основные файлы

`src/App.tsx`

Главный shell приложения: Auth, создание/подключение к кампании, загрузка campaign state, основной sidebar, dashboard, map, roster и audit log. Подписывается на Realtime изменения основных таблиц.

`src/components/StrategicPanel.tsx`

Strategic Activation. Movement, Strategic Actions, контакт, переход в battle/reaction/logistics.

`src/components/SpecialMovementPanel.tsx`

Deep Raid, Orbital Ossuary Lift, attacking Airlift, Glass Wastes route.

`src/components/ReactionPanel.tsx`

Realtime reaction window. Сейчас используется для Counter-Sabotage.

`src/components/BattleCenter.tsx`

Mission roll, Muster обеих сторон, Battle Assets, Battle Report, VP, outcome, Deeds, Distinguished, casualty modifiers, Field Medicae и автоматический Aftermath.

`src/components/BattleAssets.tsx`

Выбор Tactical Assets для Underdog, Fortified Defensive Asset и Breach Assets. Лимиты считаются на сервере по фактическому Muster.

`src/components/LogisticsPanel.tsx`

Покупка units, Recovery, Disband, затем явный конец Logistics и передача хода.

`src/components/LogisticsUpgrades.tsx`

Campaign Armoury, Rehabilitation и Deep Reconstruction Battle Scars.

`src/components/HonourClaims.tsx`

Выбор Battle Honours после достижения нового rank. Campaign Rating изменяется автоматически через RPC.

`src/components/EventsPanel.tsx`

BLACK CHOIR Reveal track, история D66, применение автоматизированных событий и отображение queued effects.

`src/components/D66ChoiceControls.tsx`

Игроковые решения для D66, где правило требует отдельного выбора стороны: target unit, target sector, reward или pass.

`src/data/campaign.ts`

Client-side reference data: stages, adjacency, sector metadata, mission names, D66 text, Battle Honours, Signature Honours, Campaign Armoury и простые display/calculation helpers.

Серверные правила не следует заменять этими helpers. Они нужны для интерфейса и предварительного отображения.

---

## 6. Архитектурный принцип

Frontend считается **недоверенным клиентом**.

Критические state changes идут через Supabase RPC. Прямые INSERT/UPDATE/DELETE для основных campaign tables через обычный authenticated client намеренно закрыты RLS.

Это значит:

```text
React UI
  ↓
supabase.rpc(...)
  ↓
Postgres validation
  ↓
atomic state mutation
  ↓
audit_log / resource_ledger
  ↓
Supabase Realtime
  ↓
оба клиента обновляют состояние
```

Не возвращайте прямые mutating policies на `units`, `players`, `sectors`, `battles` и т.п. ради удобства UI. Если нужна новая операция, делайте отдельный RPC с проверками.

---

## 7. State machine кампании

### Campaign

`campaigns.active_side` определяет, кто имеет право начать/продолжать Strategic Activation.

`campaigns.status='finished'` и `winner_side` используются после финального Stronghold Assault.

### Activation

Основные состояния:

```text
open
  ├─ movement/actions продолжаются
  ├─ Sabotage с доступным Counter-Sabotage → reaction_pending
  ├─ enemy contact → battle_pending
  ├─ Occupation → logistics
  └─ ручное End Activation → logistics

reaction_pending
  └─ defending player отвечает → open

battle_pending
  └─ BattleCenter Resolve + Aftermath → logistics

logistics
  └─ покупки/recovery/reconstruction → activation_pass_turn → completed

completed
  └─ active_side передаётся сопернику
```

Нельзя автоматически передавать ход сразу после Occupation или battle. По правилам сначала должна быть Logistics Phase.

### Battle

```text
draft
  → mission
  → both musters locked
  → tabletop result
  → automatic aftermath
  → completed
```

---

## 8. Основная модель данных Supabase

### `campaigns`

Глобальное состояние кампании.

Ключевые поля:

- `battle_count`
- `stage_index`
- `active_side`
- `black_choir`
- `status`
- `winner_side`
- `rules_version`
- `snapshot_date`

### `campaign_members`

Связь Supabase user с кампанией и стороной.

Две стороны:

- `necrons`
- `deathwatch`

### `players`

Ресурсы и стратегическое состояние стороны.

Ключевые поля:

- `supply`
- `intelligence`
- `recovery_supply`
- `main_force_sector`
- `secret_fragments`
- `fortress_integrity`
- `detachment_package`
- `enhancement_assignments`

### `sectors`

A–K.

Ключевые поля:

- `owner_side`
- `sector_class`
- `fortified`
- `conditions[]`
- `state_counter`

Используемые conditions:

- `Exhausted`
- `Sabotaged`
- `Disrupted`
- `Contested`
- `Ruined Fortifications`

### `units`

Persistent campaign units.

Ключевые поля:

- `reference_cost`: Reference Cost (RC)
- `campaign_rating`: процент CR
- `xp`
- `damage`: 0–3
- `location_type`: `field` / `garrison`
- `sector_key`
- `keywords[]`
- `honours jsonb`
- `scars jsonb`
- `armoury jsonb`
- `relics jsonb`
- `campaign_flags jsonb`

`campaign_flags.scar_lock=true` означает состояние после попытки получить четвёртый Battle Scar: unit становится Shattered и не может восстановиться ниже 2 Damage, пока хотя бы один Scar не удалён.

### `activations`

Одна запись на Strategic Activation.

Хранит:

- start/end sector
- March Points
- actions_available
- историю actions в JSON
- movement в JSON
- status

### `battles`

Battle header и Aftermath.

Хранит mission, battle type, attacker/defender, origin, VP, outcome, lock state Muster, Salvage, D66, Mission/Fleshworks choices, Recon/Interdict state, выбранные Battle Assets, `campaign_effects` для следующей battle и JSON report/aftermath.

### `battle_units`

Snapshot участия persistent units в конкретной battle.

Хранит:

- role
- participated/resting
- Official Battle Cost
- Effective Cost snapshot
- destroyed
- Deed
- Distinguished
- Casualty roll/modifier/result
- Damage before/after
- XP gained
- Scar
- Critical Injury result/roll metadata

### `reactions`

Асинхронные окна решения второго игрока.

Сейчас реализован `counter_sabotage`.

### `campaign_events`

D66 и другие campaign events.

Часть событий пока является только сохранённым событием/напоминанием и не исполняется автоматически.

### `resource_ledger`

Финансовый/ресурсный журнал. Любое серверное изменение Supply/Intelligence, которое имеет экономический смысл, желательно отражать здесь.

### `audit_log`

Техническая и игровая история операций.

---

## 9. Public RPC API

Mutations должны по возможности расширять этот API, а не обходить его.

### Campaign / auth flow

`create_campaign(name, side, display_name)`

Создаёт кампанию, membership, player states, стартовую карту и стартовые persistent forces.

`join_campaign(invite_code, display_name)`

Подключает второго игрока.

`set_first_player(campaign, side)`

Фиксирует первого игрока.

### Strategic Activation

`begin_activation(campaign)`

Создаёт activation только для `active_side`. Не допускает параллельную открытую activation.

`activation_move(activation, target)`

Обычное движение. Friendly move, Occupation или создание battle contact.

`activation_recon(activation)`

Recon.

`activation_mobilise(activation)`

Supply gain + Exhausted.

`activation_forced_march(activation)`

+1 MP, с последующим запретом покупки нового garrison.

`activation_fortify(activation)`

Fortified с серверным расчётом цены.

`activation_repair_network(activation, condition)`

Снимает Exhausted/Sabotaged.

`activation_sabotage(activation, target, auto)`

1 Intel на D6 4+ или 2 Intel auto-success. Если у защитника есть Intel, создаёт reaction window Counter-Sabotage.

`respond_counter_sabotage(reaction, counter)`

Ответ защищающейся стороны. При Counter тратит 1 Intel и отменяет Sabotage.

`activation_reorganise(activation, to_field[], to_garrison[])`

Физически переводит units между Field Roster и локальным garrison с проверкой caps и garrison legality.

`activation_investigate_choir(activation)`

Доступен после Reveal II, в G или controlled sector рядом с G.

`activation_airlift_move(activation, target)`

Friendly Orbital Ossuary Lift.

`activation_special_attack(activation, target, method)`

Сейчас методы:

- `deep_raid`
- `airlift_attack`
- `glass_wastes`

`end_activation(activation)`

Не передаёт ход. Переводит `open → logistics`.

`activation_pass_turn(activation)`

Закрывает Logistics и передаёт ход сопернику.

### Battle

`battle_roll_mission(battle)`

Бросок sector mission с anti-repeat logic. Активный Noctis Relay F один раз за Activation может создать два результата и перевести battle в состояние mission choice.

`battle_choose_mission(battle, code)`

Выбор одного из двух результатов Noctis Relay. До разрешения `CHOICE` Muster нельзя зафиксировать.

`battle_reroll_mission(battle)`

1 Intel. Соблюдает запрет повторов до прохождения всех трёх sector missions.

`battle_set_muster(battle, units, lock)`

Серверная проверка:

- принадлежности unit;
- Damage 3;
- Army Limit;
- per-unit OBC;
- Effective Cost = OBC + RC-based Campaign surcharge;
- Field/Garrison location;
- Initial Garrison tier;
- Reinforcement Capacity;
- Field Battle replacement logic;
- Unit Limits;
- Rest legality.

`battle_set_assets(battle, tactical[], defensive, breach[])`

Проверяет и сохраняет Tactical/Defensive/Breach Assets после фиксации Muster. Underdog применяется только к чистому Field Battle без local garrison и считается по разнице первоначальных Field forces относительно большей силы, как в v2.0.

`battle_use_recon_lock(battle)`

Тратит 1 Intelligence и должен быть объявлен до того, как хотя бы одна сторона зафиксировала Muster. Если Recon Lock использует одна сторона, сервер запрещает ей lock Muster до того, как соперник раскроет и зафиксирует свой. Если Recon Lock используют обе стороны, порядок раскрытия снова становится одновременным.

`battle_use_interdict(battle, asset)`

Тратит 2 Intelligence после фиксации обоих Muster и запрещает один legal enemy Tactical/Breach Asset. Если противник успел сохранить этот Asset раньше, RPC удаляет его из сохранённого выбора. Проверка также действует в `battle_set_assets`, поэтому обход клиентской формы не помогает.

`battle_choose_d66_event(battle, code)`

Выбирает один из двух D66, выпавших в Fleshworks IX. Winner выбирает после victory, Defender при Draw.

`battle_reroll_salvage(battle, choice)`

Тратит 1 Intelligence и перебрасывает собственный Salvage один раз. Старый reward атомарно отменяется, новый результат обязателен.

`battle_reroll_d66(battle)`

Тратит 2 Intelligence и перебрасывает глобальный D66 один раз. Разрешён только до применения события; второй результат обязателен.

`resolve_d66_event(event)`

Применяет D66 events, которые не требуют выбора конкретного unit/sector/reward, либо ставит их delayed effect в `campaigns.settings.pending_effects`.

`resolve_d66_player_choice(event, action, unit, sector)`

Server-authoritative resolver для D66 24, 31, 33, 41, 52, 53, 54 и 56. Каждая сторона может разрешить только свою часть события.

`battle_resolve(...)`

Главный Aftermath engine.

Выполняет:

- VP/outcome validation;
- Participation XP;
- Unit Deed XP;
- Distinguished XP;
- Casualty Roll;
- Damage;
- Battle Scar;
- fourth-Scar lock;
- Field Medicae consumption;
- retreat / emergency evacuation;
- garrison displacement;
- sector ownership;
- Stronghold Integrity;
- battle income;
- Salvage;
- Intelligence for loser;
- stage grant;
- Ash Meridian income;
- D66 roll;
- battle_count/stage update;
- перевод activation в Logistics.

### Logistics

`logistics_buy_unit(...)`

Покупка Field/Garrison unit с server-side legality.

`logistics_recover(activation, unit)`

Paid Recovery, Emergency Overhaul, Emergency Field Repair, sector discounts и Recovery Cache.

`logistics_disband(activation, unit)`

Удаляет persistent unit с возвратом по Damage state.

`logistics_buy_armoury(activation, unit, item_code)`

Покупает один Campaign Armoury item. Один unit может иметь максимум один покупной item.

`logistics_rehabilitate_scar(activation, unit, scar_code, deep)`

- `deep=false`: Rehabilitation, 25% RC, D6 4+
- `deep=true`: Deep Reconstruction, 50% RC, auto-success

При успешном удалении Scar снимается `scar_lock` и очищаются связанные persistent flags.

`logistics_veteran_drill(activation, units[])`

30 Supply, до двух persistent units, +1 XP; один unit не чаще одного раза за Stage.

`logistics_resolve_critical_choice(activation, unit, choice)` / `logistics_pay_character_evacuation(...)`

Полный v2.0 Lost / Evacuation flow Critical Injury.

`logistics_set_stage_detachment_package(...)`, `activation_doctrine_refit(...)`

Stage-locked Detachment Package и Doctrine Refit 1 Action + 25 Supply.

`logistics_assign_enhancement(...)`, `logistics_reassign_enhancement(...)`

Persistent Enhancement assignments; вне Stage reassignment стоит 15 Supply.

`logistics_refit_unit(...)`

Persistent size/loadout refit, включая RC delta, 5 Supply loadout fee вне бесплатного Stage reset и Foundry J discount.

`logistics_set_protocol_obsession(...)`, `logistics_resolve_ammunition_debt(...)`

Campaign-facing последствия соответствующих Battle Scars.

### Advancement

`unit_claim_honour(unit, code)`

Проверяет rank, число Honour slots, CHARACTER-only options и faction Signature Honours; затем увеличивает Campaign Rating.

---

## 10. Правила эскалации

Client reference находится в `STAGES`.

| Completed battles | Army Limit | Field Roster Cap |
|---|---:|---:|
| 0–1 | 500 | 750 |
| 2–3 | 750 | 1125 |
| 4–5 | 1000 | 1500 |
| 6–7 | 1250 | 1875 |
| 8–9 | 1500 | 2250 |
| 10–11 | 1750 | 2625 |
| 12+ | 2000 | 3000 |

Field Roster Cap считается по Reference Cost (RC).

Battle Deployment limits считаются по Effective Cost:

```text
Campaign surcharge =
ROUNDUP_TO_5(RC × Campaign Rating %)

Effective Cost =
Official Battle Cost (OBC)
+ Campaign surcharge
```

Reference Cost используется для purchase/roster/recovery. OBC вводится для конкретной Committed Force по Season Snapshot и включает contextual duplicate pricing, платный wargear и официальный Enhancement. Campaign Rating увеличивают Battle Honours, Signature Honours и Campaign Relics/Armoury, где это указано.

---

## 11. Garrison model

Garrison unit является настоящим persistent unit, а не бесплатным reinforcement.

Он:

- покупается за Supply;
- закреплён за сектором;
- имеет XP, Damage, Scars, Honours, Armoury и Campaign Rating;
- не входит в Field Roster Cap;
- при battle съедает caps по Effective Cost.

Initial tiers:

| Sector | Initial | Reserve |
|---|---:|---:|
| Ordinary | 50% | 25% |
| Strategic Node | 75% | 35% |
| Fortified | 100% | 50% |
| Home Stronghold | 100% | 75% |

Unsupplied/Exhausted уменьшают Reserve Capacity на 10 процентных пунктов.

В Field Battle local garrison в норме является reinforcement pool. Он может заполнять Initial Deployment только если доступный Field Roster защитника физически не способен заполнить Army Limit из-за Damage.

---

## 12. Что уже автоматизировано

Приложение проводит основной цикл v2.0:

```text
login
→ create/join campaign
→ first player
→ Strategic Activation
→ movement / actions / reactions
→ occupation or battle
→ mission
→ secret Muster / Recon Lock
→ Battle Assets
→ tabletop result
→ automatic Aftermath
→ обе стороны получают post-battle Logistics
→ active side передаёт ход
```

Server-authoritative логика уже покрывает:

- Strategic Resource Window Recon/Mobilise и сброс обоих flags после любой tabletop battle;
- movement, Occupation, Origin, Supply Line, Forced March, Fortify, Sabotage/Counter-Sabotage, Repair Network, Reorganise;
- Deep Raid, Orbital Lift/Airlift, Glass Wastes, Hidden Route и SECRET ROUTE;
- Stronghold requirements v2.0: Stage 1000+, adjacent Home, Supplied, контроль G **или 3 Secret Fragments**; War of Attrition; unmanned Home; Integrity 2→1→0; temporary 60% Home Capacity;
- sector states, включая некумулятивный Unsupplied/Exhausted reinforcement penalty, Disrupted, Contested, Ruined Fortifications и F3 short Sabotage; Exhausted сохраняется при смене владельца, Sabotaged снимается только своей обычной длительностью/Repair, а Occupation корректно превращает Fortified в Ruined Fortifications;
- OBC/RC/Effective Cost split: per-unit OBC фиксируется в Muster, CR surcharge считается от RC;
- secret Muster с RLS: до reveal соперник не читает чужой `battle_units`; Recon Lock реально раскрывает opponent Committed Force первым;
- Unit Limits, Initial/Capacity tiers, local-garrison replacement в Field Battle, RESTING, DISPLACED;
- Tactical/Defensive/Breach Assets, Interdict и post-battle Hard Evacuation/Hardened Stores/Extraction Beacon;
- Hybrid Attrition, Damage, D12 Battle Scars, fourth-Scar lock;
- полный Critical Injury D6, Lost/Evacuation, Epic Hero rule, Evacuation payment, Out of Action/Systemic Failure;
- Participation/Deed/Distinguished XP, Honours, Signature Honours, Campaign Rating;
- Campaign Armoury, Random Minor Armoury D6, Campaign Relics D6, Veteran Drill;
- Paid Recovery, Emergency Overhaul, Emergency Field Repair, Recovery Supply, Recovery Cache, Field Medicae, Rehabilitation/Deep Reconstruction;
- persistent size/loadout refit, Stage Detachment Package, Doctrine Refit и Enhancement assignments/reassignment;
- campaign-facing Scar effects: Legendary Bounty, Marked by the Watch, Gene-seed Shock, Memory Bleed, Severed Command Link/Node Redemption, Protocol Obsession и Ammunition Debt;
- retreat/Emergency Evacuation, garrison displacement и post-battle Logistics обеих сторон;
- Salvage, mandatory rerolls, global D66, Fleshworks 2-roll/D3 3-roll procedure, D66 choice flows и delayed effects;
- D66 16 по таблице Minor Armoury из v2.0;
- BLACK CHOIR track, forced Reveals, Investigate Choir, Secret Fragments и Reveal III EXTRACT INDEX для Stronghold battles;
- основные sector bonuses A–K: A/K recovery/enemy Intel, B victory Intel, C Lift, D recovery/event amplification, E income, F Noctis mission/reactive Intel, G Stronghold/raid/Choir, H long attack, I Rest/Deathwatch Intel/capture salvage, J qualifying garrison discount;
- campaign outcomes и tabletop-fact inputs для sector missions, включая C1, C3, D1/D2/D3, F3, G1, I1/I3, J2/J3 и остальные простые rewards;
- Realtime state sync, audit_log и resource_ledger.

Tabletop-only effects не моделируются как виртуальный Warhammer. Сайт хранит/показывает их как reminders или принимает факты после физической battle.

---

## 13. Что ещё НЕ считать завершённым

Оставшиеся пункты делятся на реальные source gaps и optional/unsupported automation.

### Реальные пробелы самого v2.0 source

1. **Scavenge.** В разделе Strategic Actions сказано только «если sector/mission/event прямо разрешает», а J определяет лишь дополнительное последствие натуральной 1 при Exhausted. Ни reward table, ни сам roll/procedure в v2.0 не определены. Сайт намеренно не выдумывает механику.
2. **D66 11 и Draw-ветка D66 32 при полном равенстве числа секторов.** PDF выбирает игрока с меньшим числом sectors, но не задаёт tie-break. Сервер намеренно останавливает resolver с понятной ошибкой.

### Опциональная механика v2.0, ещё не реализованная

- **Optional Secondary Task Force (STF)** из раздела 35. Основная кампания полностью использует одну Main Force, как базовые правила. STF требует отдельного strategic token/roster/activation selector и должен внедряться отдельным migration pass.

### Сознательно не автоматизируется как tabletop simulator

- movement, attacks, saves, Battle-shock, CP, objective control и Named Actions во время физической battle;
- большинство Honour/Relic/Armoury/Battle Scar эффектов, которые непосредственно меняют tabletop roll/position;
- DP legality и официальный Enhancement legality по Codex/MFM: сайт хранит Detachment Package/assignments и OBC, но официальный army legality остаётся за актуальным Season Snapshot, потому что datasheets/Codex data в проект не импортированы;
- эффекты, требующие факта с tabletop, заполняются через Battle Report либо остаются явной памяткой.

### Следующий технический приоритет

- Optional STF, если вы решаете включать это приложение кампании;
- добавить automated integration tests для двухаккаунтного state machine;
- зеркалировать production Supabase schema/migration snapshot в Git для полностью воспроизводимого disaster recovery.

### Не подменять правила догадками

Если v2.0 PDF не задаёт механику, сервер не должен молча выбирать «разумный» вариант. Зафиксируйте новое правило в PDF/README как проектное решение, затем реализуйте его.

---

## 14. Security / RLS

Authenticated users должны читать только кампании, членами которых являются.

Критические таблицы имеют read policies, но не произвольные client-side write policies.

Основные изменения выполняются `SECURITY DEFINER` RPC. Это намеренно: RPC обязан самостоятельно проверять `auth.uid()`, campaign membership, side ownership и текущий state machine.

Supabase advisor поэтому показывает warning о callable `SECURITY DEFINER` functions. Сам по себе warning здесь не означает ошибку: эти функции и являются публичным mutation API.

При добавлении новой `SECURITY DEFINER` функции обязательно:

- фиксировать `search_path`;
- проверять `auth.uid()`;
- проверять campaign membership;
- проверять сторону;
- проверять phase/status;
- не принимать campaign/side от клиента как доверенный факт, если их можно вывести из server state;
- писать `audit_log`;
- для ресурсов писать `resource_ledger`.

Не выдавайте authenticated role прямые права, позволяющие обойти RPC validation.

---

## 15. Realtime

Realtime используется не только для удобства. Кампания рассчитана на два браузера одновременно.

Подписки есть на:

- players
- sectors
- units
- activations
- battles
- battle_units
- campaign_events
- reactions
- audit_log

Особенно важно не ломать realtime для:

- Counter-Sabotage;
- Muster lock второй стороны;
- перехода battle → logistics;
- смены active player.

Если добавляется новая table, которую должен видеть второй игрок без refresh, её нужно:

1. добавить в publication `supabase_realtime`;
2. добавить subscription на клиенте.

---

## 16. Database migrations

История migrations хранится в production Supabase.

На 2026-10-02 production migration chain начинается с `initial_campaign_schema`. Точный хвост всегда проверяйте через Supabase `list_migrations`, потому что база является более оперативным источником, чем этот текст.

Ключевые поздние migrations:

- `explicit_logistics_phase_v2`
- `lock_direct_campaign_writes`
- `stronghold_assault_guards`
- `special_strategic_movement`
- `counter_sabotage_reactions`
- `battle_honour_claims`
- `reactions_realtime`
- `armoury_rehabilitation_and_scar_lock`
- `consumable_armoury_effects`
- `battle_assets_engine`
- `sector_bonus_automation`
- `conditional_field_medicae`
- `khepra_capture_salvage`
- `recon_lock_and_interdict`
- `recovery_discount_and_distinguished_fixes`
- `harden_recon_lock_and_interdict_timing`
- `interdict_target_cleanup`
- `noctis_double_mission_choice`
- `khepra_enhanced_rest`
- `aftermath_reroll_state_and_fleshworks_choice`
- `aftermath_choices_and_intel_rerolls`
- `forced_black_choir_reveals`
- `d66_simple_event_resolver`
- `apply_key_pending_d66_effects`
- `attach_next_battle_d66_effects`
- `d66_player_choice_events`
- `ammunition_rot_next_battle_enforcement`
- `automatic_mission_campaign_outcomes`
- `d66_global_reward_choices`
- `d66_cache_shards_recovery_crew`
- `d66_names_in_static`
- `d66_secret_route`
- `d66_hidden_route_attack`
- `fix_names_in_static_survival`
- `advisor_cleanup_d66_and_reactions`
- `sector_bonus_corrections`
- `missing_hour_strategic_action_gate`
- `post_battle_asset_casualty_bonuses`

Перед новым handoff первым делом выполните Supabase `list_migrations`, потому что production DB может быть новее этого README.

### Важный технический долг

Исторические SQL migration files пока не зеркалируются в Git repository. Production Supabase migration history является текущей authoritative history.

Если проект будет передаваться разработчику без доступа к текущему Supabase project, первым инфраструктурным улучшением должно стать сохранение воспроизводимого schema/migration snapshot в репозитории.

---

## 17. Как правильно добавлять новую механику

Пример: нужно добавить новую Strategic Action.

Правильный порядок:

1. Найти точную формулировку в rules PDF.
2. Определить, какие server states она читает и меняет.
3. Сделать PostgreSQL RPC с полной validation.
4. Записать audit/resource entries.
5. При необходимости добавить Realtime table/state.
6. Добавить минимальный UI, который вызывает RPC.
7. Не дублировать в React server authority.
8. Выполнить `npm run build`.
9. Проверить GitHub Action.
10. Проверить Pages deployment.
11. Обновить этот README, если появилась новая подсистема или изменился state machine.

---

## 18. Testing checklist

Автоматических unit/integration tests пока нет, поэтому после крупных изменений нужен ручной smoke test двумя аккаунтами.

Минимальный сценарий:

```text
Account A creates campaign
→ Account B joins by invite code
→ owner sets first player
→ active player begins activation
→ both clients see same state
→ move / strategic action
→ create battle
→ mission roll
→ both sides lock Muster
→ enter tabletop result
→ resolve aftermath
→ both clients see Damage/XP/resources/sector changes
→ Logistics
→ buy/recover if needed
→ pass turn
→ second player becomes active
```

Отдельно проверять:

- Sabotage → Counter-Sabotage в двух браузерах;
- Garrison Battle;
- Field Battle с local garrison;
- Rest;
- Shattered unit;
- fourth Scar lock;
- Rehabilitation success/failure;
- Deep Reconstruction;
- Campaign Armoury purchase;
- Recovery Cache consumption;
- Field Medicae consumption;
- Noctis double mission choice;
- Fleshworks double D66 choice;
- Salvage/D66 rerolls before Logistics spending;
- D66 24/31/33/41/52/53/54/56 both-side resolution;
- queued Noosphere Static / False Orders / Broken Map / Ceasefire;
- next-battle Auspex Ghost / Bone Bloom / Ammunition Rot;
- Stronghold Integrity 2 → 1 → 0;
- Emergency Evacuation без legal retreat.

---

## 19. Частые ошибки

### «Сайт не обновился после push»

Проверить два workflow:

1. `Build and publish site`
2. `pages build and deployment`

Оба должны завершиться `success`.

### «Второй игрок не видит изменение»

Проверить:

- table входит в `supabase_realtime`;
- subscription использует правильный filter;
- RLS разрешает SELECT второму члену кампании.

### «RPC работает через SQL editor, но не из клиента»

Проверить:

- `GRANT EXECUTE ... TO authenticated`;
- функция не была случайно оставлена только owner-only;
- внутри функции корректно проверяется `auth.uid()`.

### «Можно руками испортить состояние через Supabase client»

Это дефект. Убрать прямую write policy и вынести mutation в RPC.

### «Effective Cost не совпадает с RC»

Это ожидаемо. Покупка и Field Roster Cap используют Reference Cost. В конкретной battle игрок указывает Official Battle Cost по Season Snapshot, а сервер добавляет Campaign surcharge от RC.

### «После боя ход сразу передался»

Это дефект. После battle/occupation должна открываться Logistics Phase; только `activation_pass_turn` передаёт ход.

---

## 20. UI conventions

Интерфейс намеренно компактный и утилитарный.

Основные принципы:

- не делать отдельный экран на каждую мелкую механику;
- критические phase transitions должны быть явно видны;
- disabled state должен объясняться контекстом;
- opponent state читается, но не редактируется;
- destructive actions требуют подтверждения;
- вычисляемые значения показывать рядом с выбором до отправки;
- ошибки RPC выводить пользователю без скрытого fallback.

Desktop является основным сценарием, но основные панели должны оставаться usable на узком экране.

---

## 21. Naming conventions

В коде side всегда:

```text
necrons
deathwatch
```

Sector keys:

```text
A B C D E F G H I J K
```

Battle types:

```text
Field Battle
Garrison Battle
Stronghold Assault
```

Activation statuses:

```text
open
reaction_pending
battle_pending
logistics
completed
cancelled
```

Battle outcomes:

```text
attacker_win
defender_win
draw
attacker_withdrawal
defender_withdrawal
```

Garrison battle roles:

```text
field
garrison_initial
garrison_reinforcement
```

Не вводите вторые варианты строк для тех же сущностей без миграции и нормализации.

---

## 22. Handoff: первые 5 минут

Если проект подхватывает новый разработчик или новый AI-сеанс, не пытайтесь восстанавливать контекст из переписки. Сделайте следующее:

1. Прочитайте этот README целиком.
2. Откройте rules PDF и считайте его первичным источником механик.
3. Посмотрите последние commits в `main`.
4. В Supabase выполните `list_migrations` и проверьте production schema/RPC перед изменениями.
5. Посмотрите последний `Build and publish site` и последний `pages build and deployment`.
6. Перед новой mutation-механикой найдите существующий RPC или создайте новый server-authoritative RPC.
7. После изменения frontend дождитесь зелёного `npm run build` в GitHub Actions и отдельного успешного Pages deployment.
8. Обновите разделы «Что уже автоматизировано» и «Что ещё НЕ считать завершённым», если граница функциональности изменилась.

### Что не надо делать при handoff

- Не создавать новую архитектуру поверх существующей без необходимости.
- Не переводить authoritative checks из Postgres в React.
- Не давать authenticated client прямые write policies к campaign state.
- Не считать текст D66/Asset/mission в UI доказательством автоматизации эффекта. Проверять соответствующий RPC/queued-effect path.
- Не придумывать недостающие правила. Critical Injury, Minor Armoury D6, Relics и прочие механики сначала ищите в `docs/Black_Sepulchre_v2.0_source.txt`; старый v1.2.1 не использовать.
- Не считать старый успешный Pages deploy доказательством, что последний commit собрался. Всегда сопоставляйте SHA.

---

## 23. Current handoff summary

На 2026-10-02 production является рабочим multiplayer Campaign Command для **The Black Sepulchre v2.0**. После обнаружения ошибочного обращения к старому v1.2.1 выполнен отдельный reconciliation pass по каноническому v2.0 source.

Критические v2.0 системы, которые раньше были неполными, уже доведены: RC/OBC/Effective Cost, secret Muster/Recon Lock, Critical Injury, Relics/Minor Armoury, mission reports, Stronghold rules, Resource Window, shared post-battle Logistics, persistent Refit/Doctrine/Enhancements и campaign-facing Scar consequences.

Перед любой следующей задачей:

1. считать `Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf` нормативным документом;
2. для поиска использовать `docs/Black_Sepulchre_v2.0_source.txt`;
3. проверить последние production migrations через Supabase;
4. проверить последний GitHub SHA и оба workflow;
5. не использовать v1.2.1 как источник.

Из rules coverage остаются два специально отмеченных source ambiguity: Scavenge и equal-sector tie для D66 11/32. Optional Secondary Task Force пока не реализован. Всё остальное, что происходит непосредственно на tabletop, сайт не симулирует, а хранит как rule reminder или post-battle fact input.
