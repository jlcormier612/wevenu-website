/**
 * Event Order template option persists.
 *
 * Rapid consecutive Saves used overlapping startTransition work, which can
 * abandon the first server action. Each persist must start in the originating
 * click stack (Next server actions do not run when only scheduled on .then).
 * Completion is still chained so follow-up refresh/status work stays ordered.
 */

let chain: Promise<void> = Promise.resolve();

export function enqueueOptionPersist(task: () => Promise<void>): Promise<void> {
  const started = task();
  const run = chain.then(
    () => started,
    () => started,
  );
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetOptionPersistQueueForTests(): void {
  chain = Promise.resolve();
}
