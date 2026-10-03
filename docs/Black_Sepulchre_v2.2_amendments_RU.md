# THE BLACK SEPULCHRE v2.2

## Нормативные изменения и порядок применения

Редакция 03.10.2026. Подготовлена по решениям владельца после ревью v2.1. Это полное дополнение к v2.1, а не самостоятельный базовый учебник: неизменённые правила, Season Snapshot, стартовые силы, официальные datasheets и таблицы событий берутся из v2.1. В PDF настоящие изменения, новые карточки всех 33 миссий и кризис помещены перед исходным документом v2.1. Для игры достаточно этого одного PDF.

Приоритет для кампании v2.2: кризисные исключения, прямо названные для текущей battle -> конкретная карточка миссии v2.2 -> общие настоящие изменения -> неизменённый текст v2.1 -> официальные правила выбранного Season Snapshot. Конкретное прямо указанное исключение имеет приоритет над общим правилом. Кризис не отменяет обязательный CLAIM обычного Stronghold finale. Старые формулировки по вопросам, заново определённым здесь, не применяются.

Изменены F01-F13, F15-F17, F19-F37. Условия War of Attrition (F14) и базовые Initial/Capacity (F18) сохранены. Показатели CR ниже заменяют процентные надбавки Honours/Armoury/Relics из v2.1; проценты стоимости лечения остаются процентами RC. Optional STF остаётся модулем по обоюдному согласию, выключенным по умолчанию.

### 1. Общая точность процедур

Сторона = Deathwatch или Necrons. Unit без уточнения = игровое подразделение; persistent component = отдельная запись Character, Support или Bodyguard. Уничтожение на столе не означает удаление из кампании. Available = legal для текущей battle, Damage не выше 2, нет Displaced, неоплаченной Evacuation или Out of Action для этой relevant battle. Запись, объявленная Resting, остаётся legal, но исключается из commitment.

Каждый одноразовый эффект хранит owner, target, источник, момент выдачи, точный expiry и used flag. Эффекты «следующая battle» применяются к следующей tabletop battle владельца независимо от сектора, если написано иначе - к следующей battle названного Force/гарнизона/сектора. Expiry «до следующей собственной Activation» означает до её окончания. Повторная выдача одного именованного эффекта продлевает срок до более позднего expiry, но не создаёт вторую копию. Неименованные разовые Supply/Intel rewards складываются.

Внутри одной фазы: закончить текущую атаку/действие -> применить его последствия -> обязательные проверки -> реакции -> следующие действия. В конце battle round: завершить ожидающие Actions -> движение mission objects -> scoring и бонус прибытия -> environmental hazards -> последствия уничтожения. Правило миссии может явно заменить этот порядок. Одновременные эффекты выбирает и разрешает сначала player, чей turn; вне turn первым действует player, ходивший вторым в этом round. Это не меняет заранее заявленные цели.

Battle-shock bonus записывается как +1 к броску теста; штраф как -1 к броску. Ухудшение характеристики Leadership записывается +1 Leadership. Применяются официальные пределы модификаторов и получения CP. Термин JUMP означает JUMP PACK выбранного snapshot. Старые ссылки Ammunition Debt на Grenades Stratagem заменены ниже; используется текущая процедура Explosives, если она есть в snapshot.

### 2. Карта, движение и объявления

Канонические связи v2.2: A: B,C; B: A,D; C: A,E; D: B,F,G; E: C,H,G; F: D,I,G; G: D,E,F,H; H: E,J,G; I: F,K; J: H,K; K: I,J. Связи всегда двусторонние. Supply, Deep Raid, Lift и Hidden Routes используют эту же карту. Отдельных скрытых supply-only связей нет. Расстояние A-K теперь минимум пять links; G остаётся центральным узлом с четырьмя подходами.

После объявления hostile target фиксируются target, Origin, способ входа и расходы маршрута. Recon pre-roll относится только к этой атаке. После pre-roll отмена/смена target запрещена; отсутствие ресурсов для legal assault проверяется до объявления. Можно заранее бесплатно проверить легальность. Атака Home по Deep Raid/Lift не обходит условие физического присутствия в непосредственно adjacent секторе. Кризисный Forced Encounter ниже является отдельным исключением.

Raid - необязательный режим обычной атаки non-Home, заявляется вместе с target до mission roll. Бой и награды обычные; при победе ownership не меняется, target получает Sabotaged, Attacker возвращается в Origin. Дополнительного дохода за Raid нет. При поражении/Draw обычный отход; Raid не занимает Fortress Integrity и не является Stronghold Assault для War of Attrition.

Владение по-прежнему даёт действующие sector bonuses без платы за удержание и без требования покупать гарнизон. Чтобы присутствие было заметно, после победы в обороне controlled сектора один действительно участвовавший local garrison component получает 10 Recovery Supply, закреплённого за этой записью. Оно расходуется только на её paid recovery, максимум накопления 20; при transfer сохраняется, при удалении пропадает. Это награда за защиту, не налог на пустую территорию.

### 3. Resource Window, Exhausted и Sabotage

Window существует отдельно для каждой стороны; начинается в начале кампании и заново после любой завершённой tabletop battle. Occupation, перемещение, Repair Network, Stage transition сами по себе его не обновляют. В одном Window: один стратегический доход Supply; один Recon-like доход Intel; один обычный paid recovery step на persistent component; один дополнительный Overhaul step; одна remote local requisition. Unit, сменивший roster/location, сохраняет использованные флаги.

Supply flag общий для Mobilise и Scavenge. Получение денег через любой из них закрывает его, даже если Scavenge дал 0. Mobilise: действующие 10% Army Limit, не в Home. Scavenge в J: 1 Action, current controlled supplied J с работающим бонусом; D6 1: 0, 2-3: 15, 4-5: 25, 6: 40. При Exhausted, Sabotaged, Disrupted или Contested Scavenge недоступен. Явно разрешённый event Scavenge использует тот же Supply flag, если событие не называет его one-shot reward. Изменение этой таблицы не меняет base battle income.

Recon и Investigate Choir используют общий Intel flag для мягко ограниченного strategic Intel. Сам Action/pre-roll/расследование разрешены при закрытом flag, но новый Recon-like Intel не выдаётся. Уничтожение unit и одноразовые rewards не открывают flags. Секторные timing caps дополнительно действуют.

Exhausted counter 2 уменьшается в начале последующих собственных Activations. Repair Network нельзя снять Exhausted в той Activation, когда это состояние наложено. В следующую собственную Activation его уже можно ремонтировать. Это правило относится и к Mobilise, и к новым mission/event последствиям. Нельзя обходить его повторным наложением/сменой ownership. Mutual Atrocity выбирает current non-Home сектор выбранной Main Force, а не произвольный безопасный Home.

Sabotage сохраняет цену 1 Intel и 4+, либо 2 Intel автоматически; Counter-Sabotage 1 Intel до броска/подтверждения автоматического успеха. Sabotaged выключает sector bonus и Defensive Asset Fortified; Capacity -10 процентных пунктов и первое garrison arrival +1 round. С Unsupplied/Exhausted эти Capacity/arrival штрафы не складываются: применяется один -10/+1. Initial не уменьшается. Home можно Sabotage; его самостоятельное снабжение остаётся. После первой tabletop battle здесь старый Sabotaged снимается, затем новые mission/event states накладываются заново.

Siege Recon - 1 Action и 2 Intel в current supplied секторе непосредственно adjacent enemy Home. Один раз за Window можно записать Breach Plan для этого Home. План даёт один дополнительный Breach Asset на следующую вашу объявленную осаду этого Home; истекает в конце следующей собственной Activation. Максимум один plan на сторону, не складывается с другим plan. Если осада не состоялась, Supply/Intel не возвращаются. План не открывает доступ к Home сам по себе. Capture G, Secret Fragments и War of Attrition остаются способами открыть доступ; Sabotage и Siege Recon определяют подготовку уже доступной осады.

### 4. Logistics, местный Supply и catch-up

Base +100 каждому, winner +20, draw +10 каждому и Stage Grant +100 каждому остаются. В обычном aftermath покупки/обычное paid recovery для Field roster требуют, чтобы именно его Force находилась в controlled supplied секторе. Участвовавший Defender имеет такую же aftermath Logistics; ему не требуется «закончить чужую Activation». Local garrison обслуживается только в своём controlled supplied секторе, при присутствии Main Force либо через явно разрешённый местный запас. Бонусы A/D/I/K действуют на обслуживаемые записи физически в этом секторе. Дистанционное владение D не удешевляет лечение в другом месте.

Local Defence Supply - отдельная сумма в секторе, принадлежащая текущему владельцу. В начале кампании B,C получают по 25 Deathwatch Local Supply; I,J по 25 Necron Local Supply; прочие 0. После каждой non-final tabletop battle каждая сторона направляет 25 Local Supply в один controlled supplied non-Home сектор. Неиспользованный award пропадает, его нельзя забрать в общий Supply. Лимит накопления в секторе = округлённые вверх до 5 10% текущего Army Limit; излишек award пропадает. При росте Stage cap растёт; при snapshot migration уже имеющийся излишек остаётся, новые deposits нельзя делать выше cap. При потере сектора весь старый местный запас пропадает; победитель начинает с 0. Occupation, Unmanned Assault и strategic Actions не создают deposits.

Один раз за Window в собственной Logistics можно дистанционно купить один Local Defence unit в любом своём supplied non-Home секторе, где нет Exhausted, Sabotaged, Disrupted или Contested. Forced March запрещает такую requisition в этой Activation. Покупка полностью из Local Supply, без удалённого дополнения из общего кошелька. Допустим non-Epic, non-CHARACTER, non-VEHICLE/MONSTER/TRANSPORT Core Garrison unit с RC не выше 20% Army Limit. Допустимость datasheet/size и текущие discounts проверяются как обычная покупка. При присутствии Main Force разрешены дополнительные местные покупки, но сохраняются ordinary purchase restrictions и доступный запас; remote flag не создаёт деньги.

У купленной записи Local Commission: она участвует как обычный persistent garrison, получает XP/Damage/Honours, отступает как другие и занимает те же Initial/Capacity. Она не переводится в Field/STF и не возвращает общий Supply при Disband. В supplied секторе при Main Force можно выкупить Commission за полный текущий RC из общего Supply; после этого запись обычная. XP сохраняется. Доплатить лишь разницу запрещено. Это не бесплатный пополняемый пул и не новые модели, выбранные случайной таблицей.

Recovery Supply и Local Supply не обмениваются друг на друга. Recovery Supply оплачивает только лечение, Local Supply - покупку Local Defence units. Новые расходы Fortify/Armoury/Doctrine не оплачиваются местным запасом.

Каждые четыре battles записать Resources = общий Supply + Local Supply + сумма RC всех persistent units - сумма стоимости восстановления их Damage обычными шагами 15% с минимумом 10 - Evacuation debts, минимум 0. Для оценки отдельно записать максимальный legal available Field Deployment Effective обеих Main Forces, ограниченный Army Limit, без local Pool и Underdog.

Catch-up включается для стороны, которая на двух последовательных check имеет Resources минимум на 250 меньше и available Field Deployment минимум на 10% Army Limit меньше соперника. На следующие четыре non-final battles она получает по 25 Recovery Supply, общий cap такого кошелька 100. Новый check заменяет режим; одной победой помощь не выключается. Winner bonus обеим сторонам сохраняется. Это ориентир для автоматического catch-up, не измерение faction power. Territory gap Recon сохраняется, но расходует Intel flag. Automatic Fortified Capacity reduction и automatic Mobilise increase из старой §34 удалены: числа F18 меняются только совместным решением после партий.

### 5. Гарнизоны, пустая оборона и подкрепления

Initial/Capacity сохранены: Ordinary 50%/25%, Node 75%/35%, Fortified 100%/50%, Home 100%/75%. Arrival R3/R3/R2/R2, максимум один slot за round, до R5. A2 и K2 имеют одинаковые +10 п.п. Home Capacity; одноразовые 60% после outer breach становятся 70% в этих миссиях. Slot не является дополнительным budget.

Defence Available определяется до Muster: хотя бы один legal available unit из defending Field force или local garrison. Отказ выставить available запись не превращает defence в пустую. При отсутствии такой записи non-Home захватывается Occupation; все остающиеся persistent записи гарнизона отходят по правилам ниже. В Home действует Unmanned Stronghold, включая случай, когда физически присутствующая Main Force не имеет available legal записей. Автоматический assault требует всех обычных условий объявления и отдельной Activation для каждого Integrity step. Он не считается tabletop battle и не двигает кризисный счётчик.

Для standalone garrison battle campaign exception разрешает армейскую сборку без обязательного CHARACTER/Warlord: назначьте Garrison Commander как отметку на одном Initial unit. Она не даёт CHARACTER keyword, Leader ability, Enhancement или official CHARACTER-only benefits. Official detachment prerequisites, действующие исключительно при наличии конкретной модели, не игнорируются. Для Field и Stronghold с Main Force обычная army legality сохраняется.

После Casualty/Critical отступают ВСЕ persistent garrison записи потерянного сектора, не удалённые окончательно, включая уничтоженные на столе, Resting и не вошедший Pool. Все получают один chosen adjacent controlled destination; unavailable статусы сохраняются. Нет legal соседнего destination -> Emergency Evacuate в Home, каждому D6 1-3 +1 Damage. Незаконные для destination категории становятся Displaced. Не вошедший Pool не получает Casualty только за невыход; Emergency Evacuation является отдельным источником Damage.

Garrison arrivals: в конце Reinforcements step своей Movement phase, начиная с указанного round. Один slot = один заранее committed unit; attached components либо transport с полностью заранее declared payload входят одним пакетом, все их Effective Costs оплачены в Pool и одновременно помещаются в оставшуюся Capacity. Payload при входе transport остаётся embarked до следующего своего turn; нельзя использовать пакет для бесплатного немедленного disembark. Если transport/payload были разделены в formations, это отдельные slots.

Default ingress: wholly within 6" собственной deployment battlefield edge и дальше 9" от enemy models. У unit с официальным Deep Strike можно вместо edge использовать его актуальную legal placement. Это campaign arrival exception к core reserve deadline и pre-battle reserve cap; других deployment способностей оно не добавляет. Нет legal placement -> unit остаётся в Pool, slot этого round потерян. Можно добровольно не входить. Suppression Window объявляется в начале Defender Movement, расходует следующий slot этого round; не переносит arrival, которое иначе уже не существовало. В R5 оставшийся Pool не уничтожается.

Participation XP получают persistent components, реально выставленные на поле хотя бы в один момент; embarked payload считается участником, если его transport вошёл с ним. Сам commitment/Resting/не вошедший Pool XP не дают. Уничтожение transport разрешается по core rules, отдельно для его payload.

### 6. Assets и осадная симметрия

Breach Assets определяются защитным tier независимо от размера Pool: Ordinary 0, Node 1, Fortified 2, Home 3. Siege Recon добавляет 1, общий максимум 4. Home число указано также на всех шести карточках. Assets выбираются после reveal и Interdict. Нельзя брать duplicate одного asset в одной стороне одной battle. Interdict запрещает option, не mission-mandated эффект; после запретов всегда legal выбрать меньше доступного количества.

Suppression Window недоступен для выбора, если Pool 0. Остальные Breach Assets v2.1 сохраняются, с единым scope из §10 ниже. Extra asset за hack A2/K2 берётся из mid-battle Tactical list с действующим timing; duplicate уже имеющегося одноимённого asset нельзя. CP reward не обходят core gain limits.

Outer A1/K1 используют одинаковые три nodes, scoring и hazards. A2/K2 одинаковы по budget, трём объектам и timing; faction names различаются. A3/K3 одинаковы по четырём предварительным объектам и требованиям CLAIM. Условие G/Fragments/War of Attrition, порядок двух assaults и возврат в Origin остаются из v2.1. Для финала VP никогда не заменяют CLAIM: Attacker выигрывает только если его CLAIM завершён и к концу R5 он контролирует Throne. Иначе Defender выигрывает, даже если Attacker выше по VP. Дополнительные mission/Relic/crisis VP не обходят это условие. Наличие CLAIM не даёт раннего окончания battle.

### 7. Damage, recovery и пересчёт

Casualty table заменена монотонной: 1 Catastrophic: +2 Damage, Scar; 2 Mauled: +2 Damage; 3 Battered: +1 Damage; 4 Recovery: 0 Damage; 5 Lessons: 0 Damage и +1 XP; 6 Refuse: 0 Damage и +1 XP. Модификаторы и Critical trigger modified raw <=0 сохранены, затем clamp 1-6. +1 больше не превращает безопасный результат в Damage. При entering Damage 2 modifier -1 остаётся: если unit уничтожен без иных modifiers, шанс стать Shattered 4/6. Это риск ротации, а не боевой штраф.

Ordinary Recovery 15% RC, minimum 10; Overhaul второй шаг 25%, minimum 15; Unsupplied Emergency Field Repair 25%, minimum 15. Округлить вверх до 5. На unit за Window максимум один обычный/Field Repair шаг и один Overhaul; Overhaul только Supplied. Free recovery от Rest/mission/event не расходует paid flags, но не позволяет третий paid step. Cache не снимает лимит. После tabletop battle новое окно открывается ДО aftermath Logistics; обычное healing там и в последующих nonbattle Activations используют одно и то же окно. Systemic Failure всё ещё запрещает paid recovery в этом aftermath.

Sector reductions A/D/K действуют один раз в своей текущей Logistics для одной eligible физически присутствующей записи; они не дают новый step. I усиливает объявленный Rest до 2 Damage для одного eligible local unit, Rest по-прежнему разрешён только при entering Damage <=2. Rest resolves до paid recovery. Flag paid healing привязан к записи, не к сектору.

Recovery Crew D66 14: выбрать уничтоженную persistent запись с сохранённым casualty snapshot и повысить её modified RAW casualty total на +1, после чего заново определить Critical и clamp. Полностью заменить пакет первого результата: Damage, casualty XP, Scars, все Critical последствия, Evacuation debt, удаление и Out of Action. Сохранить результат уже сделанного Critical die, если новый outcome всё ещё требует Critical; новый die не бросать. Восстановить Lost запись из snapshot, если Critical больше не требуется. Другие mission XP, довоенное состояние и независимый retreat Damage сохраняются. Для ручной игры сначала записывать raw die, modifiers, pre-casualty Damage/XP/Scars/status; не уничтожать карточку окончательно до D66 Window. Прежний Scar отменяется только если он возник именно из заменяемого результата; новый пакет не снимает старые Scars.

Field Medicae/Repair Node после полного Casualty/Critical package уменьшает полученный в нём Damage на 1, не ниже довоенного Damage. Не отменяет Scar/Critical/Lost. Решение использовать consumable принимается после результата; если не мог предотвратить ни одного Damage, не тратится. Recovery Crew заново вычисляет Medicae по новому пакету; если больше нет Damage для предотвращения, consumable возвращается. Retreat damage и бесплатное последующее лечение пересчитываются после casualty package в своём прежнем порядке.

Rehabilitation: 20% RC, minimum 10, D6 3+ снимает выбранный Scar. При провале этот конкретный Scar получает один Rehab Progress; следующая Rehabilitation на него за те же 20% автоматически успешна. Progress исчезает при снятии Scar/Disband, не передаётся и не складывается. Максимум одна попытка на запись за Window. Deep Reconstruction 35% RC, minimum 20, гарантированно снимает Scar в одной Logistics. Выбор: дешёвая вероятная помощь с задержкой либо гарантированный результат сразу. Redemption двух подходящих Deeds в РАЗНЫХ relevant battles бесплатно снимает один заранее выбранный Scar; объявить цель до первой из них. Максимум один активный Redemption на unit; XP за Deeds обычный.

### 8. XP, активные Honours и цены

Rank thresholds, Participation/Deed/Distinguished и Legendary Bounty сохраняются. Ранг не заставляет выбирать Honour немедленно: слот можно оставить pending. Unit знает полученные Honours; перед battle в sealed commitment отмечаются активные в пределах ранга. Неактивные эффекта и CR не дают. Нельзя менять активный набор после reveal; Recon Lock меняет порядок commit, а не бесплатную возможность нарушить eligibility. До Legendary максимум один активный Major; Legendary максимум два Major в трёх regular slots. Signature только в отдельном Legendary slot.

Campaign surcharge = сумма цен активных Honours, permanent Armoury и Relic. Minor = 5 points; Major = max(10, ROUNDUP_TO_5(RC x 5%)); Signature = max(15, ROUNDUP_TO_5(RC x 10%)). Armoury/Relic tier оплачивается так же. Это flat battle surcharge, не Supply purchase price и не официальный OBC. Одна таблица заменяет все прежние +5/+10/+15% этих категорий. CR отображается как points. Unit, расширенный до нового RC, пересчитывает Major/Signature цену. Награды, прямо рассчитанные на formation, оплачиваются отдельно ниже.

Minor Honours - полный replacement:

| Honour | Эффект |
| --- | --- |
| Hard Lessons | Один раз за battle reroll failed save модели bearer component. |
| Dig In | Пока bearer component в range controlled objective, +1 к Battle-shock test его formation; formation price. |
| Hold Fast | Один раз за battle в начале своей Command: component получает +2 суммарного OC до конца round; распределить по моделям, не более +1 на модель. Не отменяет Battle-shocked OC 0. |
| Kill Confirmed | Один раз за battle reroll один Hit против unit, уже потерявшего wounds/models. |
| Measured Fire | Один ranged profile bearer component игнорирует Cover в одной его Shooting activation за battle. |
| Finisher | Один раз за battle reroll Wound против Below Half-strength unit. |
| Forced March | Один раз за battle заменить Advance die на 6. |
| Pathfinders | Scout 3" только для unattached bearer unit без собственного Scout; не VEHICLE/MONSTER. Для attached всей группе Scout не выдаётся. |
| Pursuit | Один раз за battle reroll Charge всей formation bearer против damaged enemy; formation price вместо обычной Minor. |
| Shock Presence | После одного своего Charge за battle +2 total OC bearer component до конца round, максимум +1/model. |
| Breach Discipline | Один раз за battle проигнорировать campaign Rough Ground/hazard movement penalty для bearer formation; formation price. |
| Take the Ground | После захвата enemy-controlled objective +1 к одному следующему Battle-shock test bearer formation до конца следующей Command. Formation price. |
| Mission Experts | Один раз за battle после успешного обычного Action: до конца round +2 total OC bearer component. Не ускоряет completion и не игнорирует gate. |
| Field Engineers | После своего completed Action один раз оставить Jam marker на объекте до конца следующего round. Первый enemy Action там требует controlled object в момент completion; затем marker снимается. Своих markers на объекте максимум один; задержки на следующий turn нет. |
| Secure and Extract | Один раз за battle начать обычный Action после Advance; unit всё равно не Shoot/Charge. Не разрешает CORE CLAIM/PRIME/OVERRIDE кризиса. |
| Command Presence | CHARACTER: один раз за battle +1 к Battle-shock всей своей formation. Formation price. |
| Contingency Orders | CHARACTER: после первого-turn roll один раз переместить свою formation в legal Strategic Reserves, не меняя roster/Pool/army caps. Formation price. |
| Calculated Risk | CHARACTER: один раз за battle reroll один die собственного formation Advance/Charge. Formation price. |

Major: Last Line один раз при Below Half-strength formation пройти её Battle-shock автоматически, formation price; Extermination Pattern один profile bearer component получает Sustained Hits 1 в одной activation, без stacking; Relentless Track один раз после всех moves одного enemy unit, закончившего Normal Move в 9", bearer formation Normal Move до 3", дальше 6" от всех enemy, formation price; No Step Back один раз автоматически пройти Desperate Escape для formation, formation price; Operational Mastery один раз обычный Action + Shoot с -1 Hit, без Charge и без Crisis final CORE Actions/Stronghold CLAIM; Field Commander CHARACTER один раз после вашего Stratagem на formation на 4+ вернуть 1 CP по core limits.

Signature: Purge Protocol Absolute один раз выбрать XENOS, bearer component reroll по одному Hit и Wound в одной Shooting/Fight activation против него; The Watch Endures один раз после завершения атак уничтожившего enemy unit сохранить одну модель bearer component с 1 wound, component Battle-shocked, без одновременного datasheet death-prevention; Black Spear Veteran один обычный Action + Shoot без Charge, без final CORE Actions/CLAIM; Inevitable один failed save bearer model Damage -> 0, затем bearer formation -1" Move до конца следующего своего turn; Ancient Murder-Logic ОДИН Fight activation за battle один bearer melee profile +1 Attack/model, максимум +5 attacks; Memory of Eternity один failed Battle-shock formation автоматически успешен, formation price, при выживании bearer +1 XP.

Deed of the Stage: перед первым боем Stage выбрать один non-Epic unit и цель HOLD / EXTRACT / OPERATE в двух разных relevant battles. Он не получает нового combat upgrade сверх rank. При выполнении получает narrative title и может занять обычный Distinguished slot этого боя, если eligible. Это заменяет произвольный выбор этого slot, не добавляет второй. Unit с Redemption может использовать те же реальные Deeds; фиктивные friendly Actions вне tabletop не считаются.

### 9. Armoury и Relics

Один Armoury slot и отдельный Relic slot сохранены. Consumables не дают surcharge. Permanent Armoury можно отметить inactive до sealed commit, без эффекта/CR; consumable с закрытым Scar slot использовать нельзя. Все цены Supply ниже заменяют старые.

| Item | Supply | Surcharge | Эффект |
| --- | ---: | --- | --- |
| Field Medicae / Repair Node | 15 | 0 | Один Damage prevention после casualty package, §7. |
| Reinforced Plating | 30 | Minor | Один раз за battle Damage одной атаки по bearer model -1, minimum 1. |
| Tactical Relay | 25 | Minor | Один раз за battle bearer начинает обычный Named Action с interaction range 6" вместо его обычного range. Не CLAIM/CORE, не DELIVER/FEED, не изменение control range и не modifier reward/discovery rolls. |
| Reserve Beacon | 30 | Minor | Один Charge reroll в turn arrival bearer formation; formation price. |
| Recovery Cache | 20 | 0 | Consumable: оплатить до 30 Supply ОДНОГО legal paid recovery step, остаток не сохраняется. Не скидка 50%, не обход Window. Сначала обычные discounts, затем Cache, затем кошельки. |
| Blackglass Ward | 25 | Minor | Один раз reroll любой Battle-shock bearer formation, не только Choir; formation price. |
| Combat Auspex | 25 | Minor | Одна Shooting activation bearer component игнорирует Cover. |

Cache можно купить/использовать только в обычной legal Armoury Logistics; в Unsupplied его можно потратить из уже выданного inventory на legal Emergency Field Repair. При покупке он даёт максимум 10 Supply экономии и занимает slot до расходования; для дешёвого recovery брать его невыгодно. Free Cache остаётся полноценной наградой. Нельзя вернуть его в Supply или использовать на Rehab/Commission.

Relics: Blackglass Shard/Chronal Sliver = Minor и formation price, эффекты прежние одноразовые; Ossuary Key = Minor, +1 VP после обычного successful Action, максимум один раз, не влияет на eligibility/CLAIM; Blackglass Lens = Minor и bearer ranged profile; Mnemonic Crown = Minor, один раз после Action +2 total OC bearer component до следующей своей Command; Anchor Fragment = Major с formation price, один Normal Move до 3" после завершения enemy Normal Move в 9", оставаясь дальше 6" от enemy.

Невручённый Relic можно держать на складе стороны. Назначение/замена только в legal Armoury Logistics до next hostile declaration; заменённый Relic возвращается на склад. Передача между записями стоит 10 Supply и требует физического присутствия обеих при Main Force. При Disband, Lost или SEAL исчезает вместе с bearer; Evacuation/обычная гибель на столе сохраняет его. Один и тот же bearer не носит два Relics. Случайный Armoury reward при отсутствии legal свободного slot заменить на 10 Supply, если event не задаёт свою цену; consumable можно хранить в inventory Force, но выдать bearer только до его commitment.

### 10. Attached scope и formations

Wounds, weapon stats, save rerolls, damage prevention, XP и casualty effects по умолчанию относятся ТОЛЬКО к bearer persistent component и его моделям. Leader Honour не выдаёт profile bonus всему Bodyguard. Formation-wide Move/Charge/Scout/Battle-shock/Actions/OC modifiers работают только когда текст прямо говорит formation.

Для formation-wide Honour/item surcharge вместо цены по RC bearer рассчитывается один раз на суммарном RC всех attached/transported components, реально получающих эффект: Minor = max(5, ROUNDUP_TO_5(общий RC x 5%)); Major = max(10, ... x 10%); Signature = max(15, ... x 15%). Это один surcharge, приписанный bearer, не повторная цена каждому. Transport payload не получает эффекта транспортного bearer, если это не сказано прямо. После отделения компонентов цену в этой battle не пересчитывать. Эффект следует bearer: при смерти Leader Bodyguard его теряет; shared depleted uses не восстанавливаются при separation/rejoin.

В attached Action выбрать один bearer component при старте; только его personal Honour меняет Action. Formation целиком выполняет core eligibility/ограничения. Все effects «unit может Action и Shoot» снимают запрет Shooting только bearer component, остальные участники formation сохраняют core Action restriction. Если нужен эффект для всей группы, он должен прямо называться formation и платить formation surcharge. До 1000 ограничение 40% RC распространяется также на весь Attached Unit; embarked units не складываются с transport для этого лимита, но не обходят прочие army caps.

### 11. Battle Scars - полный replacement D12

Scar CR 0. Негативная часть действует постоянно, пока Scar существует. Бонус только когда прямо указан и не отменяет downside. Неприменимую строку перебросить до применимой; duplicates перебросить. Общий Scar cap 3, четвёртый и Critical последствия сохраняются. Разовые бонусы одного Scar нельзя передавать Bodyguard; scope formation указан явно.

| D12 | Deathwatch | Правило |
| --- | --- | --- |
| 1 | Bionic Reconstruction | Bearer formation -1" Move. Один save reroll bearer за battle. |
| 2 | Cracked Plate | Bearer models не получают Cover против всех атак первого enemy unit, стрелявшего по formation в этой battle. Один раз после этого игнорировать 1 полученный mortal wound bearer. |
| 3 | Lost Brother | Formation -1 к Battle-shock. HUNT CHARACTER/MONSTER/VEHICLE даёт bearer +1 XP, максимум один за battle. |
| 4 | Xenos Toxin Load | После одного Wound reroll против XENOS bearer получает 1 mortal wound; после атак, один раз за battle. Armoury slot закрыт. |
| 5 | Damaged Auspex | Первый ranged Hit roll bearer за battle не перебрасывается. Позже один Hit reroll, после его activation formation Battle-shocked до следующей своей Command. |
| 6 | Warp Burn | Только PSYKER: +1 Leadership formation. Один successful Battle-shock за battle даёт 1 CP по core limits. |
| 7 | Ammunition Debt | После каждого участия заплатить 5 Supply либо в следующей relevant battle первый Hit roll каждой Shooting/Fight activation bearer получает -1 по core modifier limits. Долг не складывается сам с собой. |
| 8 | Severed Command Link | Не Distinguished до Redemption OPERATE в двух battles; затем Scar снимается. Бонуса до снятия нет. |
| 9 | Blackshield Oath | Если после Charge roll ближайший visible enemy в 8" является legal достижимой целью, formation должна закончить charge move в его Engagement Range либо отказаться от Charge move. Один die этого roll можно reroll ДО выбора charge move. |
| 10 | Trophy Obsession | В первой Shooting activation bearer обязан распределить хотя бы половину своих eligible attacks в nearest visible legal XENOS. Один Wound reroll против него. Неприменим без ranged weapons. |
| 11 | Gene-seed Shock | Нет Participation XP до выполнения ENDURE или OPERATE; тогда Scar снимается и bearer получает обычный XP за Deed, без компенсационного +2. |
| 12 | Marked by the Watch | При уничтожении к концу battle enemy +10 Supply; при выживании bearer +1 XP. За window outside battle reward нет. |

| D12 | Necrons | Правило |
| --- | --- | --- |
| 1 | Fractured Engram | Formation -1 Battle-shock. После одного успешного test за battle bearer восстанавливает 1 lost wound, не model. |
| 2 | Reanimation Drift | Первый restoration bearer за battle восстанавливает на 1 wound/model меньше, минимум 0. Второй получает +1 к связанному roll, если есть. Только bearer с restoration ability. |
| 3 | Phase Scar | Formation -1" Move. Один раз после Normal Move дополнительный Normal Move до 2", без Charge в этом turn. |
| 4 | Destroyer Contamination | Если visible enemy в 8", formation не может добровольно Fall Back. Один melee Hit и Wound reroll bearer за battle. |
| 5 | Flayer Echo | После первого уничтожения enemy model bearer: D6 1-2 formation Battle-shocked, 5-6 +2 total OC bearer до конца round. Без re-trigger. |
| 6 | Severed Command Node | Formation не может использовать Tactical/Breach Assets до первого собственного completed Named Action. После OPERATE в двух battles Scar бесплатно снимается. |
| 7 | Chronometric Desync | Formation -1 Advance. Один раз после Advance roll заменить die на 6, затем formation не Charge и не начинает Actions в этом turn. |
| 8 | Necrodermis Fatigue | После одного Damage reduction на 1, minimum 1, bearer formation теряет Cover и -2 total OC до следующей своей Command, minimum 0. |
| 9 | Tomb Signal Static | Если bearer formation начинает в Reserves/Pool, первое legal arrival только на round позже обычного; тогда casualty +1. При initial deployment formation -1 Battle-shock, casualty bonus нет. |
| 10 | Logic Loop | В первом своём Command выбрать nearest non-Home mission objective. Пока unit существует, formation не делает move, заканчивающий дальше от него, кроме Forced Retreat/Withdrawal; bearer +2 total OC в его range. Если objective удалён, выбрать ближайший в следующей Command. |
| 11 | Memory Bleed | Нет Participation XP до successful OPERATE; после него Scar снимается. Другой XP сохраняется. |
| 12 | Protocol Obsession | До battle выбрать HOLD или HUNT; другие Unit Deeds не дают Deed XP, bearer +1 дополнительный XP при выполнении выбранного, но не Distinguished пока Scar есть. |

Бонус total OC всегда распределяется между bearer моделями, максимум +1/model, не отменяет Battle-shocked OC 0. Formation penalties распространяются на всю группу, персональные bonuses - только bearer. В small formats Scar, накладывающий запрет на единственный legal способ передвижения/атаки datasheet, считается неприменимым; обычная трудность достижения цели не повод перебрасывать.

### 12. Muster, Actions, предметы и identity

Mission anti-repeat ведётся циклом: сыгранная mission отмечается; когда сыграны все три обычные legal missions, очистить цикл для следующей selection. Если legal pool одна, платный reroll недоступен. Provisional roll/Relay/pre-roll один; затем максимум один платный mission reroll СУММАРНО на battle. Active player первым заявляет выбор, затем defender; если первый оплатил, второй не reroll. Новый result обязателен, отличается от provisional при pool >=2. Stronghold сохраняет D2 и outer swap, separate anti-repeat.

Оба заранее независимо проверяют стоимость/availability/formation legality до reveal, затем sealed commit с timestamp. Если после reveal обнаружена ошибка: нельзя добавлять или заменять units, менять loadout, attachment или detachment. Удалять до legal в таком порядке: последний записанный Pool пакет -> последний Initial/Field пакет; целый Attached/transport package, если иначе он нелегален. Unavailable убрать сразу. Если Army/DP restriction нельзя исправить удалением, используется последний заранее записанный legal пакет этой Stage; отсутствует такой пакет -> offending official option не даёт benefits, сохраняются legal datasheets. Validation не создаёт новый counter-pick. Опечатки исправить при проверяемой неизменности фактического выбора, не в обмен на новые модели.

Default Named Action: конец своей Movement, eligible formation в 3" объекта, completes конец своего turn; USE LIMIT один старт каждого типа на объект на сторону за turn и максимум один Action на unit за turn. Получение Action VP/Intel/XP на объекте каждой стороной максимум один раз за battle, если карточка прямо не разрешает повторяемый reward. Уже отключённый/удалённый объект недоступен. Own-tag CONTROL не начинается. Enemy-tag CONTROL меняет tag; discovery VP повторно не выдаются. Tag не равен physical OC control. Для требования «контролировать объект», который не является objective, считать Area OC моделей в 3": больше opponent = control, tie = никто. Mission Experts/Relics не обходят gate/ограничения.

Rough Ground: если unit начинает move partly within отмеченной area, Advance/Charge distance -2, minimum 0. Не меняет dice или результат для иных эффектов. Если начинает вне и впервые входит, оставшийся разрешённый путь сокращается на 2 до minimum 0; разрешено закончить перед границей, если вход с уменьшенной дистанцией нелегален. Можно добровольно выбрать путь мимо. Штраф один на move, проверяется до фактического пересечения, не прерывает Charge в нелегальной позиции.

Carrier: максимум один предмет на formation. PICK UP выбирает один ground item; при completion его получает названный persistent component, затем marker следует formation. Carrier не redeploy/teleport/enter Reserves/embark и не добровольно передаёт предмет. Нельзя сделать PICK UP уже занятому carrier. В конце Normal Move можно бесплатно DROP wholly в 1" от carrier model, вне enemy Engagement; DROP не даёт VP. На destruction bearer component предмет падает у последней уничтоженной bearer model; если позиция невозможна, ближайшая legal точка. Bodyguard/Leader не наследует предмет автоматически. При Withdrawal предмет падает у exit point, не доставляется, если mission явно не разрешает. Успешная DELIVER/PICK UP completion и его reward сохраняются даже при немедленной гибели от эффекта этого Action. Delivery: carrier wholly в своей deployment zone, в конце своей Movement может начать DELIVER; completes конец turn, предмет удаляется. Mission с DELIVER у battlefield edge требует bearer model wholly within 3" своей edge. Удержание/доставка одного предмета не складываются.

Persistent ID сохраняется при legal size change; новые модели получают существующие upgrades всей записи. Максимум одно увеличение size на Stage, с полной положительной разницей RC. Уменьшение без refund, повторное увеличение в эту Stage запрещено. Split/merge, смена datasheet и создание второго ID с XP первого запрещены. Snapshot migration одновременно обеим сторонам на Stage: ближайшая новая legal версия того же datasheet; если её нет, совместно выбрать замену с тем же battlefield role, максимум прежний RC, без free increase; difference pay/refund 0 для меньшего. Старый ID и story сохраняются; неприменимые Honours переводятся в pending slots, лишние official options снимаются. Epic Heroes получают Damage/Participation/story XP, но не regular/Signature Honours, Campaign Armoury/Relics или Distinguished; их official abilities не дополняются generic upgrades.

### 13. Withdrawal и события

Withdrawal заявляется в собственной Command начиная с R3. До конца СЛЕДУЮЩЕЙ собственной Movement вывести units через свою deployment edge: unit wholly within 3" edge может вместо дальнейшего move уйти; embarked cargo выходит вместе с transport. Успешный exit = survival; остаток после срока = уничтожен. Новые собственные Pool arrivals после объявления не разрешены; не вошедшие записи затем отступают без casualty за невыход. Противник может принять капитуляцию сразу, но withdrawing стороне всё равно разрешён один evacuation Movement с обычной дистанцией без атак/Actions; принять victory нельзя использовать для отнятия эвакуации. При отказе бой продолжается до этого срока, затем автоматически поражение withdrawing стороны независимо от VP. Максимум её VP 25 для log; это не способ выиграть уступленный сектор.

Если обе стороны заявили до завершения первой evacuation, обе получают свои evacuation Movement; оставшиеся units destroyed; outcome Draw, ownership прежний, sector Contested, обе Field Forces отходят: Attacker в Origin, Defender в соседний controlled сектор/Home emergency. Local garrison остаётся в прежнем owned секторе с Damage, пока он legal; в ходе battle выведенные units возвращаются туда после aftermath, не получают бесплатный strategic transfer. Home Integrity не меняется. Нет winner/loser rewards, обычный draw income если это не terminal crisis finale.

D66 13: обе qualifying стороны получают по одному Ward/1 Intel. D66 26: первый VEHICLE/MONSTER каждой стороны отдельно. D66 51 previous battle означает только что завершённую; при равных destroyed persistent counts eligible сторона определяется Lesser Territory tie-break v2.1. D66 64 SECRET ROUTE: использовать только из сектора token, целевой сектор и expiry записываются при выдаче; Home assault prerequisites не обходятся. D3 casualties при недостатке eligible: выбрать все доступные без повторов; при нуле эффекта нет. Ruined Fortify = половина обычной уже округлённой цены, затем вверх до 5. Relay Disruption expiry привязан к текущему владельцу при выдаче и его следующей Activation; ownership change не продлевает его. Явный более поздний effect заменяет expiry только по общему правилу повторной выдачи.

### 14. BLACK CHOIR, Fragments и обычные endings

Choir track 0-8, excess не хранится. Threshold пересечение открывает все пройденные Reveals. D66 66 по-прежнему даёт +2 и открывает следующий закрытый Reveal; любой forced Reveal устанавливает track не ниже своего printed threshold. Если это Reveal IV, track становится 8. FEED требует открытого Reveal IV; это терминальный обычный Home ending, не совместная победа.

Investigate Choir: после Reveal II current controlled G/D/E/F/H; 1 Action, 1 Intel; максимум один attempt на сторону за Window. Таблица v2.1 сохраняется, но result 3-4 refund потраченного Intel, не новый Recon-like income; result 6 Secret Fragment, максимум 3 у стороны. На третьем подряд attempt без Fragment вместо D6 получить Fragment автоматически; progress 0 после Fragment. Бесплатные story Fragments не сбрасывают investigation progress. Это гарантирует доступ к пути разведки без бесконечной покупки бросков.

EXTRACT INDEX после Reveal III: отдельный marker точно в battlefield centre во всех Stronghold missions. Только CHARACTER, 3", обычный Action; один completion НА СТОРОНУ за battle, +1 Secret Fragment до cap 3 и +1 XP bearer, VP не даёт. После completion casualty -1 для bearer, если уничтожен. Не использовать в Cooperative Finale, где extraction replaced sealing. PURGE/SEIZE/SEAL сохраняют story outcomes v2.1; SEAL каждый player выбирает участвовавший named unit для эпилога, не обязательно cheapest; consent не меняет наличие winner. Финал кризиса имеет отдельные endings.

### 15. Памятка перехода

Существующая кампания может перейти на v2.2 только между battles, до hostile declaration, одновременно обеими сторонами. Сохранить XP, Damage, Supply, locations и mission history. Пересчитать карту/Supplied, CR, отметить действующие Scars по replacement D12; старые stored Armoury остаются, возврата разницы purchase price нет. Распределить 50 стартового Local Supply на два любых собственных supplied non-Home сектора, максимум 25 каждый, если переход не в начале. Закрытые Resource Window flags сохраняются; used healing в текущем окне перенести. Если battle count >=12, немедленно открыть достигнутую кризисную фазу; если >=17, следующая tabletop - Convergence finale. Legacy learning slots можно оставить pending. DB v2.1 сам по себе не исполняет v2.2: новые flags/Local Supply/CR/Crisis требуют реализации, до неё вести их в согласованном ручном журнале.

Порядок aftermath: VP/mandatory victory gates/ending -> XP -> Casualty snapshot/roll/Critical -> retreat -> terminal stop ИЛИ Salvage/D66/recalculation -> income/Stage/local deposits -> открыть новый Window -> Rest -> Logistics -> crisis threshold reveal -> pass. Recovery Crew пересчитывает package, не делает второй aftermath. Финал кризиса не выдаёт cash/deposits и не запускает следующую Activation.
