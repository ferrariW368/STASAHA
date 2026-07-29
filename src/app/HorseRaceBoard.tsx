'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CurrentRaceView } from '@/lib/horseRaceEngine';

// Poll cadence matches the live race page (src/app/at-yarisi/page.tsx) so the
// board's "current" row updates at the same rate the underlying data can
// actually change — no point polling faster than that page does.
const POLL_MS = 2000;

const phaseLabel: Record<'BETTING' | 'RACING' | 'FINISHED', string> = {
  BETTING: 'Bahis Açık',
  RACING: 'Canlı',
  FINISHED: 'Bitti',
};

export type RaceBoardRow = {
  id: string;
  raceNumber: number;
  phase: 'BETTING' | 'RACING' | 'FINISHED';
  createdAt: string;
  bettingEndsAt: string;
  raceEndsAt: string;
  top3: { position: number; name: string; number: number | null }[];
};

export type MyHorseBetRow = {
  id: string;
  horseName: string;
  horseNumber: number | null;
  stake: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
};

const betStatus: Record<'pending' | 'won' | 'lost', { text: string; className: string }> = {
  pending: { text: 'Bekliyor', className: 'bg-gold/10 text-gold' },
  won: { text: 'Kazandı', className: 'bg-grass/10 text-grass' },
  lost: { text: 'Kaybetti', className: 'bg-red-500/10 text-red-400' },
};

// A single split-flap unit: only replays the flip animation when the
// *displayed* text actually changes, not on every poll tick. The old text
// stays on screen through the first half of the flip, then swaps at the
// midpoint — mimicking a real split-flap display without needing per-
// character DOM churn.
function FlapCell({ value, className = '' }: { value: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setFlipping(true);
    const swap = setTimeout(() => setDisplay(value), 210);
    const done = setTimeout(() => setFlipping(false), 420);
    return () => {
      clearTimeout(swap);
      clearTimeout(done);
    };
  }, [value]);

  return <span className={`split-flap-cell ${flipping ? 'flap-animate' : ''} ${className}`}>{display}</span>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function rankingText(row: RaceBoardRow) {
  if (row.top3.length === 0) return row.phase === 'BETTING' ? 'Bahis bekliyor' : 'Devam ediyor';
  return row.top3
    .sort((a, b) => a.position - b.position)
    .map((e) => `${e.position}. ${e.name}`)
    .join('  ·  ');
}

function BoardRow({ row }: { row: RaceBoardRow }) {
  return (
    <div className="grid grid-cols-[3.2rem_1fr_2fr_auto] items-center gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0 sm:text-sm">
      <FlapCell value={formatTime(row.createdAt)} className="font-display tracking-wide text-text-primary" />
      <FlapCell value={`${row.raceNumber}. STA Yarışı`} className="text-text-primary" />
      <FlapCell value={rankingText(row)} className="truncate text-text-muted" />
      <FlapCell
        value={phaseLabel[row.phase]}
        className={
          row.phase === 'RACING'
            ? 'live-pulse rounded-full bg-ferrari-red/10 px-2 py-0.5 font-semibold text-ferrari-red'
            : row.phase === 'FINISHED'
              ? 'rounded-full bg-line px-2 py-0.5 font-semibold text-text-muted'
              : 'rounded-full bg-gold/10 px-2 py-0.5 font-semibold text-gold'
        }
      />
    </div>
  );
}

export default function HorseRaceBoard({
  initialRows,
  myBets,
  isLoggedIn,
}: {
  initialRows: RaceBoardRow[];
  myBets: MyHorseBetRow[];
  isLoggedIn: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<'live' | 'history'>('live');

  // Only the "current" race (today's most recent) can still be BETTING or
  // RACING — everything else in initialRows is already FINISHED and frozen.
  // Polling the same /api/horse-race/current endpoint the live race page
  // already uses (see src/app/at-yarisi/page.tsx) keeps this to a single
  // extra request per tick, merged into whichever row shares its id.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/horse-race/current');
        const data: CurrentRaceView = await res.json();
        if (cancelled || 'error' in data) return;
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === data.id);
          const merged: RaceBoardRow = {
            id: data.id,
            raceNumber: idx >= 0 ? prev[idx].raceNumber : prev.length + 1,
            phase: data.phase,
            createdAt: data.createdAt,
            bettingEndsAt: data.bettingEndsAt,
            raceEndsAt: data.raceEndsAt,
            top3: data.entries
              .filter((e) => e.finishPosition !== null && e.finishPosition <= 3)
              .map((e) => ({ position: e.finishPosition!, name: e.horseName, number: e.number })),
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = merged;
            return next;
          }
          // Race rolled past midnight relative to the server render, or was
          // created in the small gap before hydration — append rather than
          // drop it, same "self-healing, not worth a lock" tolerance the
          // engine itself documents for race creation.
          return [...prev, merged];
        });
      } catch {
        // Transient network hiccup — next tick retries, nothing to surface.
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const sortedRows = [...rows].sort((a, b) => b.raceNumber - a.raceNumber);

  return (
    <div className="rounded-xl border border-line bg-pitch-night-raised">
      <div className="flex border-b border-line">
        <button
          onClick={() => setTab('live')}
          className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
            tab === 'live' ? 'text-gold' : 'text-text-muted'
          }`}
        >
          Canlı Yarış Tablosu
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
            tab === 'history' ? 'text-gold' : 'text-text-muted'
          }`}
        >
          Geçmiş Kuponlarım
        </button>
      </div>

      {tab === 'live' && (
        <div>
          {sortedRows.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-text-muted">Bugün henüz yarış oynanmadı.</p>
          )}
          {sortedRows.map((row) => (
            <BoardRow key={row.id} row={row} />
          ))}
          <div className="p-3">
            <Link href="/at-yarisi" className="pop-interactive block rounded-full bg-gold py-2 text-center text-sm font-semibold text-pitch-night">
              Yarışa Katıl →
            </Link>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-2 p-3">
          {!isLoggedIn && (
            <p className="text-center text-sm text-text-muted">Geçmiş kuponlarını görmek için giriş yapmalısın.</p>
          )}
          {isLoggedIn && myBets.length === 0 && (
            <p className="text-center text-sm text-text-muted">Henüz at yarışı kuponun yok.</p>
          )}
          {myBets.map((bet) => {
            const status = betStatus[bet.status];
            return (
              <div key={bet.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs sm:text-sm">
                <div>
                  <p className="text-text-primary">
                    #{bet.horseNumber ?? '?'} {bet.horseName}
                  </p>
                  <p className="text-text-muted">
                    {bet.stake} STA · olası kazanç {bet.potentialWin} STA
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
