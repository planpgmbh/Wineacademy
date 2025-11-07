"use client";

import { useMemo } from "react";

type SeminarDateBadgeProps = {
  date: string | Date;
  className?: string;
  align?: "center" | "start";
};

const DAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "short" });

const parseDate = (value: string | Date): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const ALIGN_CLASSES: Record<NonNullable<SeminarDateBadgeProps["align"]>, string> = {
  center: "items-center justify-center text-center",
  start: "items-center justify-center text-center md:items-start md:justify-start md:text-left"
};

export function SeminarDateBadge({ date, className, align = "center" }: SeminarDateBadgeProps) {
  const dateParts = useMemo(() => {
    const parsed = parseDate(date);
    if (!parsed) {
      return null;
    }

    return {
      day: DAY_FORMATTER.format(parsed),
      month: MONTH_FORMATTER.format(parsed).toUpperCase()
    };
  }, [date]);

  if (!dateParts) {
    return null;
  }

  return (
    <div
      className={joinClasses(
        "flex flex-col items-center justify-center gap-1 text-center text-base-content/70 md:w-[var(--width-seminar-date)]",
        ALIGN_CLASSES[align],
        className
      )}
    >
      <span className="text-3xl font-semibold tracking-tight text-base-content md:text-4xl">{dateParts.day}</span>
      <span className="hidden h-px w-8 bg-base-content/30 md:block" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-base-content/60 md:tracking-[0.35em]">
        {dateParts.month}
      </span>
    </div>
  );
}
