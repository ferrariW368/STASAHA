import F1Car from './F1Car';

export default function AdBanner() {
  return (
    <div className="mb-5 overflow-hidden rounded-xl border-2 border-dashed border-red-600/60 bg-gradient-to-r from-red-900/40 via-neutral-900 to-neutral-900 p-4 text-center">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">Reklam Alanı</p>
      <F1Car className="mx-auto mb-2 h-8 w-auto text-red-600" />
      <p className="text-sm font-bold text-neutral-200">
        Buraya reklam vermek ister misin? <span className="text-amber-400">FERRARİ&apos;YE ULAŞIN</span>
      </p>
    </div>
  );
}
