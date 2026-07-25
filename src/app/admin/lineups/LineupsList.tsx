'use client';

import { useState } from 'react';
import { approveLineup, rejectLineup } from '@/actions/lineups';
import type { Position } from '@/lib/formation';

const positionLabel: Record<Position, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'Onay Bekliyor', className: 'bg-amber-400/10 text-amber-400' },
  approved: { text: 'Onaylandı', className: 'bg-green-500/10 text-green-400' },
  rejected: { text: 'Reddedildi', className: 'bg-red-500/10 text-red-400' },
};

type SlotData = { position: Position; slotOrder: number; playerName: string; styleInspiration: string | null };
type LineupData = {
  id: string;
  squadName: string;
  format: number;
  status: string;
  submittedByUsername: string;
  rows: { position: Position; slots: SlotData[] }[];
};

export default function LineupsList({ lineups }: { lineups: LineupData[] }) {
  const [showInspiration, setShowInspiration] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowInspiration((v) => !v)}
        className={`mb-4 rounded-lg border-2 px-3 py-1.5 text-xs font-bold ${showInspiration ? 'border-amber-500 bg-amber-400/10 text-amber-400' : 'border-neutral-800 text-neutral-500'}`}
      >
        {showInspiration ? '⭐ İlham Alınan Futbolcular Gösteriliyor' : 'İlham Alınan Futbolcuları Göster'}
      </button>

      <div className="flex flex-col gap-4">
        {lineups.map((lineup) => {
          const status = statusLabel[lineup.status] ?? statusLabel.pending;
          return (
            <div key={lineup.id} className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{lineup.squadName}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {lineup.format}v{lineup.format} · {lineup.submittedByUsername}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                  {status.text}
                </span>
              </div>

              <div className="mb-3 flex flex-col gap-1">
                {lineup.rows.map((row) => (
                  <div key={row.position} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 font-semibold text-neutral-500">{positionLabel[row.position]}</span>
                    <span className="text-neutral-300">
                      {row.slots
                        .map((s) => (showInspiration && s.styleInspiration ? s.styleInspiration : s.playerName))
                        .join(', ')}
                    </span>
                  </div>
                ))}
              </div>

              {lineup.status === 'pending' && (
                <div className="flex gap-2">
                  <form action={async () => { await approveLineup(lineup.id); }}>
                    <button className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                      Onayla (takımı oluştur)
                    </button>
                  </form>
                  <form action={async () => { await rejectLineup(lineup.id); }}>
                    <button className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-400">
                      Reddet
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {lineups.length === 0 && <p className="text-sm text-neutral-600">Henüz kadro önerisi yok.</p>}
      </div>
    </div>
  );
}
