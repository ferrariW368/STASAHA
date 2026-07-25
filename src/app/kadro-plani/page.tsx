'use client';

import { useEffect, useMemo, useState } from 'react';
import { createLineup } from '@/actions/lineups';
import { getFormation, VALID_FORMATS, type Position } from '@/lib/formation';

type PlayerOption = { id: string; name: string; number: number | null; position: string | null; teamName: string | null; styleInspiration: string | null };
type Slot = { position: Position; slotOrder: number; playerId: string | null };

const positionLabel: Record<Position, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };

export default function LineupBuilderPage() {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [format, setFormat] = useState<number | null>(null);
  const [squadName, setSquadName] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pickerSlot, setPickerSlot] = useState<{ position: Position; slotOrder: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);

  useEffect(() => {
    fetch('/api/players').then((r) => r.json()).then(setPlayers);
  }, []);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const usedPlayerIds = useMemo(() => new Set(slots.map((s) => s.playerId).filter(Boolean) as string[]), [slots]);

  function displayName(p: PlayerOption) {
    return showInspiration && p.styleInspiration ? p.styleInspiration : p.name;
  }

  function chooseFormat(f: number) {
    const formation = getFormation(f);
    if (!formation) return;
    const newSlots: Slot[] = [];
    for (const row of formation.rows) {
      for (let i = 0; i < row.count; i++) newSlots.push({ position: row.position, slotOrder: i, playerId: null });
    }
    setFormat(f);
    setSlots(newSlots);
  }

  function assignPlayer(position: Position, slotOrder: number, playerId: string) {
    setSlots((prev) =>
      prev.map((s) => (s.position === position && s.slotOrder === slotOrder ? { ...s, playerId } : s))
    );
    setPickerSlot(null);
  }

  function clearSlot(position: Position, slotOrder: number) {
    setSlots((prev) =>
      prev.map((s) => (s.position === position && s.slotOrder === slotOrder ? { ...s, playerId: null } : s))
    );
  }

  const formation = format ? getFormation(format) : null;
  const displayRows = formation ? [...formation.rows].reverse() : []; // FWD (top/attack) down to GK (bottom)
  const allFilled = slots.length > 0 && slots.every((s) => s.playerId !== null);

  async function submit() {
    setMessage(null);
    if (!format) return;
    setSubmitting(true);
    const result: { error?: string; lineupId?: string } = await createLineup(
      squadName,
      format,
      slots.map((s) => ({ position: s.position, slotOrder: s.slotOrder, playerId: s.playerId! }))
    );
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage('Kadron admin onayına gönderildi! 🎉');
      setFormat(null);
      setSlots([]);
      setSquadName('');
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">⚽ Kadro Planla</h1>
      <p className="mb-4 text-xs text-neutral-500">
        Hayalindeki kadroyu kur, admin onaylarsa yeni maç kurulurken hazır bekler.
      </p>

      {!format ? (
        <div className="rounded-xl bg-neutral-900 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-400">Kaça kaça oynanacak?</h2>
          <div className="grid grid-cols-4 gap-2">
            {VALID_FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => chooseFormat(f)}
                className="rounded-xl border-2 border-green-600 py-4 text-lg font-black text-green-400 active:bg-green-500/10"
              >
                {f}v{f}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <input
            value={squadName}
            onChange={(e) => setSquadName(e.target.value)}
            placeholder="Takımına bir isim ver"
            className="mb-3 w-full rounded-xl border-2 border-neutral-800 px-3 py-2 text-sm font-semibold"
          />

          <button
            onClick={() => setShowInspiration((v) => !v)}
            className={`mb-3 w-full rounded-xl border-2 py-2 text-xs font-bold ${showInspiration ? 'border-amber-500 bg-amber-400/10 text-amber-400' : 'border-neutral-800 text-neutral-500'}`}
          >
            {showInspiration ? '⭐ İlham Alınan Futbolcular Gösteriliyor' : 'İlham Alınan Futbolcuları Göster'}
          </button>

          <div className="mb-4 rounded-2xl bg-gradient-to-b from-green-600 via-green-700 to-green-800 p-4 shadow-lg">
            <div className="flex flex-col gap-6 rounded-xl border-2 border-white/30 p-3">
              {displayRows.map((row) => (
                <div key={row.position} className="flex justify-evenly gap-2">
                  {Array.from({ length: row.count }).map((_, i) => {
                    const slot = slots.find((s) => s.position === row.position && s.slotOrder === i)!;
                    const player = slot.playerId ? playerById.get(slot.playerId) : null;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          player ? clearSlot(row.position, i) : setPickerSlot({ position: row.position, slotOrder: i })
                        }
                        className={`flex w-20 flex-col items-center gap-0.5 rounded-lg border-2 border-dashed border-white/60 bg-white/10 px-1 py-2 text-center backdrop-blur-sm active:bg-white/20 ${player ? 'border-solid bg-white/90' : ''}`}
                      >
                        {player ? (
                          <>
                            <span className="text-xs font-bold text-green-800 truncate w-full">{displayName(player)}</span>
                            <span className="text-[9px] text-green-400">{player.number ? `#${player.number}` : ''}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">➕</span>
                            <span className="text-[9px] font-bold text-white">{positionLabel[row.position]}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {pickerSlot && (
            <div className="mb-4 rounded-xl bg-neutral-900 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-400">
                  {positionLabel[pickerSlot.position]} seç
                </h2>
                <button onClick={() => setPickerSlot(null)} className="text-xs text-neutral-600">Kapat</button>
              </div>
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {players
                  .filter((p) => !usedPlayerIds.has(p.id))
                  .sort((a, b) => {
                    const aMatch = a.position === pickerSlot.position ? 0 : 1;
                    const bMatch = b.position === pickerSlot.position ? 0 : 1;
                    return aMatch - bMatch || a.name.localeCompare(b.name);
                  })
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => assignPlayer(pickerSlot.position, pickerSlot.slotOrder, p.id)}
                      className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm active:bg-neutral-950"
                    >
                      <span>
                        {displayName(p)} {p.number ? `#${p.number}` : ''}
                        {p.position && p.position !== pickerSlot.position && (
                          <span className="ml-1 text-[10px] text-amber-400">({positionLabel[p.position as Position]})</span>
                        )}
                      </span>
                      <span className="text-xs text-neutral-600">{p.teamName ?? 'Serbest'}</span>
                    </button>
                  ))}
                {players.filter((p) => !usedPlayerIds.has(p.id)).length === 0 && (
                  <p className="px-3 py-2 text-xs text-neutral-600">Uygun oyuncu kalmadı.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setFormat(null);
                setSlots([]);
              }}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-400"
            >
              Vazgeç
            </button>
            <button
              onClick={submit}
              disabled={!allFilled || squadName.trim().length < 2 || submitting}
              className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {submitting ? 'Gönderiliyor...' : 'Onaya Gönder'}
            </button>
          </div>
        </>
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-neutral-900 p-3 text-center text-sm shadow-sm">{message}</p>
      )}
    </main>
  );
}
