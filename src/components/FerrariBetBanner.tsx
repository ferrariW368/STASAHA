const items = [
  { emoji: '🎰', text: 'FERRARI BET × STASAHA' },
  { emoji: '🎲', text: 'ŞANSINI DENE, KAZAN!' },
  { emoji: '💰', text: 'JACKPOT: STA YAĞMURU' },
  { emoji: '🏆', text: 'RESMİ SPONSOR: EFSANE HALI SAHA' },
  { emoji: '🔥', text: 'ORANLAR ATEŞ GİBİ' },
];

function SideBannerContent() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 rounded-2xl border-4 border-double border-amber-300 bg-gradient-to-b from-red-900 via-neutral-900 to-red-900 px-3 py-8 text-center shadow-[0_0_35px_rgba(251,191,36,0.55)]">
      <span className="animate-bounce text-4xl">🎰</span>
      <span className="text-sm font-black leading-tight tracking-wide text-amber-300">FERRARI</span>
      <span className="text-sm font-black leading-tight tracking-wide text-amber-300">BET</span>
      <span className="text-[10px] font-bold text-neutral-400">✕</span>
      <span className="text-sm font-black leading-tight tracking-wide text-white">STASAHA</span>
      <div className="my-1 h-px w-16 bg-amber-400/40" />
      {items.slice(1).map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-2xl">{item.emoji}</span>
          <span className="text-[10px] font-black leading-tight tracking-wide text-amber-400">
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
      <div className="flex items-center gap-3 overflow-x-auto rounded-xl border-2 border-double border-amber-300 bg-gradient-to-r from-red-900 via-neutral-900 to-red-900 px-3 py-2 shadow-[0_0_20px_rgba(251,191,36,0.45)]">
        <span className="shrink-0 animate-bounce text-xl">🎰</span>
        <span className="shrink-0 text-xs font-black tracking-wide text-amber-300">
          FERRARI BET <span className="text-neutral-400">✕</span> <span className="text-white">STASAHA</span>
        </span>
        {items.slice(1).map((item, i) => (
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
