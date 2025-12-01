type SliderDotsProps = {
  count: number;
  activeIndex: number;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export function SliderDots({
  count,
  activeIndex,
  className = "mt-2 flex justify-center gap-2.5",
  activeClassName = "bg-primary",
  inactiveClassName = "bg-primary/30"
}: SliderDotsProps) {
  if (!Number.isFinite(count) || count <= 1) {
    return null;
  }
  const items = Array.from({ length: Math.floor(count) });
  return (
    <div className={className}>
      {items.map((_, index) => (
        <span
          key={`dot-${index}`}
          className={`h-2 w-2 rounded-full transition-colors duration-200 ${
            index === activeIndex ? activeClassName : inactiveClassName
          }`}
        />
      ))}
    </div>
  );
}
