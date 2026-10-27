import { terrainProfile, terrainWalls, type TerrainPiece } from '../../shared/terrain'

const format = (value: number) => +value.toFixed(2)

/** A buildable recipe for the exact wall segments shown on the battlefield plan. */
export function TerrainPieceDetails({ piece: p }: { piece: TerrainPiece }) {
  const profile = terrainProfile(p)
  const name =
    p.kind === 'light'
      ? 'Низкая баррикада'
      : p.platforms?.length
        ? 'Руина с этажом'
        : p.symmetric
          ? 'Два угла руин'
          : 'Угол руин'
  const walls = terrainWalls(p)
  const point = (x: number, y: number) => `(${format(x - p.x)}; ${format(y - p.y)})`
  return (
    <details className="terrain-piece-details">
      <summary aria-label={`Описание террейна ${p.id}`}>
        {name} · {p.kind === 'dense' ? 'Dense' : 'Light'}
      </summary>
      <p>
        {p.outline ? 'Габариты области' : 'Область'} {p.width} × {p.height}″.{' '}
        {p.outline
          ? 'Подложку со скошенным углом соберите по вершинам ниже.'
          : 'Обозначьте её плоской подложкой или лентой.'}{' '}
        Её граница не является стеной. Высота физических стен — {profile.wallHeight}″ (примерно{' '}
        {Math.round(profile.wallHeight * 25.4)} мм); толщина — не более {profile.maxWallThickness}″
        (примерно {Math.round(profile.maxWallThickness * 25.4)} мм).{' '}
        {p.platforms?.length
          ? 'Игровые поверхности — земля и указанная площадка; остальная часть руины открыта сверху.'
          : 'Игровая поверхность — только земля, верхних этажей и крыши нет.'}
      </p>
      <p>
        {p.kind === 'light'
          ? 'Поставьте одну низкую стенку, трубу или баррикаду вдоль указанной линии.'
          : p.symmetric
            ? 'Поставьте два противоположных угла с глухими стенами. Центр и промежутки между углами оставьте открытыми.'
            : 'Поставьте две глухие стены под прямым углом, как на схеме. Остальные стороны оставьте открытыми.'}
      </p>
      <p>
        Линия на карте проходит по середине толщины стены. Ниже указаны длины и концы стен в дюймах
        относительно верхнего левого угла этой области; x направлен вправо, y — вниз.
      </p>
      {p.outline && (
        <p>
          Вершины контура по порядку: {p.outline.map((v) => point(v.x, v.y)).join(' → ')} → первая
          вершина. Координаты даны от верхнего левого угла габаритного прямоугольника.
        </p>
      )}
      <ol>
        {walls.map((wall, i) => (
          <li key={i}>
            Стена {i + 1}: {format(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1))}″, от{' '}
            {point(wall.x1, wall.y1)} до {point(wall.x2, wall.y2)}.
          </li>
        ))}
      </ol>
      {p.platforms?.map((floor, i) => (
        <p key={i}>
          <strong>Этаж +{floor.elevation}″.</strong> Размер {floor.width} × {floor.height}″; верхний
          левый угол {point(floor.x, floor.y)}. Высота измеряется до верхней поверхности; толщина
          пола — не более {floor.thickness}″, просвет под ним — не менее{' '}
          {format(floor.elevation - floor.thickness)}″. Крепите площадку к указанным стенам без
          дополнительных опор в проходах. База должна помещаться на площадке по обычным правилам;
          доступ и стрельба определяются правилами движения по вертикали и Plunging Fire.
        </p>
      ))}
      {p.objectiveId && (
        <p>
          Вся область — цель {p.objectiveId}. Крестик задаёт центр для расстановки; контроль
          считается по моделям внутри области.
        </p>
      )}
      <p className="muted">
        Это профиль сборки для данной схемы кампании. Готовые элементы подходят, если сохраняют
        указанные глухие части и свободное пространство. Более широкую постройку, дополнительные
        стены или другие этажи согласуйте до боя и заново проверьте проходы и видимость.
      </p>
    </details>
  )
}
