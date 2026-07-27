import { generateFakeStats } from '@/lib/fakeStats';
import AnimatedNumber from '@/components/AnimatedNumber';

function StatRow({ label, home, away, suffix = '' }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-blue-400"><AnimatedNumber value={home} />{suffix}</span>
        <span className="text-text-muted">{label}</span>
        <span className="font-bold text-green-400"><AnimatedNumber value={away} />{suffix}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
        <div className="bg-blue-500" style={{ width: `${homePct}%` }} />
        <div className="bg-green-500" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

export default function MatchStats({
  matchId,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
}: {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
}) {
  const stats = generateFakeStats(matchId, homeScore, awayScore);

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold text-text-muted">📊 Maç İstatistikleri</h2>
      <div className="rounded-lg border border-line bg-pitch-night-raised p-3">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold text-text-muted">
          <span className="truncate text-blue-400">{homeTeamName}</span>
          <span className="truncate text-green-400">{awayTeamName}</span>
        </div>
        <StatRow label="Topla Oynama" home={stats.possession[0]} away={stats.possession[1]} suffix="%" />
        <StatRow label="Toplam Şut" home={stats.shots[0]} away={stats.shots[1]} />
        <StatRow label="İsabetli Şut" home={stats.shotsOnTarget[0]} away={stats.shotsOnTarget[1]} />
        <StatRow label="Korner" home={stats.corners[0]} away={stats.corners[1]} />
        <StatRow label="İkili Mücadele" home={stats.duelsWon[0]} away={stats.duelsWon[1]} />
        <StatRow label="Hava Topu" home={stats.aerialDuelsWon[0]} away={stats.aerialDuelsWon[1]} />
        <StatRow label="Ofsayt" home={stats.offsides[0]} away={stats.offsides[1]} />
        <p className="mt-2 text-center text-[9px] italic text-text-muted">
          İstatistikler eğlence amaçlıdır, gerçek maç kaydı değildir.
        </p>
      </div>
    </section>
  );
}
