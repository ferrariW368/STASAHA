'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { placeBet } from '@/actions/bets';
import AdBanner from '@/components/AdBanner';

type Odds = { market: string; selectionKey: string; oddsValue: number };
type PlayerData = { id: string; name: string; number: number | null };
type MatchData = {
  id: string;
  homeTeam: { name: string; players: PlayerData[] };
  awayTeam: { name: string; players: PlayerData[] };
  kickoffTime: string;
  odds: Odds[];
};

function findOdds(list: Odds[], market: string, selectionKey: string) {
  return list.find((o) => o.market === market && o.selectionKey === selectionKey);
}

function OddsButton({
  odds,
  label,
  active,
  onClick,
}: {
  odds: Odds | undefined;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  if (!odds) return null;
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center rounded-lg border py-2 text-sm transition-colors ${
        active
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-gray-300 bg-white text-gray-800 active:bg-gray-100'
      }`}
    >
      <span className="text-xs">{label}</span>
      <span className="font-bold">{odds?.oddsValue.toFixed(2)}</span>
    </button>
  );
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [selected, setSelected] = useState<Odds[]>([]);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/matches/${id}`).then((r) => r.json()).then(setMatch);
  }, [id]);

  const totalOdds = selected.reduce((acc, o) => acc * o.oddsValue, 1);
  const potentialWin = selected.length ? Math.round(stake * totalOdds) : 0;

  const scoreGrid = useMemo(() => {
    if (!match) return [];
    const rows: { home: number; cells: (Odds | undefined)[] }[] = [];
    for (let h = 0; h <= 5; h++) {
      const cells: (Odds | undefined)[] = [];
      for (let a = 0; a <= 5; a++) {
        cells.push(findOdds(match.odds, 'SCORE', `${h}-${a}`));
      }
      rows.push({ home: h, cells });
    }
    return rows;
  }, [match]);

  if (!match) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-500">
        Maç yükleniyor...
      </main>
    );
  }

  function isSelected(o: Odds) {
    return selected.some((s) => s.market === o.market && s.selectionKey === o.selectionKey);
  }

  function oddsButtonProps(o: Odds | undefined) {
    return { active: o ? isSelected(o) : false, onClick: () => toggleSelection(o) };
  }

  function toggleSelection(o: Odds | undefined) {
    if (!o) return;
    setSelected((prev) => {
      const withoutSameMarketAndPlayer = prev.filter((s) => {
        if (s.market !== o.market) return true;
        // for PLAYER_GOALS, only one band per player can be selected, other players stay
        if (o.market === 'PLAYER_GOALS') {
          const [prevPlayerId] = s.selectionKey.split(':');
          const [newPlayerId] = o.selectionKey.split(':');
          return prevPlayerId !== newPlayerId;
        }
        return false;
      });
      const already = prev.some((s) => s.market === o.market && s.selectionKey === o.selectionKey);
      return already ? withoutSameMarketAndPlayer : [...withoutSameMarketAndPlayer, o];
    });
  }

  async function submit() {
    setMessage(null);
    setSubmitting(true);
    const result = await placeBet(
      match!.id,
      selected.map((s) => ({ market: s.market, selectionKey: s.selectionKey })),
      stake
    );
    setSubmitting(false);
    setMessage(result.error ?? 'Kupon başarıyla oluşturuldu!');
    if (!result.error) setSelected([]);
  }

  const oneXTwo = match.odds.filter((o) => o.market === '1X2');
  const ouGoals = match.odds.filter((o) => o.market === 'OU_GOALS');
  const oneXTwoLabels: Record<string, string> = { '1': match.homeTeam.name, X: 'Berabere', '2': match.awayTeam.name };

  return (
    <main className="mx-auto max-w-lg px-4 pb-40 pt-6">
      <div className="mb-5 rounded-xl bg-white p-4 text-center shadow-sm">
        <h1 className="text-lg font-bold">
          {match.homeTeam.name} <span className="text-gray-400">vs</span> {match.awayTeam.name}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {new Date(match.kickoffTime).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Maç Sonucu</h2>
        <div className="flex gap-2">
          {oneXTwo.map((o) => (
            <OddsButton
              key={o.selectionKey}
              odds={o}
              label={oneXTwoLabels[o.selectionKey] ?? o.selectionKey}
              {...oddsButtonProps(o)}
            />
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Toplam Gol</h2>
        <div className="flex gap-2">
          {ouGoals.map((o) => (
            <OddsButton
              key={o.selectionKey}
              odds={o}
              label={o.selectionKey.startsWith('OVER') ? `${o.selectionKey.split('_')[1]} Üst` : `${o.selectionKey.split('_')[1]} Alt`}
              {...oddsButtonProps(o)}
            />
          ))}
        </div>
      </section>

      <AdBanner />

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Skor Tahmini</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b border-r border-gray-200 bg-gray-50 p-1 text-[10px] text-gray-400">Ev \ Dep</th>
                {[0, 1, 2, 3, 4, 5].map((a) => (
                  <th key={a} className="border-b border-gray-200 bg-gray-50 p-1 text-gray-500">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoreGrid.map((row) => (
                <tr key={row.home}>
                  <th className="border-r border-gray-200 bg-gray-50 p-1 text-gray-500">{row.home}</th>
                  {row.cells.map((o, i) =>
                    o ? (
                      <td key={i} className="border border-gray-100 p-0.5">
                        <button
                          onClick={() => toggleSelection(o)}
                          className={`w-full rounded py-1 text-[11px] font-semibold ${
                            isSelected(o) ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-700 active:bg-gray-200'
                          }`}
                        >
                          {o.oddsValue.toFixed(1)}
                        </button>
                      </td>
                    ) : (
                      <td key={i} />
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Oyuncu Golleri</h2>
        <div className="flex flex-col gap-3">
          {[
            { team: match.homeTeam, teamLabel: match.homeTeam.name },
            { team: match.awayTeam, teamLabel: match.awayTeam.name },
          ].map(({ team, teamLabel }) => (
            <div key={teamLabel} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-gray-500">{teamLabel}</p>
              <div className="flex flex-col gap-2">
                {team.players.map((p) => {
                  const onePlus = findOdds(match.odds, 'PLAYER_GOALS', `${p.id}:1+`);
                  const twoPlus = findOdds(match.odds, 'PLAYER_GOALS', `${p.id}:2+`);
                  if (!onePlus && !twoPlus) return null;
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate text-xs text-gray-700">
                        {p.name}
                        {p.number ? ` (#${p.number})` : ''}
                      </span>
                      <div className="flex flex-1 gap-1">
                        <OddsButton odds={onePlus} label="Gol Atar" {...oddsButtonProps(onePlus)} />
                        <OddsButton odds={twoPlus} label="2+ Gol" {...oddsButtonProps(twoPlus)} />
                      </div>
                    </div>
                  );
                })}
                {team.players.length === 0 && <p className="text-xs text-gray-400">Kadro girilmemiş.</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">🎉 Eğlenceli Bahisler</h2>
        <div className="mb-2 flex gap-2">
          <OddsButton odds={findOdds(match.odds, 'BTS', 'YES')} label="KG Var" {...oddsButtonProps(findOdds(match.odds, 'BTS', 'YES'))} />
          <OddsButton odds={findOdds(match.odds, 'BTS', 'NO')} label="KG Yok" {...oddsButtonProps(findOdds(match.odds, 'BTS', 'NO'))} />
        </div>
        <div className="mb-2 flex gap-2">
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'RED_CARD_YES')}
            label="🟥 Kart Çıkar"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'RED_CARD_YES'))}
          />
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'RED_CARD_NO')}
            label="🟥 Kart Çıkmaz"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'RED_CARD_NO'))}
          />
        </div>
        <div className="mb-2 flex gap-2">
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'PITCH_INVASION_YES')}
            label="🏃 Sahaya Dalan Olur"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'PITCH_INVASION_YES'))}
          />
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'PITCH_INVASION_NO')}
            label="🏃 Olmaz"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'PITCH_INVASION_NO'))}
          />
        </div>
        <div className="mb-2 flex gap-2">
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'REFEREE_ARGUMENT_YES')}
            label="🗣️ Hakemle Tartışılır"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'REFEREE_ARGUMENT_YES'))}
          />
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'REFEREE_ARGUMENT_NO')}
            label="🗣️ Sakin Geçer"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'REFEREE_ARGUMENT_NO'))}
          />
        </div>
        <div className="flex gap-2">
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'MATCH_ABANDONED_YES')}
            label="🚨 Maç Yarıda Kalır"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'MATCH_ABANDONED_YES'))}
          />
          <OddsButton
            odds={findOdds(match.odds, 'NOVELTY', 'MATCH_ABANDONED_NO')}
            label="🚨 Sonuna Kadar Oynanır"
            {...oddsButtonProps(findOdds(match.odds, 'NOVELTY', 'MATCH_ABANDONED_NO'))}
          />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">🥊 Kavga & Geç Kalma</h2>
        <div className="flex flex-col gap-3">
          {[
            { team: match.homeTeam, teamLabel: match.homeTeam.name },
            { team: match.awayTeam, teamLabel: match.awayTeam.name },
          ].map(({ team, teamLabel }) => (
            <div key={teamLabel} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-gray-500">{teamLabel}</p>
              <div className="flex flex-col gap-2">
                {team.players.map((p) => {
                  const fightYes = findOdds(match.odds, 'FIGHT', `${p.id}:YES`);
                  const lateYes = findOdds(match.odds, 'LATE', `${p.id}:YES`);
                  if (!fightYes && !lateYes) return null;
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate text-xs text-gray-700">{p.name}</span>
                      <div className="flex flex-1 gap-1">
                        <OddsButton odds={fightYes} label="Kavga Eder" {...oddsButtonProps(fightYes)} />
                        <OddsButton odds={lateYes} label="Geç Kalır" {...oddsButtonProps(lateYes)} />
                      </div>
                    </div>
                  );
                })}
                {team.players.length === 0 && <p className="text-xs text-gray-400">Kadro girilmemiş.</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {selected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {selected.map((s) => (
                <span key={`${s.market}-${s.selectionKey}`} className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-700">
                  {s.selectionKey} · {s.oddsValue.toFixed(2)}
                </span>
              ))}
            </div>
          )}
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">Toplam Oran</span>
            <span className="font-bold">{selected.length ? totalOdds.toFixed(2) : '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(parseInt(e.target.value, 10) || 0)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="STA"
            />
            <button
              onClick={submit}
              disabled={submitting || selected.length === 0 || stake <= 0}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? 'Gönderiliyor...' : `Kuponu Onayla${potentialWin ? ` · Kazanç ${potentialWin} STA` : ''}`}
            </button>
          </div>
          {message && (
            <p className={`mt-2 text-center text-sm ${message.includes('başarıyla') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
