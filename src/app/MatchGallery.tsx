'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isMatchLocked } from '@/lib/matchLock';

export type GalleryMatch = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTime: string;
  status: string;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
};

export default function MatchGallery({ matches }: { matches: GalleryMatch[] }) {
  const [filter, setFilter] = useState('ALL');

  const teamNames = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      set.add(m.homeTeamName);
      set.add(m.awayTeamName);
    });
    return Array.from(set).sort();
  }, [matches]);

  const chips = [
    { key: 'ALL', label: 'Tümü' },
    { key: 'UPCOMING', label: 'Yaklaşan' },
    { key: 'FINISHED', label: 'Geçmiş' },
    ...teamNames.map((t) => ({ key: t, label: t })),
  ];

  const filtered = matches.filter((m) => {
    if (filter === 'ALL') return true;
    if (filter === 'UPCOMING') return m.status !== 'finished';
    if (filter === 'FINISHED') return m.status === 'finished';
    return m.homeTeamName === filter || m.awayTeamName === filter;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`pop-interactive rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === c.key ? 'border-gold bg-gold/10 text-gold' : 'border-line text-text-muted'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((m) => {
          const isFinished = m.status === 'finished';
          const isLocked = !isFinished && isMatchLocked(new Date(m.kickoffTime));
          return (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="match-card-glow pop-interactive rounded-xl border border-line bg-pitch-night-raised p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.homeTeamName} vs {m.awayTeamName}</span>
                {isFinished ? (
                  <span className="shrink-0 rounded-full bg-line px-2 py-1 text-xs font-semibold text-text-primary">
                    {m.finalHomeScore} - {m.finalAwayScore}
                  </span>
                ) : isLocked ? (
                  <span className="live-pulse shrink-0 rounded-full bg-ferrari-red/10 px-2 py-1 text-xs font-medium text-ferrari-red">
                    🔴 CANLI
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-gold/10 px-2 py-1 text-xs font-medium text-gold">
                    Kupon Yap
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-text-muted">
                {new Date(m.kickoffTime).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-line bg-pitch-night-raised p-4 text-center text-sm text-text-muted">
            Bu filtreye uyan maç yok.
          </p>
        )}
      </div>
    </div>
  );
}
