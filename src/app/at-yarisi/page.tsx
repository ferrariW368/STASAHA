'use client';

import { useEffect, useState } from 'react';
import RaceTrack from '@/components/RaceTrack';
import { placeHorseBet } from '@/actions/horseRace';
import type { CurrentRaceView, RaceEntryView } from '@/lib/horseRaceEngine';

const POLL_MS = 2000;

// "X kişi bu ata ortak" social-proof line — shown next to every horse,
// during betting AND while the race is live, using data that already rides
// along on the same /current payload (no extra fetch, see horseRaceEngine.ts).
function OwnerBadge({ entry }: { entry: RaceEntryView }) {
  if (entry.ownerCount === 0) return null;
  const names = entry.topOwners.join(', ');
  const extra = entry.ownerCount - entry.topOwners.length;
  return (
    <span className="text-xs text-text-muted">
      👥 {names}
      {extra > 0 ? ` +${extra}` : ''} ortak
    </span>
  );
}

export default function HorseRacePage() {
  const [race, setRace] = useState<CurrentRaceView | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch('/api/horse-race/current');
      const data: CurrentRaceView = await res.json();
      if (!cancelled) setRace(data);
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!race) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-text-muted">Yükleniyor...</main>;
  }
  if ('error' in race) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-text-muted">
        Yarış havuzunda yeterli at yok (en az 7 aktif at gerekli). Admin panelinden at ekleyebilirsin.
      </main>
    );
  }

  async function submit() {
    if (!selectedHorseId || 'error' in race!) return;
    setMessage(null);
    setSubmitting(true);
    const result = await placeHorseBet(race!.id, selectedHorseId, stake);
    setSubmitting(false);
    setMessage(result.error ?? 'Bahis alındı, bol şans!');
  }

  const phaseLabel = { BETTING: 'Bahisler Açık', RACING: 'CANLI', FINISHED: 'Sonuç' }[race.phase];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 font-display text-2xl tracking-wide text-text-primary">🐎 At Yarışı</h1>
      <p className="mb-4 text-sm text-text-muted">
        <span className={race.phase === 'RACING' ? 'live-pulse text-ferrari-red' : 'text-gold'}>{phaseLabel}</span>
      </p>

      <RaceTrack
        entries={race.entries}
        phase={race.phase}
        bettingEndsAt={race.bettingEndsAt}
        raceEndsAt={race.raceEndsAt}
        seed={race.seed}
      />

      {/* Owner/co-owner roster — visible in every phase, not just betting,
          so viewers watching the live race can see whose horse is running. */}
      <div className="mt-3 flex flex-col gap-1.5">
        {race.entries.map((e) => (
          <div key={e.horseId} className="flex items-center justify-between rounded-lg border border-line bg-pitch-night-raised px-3 py-1.5">
            <span className="text-sm text-text-primary">
              #{e.number ?? '?'} {e.horseName}
            </span>
            <OwnerBadge entry={e} />
          </div>
        ))}
      </div>

      {race.phase === 'BETTING' && (
        <div className="mt-4 flex flex-col gap-2">
          {race.entries.map((e) => (
            <button
              key={e.horseId}
              onClick={() => setSelectedHorseId(e.horseId)}
              className={`pop-interactive flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                selectedHorseId === e.horseId ? 'border-gold bg-gold/10' : 'border-line bg-pitch-night-raised'
              }`}
            >
              <span className="text-text-primary">
                #{e.number ?? '?'} {e.horseName}
              </span>
              <span className="font-bold text-gold">{e.oddsValue.toFixed(2)}</span>
            </button>
          ))}

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(ev) => setStake(parseInt(ev.target.value, 10) || 0)}
              className="w-24 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary"
            />
            <button
              onClick={submit}
              disabled={submitting || !selectedHorseId || stake <= 0}
              className="pop-interactive flex-1 rounded-full bg-gold py-2 text-sm font-semibold text-pitch-night disabled:opacity-40"
            >
              {submitting ? 'Gönderiliyor...' : 'Bahis Yap'}
            </button>
          </div>
          {message && <p className="text-center text-sm text-text-muted">{message}</p>}
        </div>
      )}

      {race.phase === 'FINISHED' && (
        <p className="mt-4 text-center font-display text-xl tracking-wide text-gold">
          🏆 Kazanan: {race.entries.find((e) => e.finishPosition === 1)?.horseName}
        </p>
      )}
    </main>
  );
}
