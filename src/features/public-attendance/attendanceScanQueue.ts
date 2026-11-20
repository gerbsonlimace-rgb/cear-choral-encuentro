export type ScanQueueSnapshot = { pending: number; failed: number; active: number; queued: number };

// Capacidade padrão conservadora para ambientes mistos (mobile/desktop).
// Chamar com `capacity` explícito permite limites menores em testes e cenários controlados.
const DEFAULT_CAPACITY = 256;

export function createAttendanceScanQueue<T>(options: {
  submit(token: string): Promise<T>; onResult(result: T, token: string): void; onChange(snapshot: ScanQueueSnapshot): void;
  concurrency?: number; capacity?: number;
}) {
  const capacity = Math.max(1, options.capacity ?? DEFAULT_CAPACITY);
  const concurrency = Math.min(capacity, Math.max(1, Math.min(options.concurrency ?? 3, 4)));
  const seen = new Set<string>(), failed = new Set<string>(), waiting: string[] = [];
  let active = 0, disposed = false;
  const snapshot = (): ScanQueueSnapshot => ({ pending: waiting.length + active + failed.size, failed: failed.size, active, queued: waiting.length });
  const publish = () => { if (!disposed) options.onChange(snapshot()); };
  function pump() {
    while (!disposed && active < concurrency && waiting.length) {
      const token = waiting.shift()!;
      active++; publish();
      let request: Promise<T>;
      try { request = Promise.resolve(options.submit(token)); }
      catch (error) { request = Promise.reject(error); }
      void request.then(result => { if (!disposed) options.onResult(result, token); }, () => { if (!disposed) failed.add(token); })
        .finally(() => { active--; if (!disposed) { pump(); publish(); } });
    }
  }
  return {
    snapshot,
    enqueue(token: string): "queued" | "duplicate" | "full" | "disposed" {
      if (disposed) return "disposed";
      if (seen.has(token)) return "duplicate";
      if (snapshot().pending >= capacity) return "full";
      seen.add(token); waiting.push(token); pump(); publish(); return "queued";
    },
    retryFailed() { if (disposed) return; waiting.push(...failed); failed.clear(); pump(); publish(); },
    dispose() { disposed = true; waiting.length = 0; failed.clear(); },
  };
}
