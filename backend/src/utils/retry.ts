export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delayMs: number; label?: string }
): Promise<T> {
  const { retries, delayMs, label } = options;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  const prefix = label ? `${label}: ` : "";
  const detail =
    lastErr instanceof Error
      ? lastErr.message
      : lastErr !== undefined
        ? String(lastErr)
        : "unknown error";
  throw new Error(`${prefix}failed after ${retries + 1} attempts: ${detail}`, { cause: lastErr });
}
