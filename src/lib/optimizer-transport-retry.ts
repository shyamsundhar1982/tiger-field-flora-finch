export type OptimizerTransportRetryOptions = {
  delayMs?: number;
  onRetry?: (error: unknown) => void;
};

export function isRetryableOptimizerTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network error|load failed|fetch failed/i.test(message);
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Retries exactly once, and only for browser/network transport failures.
 * Callers must reuse the same governed request ID across both attempts so the
 * persistence boundary's request-level idempotency prevents duplicate runs.
 */
export async function runWithSingleOptimizerTransportRetry<T>(
  operation: () => Promise<T>,
  options: OptimizerTransportRetryOptions = {},
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableOptimizerTransportError(error)) throw error;
    options.onRetry?.(error);
    await wait(options.delayMs ?? 900);
    return operation();
  }
}
