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
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Transfer Haberleri</h2>

      <form
        action={async (formData) => {
          'use server';
          const playerId = formData.get('playerId') as string;
          const toTeamId = (formData.get('toTeamId') as string) || null;
          const stage = formData.get('stage') as string;
          const note = (formData.get('note') as string) ?? '';
          await createTransferNews(playerId, toTeamId, stage, note);
        }}
        className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
      >
        <h3 className="font-semibold text-text-primary">Yeni Haber</h3>
        <select name="playerId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required>
          <option value="">Oyuncu seç</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="toTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary">
          <option value="">Hedef: Serbest</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="stage" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required>
          {stageOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <textarea name="note" placeholder="Not (opsiyonel)" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <button className="pop-interactive self-start rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">
          Haberi Yayınla
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {news.map((n) => (
          <div key={n.id} className="rounded-xl border border-line bg-pitch-night-raised p-4 text-sm">
            <div className="mb-1 font-semibold text-text-primary">
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
              <select name="stage" defaultValue={n.stage} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary">
                {stageOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input name="note" placeholder="Güncel not" defaultValue={n.note ?? ''} className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary" />
              <button className="pop-interactive rounded-full border border-line px-3 py-1 text-xs font-semibold text-text-primary">Güncelle</button>
            </form>
            <form
              action={async () => {
                'use server';
                await deleteTransferNews(n.id);
              }}
              className="mt-2"
            >
              <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-xs font-semibold text-ferrari-red">
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
