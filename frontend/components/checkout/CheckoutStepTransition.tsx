'use client';

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { transitionConfig } from "@/lib/config/transitionConfig";
import { useEffect } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type CheckoutStepTransitionProps = {
  stepKey: string;
  children: ReactNode;
  onAfterExit?: () => void;
};

export function CheckoutStepTransition({ stepKey, children, onAfterExit }: CheckoutStepTransitionProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!prefersReducedMotion) return;
    onAfterExit?.();
  }, [prefersReducedMotion, onAfterExit, stepKey]);

  if (prefersReducedMotion) {
    return <div data-step={stepKey}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" onExitComplete={onAfterExit}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: transitionConfig.duration, ease: transitionConfig.easing }
        }}
        exit={{
          opacity: 0,
          transition: { duration: transitionConfig.duration, ease: transitionConfig.easing }
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
