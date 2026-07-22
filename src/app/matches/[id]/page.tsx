'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { placeBet } from '@/actions/bets';

type Odds = { market: string; selectionKey: string; oddsValue: number };
type MatchData = {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  kickoffTime: string;
  odds: Odds[];
};

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [selected, setSelected] = useState<Odds[]>([]);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`).then((r) => r.json()).then(setMatch);
  }, [id]);

  if (!match) return <main className="p-4">Yükleniyor...</main>;

  function toggleSelection(o: Odds) {
    setSelected((prev) => {
      const withoutSameMarket = prev.filter((s) => s.market !== o.market);
      const alreadySelected = prev.some((s) => s.market === o.market && s.selectionKey === o.selectionKey);
      return alreadySelected ? withoutSameMarket : [...withoutSameMarket, o];
    });
  }

  const totalOdds = selected.reduce((acc, o) => acc * o.oddsValue, 1);

  async function submit() {
    setMessage(null);
    const result = await placeBet(
      match!.id,
      selected.map((s) => ({ market: s.market, selectionKey: s.selectionKey })),
      stake
    );
    setMessage(result.error ?? 'Kupon başarıyla oluşturuldu!');
  }

  const oneXTwo = match.odds.filter((o) => o.market === '1X2');
  const ouGoals = match.odds.filter((o) => o.market === 'OU_GOALS');

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">{match.homeTeam.name} vs {match.awayTeam.name}</h1>
      <p className="mb-4 text-sm text-gray-500">{new Date(match.kickoffTime).toLocaleString('tr-TR')}</p>

      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Maç Sonucu</h2>
        <div className="flex gap-2">
          {oneXTwo.map((o) => (
            <button
              key={o.selectionKey}
              onClick={() => toggleSelection(o)}
              className={`flex-1 rounded border py-2 text-sm ${selected.some((s) => s.selectionKey === o.selectionKey && s.market === o.market) ? 'bg-green-600 text-white' : ''}`}
            >
              {o.selectionKey} ({o.oddsValue})
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Toplam Gol</h2>
        <div className="flex gap-2">
          {ouGoals.map((o) => (
            <button
              key={o.selectionKey}
              onClick={() => toggleSelection(o)}
              className={`flex-1 rounded border py-2 text-sm ${selected.some((s) => s.selectionKey === o.selectionKey && s.market === o.market) ? 'bg-green-600 text-white' : ''}`}
            >
              {o.selectionKey} ({o.oddsValue})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>Toplam Oran</span>
          <span className="font-bold">{selected.length ? totalOdds.toFixed(2) : '-'}</span>
        </div>
        <input
          type="number"
          min={1}
          value={stake}
          onChange={(e) => setStake(parseInt(e.target.value, 10) || 0)}
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="STA miktarı"
        />
        <button onClick={submit} className="w-full rounded bg-green-600 py-2 font-semibold text-white">
          Kuponu Onayla
        </button>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </section>
    </main>
  );
}
