// Each start() aborts the previous request, so a late or failed old response can never replace the newest one.
export function createLatestRequest() {
  let current: AbortController | null = null;
  return {
    start() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return { signal: controller.signal, isCurrent: () => current === controller };
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}
