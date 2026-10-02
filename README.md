# The Black Sepulchre Campaign Command

Веб-приложение для двухигроковой кампании Warhammer 40,000 11e по правилам The Black Sepulchre.

Текущий стек: React + TypeScript + Vite, Supabase Postgres/Auth/Realtime, GitHub Pages.

## Deployment

GitHub Actions собирает приложение и публикует готовый статический build в ветку `gh-pages`.

Один раз включите GitHub Pages вручную:

1. Repository → **Settings**
2. **Pages**
3. **Build and deployment**
4. Source: **Deploy from a branch**
5. Branch: **gh-pages**
6. Folder: **/(root)**
7. **Save**

После этого сайт доступен по адресу:

https://mishokkka.github.io/Black_Sepulchre/

Это одноразовая настройка. Все следующие push в `main` автоматически пересобирают и обновляют ветку `gh-pages`.

## Уже реализовано

- Supabase Auth
- создание кампании и вход второго игрока по invite code
- RLS и realtime-синхронизация
- стартовая карта Kharon Secundus A–K
- persistent Field/Garrison units
- Supply, Intelligence, Damage, XP, Campaign Rating
- Supply Line
- чередование Strategic Activations
- 2 Strategic Actions + 2 MP
- friendly movement, hostile contact и Occupation
- Recon, Mobilise, Forced March, Fortify, Repair Network, Sabotage
- автоматическое определение Field/Garrison/Stronghold battle
- audit log
- responsive UI

Supabase publishable key находится в клиенте намеренно. Service-role key в репозитории отсутствует.
