import { terrainProfile, terrainWalls, type TerrainPiece } from '../../shared/terrain'

const format = (value: number) => +value.toFixed(2)

/** A buildable recipe for the exact wall segments shown on the battlefield plan. */
export function TerrainPieceDetails({ piece: p }: { piece: TerrainPiece }) {
  const profile = terrainProfile(p)
  const name = p.kind === 'light' ? 'Низкая баррикада' : p.symmetric ? 'Два угла руин' : 'Угол руин'
  const walls = terrainWalls(p)
  const point = (x: number, y: number) => `(${format(x - p.x)}; ${format(y - p.y)})`
  return (
    <details className="terrain-piece-details">
      <summary aria-label={`Описание террейна ${p.id}`}>
        {name} · {p.kind === 'dense' ? 'Dense' : 'Light'}
      </summary>
      <p>
        Область {p.width} × {p.height}″ обозначьте плоской подложкой или лентой. Её граница не
        является стеной. Высота физических стен — {profile.wallHeight}″ (примерно{' '}
        {Math.round(profile.wallHeight * 25.4)} мм); толщина — не более {profile.maxWallThickness}″
        (примерно {Math.round(profile.maxWallThickness * 25.4)} мм). Игровая поверхность — только
        земля, верхних этажей и крыши нет.
      </p>
      <p>
        {p.kind === 'light'
          ? 'Поставьте одну низкую стенку, трубу или баррикаду вдоль указанной линии.'
          : p.symmetric
            ? 'Поставьте два противоположных угла с глухими стенами. Центр и промежутки между углами оставьте открытыми.'
            : 'Поставьте две глухие стены под прямым углом, как на схеме. Остальные стороны и внутреннее пространство оставьте открытыми.'}
      </p>
      <p>
        Линия на карте проходит по середине толщины стены. Ниже указаны длины и концы стен в дюймах
        относительно верхнего левого угла этой области; x направлен вправо, y — вниз.
      </p>
      <ol>
        {walls.map((wall, i) => (
          <li key={i}>
            Стена {i + 1}: {format(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1))}″, от{' '}
            {point(wall.x1, wall.y1)} до {point(wall.x2, wall.y2)}.
          </li>
        ))}
      </ol>
      {p.objectiveId && (
        <p>
          Вся область — цель {p.objectiveId}. Крестик задаёт центр для расстановки; контроль
          считается по моделям внутри области.
        </p>
      )}
      <p className="muted">
        Это профиль сборки для данной схемы кампании. Готовые элементы подходят, если сохраняют
        указанные глухие части и свободное пространство. Более широкую постройку, дополнительные
        стены или этажи согласуйте до боя и заново проверьте проходы и видимость.
      </p>
    </details>
  )
}
