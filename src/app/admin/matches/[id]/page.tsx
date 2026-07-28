import { prisma } from '@/lib/prisma';
import { settleMatch } from '@/actions/settlement';
import { cancelMatch } from '@/actions/matches';
import { updateOdds } from '@/actions/odds';
import { isMatchLocked } from '@/lib/matchLock';
import { redirect } from 'next/navigation';

const marketLabel: Record<string, string> = {
  '1X2': 'Maç Sonucu',
  SCORE: 'Skor',
  OU_GOALS: 'Toplam Gol',
  HT_OU_GOALS: 'İlk Yarı Toplam Gol',
  BTS: 'KG Var/Yok',
  NOVELTY: 'Eğlenceli Bahisler',
  PLAYER_GOALS: 'Oyuncu Golü',
  FIGHT: 'Kavga',
  LATE: 'Geç Kalma',
};

export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      odds: true,
    },
  });
  if (!match) return <p className="text-text-muted">Maç bulunamadı.</p>;

  const allPlayers = [...match.homeTeam.players, ...match.awayTeam.players];
  const playerNameById = new Map(allPlayers.map((p) => [p.id, p.name]));
  const locked = isMatchLocked(match.kickoffTime);

  function describeOddsSelection(market: string, selectionKey: string) {
    if (market === 'PLAYER_GOALS' || market === 'FIGHT' || market === 'LATE') {
      const [playerId, rest] = selectionKey.split(':');
      return `${playerNameById.get(playerId) ?? playerId} · ${rest}`;
    }
    return selectionKey;
  }

  const oddsByMarket = new Map<string, typeof match.odds>();
  for (const o of match.odds) {
    oddsByMarket.set(o.market, [...(oddsByMarket.get(o.market) ?? []), o]);
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">{match.homeTeam.name} vs {match.awayTeam.name}</h2>
      <p className="mb-4 text-sm text-text-muted">Durum: {match.status}</p>

      {match.status === 'finished' && (
        <div className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4 text-sm text-text-primary">
          <p>Sonuç: {match.finalHomeScore} - {match.finalAwayScore}</p>
          <p>İlk yarı: {match.htHomeScore} - {match.htAwayScore}</p>
          <p>Kırmızı kart: {match.redCard ? 'Evet' : 'Hayır'}</p>
          <p>Sahaya giriş: {match.pitchInvasion ? 'Evet' : 'Hayır'}</p>
          <p>Hakem tartışması: {match.refereeArgument ? 'Evet' : 'Hayır'}</p>
          <p>Maç yarıda kaldı: {match.matchAbandoned ? 'Evet' : 'Hayır'}</p>
        </div>
      )}

      {match.status === 'cancelled' && (
        <p className="text-sm text-text-muted">Bu maç iptal edildi, bekleyen kuponlar iade edildi.</p>
      )}

      {match.status !== 'finished' && match.status !== 'cancelled' && (
        <>
          <form
            action={async (formData) => {
              'use server';
              const homeScore = parseInt(formData.get('homeScore') as string, 10);
              const awayScore = parseInt(formData.get('awayScore') as string, 10);
              const htHomeScore = parseInt(formData.get('htHomeScore') as string, 10);
              const htAwayScore = parseInt(formData.get('htAwayScore') as string, 10);
              const playerGoals = allPlayers.map((p) => ({
                playerId: p.id,
                goalCount: parseInt((formData.get(`goals_${p.id}`) as string) || '0', 10),
              }));
              const redCard = formData.get('redCard') === 'on';
              const pitchInvasion = formData.get('pitchInvasion') === 'on';
              const refereeArgument = formData.get('refereeArgument') === 'on';
              const matchAbandoned = formData.get('matchAbandoned') === 'on';
              const fightPlayerIds = allPlayers
                .filter((p) => formData.get(`fight_${p.id}`) === 'on')
                .map((p) => p.id);
              const latePlayerIds = allPlayers
                .filter((p) => formData.get(`late_${p.id}`) === 'on')
                .map((p) => p.id);
              const yellowCardPlayerIds = allPlayers
                .filter((p) => formData.get(`yellow_${p.id}`) === 'on')
                .map((p) => p.id);
              const result = await settleMatch(
                match.id,
                homeScore,
                awayScore,
                htHomeScore,
                htAwayScore,
                playerGoals,
                redCard,
                pitchInvasion,
                refereeArgument,
                matchAbandoned,
                fightPlayerIds,
                latePlayerIds,
                yellowCardPlayerIds
              );
              if (!('error' in result)) redirect('/admin');
            }}
            className="mb-6 flex flex-col gap-4"
          >
            <div className="flex gap-2">
              <input name="homeScore" type="number" min={0} placeholder="Ev sahibi skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
              <input name="awayScore" type="number" min={0} placeholder="Deplasman skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
            </div>
            <div className="flex gap-2">
              <input name="htHomeScore" type="number" min={0} placeholder="İlk yarı ev sahibi skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
              <input name="htAwayScore" type="number" min={0} placeholder="İlk yarı deplasman skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
            </div>

            <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Oyuncu Golleri</h3>
              {allPlayers.map((p) => (
                <div key={p.id} className="mb-1 flex items-center justify-between text-sm text-text-primary">
                  <span>{p.name}</span>
                  <input name={`goals_${p.id}`} type="number" min={0} defaultValue={0} className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Eğlenceli Olaylar</h3>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="redCard" /> Kırmızı kart çıktı mı?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="pitchInvasion" /> Sahaya izinsiz biri girdi mi?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="refereeArgument" /> Hakem tartışması çıktı mı?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="matchAbandoned" /> Maç yarıda mı kaldı?
              </label>
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">Kavgaya karışanlar</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`fight_${p.id}`} /> {p.name}
                </label>
              ))}
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">Sahaya geç kalanlar</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`late_${p.id}`} /> {p.name}
                </label>
              ))}
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">🟨 Sarı kart görenler</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`yellow_${p.id}`} /> {p.name}
                </label>
              ))}
            </div>

            <button className="pop-interactive rounded-full bg-ferrari-red px-4 py-2 text-sm font-semibold text-text-primary">
              Sonuçlandır (geri alınamaz)
            </button>
          </form>

          {locked ? (
            <p className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4 text-sm text-text-muted">
              Maç saati geçti, oranlar kilitlendi — sadece sonuçlandırma yapılabilir.
            </p>
          ) : (
            <div className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Oranları Düzenle</h3>
              <form
                action={async (formData) => {
                  'use server';
                  const updates = match.odds
                    .map((o) => {
                      const raw = formData.get(`odds_${o.id}`) as string;
                      const value = parseFloat(raw);
                      return { oddsId: o.id, oddsValue: value };
                    })
                    .filter((u) => Number.isFinite(u.oddsValue));
                  await updateOdds(match.id, updates);
                }}
                className="flex flex-col gap-3"
              >
                {[...oddsByMarket.entries()].map(([market, rows]) => (
                  <div key={market}>
                    <p className="mb-1 text-xs font-semibold text-text-muted">{marketLabel[market] ?? market}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      {rows.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-text-muted">
                            {describeOddsSelection(o.market, o.selectionKey)}
                          </span>
                          <input
                            name={`odds_${o.id}`}
                            type="number"
                            step="0.01"
                            min="1.01"
                            defaultValue={o.oddsValue}
                            className="w-20 rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="pop-interactive rounded-full border border-line px-4 py-2 text-sm font-semibold text-text-primary">
                  Oranları Kaydet
                </button>
              </form>
            </div>
          )}

          <form
            action={async () => {
              'use server';
              const result = await cancelMatch(match.id);
              if (!('error' in result)) redirect('/admin');
            }}
          >
            <button className="pop-interactive w-full rounded-full border border-ferrari-red px-4 py-2 text-sm font-semibold text-ferrari-red">
              Maçı İptal Et (oynanmadı, bekleyen kuponları iade eder)
            </button>
          </form>
        </>
      )}
    </div>
  );
}
