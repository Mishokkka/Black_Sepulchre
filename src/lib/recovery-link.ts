/** Only the recovery verification link from this project's email may be redeemed. */
export function recoveryToken(raw: string, projectUrl: string): string {
  try {
    const u = new URL(raw.trim())
    const token = u.searchParams.get('token_hash') ?? u.searchParams.get('token')
    if (
      u.origin === new URL(projectUrl).origin &&
      u.pathname === '/auth/v1/verify' &&
      u.searchParams.get('type') === 'recovery' &&
      token &&
      /^[a-zA-Z0-9_-]{20,200}$/.test(token)
    )
      return token
  } catch {
    /* never include the submitted secret in an error */
  }
  throw Error(
    'Вставьте исходную ссылку «Reset Password» из письма этой кампании. Ссылка уже открытой страницы не подойдёт.',
  )
}
