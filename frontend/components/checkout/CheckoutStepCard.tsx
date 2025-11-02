import { ReactNode } from "react";

type CheckoutStepCardVariant = "default" | "accent" | "warning";

type CheckoutStepCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  withDividers?: boolean;
  variant?: CheckoutStepCardVariant;
};

const VARIANT_CLASSNAMES: Record<CheckoutStepCardVariant, string> = {
  default: "border-base-200 bg-base-100",
  accent: "border-primary/50 bg-primary/5",
  warning: "border-warning/60 bg-warning/10"
};

export function CheckoutStepCard({
  title,
  description,
  children,
  className,
  contentClassName,
  withDividers = false,
  variant = "default"
}: CheckoutStepCardProps) {
  const variantClassName = VARIANT_CLASSNAMES[variant];
  const hasHeader = Boolean(title) || Boolean(description);
  const baseSpacingClass = withDividers ? "ui-divide" : "space-y-6";
  const spacingOffset = hasHeader ? "mt-4" : "mt-0";
  const contentWrapperClassName = `${spacingOffset} ${baseSpacingClass}`.trim();

  return (
    <section className={`rounded-2xl border p-6 shadow-sm md:p-8 ${variantClassName} ${className ?? ""}`.trim()}>
      {hasHeader ? (
        <div className="space-y-2">
          {title ? <h2 className="heading-ui">{title}</h2> : null}
          {description ? <p className="text-sm text-base-content/70">{description}</p> : null}
        </div>
      ) : null}
      <div className={`${contentWrapperClassName} ${contentClassName ?? ""}`.trim()}>{children}</div>
    </section>
  );
}
