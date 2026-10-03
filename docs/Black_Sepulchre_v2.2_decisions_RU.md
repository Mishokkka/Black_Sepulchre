# Решения v2.2 и связь с ревью

Дата 03.10.2026. Это пояснения автора, не дополнительные игровые правила. Нормативный текст - amendments, missions и crisis v2.2. Все решения владельца применены к тексту; production app/DB остаётся отдельной реализацией.

## Выборы, для которых запрошены предложения

**G.** Принят вариант убрать G-B, G-C, G-I, G-J. Он симметричен, убирает прямой выход из собора к внешнему поясу обеих крепостей и оставляет четыре фронтовых подхода. A-K: было 4 links, стало 5; обходы по флангам остаются 5. Альтернатива «только запрет Forced March через G» оставляет supply shortcut и обычные 2-MP обходы. Альтернатива «каждый вход в G стоит 2 MP» уменьшает мобильность, но не исправляет shortcut supply и делает исключения для Raid/Lift сложнее. Предпочтена одна общая карта без разных связей для движения/снабжения.

**F16, осадная подготовка.** Приняты Sabotage -10 Capacity/+1 first arrival (не stacks с Exhausted/Unsupplied) и Siege Recon за 2 Intel: один дополнительный Breach Asset. Это даёт два разных инструмента без изменения сохранённых baseline Initial/Capacity. Capture G/Fragments открывает осаду, Sabotage задерживает защиту, Recon даёт выбор способа прорыва. Возможный более жёсткий вариант Initial -10% от Sabotage пока не введён: это уже изменение самой силы обороны F18, которую владелец оставил для playtest.

**F21, гарнизонная экономика.** Принят предсказуемый Local Supply: 25 после боя в выбранный supplied non-Home сектор, cap 10% AL. В начале симметричные 50 на внешнем домашнем поясе каждой стороны. Удалённая requisition покупает один Core Garrison unit за Window; Local Commission защищает систему от бесплатного пополнения Field Roster. После 8 battles это до 250 локального бюджета на сторону вместе со стартом, если удалось не переполнить cap/не потерять накопления. Общий Supply и скорость роста Field остаются прежними.

Случайный unit не введён: бросок мог выдавать двум фракциям несопоставимую стоимость и модель, которой нет в коллекции. Альтернатива для более случайного narrative режима - событие выдаёт voucher с фиксированным бюджетом 50 Local Supply, player сам выбирает legal unit; для основной версии это ещё один источник дохода, поэтому пока не добавлен поверх регулярных 25. Комбинация регулярного запаса и редких vouchers возможна после проверки, без нового третьего roster.

**F13, кризис.** The Last Canticle использует уже существующую mnemonic engine. Раскрытие 12/14/16, подготовка 17, finale18. Competitive победа через control engine; Cooperative через три двусторонние печати и два безопасных канала. Два PACT до Muster дают совместную победу; иначе PvP. Никакого обязательного примирения или внезапного предательства после выбора half-size армии. Главный новый счётчик - battle count, который уже есть; Instability нужен только на один cooperative tabletop.

## Покрытие замечаний

| ID | Принятое решение | Где |
| --- | --- | --- |
| F01 | Mobilise/Scavenge общий Supply flag, Scavenge только работающий supplied J | amendments §3 |
| F02 | Один обычный recovery step + один Overhaul за Window на ID | amendments §3,7 |
| F03 | Home стартовые 3 Breach Assets, одинаковые в шести cards | amendments §6, missions A/K |
| F04 | Отступают все сохранённые persistent records, не только table survivors | amendments §5 |
| F05 | Defence Available, unavailable defence не требует пустого боя | amendments §1,5 |
| F06 | Полная процедура edge/Deep Strike/package/slot/participation | amendments §5 |
| F07 | Discovery rewards одноразовые; own-tag Actions запрещены | amendments §12, missions F2/G2/I1 |
| F08 | Deferred uniform discovery 1/n, без знающего ведущего | missions F2 |
| F09 | Convoy 9/9/12 и explicit movement-before-score; legal J2 FOUR | missions B3/E1/J2 |
| F10 | CLAIM+контроль Throne mandatory endR5, VP не substitute | amendments §6, missions A3/K3 |
| F11 | Монотонная Casualty, raw snapshot и полный rollback | amendments §7 |
| F12 | Leadership знак, Charge procedure, Explosives, Rough Ground | amendments §1,11,12 |
| F13 | Обязательный staged crisis и Contact Clock | crisis |
| F14 | СОХРАНЕНО: четыре non-assault battles на 1500+, waive до следующей осады | v2.1 §17 |
| F15 | Без upkeep/налога; награда участвующему местному защитнику | amendments §2 |
| F16 | Sabotage влияет на волны, Intel-funded Siege Recon | amendments §3 |
| F17 | Запрет ремонта freshly Exhausted в ту же Activation, Atrocity local | amendments §3 |
| F18 | СОХРАНЕНЫ baseline50/75/100/100 и 25/35/50/75 | amendments §5 |
| F19 | Assets по tier без binary Poolgate, duplicate запрещены | amendments §6 |
| F20 | Парные A/K одинаковые geometry, budgets, scoring/gates | missions A1/K1,A2/K2,A3/K3 |
| F21 | Local Defence Supply и Commission | amendments §4 |
| F22 | Cache 20, voucher до 30 одного recoverystep | amendments §9 |
| F23 | Medicae15, permanent25-30, Ward шире; scope явный | amendments §7,9,10 |
| F24 | Rehab20%3+,failprogress; Deep35% guaranteed; Redemption | amendments §7 |
| F25 | Resources+fieldavailability, сохраняется winner bonus | amendments §4 |
| F26 | Pending/inactiveHonours, новые pointCR, обязательный Majorcap | amendments §8 |
| F27 | Переписаны Specialists, нет turn-long задержки, finalCORE защищены | amendments §8 |
| F28 | Replacement24Scars, фактические tradeoffs и Redemption | amendments §11 |
| F29 | Casualty5 без Damage, MauledShattered4/6, risk показан | amendments §7 |
| F30 | Bearer-onlydefault, formation tax пообщему RC | amendments §10 |
| F31 | Commitmentvalidation до reveal, deletion-onlyrepair; reroll один | amendments §2,12 |
| F32 | Logistics пофизическому Force/sector, Rest и Windowtiming | amendments §4,7,15 |
| F33 | Carrier один, bearerID, DROP, delivery, transport/reserve запрет | amendments §12 |
| F34 | Timing/expiry, Relicstorage, D66eligibility и duplicates | amendments §1,9,13 |
| F35 | Automaticwithdrawaldeadline, обеэвакуациии doubleDraw | amendments §13 |
| F36 | Size один increase/Stage, no split/merge, snapshotmigration, Epic limits | amendments §12 |
| F37 | Choircap8, forcedIV=8, FEED по RevealIV | amendments §14 |

## Что проверить в партиях

Первая серия: поменяться Attacker/Defender в A1/K1 и A2/K2, одна Stage, одинаковые layouts/terrain, записать реально вошедший Pool и rounds. Не менять F18 одновременно с новыми Assets/Sabotage: иначе нельзя понять источник результата.

Вторая: Local Supply на 500-1000, сколько Field роста остаётся после recovery; какие units покупаются локально, сколько deployments стоят без участия. Проверить, что Local Commission не превратился в бесплатные Field units.

Третья: Specialists в F3 и A3/K3, Attached цены, inactive Honours. Проверить комбинации rank+Armoury+Relic, а не только каждый эффект отдельно.

Четвёртая: один standalone Cooperative Finale с 1000+1000, затем competitive2000+2000. Измерить turns до keys/Prime, Suppression use и last Pulse losses. Цифры кризиса спроектированы и математически проверены; tabletop winrate ещё не измерен. Слишком лёгкий cooperative проход корректировать максимумом completedkeys или Pulse, не увеличением всем casualtytax.

Переход production app требует серверных flags, Local Supply/Commission, новой CR модели, available/arrival validation, mission records и crisis modes. Эти документы не утверждают automation parity. Играть v2.2 до implementation можно с отдельным согласованным ручным ledger.
