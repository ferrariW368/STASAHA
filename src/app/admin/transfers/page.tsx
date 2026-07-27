import { prisma } from '@/lib/prisma';
import { createTransferNews, updateTransferStage, deleteTransferNews } from '@/actions/transfers';

const stageOptions = [
  { value: 'RUMOR', label: 'Söylenti' },
  { value: 'ADVANCED', label: 'Büyük Oranda Bitti' },
  { value: 'FAILED', label: 'Gerçekleşmedi' },
  { value: 'SIGNED', label: 'İmza Atıldı' },
  { value: 'CANCELLED', label: 'İptal Edildi / Transfer Yattı' },
];

export default async function AdminTransfersPage() {
  const [players, teams, news] = await Promise.all([
    prisma.player.findMany({ orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.transferNews.findMany({
      include: { player: true, fromTeam: true, toTeam: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Transfer Haberleri</h1>

      <form
        action={async (formData) => {
          'use server';
          const playerId = formData.get('playerId') as string;
          const toTeamId = (formData.get('toTeamId') as string) || null;
          const stage = formData.get('stage') as string;
          const note = (formData.get('note') as string) ?? '';
          await createTransferNews(playerId, toTeamId, stage, note);
        }}
        className="mb-6 flex flex-col gap-2 rounded border p-3"
      >
        <h2 className="font-semibold">Yeni Haber</h2>
        <select name="playerId" className="rounded border px-3 py-2 text-sm" required>
          <option value="">Oyuncu seç</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="toTeamId" className="rounded border px-3 py-2 text-sm">
          <option value="">Hedef: Serbest</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="stage" className="rounded border px-3 py-2 text-sm" required>
          {stageOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <textarea name="note" placeholder="Not (opsiyonel)" className="rounded border px-3 py-2 text-sm" />
        <button className="self-start rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white">
          Haberi Yayınla
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {news.map((n) => (
          <div key={n.id} className="rounded border p-3 text-sm">
            <div className="mb-1 font-semibold">
              {n.player.name}: {n.fromTeam?.name ?? 'Serbest'} → {n.toTeam?.name ?? 'Serbest'}
            </div>
            {n.note && <p className="mb-2 text-xs text-text-muted">{n.note}</p>}
            <form
              action={async (formData) => {
                'use server';
                const stage = formData.get('stage') as string;
                const note = (formData.get('note') as string) ?? '';
                await updateTransferStage(n.id, stage, note);
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select name="stage" defaultValue={n.stage} className="rounded border px-2 py-1 text-xs">
                {stageOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input name="note" placeholder="Güncel not" defaultValue={n.note ?? ''} className="flex-1 rounded border px-2 py-1 text-xs" />
              <button className="rounded bg-line px-3 py-1 text-xs font-semibold text-white">Güncelle</button>
            </form>
            <form
              action={async () => {
                'use server';
                await deleteTransferNews(n.id);
              }}
              className="mt-2"
            >
              <button className="rounded border border-red-800 px-3 py-1 text-xs font-semibold text-red-400">
                Sil (hiç gözükmesin)
              </button>
            </form>
          </div>
        ))}
        {news.length === 0 && <p className="text-sm text-text-muted">Henüz transfer haberi yok.</p>}
      </div>
    </div>
  );
}
