export function ScreenLoading({
  label = 'Загрузка раздела…',
  full = false,
}: {
  label?: string
  full?: boolean
}) {
  return (
    <div className={full ? 'screen-loading-center' : ''}>
      <section className="panel screen-loading" role="status" aria-label={label}>
        <p>{label}</p>
        <div className="skeleton-heading" aria-hidden="true" />
        <div className="skeleton-cards" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
