# Карточки миссий v2.2

Эти карточки полностью заменяют §19-29 v2.1. Общие Actions/carriers/Assets/arrivals v2.2 обязательны. Пять rounds, cap 50 VP на сторону, ordinary missions: больше VP победа, равенство Draw. Все Action rewards на объекте одноразовые на сторону; изменение tag можно повторять без повторных discovery VP. Named Actions, не перечисленные отдельно, используют стандартный timing v2.2. XP за OPERATE ограничен одним Deed, не каждым Action.

## Воспроизводимые layouts

L = длинная ось, W = короткая: 44x30, 44x44, 60x44 inches. x от 0 до L, y от 0 до W. На квадрате до setup обозначить ось x. По умолчанию Attacker zone y <= d, Defender zone y >= W-d, где d = 7/10/12. Deployment edges - y=0/W. Short-edge deployment, где указано: x<=d и x>=L-d. Назначение Attacker не даёт первый tabletop turn; применить обычное определение first turn. Все координаты - центры markers; interaction/control range 3", если иначе не указано.

g = W-2d. Layout THREE: (0.25L,0.5W), (0.5L,0.5W), (0.75L,0.5W). Layout FOUR: x=0.3L/0.7L, y=0.5W-g/4 и 0.5W+g/4. Layout FIVE: FOUR + centre. Layout SIX: x=0.25L/0.5L/0.75L на тех же двух y линиях. Layout CROSS: centre; (0.25L,0.5W); (0.75L,0.5W); (0.5L,d/2); (0.5L,W-d/2). Triangle: (0.5L,0.5W-g/4), (0.3L,0.5W+g/4), (0.7L,0.5W+g/4).

Home FINAL: Throne (0.5L,W-d/2); четыре nodes на y=W-d-2, x=0.2/0.4/0.6/0.8L. Nodes не являются objectives; Throne становится objective после открытия CLAIM. На 500 Home assaults запрещены базовыми campaign conditions; layout масштабируется для полноты. Short-edge missions с несколькими objects используют x=0.5L, y=0.2/0.4/0.6/0.8W, все outside zones. Terrain mirrored по обоим deployment направлениям: не блокировать подход 3" к marker, оставить по одному INFANTRY ingress с обеих сторон, одинаковое число Obscuring footprints у обеих зон. После расстановки объектов terrain нельзя сдвигать ради армии. Если footprint накрывает marker, положить marker на ground level и согласовать доступ до Muster.

Area OC = сумма актуального OC только моделей, чьи bases within названного радиуса; модель не считается twice на одном объекте. «Unit в зоне» = хотя бы одна model base partly within; wholly требуется только где написано. End-of-Command score в R2-4; в R5 первый player score в конце своей Command, второй player вместо своей Command score в конце своего turn. Это общий final-round compensation для B2/C1/H1/J1/F1. При полном уничтожении стороны battle всё равно разрешить до R5 без новых атак, чтобы завершить movement/hazards/scoring; surrender использует Withdrawal.

## A1. Cut the Shield / K1. Break the Seal

Одинаковая внешняя осада под разными названиями. THREE Shield Nodes/Stasis Seals. Home Breach Assets 3. Defender обычный Home tier; Attacker напротив. BREACH/BREAK active node: отключить, Attacker 10 VP, все три ещё 10. Defender в конце 10 за каждый active node; отдельного Warlord bonus нет. После первого отключения за round все formations в 6" этого node проходят Battle-shock; после второго отключённого node за battle Attacker 1 CP по core limits. Node выключается навсегда, повторный Action недоступен. Attacker victory -> Integrity -1, обычный возврат в Origin. Обе миссии играются полностью до R5.

## A2. The Long Vigil / K2. Command Crypt

Одинаковая внешняя операция. Vault/Command Dais в centre; Relays/Control Spires на (0.25L,0.5W) и (0.75L,0.5W). Home Breach Assets 3. Home Pool Capacity +10 п.п., включая временные 60% -> 70%. В конце каждого round 5 VP за physical OC control centre. HACK/CONTROL side node каждой стороной однажды: 5 VP и 1 Intel после battle; tag обозначает завершённый hack, не заменяет OC. После первого completed hack ATTACKER за battle Defender получает 1 CP; после второго ATTACKER получает один mid-battle Smoke Screen/Field Reserves/Hard Evacuation с legal timing. Если mid-battle R2 CP timing Field Reserves уже прошёл, выбрать его нельзя. После первого за round изменения physical centre control все в 6" test Battle-shock. Winner определяется VP; Attacker victory -> Integrity -1.

## A3. Sever the Vigil / K3. The Nameless Throne

Layout FINAL, четыре Consoles/Chronal Anchors. Home Breach Assets 3. DISABLE/DESTROY active node: Attacker 5 VP. После двух отключённых nodes открывается CLAIM Throne, 20 VP однажды. После каждого disable Defender выбирает свой formation в 6" Throne: +2 total OC до конца round, максимум +1/model, не складывается сам с собой. В ОБЕИХ миссиях после четвёртого disable Defender теряет неиспользованный Defensive Asset, а до конца battle обе стороны не используют Infiltration Route, Emergency Coordinates, Contingency Orders, Anchor Fragment и Relentless Track. Ordinary Normal Move/Charge/arrival и official abilities разрешены. Формулы и ограничения A3/K3 одинаковы; Consoles/Anchors и Throne сохраняют фракционные названия.

Defender в конце получает 5 VP за каждый active node и 20, если CLAIM не выполнен. Главный outcome: Attacker victory ТОЛЬКО при завершённом CLAIM и physical control Throne в конце R5; иначе Defender victory. VP сохраняются для лога, не обходят gate. CLAIM не ускоряется Honours, разрешён только с R3, и не завершается немедленно в Movement. Throne contest не отменяет record CLAIM, но не позволяет выиграть до нового physical control. Attacker victory при Integrity 1 -> 0 и обычный ending.

## B1. Reliquary Hunt

FIVE переносимых Reliquaries. PICK UP, carrier -1" Move. DELIVER в свою zone: 8 VP; central 13. Undelivered предмет у живого carrier в конце: 5 VP, central 10; не складывать с delivery. Первый pickup centre за battle: D6 1-2 carrier Battle-shocked, 3-6 его сторона +1 Intel aftermath. Первый picker записывается, повторного roll нет. Winner даёт +1 XP одному своему component, успешно PICK UP, сверх обычного Deed. Каждую вещь доставляют один раз всего, после delivery удаляется.

## B2. Bone Choir

CROSS objectives. В scoring Command R2-5: 3 VP за >=1 controlled objective, +3 если больше opponent, +2 за centre, максимум 8 за step. В начале round D6: 1-2 все в 6" centre Battle-shock; 3-4 ничего; 5-6 formation в centre range +2 total OC до конца round, max +1/model. При провале такого test на natural total 2 Choir +1 aftermath, общий cap один increment за battle. Natural 2 не меняется modifiers.

## B3. Procession of the Dead

Procession marker (0,W/2), путь по x к (L,W/2), длинные deployment edges. В конце round СНАЧАЛА marker движется 9/9/12" на 44x30/44x44/60x44, остановиться точно у exit; ПОТОМ Area OC в 6": большему 7 VP, tie 0. В round первого exit тому же winner Area OC дополнительно 15 VP однажды. Marker остаётся у exit, повторного arrival bonus нет. Formation partly в 3" получает Cover и -1 Advance roll пока там. Объект не перевозит модели. Winner +15 Supply aftermath.

## C1. Falling Sky

CROSS с индексами: centre=1, x-left=2, x-right=3, attacker rear=4, defender rear=5. Command R2-5: 5 VP если controlled objectives больше enemy, +3 за centre. В начале round два D5 (D6 reroll 6); duplicate второго перебрасывать, но если первые два совпали, formations в 4" этого marker один раз на 4+ D3 mortal wounds. Два итоговых unique markers дают Debris Rough Ground 4" до конца round. Уничтоженный VEHICLE получает -1 Casualty только если последние wounds потерял от этой Debris explosion, а не за любую гибель в секторе.

## C2. Counterweight

Platform centre, extraction edges y=0/W. В конце своего Movement при большем Area OC в 3" передвинуть platform до 6" прямо к своей edge. Для каждого round отметить, контролировал ли player Platform в этот момент; в конце round +5 VP qualifying стороне, даже если opponent позже тоже контролировал, cap 50. Первое касание edge: 25 VP извлекшей стороне, platform удаляется, никаких дальнейших Platform VP. В extraction round +5 control ещё начисляется. Пока Platform есть, formations в 3" получают Cover против attack издалека >18" по model distances. Winner +20 Supply. Уже сделанные действия не перевозят модели вместе с marker.

## C3. Zero-G Breach

Short-edge deployment. Четыре objectives x=L/2, y=0.2/0.4/0.6/0.8W; центральная полоса x в [L/2-4,L/2+4]. End round 4 VP за controlled objective, cap 12; +2 VP за enemy persistent unit, чья последняя model уничтожена в полосе, cap 4 за round. INFANTRY/JUMP PACK +1" Move и +1 Advance; Charge с natural total >8 distance -1, minimum0, до выбора legal charge move. Не менять natural result. Winner Airlift Window до конца следующей своей Activation: первая Orbital Lift attack не стоит Intel; Origin/adjacency/Home restrictions сохраняются.

## D1. Vat Breach

THREE Vats. Attacker OVERLOAD active Vat: отключить, 10 VP; все три ещё 10. Defender 10 за intact Vat в конце. После OVERLOAD вокруг marker Toxic area radius5. В конце СВОЕГО turn formation partly в одной/нескольких Toxic areas на 4+ D3 mortal wounds, максимум одна такая проверка за turn. Уничтоженный этим hazard component -1 Casualty. Overlap не множит checks; другие причины гибели в области штрафа не дают.

## D2. Harvest Line

FOUR Caskets. PICK UP, DELIVER к своей edge в 3": 10 VP; удержать до конца 5; DESTROY ground casket: 5 VP и удалить. Переносимый enemy casket не DESTROY; можно сначала уничтожить carrier и подобрать ground item. При первом завершённом PICK UP ИЛИ DESTROY каждого casket D6: 1 bearer Battle-shocked, 2-5 ничего, 6 +10 Supply его стороне. Второго opening reward нет. Winner +25 Supply либо free1 Damage recovery своему участвовавшему component.

## D3. Red Conveyor

Три полосы x=0.25L/0.5L/0.75L, width4 по x и от y=d до W-d; conveyor direction для каждой заранее +y. Objective в centre каждой. Начало round: второй player затем первый выбирают eligible formations с моделью на strip. Каждому разрешён один Normal Move до 3" вдоль +y или -y с обычной terrain/Engagement legality, без Advance/Charge. Engaged не move и не получает hazard за невозможность. Добровольно отказаться при legal move: D6 1 ->1 mortal wound. Нельзя одним unit использовать две полосы. End round centre5 VP, flank3 каждый. Aftermath D66 три rolls вместо двух D; winner выбирает один, Draw defender. Re-roll window заменяет весь выбранный result обычным одним D66, как в v2.1.

## E1. Armoured Train

Train path/movement B3, range3. После движения в конце round Area OC winner6 VP; при первом exit ещё 10. BOARD action в 3" Train даёт 4 VP один раз на игровую formation, максимум 12 на сторону; attached components не дают нескольких BOARD. Во время каждого move formation, впервые пересекающая track x-axis y=W/2, D6: 1 сокращает разрешённую дистанцию на 2", minimum0. Проверить до crossing; можно остановиться перед линией, никогда не ставить unit нелегально. Один такой roll за unit за round. Train не terrain/transport. Winner +25 Supply.

## E2. Break the Rails

FIVE Rail Junctions. Attacker DEMOLISH intact Junction8 VP; Defender8 за intact в конце. Отключённый marker не objective; оставить Rough Ground radius3. При >=3 demolitions в начале R5 Ash Storm: атакующая модель не выбирает ranged target model дальше 24", в unit attacks использовать обычную core target legality. Это не расстояние между markers/центрами units. Attacker win -> E Exhausted counter2 после capture.

## E3. Black Freight

SIX Cargo. SEARCH удалить Cargo и D6:1 D3 mortal wounds bearer, 2-4 5 VP,5 8 VP,6 8 VP и 10 Supply. Reward после completed Action не отменяется его explosion. После третьего SEARCH суммарно обеих сторон оставшиеся volatile. ЛЮБАЯ сторона может DESTROY CARGO ground volatile: удалить без VP/Supply; все formations в 3" на 4+ D3 mortal wounds каждая. Neutral Cargo не имеет enemy owner. Каждая сторона сохраняет заработанный Supply независимо от outcome.

## F1. Kill the Signal

THREE objectives. Command R2-5: 3 VP за controlled Relay, cap 9. HACK: первый своего player на каждом Relay5 VP и own tag; потом reclaim enemy tag без новых 5. Пока formation в 3" own-tag marker, +2 total OC, максимум+1/model; несколько Relays не складываются. Own-tag HACK не запускается. Winner +1 Intel. Physical OC control и tag различаются.

## F2. Ghost Frequency

FIVE Signals с индексами 1-5. Никто заранее не знает true marker. На первом SCAN unrevealed marker пусть n = число unrevealed: бросить равномерный Dn (D6 reroll значения>n);1 = true, остальные false. При n=1 true автоматически. После true все остальные false. Это эквивалентно одному равномерно скрытому transmitter без ведущего; порядок scans не даёт тайного знания. Сам выбор marker фиксируется до Dn, Tactical Relay не меняет этот roll.

Первый global reveal false3 VP обнаружившему player; true10 VP, он становится objective. Повторные scans revealed marker недоступны, второй player discovery VP не получает. End round physical control true5 VP. True-discoverer test Battle-shock, fail ->Choir+1 один раз aftermath. Winner free Recon Lock в своей следующей tabletop battle, expiry конец следующей своей Activation; выбрать применение до commitments. Ни одна сторона не получает >1 discovery reward с одного marker.

## F3. Last Transmission

THREE: centre Array, flank Power Nodes. Attacker HACK каждую 5 VP. После >=1 hack UPLOAD Array25 VP один раз. Defender5 VP за каждый round, который закончился БЕЗ ранее completed Upload; после completion в этом же round нет passive5. В конце если Upload не было, ещё 15. Первый disrupted UPLOAD за battle вызывает Battle-shock всем в 6" Array. Mission Experts не отменяет HACK gate, Field Engineers может требовать physical control но не переносит Upload на следующий enemy turn. Attacker capture ->F Relay Disruption до конца следующей своей Activation; это отдельное state, не Sabotaged.

## G1. Pilgrimage into Glass

CROSS, centre Altar. End round flank objectives2 VP каждый, centre6. COMMUNE доступен с R3, начинается стандартно, завершается в конце round при сохранённой Action eligibility и physical control Altar. Если обе стороны завершали, больший Area OC в 3" определяет единственного completer; tie обе попытки провалены. За battle один global COMMUNE8 VP и Choir+1. В начале round D6:1-2 formations в 6" Altar -1 Battle-shock tests;3-4 ничего;5-6 +2 total OC каждой такой formation до конца round. Winner random Relic либо 1 Intel. Благодаря end-round completion первый turn не выдаёт награду без ответа.

## G2. Beneath the Altar

Triangle Descent Nodes. CONTROL neutral/enemy Node: own tag, первый такой completion стороны на этом node6 VP. Reclaim меняет tag без 6; own-tag Action запрещён. End round >=2 tags6 VP; первый round со всеми 3 tags ещё 10 однажды. Первый completed Action round вызывает Shear: opponent выбирает eligible acting-side formation в 3" этого node;4+ D3 mortal wounds; при отсутствии такой формации эффекта нет. Choir+1 aftermath. Node tag не требует непрерывного OC, но Action требует legal actor.

## G3. The Black Choir

CROSS, centre Altar, Choir area9. End round 3 VP за controlled objective, cap 9. LISTEN Altar5 VP, максимум два completions на сторону за battle, не больше одного за round. Pulse начало R1:все -1Advance;R2:первый failed save каждого player можно reroll;R3:все в 9" Altar Battle-shock;R4:в 9" нет Cover;R5:в 9" +2 total OC formation. Choir+2 aftermath; обычный повторный G battle increment применяется дополнительно, общий track cap 8. Crisis phase и Choir track не взаимозаменяемы.

## H1. Mirror March

CROSS, после deployment sealed выбрать один INFANTRY Decoy каждой стороны. Command R2-5: >=2controlled objectives5 VP, больше opponent ещё 5. Первый раз Decoy targeted ranged attack из>12", AFTER всех attacks стрелявшего enemy unit он может Normal Move до 3", оставаясь legal и вне Engagement. Пока весь enemy unit не закончил, targets и модели не переставлять. Winner 1 Intel.

## H2. Buried in Glass

FIVE Fractures. SHATTER удалить, D6:1 0 VP и D3mortal wounds;2-3 5 VP;4-5 7 VP;6 10 VP и 10 Supply. Максимум один SHATTER на player за round. Central Fracture можно SHATTER только с R3; четыре outer доступны сначала. После каждого Rough Ground radius3. Две natural6 одного player за battle ->Choir+1 aftermath, globalcap1. Central timing оставляет обоим шанс подготовиться к пятому объекту.

## H3. Heat Death

Safe circle centre radius18, board intersection считается частью зоны. End round Area OC больше в 6" centre5 VP; enemy unit killed wholly outside текущей Safe Zone в этом round +2 VP, cap 4. ВR5 каждый отдельно+10 VP за своего Warlord wholly внутри текущей зоны. Затем shrink radius-3 и hazard: unit wholly вне НОВОЙ зоны D6 1-2 D3mortal wounds; VEHICLE/MONSTER только 1. Последнее уничтожение считать по последней модели и её zone position; после hazard новые killVP относятся к текущему round и добавляются перед final winner, но не вызывают повторный main scoring. Нет отдельного reward.

## I1. Awakening Pits

FIVE, outer Awakening Nodes, centre обычный objective. CONTROL neutral/enemy Node5 VP первый completion на player/node и own tag. Reclaim без 5, own-tag запрещён. End round 2 VP за own tag и 4 за physical control centre. Первый global capture каждого Node D6:1 actor Battle-shocked;6 actor+1XP aftermath, не повторяется. Necron winner free1 Damage recovery eligible participating CANOPTEK/INFANTRY; Deathwatch winner1 Intel. Бонусы не выдаются обоим при Draw.

## I2. Tomb Street

Три lanes x=[0,L/3),[L/3,2L/3),[2L/3,L], длина y0-W. Objectives centre каждого. End round 5 VP за lane, если controlled objective и хотя бы одна own model wholly за midfield y=W/2 в enemy half того же lane, cap 15. Formation может выполнить presence в нескольких lanes разными моделями; одна model считается только в своей lane. Первая уничтоженная formation на lane оставляет area radius3 у последней model. Это non-Obscuring Rubble: Rough Ground, модели partly within получают Cover; marker за спиной не даёт абстрактного LoS Cover. Winner 15 Supply.

## I3. Name of the Dead

THREE Obelisks. SCAN каждой стороной каждого один раз 8 VP; все три ещё 10. End round R3-5 centre Obelisk physical control2 VP. При completed SCAN D6:1-2 actor formation -1 Battle-shock до конца battle;6 его стороне 1 Intel aftermath. Каждый, SCAN все 3, получает 1Fragment до cap 3; общий Choir+1 maximum. Scans обеим доступны: мирное исследование возможно, но control bonus даёт предмет спора. Поздний кризис сохраняет этот выбор.

## J1. Assembly Line

FOUR Fabricators. Command R2-5 по 3 VP за controlled active Fabricator, cap 9. SHUTDOWN active Fabricator5 VP completer и permanently offline для обеих сторон, один global use. Первый completed Shutdown за round D6:1 все formations в 3" D3mortal wounds. Offline marker больше не target Actions/control VP. Winner 20 Supply либо free Recovery Cache v2.2.

## J2. Machine Hunger

FOUR Scrap, Mouth centre. Требование 9" от zones удалено; позиции FOUR остаются outside обеих zones на всех размерах. Ground Scrap в конце round до scoring движется 4" прямо к Mouth; достигнув 1" Mouth удаляется без rewards. PICK UP в 1", carrier -1"Move. DELIVER у своей edge8 VP; FEED в 3"Mouth5 VP и 5 Supply. Оба стандартный Action с carrier, удалить item при completion. Carrier не может отнести item одновременно в обе системы. Каждый сохраняет FEED Supply. Ground scraps следуют Moving Object rules, carried не двигаются отдельно.

## J3. Kill Switch

THREE Safety Nodes, Reactor точно centre; central Safety Node сдвинуть на (0.5L,0.5W-g/4), чтобы не совпадал с Reactor. OVERRIDE Node6 VP первый на player/node; tag не требуется. После двух своих unique overrides ARM Reactor12 VP один раз на player и Armed tag стороны. DISARM enemy/own Armed Reactor8 VP один раз на player и Unarmed; нельзя DISARM уже Unarmed. Повтор ARM/DISARM только state, без VP.

EndR5: завершить Actions; если Armed, добавить 10 VP последнему ARM owner; затем explosion: все formations в 9" уничтожены, casualty-1; после этого определить final VP/outcome с учётом уже earned mission points, casualty XP отдельно. Explosion не начисляет HUNT или повторные VP за уничтожение. J Exhausted+Sabotaged после aftermath независимо от winner. Withdrawal не снимает Armed автоматически.

## Общие reward и crisis overlays

Winner rewards выдаются только реальному winner, Draw никто, если карточка не говорит each player. Final Home/crisis campaign stop отменяет обычный Supply/Salvage/D66 pipeline. Crisis auxiliary objectives не дают дополнительные VP в Home finales; mandatory CLAIM сохраняется. Crisis final cards полностью заменяют ordinary sector mission и не используют G mission rewards, local Pool или Home tier. Для остальных кризисных battles применяется явно описанный overlay, а не случайная четвёртая sector mission.
