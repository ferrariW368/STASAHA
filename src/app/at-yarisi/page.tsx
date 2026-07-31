'use client';

import { useEffect, useRef, useState } from 'react';
import RaceTrack from '@/components/RaceTrack';
import RaceResultOverlay, { type RaceOverlayResult } from '@/components/RaceResultOverlay';
import { placeHorseBet } from '@/actions/horseRace';
import type { CurrentRaceView, RaceEntryView } from '@/lib/horseRaceEngine';

const POLL_MS = 2000;

// Mirrors the FINISHED_PAUSE_MS constant in src/lib/horseRaceEngine.ts (not
// exported from there — kept in sync manually, the spec fixes this value at
// 5s and doesn't change it, so a duplicated literal is an acceptable trade
// against exporting an internal engine constant for one client-side read).
const FINISHED_PAUSE_MS = 5_000;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function finishedPauseEndsAt(raceEndsAt: string): string {
  return new Date(new Date(raceEndsAt).getTime() + FINISHED_PAUSE_MS).toISOString();
}

function bannerText(race: Extract<CurrentRaceView, { phase: string }>, remaining: number): string {
  if (race.phase === 'BETTING') return `🎫 Bahisler ${remaining}sn sonra kapanıyor`;
  if (race.phase === 'RACING') return `🏇 Yarış ${remaining}sn sonra bitiyor`;
  return `🏁 Sonuçlandı — yeni tur ${remaining}sn sonra başlıyor`;
}

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
  // Lazy initializer (function form) so Date.now() is read once at mount,
  // not during every render body evaluation (react-hooks/purity). The
  // interval effect below then re-reads it every second.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [overlayResult, setOverlayResult] = useState<RaceOverlayResult | null>(null);
  const prevBetStatusRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch('/api/horse-race/current');
      const data: CurrentRaceView = await res.json();
      if (!cancelled) {
        setRace(data);
        if (!('error' in data) && data.myBet) {
          const prevStatus = prevBetStatusRef.current;
          const currentStatus = data.myBet.status;
          const alreadyShownKey = `shown-horse-result-${data.id}`;
          if (
            prevStatus === 'pending' &&
            currentStatus !== 'pending' &&
            !sessionStorage.getItem(alreadyShownKey)
          ) {
            sessionStorage.setItem(alreadyShownKey, '1');
            const winningEntry = data.entries.find((e) => e.finishPosition === 1);
            setOverlayResult({
              status: currentStatus,
              horseName: data.myBet.horseName,
              stake: data.myBet.stake,
              potentialWin: data.myBet.potentialWin,
              winningHorseName: winningEntry?.horseName ?? data.myBet.horseName,
            });
          }
          prevBetStatusRef.current = currentStatus;
        } else if (!('error' in data)) {
          prevBetStatusRef.current = null;
        }
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
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

      <div
        key={nowTick}
        className="mb-3 rounded-lg border border-line bg-pitch-night-raised px-3 py-2 text-center text-xs font-medium text-text-primary sm:text-sm"
      >
        {bannerText(
          race,
          secondsUntil(
            race.phase === 'FINISHED'
              ? finishedPauseEndsAt(race.raceEndsAt)
              : race.phase === 'BETTING'
                ? race.bettingEndsAt
                : race.raceEndsAt
          )
        )}
      </div>

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
            <div className="flex items-center gap-2">
              {race.phase !== 'FINISHED' && (
                <span className="text-xs text-text-muted">🎟️ {e.betCount} kupon</span>
              )}
              <OwnerBadge entry={e} />
            </div>
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

      {overlayResult && (
        <RaceResultOverlay result={overlayResult} onDismiss={() => setOverlayResult(null)} />
      )}
    </main>
  );
}
