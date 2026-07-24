'use client';

import Link from 'next/link';
import { useState } from 'react';
import { playerOverall, teamStarRating } from '@/lib/teamRating';

export type PitchPlayer = {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  styleInspiration: string | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  marketValue: number | null;
  playerGoals: { goalCount: number }[];
};

type Row = 'GK' | 'DEF' | 'MID' | 'FWD' | 'OTHER';
const ROW_LABEL: Record<Row, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet', OTHER: 'Diğer' };
const ORDER_FROM_EDGE: Row[] = ['OTHER', 'GK', 'DEF', 'MID', 'FWD'];

function groupByPosition(players: PitchPlayer[]): Record<Row, PitchPlayer[]> {
  const groups: Record<Row, PitchPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [], OTHER: [] };
  for (const p of players) {
    const row: Row = p.position === 'GK' || p.position === 'DEF' || p.position === 'MID' || p.position === 'FWD' ? p.position : 'OTHER';
    groups[row].push(p);
  }
  return groups;
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[10px] text-white/60">Güç verisi yok</span>;
  const filled = Math.round(rating);
  return (
    <span className="text-xs">
      <span className="text-amber-300">{'★'.repeat(filled)}</span>
      <span className="text-white/30">{'★'.repeat(5 - filled)}</span>
      <span className="ml-1 text-[10px] text-white/70">({rating.toFixed(1)})</span>
    </span>
  );
}

function PlayerChip({ player, displayName, onClick }: { player: PitchPlayer; displayName: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-16 flex-col items-center gap-0.5 rounded-lg border-2 border-white/50 bg-white/90 px-1 py-1.5 text-center active:bg-white"
    >
      <span className="text-[10px] font-bold text-green-800 leading-tight line-clamp-2">{displayName}</span>
      <span className="text-[8px] text-green-600">{player.number ? `#${player.number}` : ''}</span>
    </button>
  );
}

function TeamHalf({
  teamName,
  players,
  order,
  showInspiration,
  onSelectPlayer,
}: {
  teamName: string;
  players: PitchPlayer[];
  order: Row[];
  showInspiration: boolean;
  onSelectPlayer: (p: PitchPlayer) => void;
}) {
  const groups = groupByPosition(players);
  const rating = teamStarRating(players);
  return (
    <div className="flex flex-1 flex-col justify-center gap-2 p-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-white">{teamName}</span>
        <Stars rating={rating} />
      </div>
      {order.map((row) =>
        groups[row].length === 0 ? null : (
          <div key={row} className="flex flex-wrap justify-center gap-1.5">
            {groups[row].map((p) => (
              <PlayerChip
                key={p.id}
                player={p}
                displayName={showInspiration && p.styleInspiration ? p.styleInspiration : p.name}
                onClick={() => onSelectPlayer(p)}
              />
            ))}
          </div>
        )
      )}
      {players.length === 0 && <p className="text-center text-[10px] text-white/60">Kadro girilmemiş.</p>}
    </div>
  );
}

export default function SquadPitch({
  homeTeamName,
  awayTeamName,
  homePlayers,
  awayPlayers,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: PitchPlayer[];
  awayPlayers: PitchPlayer[];
}) {
  const [showInspiration, setShowInspiration] = useState(false);
  const [selected, setSelected] = useState<PitchPlayer | null>(null);

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Kadrolar</h2>
        <button
          onClick={() => setShowInspiration((v) => !v)}
          className={`rounded-lg border-2 px-2 py-1 text-[10px] font-bold ${showInspiration ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500'}`}
        >
          {showInspiration ? '⭐ İlham Alınan Futbolcular' : 'İlham Alınan İsimleri Göster'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-green-700 via-green-700 to-green-800 shadow-lg">
        <TeamHalf
          teamName={awayTeamName}
          players={awayPlayers}
          order={ORDER_FROM_EDGE}
          showInspiration={showInspiration}
          onSelectPlayer={setSelected}
        />
        <div className="mx-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/40" />
          <div className="h-3 w-3 rounded-full border border-white/40" />
          <div className="h-px flex-1 bg-white/40" />
        </div>
        <TeamHalf
          teamName={homeTeamName}
          players={homePlayers}
          order={[...ORDER_FROM_EDGE].reverse()}
          showInspiration={showInspiration}
          onSelectPlayer={setSelected}
        />
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {selected.name} {selected.number ? <span className="text-gray-400">#{selected.number}</span> : null}
                </h3>
                {selected.styleInspiration && (
                  <p className="text-xs italic text-gray-400">Oyun stili esini: {selected.styleInspiration}</p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400">Kapat</button>
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              <p>Mevki: <span className="font-semibold">
                {selected.position === 'GK' || selected.position === 'DEF' || selected.position === 'MID' || selected.position === 'FWD'
                  ? ROW_LABEL[selected.position]
                  : 'Belirtilmemiş'}
              </span></p>
              <p>GÜÇ: <span className="font-semibold">{playerOverall(selected) ?? '-'}</span></p>
              <p>Toplam Gol: <span className="font-semibold">{selected.playerGoals.reduce((s, g) => s + g.goalCount, 0)}</span></p>
              {selected.marketValue !== null && (
                <p>Piyasa Değeri: <span className="font-semibold">{selected.marketValue} STA</span></p>
              )}
            </div>
            <Link href={`/players/${selected.id}`} className="mt-3 block text-center text-xs font-semibold text-green-700">
              Tam Profili Gör ›
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
