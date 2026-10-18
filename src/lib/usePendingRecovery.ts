import { useEffect, useRef } from 'react'

/** Retry an uncertain delivery once with its original receipt, including after reload. */
export function usePendingRecovery(
  requestId: string | undefined,
  busy: boolean,
  online: boolean,
  retry: () => Promise<void>,
) {
  const attempted = useRef('')
  useEffect(() => {
    if (!requestId) {
      attempted.current = ''
      return
    }
    if (busy || !online || attempted.current === requestId) return
    attempted.current = requestId
    void retry()
  }, [requestId, busy, online, retry])
}
