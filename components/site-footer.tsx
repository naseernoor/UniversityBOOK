import UniBookBrand from "@/components/unibook-brand";

export default function SiteFooter() {
  return (
    <footer className="border-t border-brand-200/80 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <UniBookBrand compact showLetterhead />
        <div className="text-sm text-brand-700 sm:text-right">
          <p className="font-semibold text-brand-900">UniBOOK official pages and transcript letterheads.</p>
          <p className="mt-1 text-xs">
            Developed and managed by Naseer Khan NOOR, member of NOOR family
          </p>
        </div>
      </div>
    </footer>
  );
}
