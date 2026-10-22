import Link from 'next/link';
import { computeUserScore } from '@/lib/score';

export type HorseBetStatRow = {
  horseName: string;
  status: 'pending' | 'won' | 'lost';
  stake: number;
  potentialWin: number;
};

function mostWonHorse(bets: HorseBetStatRow[]): string | null {
  const counts = new Map<string, number>();
  for (const bet of bets) {
    if (bet.status !== 'won') continue;
    counts.set(bet.horseName, (counts.get(bet.horseName) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export default function HorseRaceStatsWidget({
  isLoggedIn,
  bets,
}: {
  isLoggedIn: boolean;
  bets: HorseBetStatRow[];
}) {
  if (!isLoggedIn || bets.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
        <h3 className="mb-2 font-display text-lg tracking-wide text-text-primary">At Yarışı Nedir?</h3>
        <ul className="mb-4 flex flex-col gap-1.5 text-sm text-text-muted">
          <li>🎫 Her turda 7 at yarışır, bahis penceresi sadece 7 saniye — hızlı karar ver.</li>
          <li>📊 Oranlar atın hız/form/şans puanına göre otomatik hesaplanır.</li>
          <li>🤝 İstersen bir ata ortak olup pasif STA geliri kazanabilirsin (At Mağazası).</li>
        </ul>
        <Link href="/at-yarisi" className="pop-interactive inline-block rounded-full bg-gold px-5 py-2 text-sm font-semibold text-pitch-night">
          Hemen Oyna →
        </Link>
      </div>
    );
  }

  const score = computeUserScore(bets);
  const won = bets.filter((b) => b.status === 'won').length;
  const lost = bets.filter((b) => b.status === 'lost').length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const favorite = mostWonHorse(bets);

  return (
    <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
      <h3 className="mb-3 font-display text-lg tracking-wide text-text-primary">At Yarışı İstatistiklerin</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`font-display text-2xl ${score.net > 0 ? 'text-grass' : score.net < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {score.net > 0 ? '+' : ''}{score.net}
          </p>
          <p className="text-[11px] text-text-muted">Net Puan</p>
        </div>
        <div>
          <p className="font-display text-2xl text-text-primary">{bets.length}</p>
          <p className="text-[11px] text-text-muted">Kupon</p>
        </div>
        <div>
          <p className="font-display text-2xl text-gold">%{winRate}</p>
          <p className="text-[11px] text-text-muted">Kazanma Oranı</p>
        </div>
      </div>
      {favorite && (
        <p className="mt-3 text-center text-xs text-text-muted">
          En çok kazandığın at: <span className="text-text-primary">{favorite}</span>
        </p>
      )}
    </div>
  );
}
