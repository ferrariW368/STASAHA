const items = [
  { emoji: '🎰', text: 'FERRARI BET' },
  { emoji: '🎲', text: 'ŞANSINI DENE, KAZAN!' },
  { emoji: '🏆', text: 'SPONSOR: EFSANE HALI SAHA' },
  { emoji: '🔥', text: 'ORANLAR ATEŞ GİBİ' },
];

function SideBannerContent() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-2xl border-4 border-double border-amber-400 bg-gradient-to-b from-red-900 via-neutral-900 to-red-900 px-3 py-8 text-center shadow-[0_0_25px_rgba(251,191,36,0.4)]">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-3xl">{item.emoji}</span>
          <span className="text-[11px] font-black leading-tight tracking-wide text-amber-400">
            {item.text}
          </span>
        </div>
      ))}
      <span className="animate-pulse text-[10px] font-bold text-red-400">18+ ŞAKA PARASI · STA</span>
    </div>
  );
}

function MobileBannerStrip() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-3">
      <div className="flex items-center gap-3 overflow-x-auto rounded-xl border-2 border-double border-amber-400 bg-gradient-to-r from-red-900 via-neutral-900 to-red-900 px-3 py-2 shadow-[0_0_15px_rgba(251,191,36,0.35)]">
        {items.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1 text-[11px] font-black tracking-wide text-amber-400">
            <span className="text-base">{item.emoji}</span>
            {item.text}
          </span>
        ))}
        <span className="shrink-0 animate-pulse text-[10px] font-bold text-red-400">18+ ŞAKA PARASI · STA</span>
      </div>
    </div>
  );
}

export default function FerrariBetBanner() {
  return (
    <>
      <div className="fixed left-4 top-1/2 z-0 hidden h-[600px] max-h-[80vh] w-36 -translate-y-1/2 lg:block">
        <SideBannerContent />
      </div>
      <div className="fixed right-4 top-1/2 z-0 hidden h-[600px] max-h-[80vh] w-36 -translate-y-1/2 lg:block">
        <SideBannerContent />
      </div>
      <div className="lg:hidden">
        <MobileBannerStrip />
      </div>
    </>
  );
}
