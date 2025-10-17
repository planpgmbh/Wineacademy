import { useCallback } from "react";

const borderColorMix = "color-mix(in oklab, var(--color-base-content) 20%, transparent)";

type QuantitySelectorProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  className?: string;
};

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  className = ""
}: QuantitySelectorProps) {
  const decrease = useCallback(() => {
    onChange(Math.max(min, value - 1));
  }, [min, onChange, value]);

  const increase = useCallback(() => {
    onChange(value + 1);
  }, [onChange, value]);

  return (
    <div
      className={`flex items-center gap-0 rounded-full border bg-base-100 px-2 py-1 text-base-content/80 ${className}`.trim()}
      style={{ borderColor: borderColorMix }}
    >
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border text-lg leading-none transition-colors hover:bg-base-200"
        onClick={decrease}
        aria-label="Menge verringern"
        style={{ borderColor: borderColorMix }}
      >
        −
      </button>
      <span className="min-w-[1.5rem] px-[3px] text-center text-sm font-medium">{value}</span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border text-lg leading-none transition-colors hover:bg-base-200"
        onClick={increase}
        aria-label="Menge erhöhen"
        style={{ borderColor: borderColorMix }}
      >
        +
      </button>
    </div>
  );
}
