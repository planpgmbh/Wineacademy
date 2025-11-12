import { useCallback, type CSSProperties } from "react";

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

  const baseStyle: CSSProperties = { backgroundColor: "transparent" };

  return (
    <div className={`flex items-center gap-0 rounded-full border ui-border bg-transparent px-2 py-1 text-base-content/80 backdrop-blur-xl ${className}`.trim()} style={baseStyle}>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border ui-border text-lg leading-none bg-white/70 transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content/40"
        onClick={decrease}
        aria-label="Menge verringern"
      >
        −
      </button>
      <span className="min-w-[1.5rem] px-[3px] text-center text-sm font-medium">{value}</span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border ui-border text-lg leading-none bg-white/70 transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content/40"
        onClick={increase}
        aria-label="Menge erhöhen"
      >
        +
      </button>
    </div>
  );
}
