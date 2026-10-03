# The Black Sepulchre · 2.2.1

Приложение для двух командиров: Deathwatch и Necrons. Актуальный игровой источник — [PDF правил 2.2.1](Black_Sepulchre_40k11_Campaign_Rules_v2.2.1_RU.pdf) и четыре Markdown-файла той же версии в `docs/`. Старые материалы 2.1/2.2 сохранены для истории и не подключаются к движку.

[Открыть кампанию](https://mishokkka.github.io/Black_Sepulchre/)

## Начало игры

1. Войти в существующий аккаунт. Второй командир присоединяется по коду приглашения.
2. Согласовать Season Snapshot: версии официальных core/faction rules, datasheets, MFM и errata; legal detachments каждой фракции, цены, размеры, Leaders, транспорт и Enhancements.
3. Проверить бесплатный старт 470–500 Effective с Warlord. Импортированные цены — исходные ориентиры, а не утверждённые актуальные MFM. Бесплатный старт выдаётся один раз.
4. Обоим подтвердить Snapshot и старт. После этого приложение ведёт ход кампании; движения моделей, LoS и боевые dice остаются за столом.

Каталог можно обновить между боями только по общему согласию. Цена прежнего состава пересчитывается бесплатно; исчезнувший datasheet сохраняет ID и XP до выбора successor либо архива. Snapshot объявленного боя неизменяем.

## Что автоматизировано

- Каноническая карта, Supplied, MP/Actions, маршруты, Occupation, состояния секторов, осады и Integrity.
- Общий Window, Supply/Intel/Local/Recovery, Commission, покупка из каталога, Field/STF caps, Recovery/Overhaul/Rehab, снаряжение, Package, Drill и Deed of Stage.
- Secret commitments, Recon Lock, легальность Detached/Attached/embarked армий, contextual OBC + Campaign Rating, Interdict, Underdog и Assets.
- 33 карточки миссий с координатами, контроль и tags, Named Actions, одноразовые награды, scoring, прибытия Pool/Initial Reserves и Withdrawal. Модельные hazards и боевые способности показываются в пакете и разрешаются за столом.
- Подтверждение Result обоими, сохранённые Casualty/Critical/Salvage/D66, выбор наград, preview последствий и атомарное применение после двух подтверждений.
- Коррекция последнего Result: оба согласуют откат зависимых решений; последствия пересчитываются из исходного состояния с сохранёнными именованными dice. Второй доход не создаётся.
- Catch-up по ресурсам и максимальному legal available Field deployment, Stage Grants, Contact Clock, Emergency Muster/debt, Choir и кризис WAR/PACT.
- Optional STF после восьми боёв и общего согласия: отдельный roster, один выбранный Force на Activation, половина AL в deployment, совместный отход двух Field Forces.

Приложение не измеряет положение моделей и не подтверждает факты боя за игроков. Eligibility, range, LoS, natural rolls, причины потерь и final gates вводятся как факты; итог проверяют оба.

## Архитектура и безопасность

`shared/` — чистый TypeScript-движок. Сервер выполняет те же проверки, что интерфейс. `supabase/functions/campaign-engine/` проверяет user JWT через Supabase Auth `getUser`, определяет сторону по membership и выполняет команду. `service_role` существует только в Edge runtime; в Vite разрешён только publishable key.

Состояние и закрытые выборы находятся в `campaign_private.states`, недоступной `anon`/`authenticated`. API возвращает отдельную проекцию для стороны: чужой commitment до reveal, режим финала и скрытая F2-цель удаляются из ответа и журнала. Realtime передаёт только номер версии; клиент заново запрашивает свою проекцию.

Каждая команда содержит request UUID и expected version. Postgres блокирует строку, проверяет membership/версию, сохраняет state + receipt + audit dice одной транзакцией. Повтор UUID возвращает сохранённый результат; другой payload с тем же UUID отвергается. Конфликт не выдаёт повторной награды.

Миграция добавляет новые таблицы без удаления старых. При инициализации сохраняется `legacy_backup` всех исходных таблиц кампании, включая ledger/audit/commitments. Старый mutation API отключён; новые create/join разрешены только вошедшим пользователям. Фактическая миграция проверена для текущей кампании: 13 стартовых ID, 0 сыгранных боёв, без улучшений и потерь. Продвинутые старые кампании требуют отдельного согласованного переноса неоднозначных эффектов.

## Разработка и проверка

Требуется Node.js 22+. Для другого проекта заполнить `.env` по `.env.example`; никогда не добавлять туда server keys.

```sh
npm ci
npm run rules
npm test
npm run build
npm run dev
```

`?demo` доступен только в DEV: локальные сценарии без Supabase и изменений пользовательской кампании. В production этот модуль исключён.

`tools/compile-rules.mjs` собирает карточки, Honours, Scars, D66 и справочник из Markdown; проверяет полноту таблиц. `tools/build-assets.mjs` копирует существующий PDF в сайт как `rules.pdf`. Редактировать сгенерированные файлы вручную не следует.

Тесты проверяют стратегию, легальность составов, скрытые данные, таймеры, два подтверждения, последствия, ревизии, Snapshot/STF, весь график до боя 18 и terminal gates. SQL-тест запускает настоящую миграцию в локальном Postgres/PGlite: проверяет ACL/RLS, join, legacy freeze, idempotency и конфликт версии. Он не требует Docker и не использует рабочую базу.

## Развёртывание

1. Выполнить тесты и build.
2. Для существующей базы использовать `supabase/migrations/20261003182938_rules_221_state_engine.sql` через Supabase migration tool. В рабочем проекте эта миграция уже применена; повторять её не нужно.
3. Развернуть Edge Function `campaign-engine` с `verify_jwt=true`, `deno.json` и всеми зависимостями `shared/*.ts`. `node tools/edge-bundle.mjs` готовит локальный пакет файлов в игнорируемом `tmp/`.
4. После проверки backend опубликовать main. GitHub Actions выполняет `npm ci`, тесты и сборку, затем обновляет GitHub Pages.
5. Проверить отсутствие анонимного доступа к состоянию/командам и открытие опубликованного сайта/PDF. Существующая кампания переводится в setup для совместного утверждения Snapshot.

Не откатывать только клиент к 2.1 после инициализации: старые строки заморожены. Для восстановления использовать сохранённый checkpoint/legacy_backup и согласованную миграцию; произвольное повторное применение income недопустимо.

После развёртывания Security Advisor сообщает о двух намеренно доступных RPC (`create_campaign`, `v221_join_campaign`) и двух private-таблицах с RLS без клиентских policies: это deny-by-default, доступ даёт только сервер. Остаётся прежняя настройка Auth: [проверка паролей по базе утечек отключена](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Настройка аккаунтов этим обновлением не менялась.

