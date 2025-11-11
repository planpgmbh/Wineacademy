'use client';

import type { ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { Variants } from "motion/react";
import { useEffect } from "react";
import { useTransitionContext } from "./TransitionProvider";
import { transitionConfig } from "@/lib/config/transitionConfig";

const transitionVariants: Variants = {
  enter: {
    opacity: 1,
    transition: {
      duration: transitionConfig.duration,
      ease: transitionConfig.easing
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: transitionConfig.duration,
      ease: transitionConfig.easing
    }
  }
};

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const controls = useAnimationControls();
  const {
    status,
    transitionsEnabled,
    handleFadeOutComplete,
    handleFadeInComplete
  } = useTransitionContext();

  useEffect(() => {
    if (!transitionsEnabled) {
      controls.set("enter");
      return;
    }
    if (status === "fading-out") {
      controls.start("exit").then(handleFadeOutComplete);
    } else if (status === "fading-in") {
      controls.start("enter").then(handleFadeInComplete);
    } else if (status === "idle") {
      controls.set("enter");
    }
  }, [
    controls,
    handleFadeInComplete,
    handleFadeOutComplete,
    status,
    transitionsEnabled
  ]);

  return (
    <motion.div
      className="h-full"
      initial="enter"
      animate={controls}
      variants={transitionVariants}
    >
      {children}
    </motion.div>
  );
}
