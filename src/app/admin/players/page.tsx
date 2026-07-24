import { prisma } from '@/lib/prisma';
import { updatePlayerProfile, transferPlayer } from '@/actions/players';
import { addPlayer } from '@/actions/teams';

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ include: { team: true }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Oyuncu Havuzu</h1>
      <p className="mb-4 text-xs text-gray-500">
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
        <input name="name" placeholder="Yeni oyuncu adı" className="flex-1 rounded border px-3 py-2 text-sm" required />
        <input name="number" placeholder="No" className="w-16 rounded border px-3 py-2 text-sm" />
        <select name="teamId" className="rounded border px-3 py-2 text-sm">
          <option value="">Serbest Oyuncu</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white">Ekle</button>
      </form>

      <div className="flex flex-col gap-4">
        {players.map((p) => (
          <div key={p.id} className="rounded border p-3">
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
                <span className="font-semibold">
                  {p.name} {p.number ? `#${p.number}` : ''}
                </span>
                <select name="teamId" defaultValue={p.teamId ?? ''} className="rounded border px-2 py-1 text-xs">
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
                  className="flex-1 rounded border px-2 py-1 text-sm"
                />
                <select name="position" defaultValue={p.position ?? ''} className="rounded border px-2 py-1 text-sm">
                  <option value="">Mevki seç</option>
                  <option value="GK">Kaleci</option>
                  <option value="DEF">Defans</option>
                  <option value="MID">Orta Saha</option>
                  <option value="FWD">Forvet</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-0.5">
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
                      className="rounded border px-2 py-1"
                    />
                  </label>
                ))}
              </div>

              <label className="flex flex-col gap-0.5 text-xs">
                Piyasa Değeri (STA)
                <input
                  name="marketValue"
                  type="number"
                  min={0}
                  defaultValue={p.marketValue ?? ''}
                  className="w-32 rounded border px-2 py-1"
                />
              </label>

              <button className="mt-1 self-start rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white">
                Kaydet
              </button>
            </form>
          </div>
        ))}
        {players.length === 0 && <p className="text-sm text-gray-400">Henüz oyuncu yok.</p>}
      </div>
    </div>
  );
}
