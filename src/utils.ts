export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return sleep(delay);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log(`Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

export function logError(message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
}
