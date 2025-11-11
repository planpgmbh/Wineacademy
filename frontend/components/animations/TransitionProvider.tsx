'use client';

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type TransitionStatus = "idle" | "fading-out" | "navigating" | "fading-in";

type TransitionContextValue = {
  status: TransitionStatus;
  transitionsEnabled: boolean;
  handleFadeOutComplete: () => void;
  handleFadeInComplete: () => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function useTransitionContext() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error("useTransitionContext must be used inside TransitionProvider");
  }
  return context;
}

type TargetRef = {
  href: string;
  pathname: string;
  search: string;
};

function buildTarget(rawHref: string): TargetRef | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return {
      href: `${url.pathname}${url.search}${url.hash}`,
      pathname: url.pathname,
      search: url.search
    };
  } catch {
    return null;
  }
}

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<TransitionStatus>("idle");
  const targetRef = useRef<TargetRef | null>(null);
  const currentSearch = searchParams.toString();
  const currentSearchWithPrefix = currentSearch ? `?${currentSearch}` : "";
  const prefersReducedMotion = usePrefersReducedMotion();
  const transitionsEnabled = !prefersReducedMotion;

  const startTransition = useCallback(
    (target: TargetRef) => {
      if (status !== "idle" || !transitionsEnabled) return;
      targetRef.current = target;
      setStatus("fading-out");
      const prefetch = (router as { prefetch?: (href: string) => Promise<void> | void }).prefetch;
      if (typeof prefetch === "function") {
        Promise.resolve(prefetch(target.href)).catch(() => undefined);
      }
    },
    [router, status, transitionsEnabled]
  );

  const handleDocumentClick = useCallback(
    (event: MouseEvent) => {
      if (!transitionsEnabled) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) return;
      const anchor = (target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.transition === "false") return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      const resolvedTarget = buildTarget(href);
      if (!resolvedTarget) return;

      const isSamePage =
        resolvedTarget.pathname === pathname &&
        resolvedTarget.search === currentSearchWithPrefix;
      if (isSamePage && resolvedTarget.href.includes("#")) {
        return;
      }

      if (isSamePage) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      startTransition(resolvedTarget);
    },
    [currentSearchWithPrefix, pathname, startTransition, transitionsEnabled]
  );

  useEffect(() => {
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [handleDocumentClick]);

  const handleFadeOutComplete = useCallback(() => {
    if (status !== "fading-out") return;
    const target = targetRef.current;
    if (!target) {
      setStatus("idle");
      return;
    }
    router.push(target.href);
    setStatus("navigating");
  }, [router, status]);

  useEffect(() => {
    if (status !== "navigating" || !targetRef.current) return;
    const target = targetRef.current;
    if (
      pathname === target.pathname &&
      currentSearchWithPrefix === (target.search || "")
    ) {
      setStatus("fading-in");
    }
  }, [currentSearchWithPrefix, pathname, status]);

  const handleFadeInComplete = useCallback(() => {
    if (status !== "fading-in") return;
    targetRef.current = null;
    setStatus("idle");
  }, [status]);

  useEffect(() => {
    if (transitionsEnabled || status === "idle") return;
    targetRef.current = null;
    setStatus("idle");
  }, [status, transitionsEnabled]);

  const contextValue = useMemo(
    () => ({
      status,
      transitionsEnabled,
      handleFadeOutComplete,
      handleFadeInComplete
    }),
    [handleFadeInComplete, handleFadeOutComplete, status, transitionsEnabled]
  );

  return (
    <TransitionContext.Provider value={contextValue}>
      {children}
    </TransitionContext.Provider>
  );
}
