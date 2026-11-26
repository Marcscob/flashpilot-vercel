/** Serialize paid synthesis, sharing identical active requests without retries. */
export function createSpeechDispatch<T>() {
  type Entry = { key: string; task: Promise<T | undefined>; current: () => boolean; work: () => Promise<T>; priority: number; resolve: (value: T | undefined) => void; reject: (error: unknown) => void };
  const pending = new Map<string, Entry>();
  const queue: Entry[] = [];
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    while (queue.length) {
      queue.sort((a, b) => b.priority - a.priority);
      const entry = queue.shift();
      if (!entry) break;
      try { entry.resolve(entry.current() ? await entry.work() : undefined); }
      catch (error) { entry.reject(error); }
      finally { pending.delete(entry.key); }
    }
    running = false;
  }
  return (key: string, current: () => boolean, work: () => Promise<T>, priority = 1): Promise<T | undefined> => {
    const existing = pending.get(key);
    if (existing) {
      const before = existing.current;
      existing.current = () => before() || current();
      existing.priority = Math.max(existing.priority, priority);
      return existing.task;
    }
    let resolve: Entry["resolve"] = () => {};
    let reject: Entry["reject"] = () => {};
    const task = new Promise<T | undefined>((yes, no) => { resolve = yes; reject = no; });
    const entry: Entry = { key, current, task, work, priority, resolve, reject };
    pending.set(key, entry);
    queue.push(entry);
    void drain();
    return task;
  };
}