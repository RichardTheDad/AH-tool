import "@testing-library/jest-dom";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  observe = vi.fn((target: Element) => {
    window.setTimeout(() => {
      this.callback(
        [
          {
            isIntersecting: true,
            target,
          } as IntersectionObserverEntry,
        ],
        this,
      );
    }, 0);
  });
}

globalThis.IntersectionObserver = TestIntersectionObserver;
