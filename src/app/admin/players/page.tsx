import { prisma } from '@/lib/prisma';
import { updatePlayerProfile, transferPlayer } from '@/actions/players';
import { addPlayer } from '@/actions/teams';
import DeletePlayerButton from './DeletePlayerButton';

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ include: { team: true }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <h2 className="mb-1 font-display text-lg tracking-wide text-text-primary">Oyuncu Havuzu</h2>
      <p className="mb-4 text-xs text-text-muted">
        Profil bilgileri (özellikler, piyasa değeri, oyun stili esini) tamamen senin girdiğin, gerçek bir
        futbolcunun verisi kopyalanmadan sadece esin olarak kullanılan değerlerdir.
      </p>

      <form
        action={async (formData) => {
          'use server';
          const teamId = (formData.get('teamId') as string) || null;
          const number = formData.get('number') as string;
          await addPlayer(teamId, formData.get('name') as string, number ? parseInt(number, 10) : undefined);
        }}
        className="mb-6 flex flex-wrap gap-2"
      >
        <input name="name" placeholder="Yeni oyuncu adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
        <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <select name="teamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary">
          <option value="">Serbest Oyuncu</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">Ekle</button>
      </form>

      <div className="flex flex-col gap-4">
        {players.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
            <form
              action={async (formData) => {
                'use server';
                const parseNum = (key: string) => {
                  const raw = formData.get(key) as string;
                  return raw ? parseInt(raw, 10) : null;
                };
                await updatePlayerProfile(p.id, {
                  styleInspiration: (formData.get('styleInspiration') as string) ?? '',
                  position: (formData.get('position') as string) || null,
                  pace: parseNum('pace'),
                  shooting: parseNum('shooting'),
                  passing: parseNum('passing'),
                  dribbling: parseNum('dribbling'),
                  defending: parseNum('defending'),
                  physical: parseNum('physical'),
                  marketValue: parseNum('marketValue'),
                });
                const newTeamId = (formData.get('teamId') as string) || null;
                if (newTeamId !== (p.teamId ?? '')) {
                  await transferPlayer(p.id, newTeamId);
                }
              }}
              className="flex flex-col gap-2"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-text-primary">
                  {p.name} {p.number ? `#${p.number}` : ''}
                </span>
                <select name="teamId" defaultValue={p.teamId ?? ''} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary">
                  <option value="">Serbest Oyuncu</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  name="styleInspiration"
                  placeholder="Oyun stili esini (örn. Lionel Messi)"
                  defaultValue={p.styleInspiration ?? ''}
                  className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary"
                />
                <select name="position" defaultValue={p.position ?? ''} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary">
                  <option value="">Mevki seç</option>
                  <option value="GK">Kaleci</option>
                  <option value="DEF">Defans</option>
                  <option value="MID">Orta Saha</option>
                  <option value="FWD">Forvet</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-0.5 text-text-muted">
                    {key === 'pace' && 'Hız'}
                    {key === 'shooting' && 'Şut'}
                    {key === 'passing' && 'Pas'}
                    {key === 'dribbling' && 'Dripling'}
                    {key === 'defending' && 'Defans'}
                    {key === 'physical' && 'Fizik'}
                    <input
                      name={key}
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={p[key] ?? ''}
                      className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary"
                    />
                  </label>
                ))}
              </div>

              <label className="flex flex-col gap-0.5 text-xs text-text-muted">
                Piyasa Değeri (STA)
                <input
                  name="marketValue"
                  type="number"
                  min={0}
                  defaultValue={p.marketValue ?? ''}
                  className="w-32 rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary"
                />
              </label>

              <div className="mt-1 flex items-center justify-between">
                <button className="pop-interactive self-start rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-text-primary">
                  Kaydet
                </button>
                <DeletePlayerButton playerId={p.id} playerName={p.name} />
              </div>
            </form>
          </div>
        ))}
        {players.length === 0 && <p className="text-sm text-text-muted">Henüz oyuncu yok.</p>}
      </div>
    </div>
  );
}
