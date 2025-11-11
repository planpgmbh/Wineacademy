'use client';

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Wraps pages with a fade out/in transition triggered on pathname changes.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: 1, ease: "easeInOut" }
        }}
        exit={{
          opacity: 0,
          transition: { duration: 1, ease: "easeInOut" }
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
