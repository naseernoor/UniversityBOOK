type VerificationStatus = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";

type VerificationBadgeProps = {
  status: VerificationStatus;
  approvedLabel?: string;
  className?: string;
};

const STYLES: Record<
  VerificationStatus,
  {
    label: string;
    className: string;
    icon: string;
  }
> = {
  APPROVED: {
    label: "Admin Verified",
    className: "border-sky-300 bg-sky-50 text-sky-800 shadow-[0_8px_20px_rgba(14,165,233,0.12)]",
    icon: "✓"
  },
  PENDING: {
    label: "Pending Review",
    className: "border-amber-300 bg-amber-50 text-amber-800",
    icon: "•"
  },
  REJECTED: {
    label: "Needs Review",
    className: "border-rose-300 bg-rose-50 text-rose-800",
    icon: "!"
  },
  NOT_REQUESTED: {
    label: "Not Verified",
    className: "border-brand-300 bg-brand-50 text-brand-700",
    icon: "•"
  }
};

export default function VerificationBadge({
  status,
  approvedLabel,
  className = ""
}: VerificationBadgeProps) {
  const config = STYLES[status];
  const label = status === "APPROVED" && approvedLabel ? approvedLabel : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-[0.03em] ${config.className} ${className}`.trim()}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[11px] leading-none">
        {config.icon}
      </span>
      {label}
    </span>
  );
}
