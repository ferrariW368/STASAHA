import { prisma } from '@/lib/prisma';
import { getFormation, type Position } from '@/lib/formation';
import LineupsList from './LineupsList';

export default async function AdminLineupsPage() {
  const lineups = await prisma.lineup.findMany({
    include: { submittedBy: true, slots: { include: { player: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const data = lineups.map((lineup) => {
    const formation = getFormation(lineup.format);
    const rows = formation ? [...formation.rows].reverse() : [];
    return {
      id: lineup.id,
      squadName: lineup.squadName,
      format: lineup.format,
      status: lineup.status,
      submittedByUsername: lineup.submittedBy.username,
      rows: rows.map((row) => ({
        position: row.position,
        slots: lineup.slots
          .filter((s) => s.position === row.position)
          .sort((a, b) => a.slotOrder - b.slotOrder)
          .map((s) => ({
            position: s.position as Position,
            slotOrder: s.slotOrder,
            playerName: s.player.name,
            styleInspiration: s.player.styleInspiration,
          })),
      })),
    };
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Kadro Onayları</h1>
      <LineupsList lineups={data} />
    </div>
  );
}
