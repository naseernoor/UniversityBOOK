type UniBookBrandProps = {
  compact?: boolean;
  showLetterhead?: boolean;
  className?: string;
};

export default function UniBookBrand({
  compact = false,
  showLetterhead = false,
  className = ""
}: UniBookBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <span
        className={`relative inline-flex items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white shadow-[0_16px_38px_rgba(12,72,56,0.24)] ${
          compact ? "h-11 w-11 text-sm" : "h-14 w-14 text-base"
        }`}
      >
        <span className="absolute inset-[2px] rounded-[1.15rem] border border-white/15" />
        <span className="relative font-black tracking-[0.2em]">UB</span>
      </span>

      <span className="flex min-w-0 flex-col">
        <span className={`font-black uppercase tracking-[0.22em] text-brand-950 ${compact ? "text-sm" : "text-lg"}`}>
          UniBOOK
        </span>
        {showLetterhead ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-600">
            Official Academic Network
          </span>
        ) : null}
      </span>
    </div>
  );
}
