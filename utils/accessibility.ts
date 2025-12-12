import * as React from "react";

export function fixAriaHiddenOnMainWrapper(): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  const removeStaleInert = () => {
    try {
      document.querySelectorAll("[inert]").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (el.closest("[data-radix-portal]")) return;
        el.removeAttribute("inert");
      });
    } catch (error) {
      console.debug("Accessibility inert cleanup error:", error);
    }
  };

  const focusFirstFocusableInOpenRadixLayer = (): boolean => {
    try {
      const openLayerCandidates = Array.from(
        document.querySelectorAll(
          [
            '[data-radix-portal] [data-state="open"][role="dialog"]',
            '[data-radix-portal] [role="dialog"][data-state="open"]',
            '[data-radix-portal] [data-state="open"][role="listbox"]',
            '[data-radix-portal] [role="listbox"][data-state="open"]',
            '[data-radix-portal] [data-state="open"][role="menu"]',
            '[data-radix-portal] [role="menu"][data-state="open"]',
          ].join(","),
        ),
      ) as HTMLElement[];

      const openLayer = openLayerCandidates.at(-1);
      if (!openLayer) return false;

      const focusable = openLayer.querySelector<HTMLElement>(
        [
          "button:not([disabled])",
          "[href]",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      );

      (focusable ?? openLayer).focus?.({ preventScroll: true } as any);
      return true;
    } catch (error) {
      console.debug("Accessibility focus fix error:", error);
      return false;
    }
  };

  const moveFocusOutOfAriaHiddenSubtree = () => {
    try {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return;

      const hiddenAncestor = active.closest('[aria-hidden="true"]');
      if (!hiddenAncestor) return;

      active.blur?.();
      focusFirstFocusableInOpenRadixLayer();
    } catch (error) {
      console.debug("Accessibility focus correction error:", error);
    }
  };

  let rafId: number | null = null;
  const scheduleFixes = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      removeStaleInert();
      moveFocusOutOfAriaHiddenSubtree();
    });
  };

  scheduleFixes();

  const observer = new MutationObserver(() => {
    scheduleFixes();
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["aria-hidden", "inert"],
    childList: true,
    subtree: true,
  });

  const handleFocusIn = () => {
    scheduleFixes();
  };

  document.addEventListener("focusin", handleFocusIn);

  return () => {
    observer.disconnect();
    document.removeEventListener("focusin", handleFocusIn);
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

export function useAccessibilityFixes() {
  React.useEffect(() => {
    return fixAriaHiddenOnMainWrapper();
  }, []);
}

export const replaceAriaHiddenWithInert = (element: HTMLElement): void => {
  if (!element) return;
  if (typeof document === "undefined") return;

  if (element.hasAttribute("inert")) {
    element.removeAttribute("inert");
  }

  if (element.getAttribute("aria-hidden") === "true") {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && element.contains(active)) {
      active.blur?.();
    }
  }
};

export const setupAriaHiddenObserver = (
  rootElement: HTMLElement,
): MutationObserver | null => {
  if (!rootElement) return null;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-hidden"
      ) {
        const element = mutation.target as HTMLElement;
        replaceAriaHiddenWithInert(element);
      }
    });
  });

  observer.observe(rootElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["aria-hidden"],
  });

  return observer;
};
