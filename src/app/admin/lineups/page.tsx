import { prisma } from '@/lib/prisma';
import { approveLineup, rejectLineup } from '@/actions/lineups';
import { getFormation, type Position } from '@/lib/formation';

const positionLabel: Record<Position, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'Onay Bekliyor', className: 'bg-amber-50 text-amber-700' },
  approved: { text: 'Onaylandı', className: 'bg-green-50 text-green-700' },
  rejected: { text: 'Reddedildi', className: 'bg-red-50 text-red-600' },
};

export default async function AdminLineupsPage() {
  const lineups = await prisma.lineup.findMany({
    include: { submittedBy: true, slots: { include: { player: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Kadro Onayları</h1>
      <div className="flex flex-col gap-4">
        {lineups.map((lineup) => {
          const status = statusLabel[lineup.status] ?? statusLabel.pending;
          const formation = getFormation(lineup.format);
          const rows = formation ? [...formation.rows].reverse() : [];
          return (
            <div key={lineup.id} className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{lineup.squadName}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {lineup.format}v{lineup.format} · {lineup.submittedBy.username}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                  {status.text}
                </span>
              </div>

              <div className="mb-3 flex flex-col gap-1">
                {rows.map((row) => {
                  const rowSlots = lineup.slots
                    .filter((s) => s.position === row.position)
                    .sort((a, b) => a.slotOrder - b.slotOrder);
                  return (
                    <div key={row.position} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 font-semibold text-gray-500">{positionLabel[row.position]}</span>
                      <span className="text-gray-700">{rowSlots.map((s) => s.player.name).join(', ')}</span>
                    </div>
                  );
                })}
              </div>

              {lineup.status === 'pending' && (
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      'use server';
                      await approveLineup(lineup.id);
                    }}
                  >
                    <button className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                      Onayla (takımı oluştur)
                    </button>
                  </form>
                  <form
                    action={async () => {
                      'use server';
                      await rejectLineup(lineup.id);
                    }}
                  >
                    <button className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">
                      Reddet
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {lineups.length === 0 && <p className="text-sm text-gray-400">Henüz kadro önerisi yok.</p>}
      </div>
    </div>
  );
}
