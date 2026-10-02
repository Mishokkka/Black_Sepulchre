# The Black Sepulchre Campaign Command

Веб-приложение для ведения двухигроковой нарративной кампании Warhammer 40,000 11e по правилам **The Black Sepulchre**.

Это не просто трекер. Цель проекта: перенести максимально возможную часть кампанийной логики в приложение так, чтобы два игрока могли вести кампанию без ручного пересчёта Supply, Damage, XP, Campaign Rating, гарнизонов, перемещений, результатов боя и большинства post-battle процедур.

Production: https://mishokkka.github.io/Black_Sepulchre/

Repository: `Mishokkka/Black_Sepulchre`

Reference rules PDF: `Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf`

Supabase project ref: `xjmzsnvztqhjttcxeknf`

Current campaign snapshot date in DB: `2026-09-30`.

---

## 1. Что считать источником истины

При разработке используйте такой приоритет:

1. `Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf` в корне репозитория.
2. Явные решения владельца проекта, зафиксированные в текущей задаче/обсуждении.
3. Серверная логика Supabase RPC.
4. Клиентский UI.

Если UI и RPC расходятся, **RPC должен защищать правила**. Клиент не должен иметь возможность записать нелегальное состояние только потому, что кнопка или форма это позволила.

Не переносите кампанийную бизнес-логику только в React. Всё, что меняет ресурсы, владение секторами, Damage, XP, Campaign Rating, состав roster, battle outcome или состояние activation, должно проверяться на сервере.

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
├─ Black_Sepulchre_40k11_Campaign_Rules_v2.0_RU.pdf
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
      ├─ HonourClaims.tsx
      └─ EventsPanel.tsx
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

BLACK CHOIR Reveal track и история D66.

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

- `reference_cost`: Base Points
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

Хранит mission, battle type, attacker/defender, origin, VP, outcome, lock state Muster, Salvage, D66 и JSON report/aftermath.

### `battle_units`

Snapshot участия persistent units в конкретной battle.

Хранит:

- role
- participated/resting
- destroyed
- Deed
- Distinguished
- Casualty roll/modifier/result
- Damage before/after
- XP gained
- Scar
- Critical Injury marker

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

Бросок sector mission с anti-repeat logic.

`battle_reroll_mission(battle)`

1 Intel. Соблюдает запрет повторов до прохождения всех трёх sector missions.

`battle_set_muster(battle, units, lock)`

Серверная проверка:

- принадлежности unit;
- Damage 3;
- Army Limit;
- Effective Cost;
- Field/Garrison location;
- Initial Garrison tier;
- Reinforcement Capacity;
- Field Battle replacement logic;
- Unit Limits;
- Rest legality.

`battle_set_assets(battle, tactical[], defensive, breach[])`

Проверяет и сохраняет Tactical/Defensive/Breach Assets после фиксации Muster. Underdog считается по разнице первоначального Effective Cost относительно Army Limit.

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

- `deep=false`: Rehabilitation, 25% Base Points, D6 4+
- `deep=true`: Deep Reconstruction, 50% Base Points, auto-success

При успешном удалении Scar снимается `scar_lock`.

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

Field Roster Cap считается по Base Points.

Battle Deployment limits считаются по Effective Cost:

```text
Effective Cost =
Base Points
+ ROUNDUP(Base Points × Campaign Rating %, nearest 5)
```

Campaign Rating увеличивают Battle Honours, Signature Honours и отдельные Campaign Armoury/Relic effects.

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

На текущем этапе приложение умеет провести основной цикл кампании:

```text
login
→ create/join campaign
→ first player
→ Strategic Activation
→ movement / actions
→ reaction windows
→ occupation or battle
→ mission
→ Muster обеих сторон
→ tabletop result
→ automatic Aftermath
→ Logistics
→ next player
```

Работают:

- Supply Lines;
- regular movement;
- Occupation;
- Field/Garrison/Stronghold contact;
- Recon;
- Mobilise;
- Forced March;
- Fortify;
- Repair Network;
- Sabotage + Counter-Sabotage;
- Reorganise Forces;
- Investigate Choir;
- Deep Raid;
- Orbital Airlift;
- Glass Wastes route;
- Cathedral G: первый Deep Raid стадии дешевле на 1 Intel;
- Basilica B: +1 Intel за соседнюю победу, максимум раз между своими Activations;
- Noctis Relay F: +1 Intel на объявление атаки противником, максимум раз между своими Activations;
- Necropolis I: Deathwatch Intel bonus при победах в I/K при активном контроле I;
- Canoptek Foundry J: скидка на одну qualifying garrison purchase за Activation;
- Stronghold Assault guards;
- Fortress Integrity;
- mission anti-repeat;
- Muster locks обеих сторон;
- Tactical Assets / Underdog selection;
- Fortified Defensive Asset selection;
- Breach Asset selection;
- Field Roster / garrison role checks;
- 50/75/100 Initial tiers;
- 25/35/50/75 Reserve tiers;
- Unit Limits;
- Rest;
- VP validation;
- Participation/Deed/Distinguished XP;
- Hybrid Attrition roll;
- Damage 0–3;
- Battle Scars;
- fourth-Scar lock;
- Battle Honours;
- Signature Honours;
- Campaign Rating / Effective Cost;
- Paid Recovery;
- Emergency Overhaul;
- Emergency Field Repair;
- Rehabilitation;
- Deep Reconstruction;
- Campaign Armoury purchases;
- Recovery Cache;
- Field Medicae;
- Disband;
- retreat and Emergency Evacuation;
- garrison displacement;
- base battle income;
- winner/loser income;
- stage grants;
- Ash Meridian income;
- Salvage roll;
- D66 roll/history;
- BLACK CHOIR Reveal display;
- realtime state sync;
- audit log.

---

## 13. Что ещё НЕ считать завершённым

Это важный раздел для handoff. Наличие текста правила в UI не означает, что effect автоматизирован.

### Высокий приоритет

1. **Critical Injury CHARACTER.**
   Сейчас battle aftermath может поставить marker `PENDING CRITICAL INJURY`, но полный Critical Injury flow ещё не автоматизирован.

2. **Полное применение D66.**
   D66 бросается и сохраняется. `EventsPanel` показывает текст. Большинство событий с выбором цели, delayed effect, reroll, BLACK CHOIR mutation или изменением следующей battle пока требуют ручного исполнения.

3. **Sector rules.**
   Автоматизирована уже значительная часть: A/K recovery discounts, B adjacent-victory Intel, C Airlift, E income, F reactive Intel, G Deep Raid discount, H Glass Wastes, I Deathwatch Intel bonus, J qualifying garrison discount. Остались D double-D66, F double mission roll/choice, I Rest/salvage, J Scavenge interaction и отдельные capture effects.

4. **Battle Assets effects.**
   Tactical/Defensive/Breach Assets уже рассчитываются, выбираются и сохраняются. Большинство их tabletop effects остаётся памяткой. Post-battle modifiers вроде Hard Evacuation / Hardened Stores / Extraction Beacon пока не привязаны автоматически к конкретному unit.

5. **Mission-specific campaign outcomes.**
   Mission code выбирается, но уникальные outcomes всех 33 sector missions пока не все применяются автоматически.

### Средний приоритет

- Recon Lock.
- Interdict.
- D66 reroll за 2 Intel.
- Salvage reroll за 1 Intel.
- Scavenge.
- Campaign Relics.
- Redemption conditions для Scar.
- Combat Auspex / Veteran Drill, если сохраняются в финальной версии rules.
- unit size upgrades и points-difference purchase flow.
- отдельно оцениваемый wargear.
- Detachment Package / Doctrine Refit UI.
- Enhancement assignment / reassignment UI.
- полный legality validator Detachment Points/Enhancements.
- sector-specific first-capture salvage.
- complete BLACK CHOIR automatic effects.
- Legendary Bounty.
- автоматические Scar-specific XP/behaviour consequences.

### Не подменять правила догадками

Если механика в PDF неоднозначна или плохо извлекается, не придумывайте «разумную» реализацию молча. Сначала сверить точную формулировку, затем зафиксировать выбранную интерпретацию в README/коде.

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

На 2026-10-02 применены migrations от:

`initial_campaign_schema`

до актуальной migration, указанной Supabase `list_migrations`. README обновлён после добавления battle assets и sector bonus automation.

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

### «Effective Cost не совпадает с Base Points»

Это ожидаемо. Покупка идёт по Base Points, battle caps используют Base Points + Campaign Rating surcharge.

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

## 22. Current handoff summary

На 2026-10-02 проект уже является рабочим multiplayer campaign command layer, а не макетом.

Главная задача следующего этапа: не переписывать существующий flow, а **закрывать оставшиеся rules gaps поверх текущей server-authoritative архитектуры**.

Лучший следующий порядок работ:

1. Critical Injury CHARACTER, если финальная формулировка будет подтверждена в rules source.
2. D66 resolver с pending choices/effects.
3. Оставшиеся sector-specific mechanics, особенно D/F/I/J.
4. Mission-specific campaign outcomes.
5. Автоматическое применение post-battle Battle Assets.
6. Recon Lock / Interdict / Salvage/D66 rerolls.
7. Relics, Detachment/Enhancement management.
8. unit size upgrades / paid wargear changes.
9. Автоматические tests для основных state transitions.

Перед изменениями сначала проверить последние GitHub commits, `Supabase list_migrations` и production schema. Не предполагать, что этот README новее базы данных.
