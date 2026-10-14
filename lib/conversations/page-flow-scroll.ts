/**
 * Inbox page-flow scrolling helpers.
 *
 * The workspace chrome uses a sticky header beside `[data-workspace-main]`.
 * Calling `Element.scrollIntoView()` from inside the thread scrolls ancestors
 * in a way that pulls `main` under that header (main.top → 0, ~header-height
 * white gap at the bottom). Page-flow scroll must only adjust the module
 * scrollport's `scrollTop`.
 */

/** Pure scroll math — keeps page-flow alignment testable without a DOM. */
export function nextWorkspaceMainScrollTop(opts: {
  mainScrollTop: number;
  mainViewportTop: number;
  targetViewportTop: number;
}): number {
  return Math.max(
    0,
    opts.mainScrollTop + (opts.targetViewportTop - opts.mainViewportTop),
  );
}

export function workspaceMainScrollport(
  from: Element | null | undefined,
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (from instanceof Element) {
    const closest = from.closest("[data-workspace-main]");
    if (closest instanceof HTMLElement) return closest;
  }
  return document.querySelector<HTMLElement>("[data-workspace-main]");
}

/**
 * Scroll the workspace main so `target` aligns to the top of the main
 * visible area. Never uses scrollIntoView.
 */
export function scrollWorkspaceMainToElement(
  target: Element | null | undefined,
  behavior: ScrollBehavior = "auto",
): boolean {
  if (!(target instanceof Element)) return false;
  const main = workspaceMainScrollport(target);
  if (!main) return false;

  const nextTop = nextWorkspaceMainScrollTop({
    mainScrollTop: main.scrollTop,
    mainViewportTop: main.getBoundingClientRect().top,
    targetViewportTop: target.getBoundingClientRect().top,
  });

  if (behavior === "smooth") {
    main.scrollTo({ top: nextTop, behavior: "smooth" });
  } else {
    main.scrollTop = nextTop;
  }
  return true;
}
