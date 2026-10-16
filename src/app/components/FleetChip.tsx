import { cn } from "./ui/utils";

type FleetChipProps = {
  label: string;
  className?: string;
};

export function FleetChip({ label, className }: FleetChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs tracking-wide text-white/65",
        className,
      )}
    >
      {label}
    </span>
  );
}
