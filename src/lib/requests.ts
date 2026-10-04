export class CampaignRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}
/** HTTP validation/conflict failures require a new decision; uncertain delivery reuses UUID. */
export function retryableStatus(status?: number) {
  return status === undefined || status >= 500 || status === 408 || status === 429
}
