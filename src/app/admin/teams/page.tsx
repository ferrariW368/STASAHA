import { prisma } from '@/lib/prisma';
import { createTeam, updateTeamName, deleteTeam, addPlayer, removePlayer } from '@/actions/teams';
import { redirect } from 'next/navigation';

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const teams = await prisma.team.findMany({ include: { players: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Takımlar & Kadro</h2>
      {err && <p className="mb-4 rounded-lg bg-ferrari-red/10 p-2 text-sm text-ferrari-red">{err}</p>}

      <form
        action={async (formData) => {
          'use server';
          await createTeam(formData.get('name') as string);
        }}
        className="mb-6 flex gap-2"
      >
        <input name="name" placeholder="Yeni takım adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">Ekle</button>
      </form>

      <div className="flex flex-col gap-6">
        {teams.map((team) => (
          <div key={team.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
            <div className="mb-2 flex gap-2">
              <form
                action={async (formData) => {
                  'use server';
                  await updateTeamName(team.id, formData.get('teamName') as string);
                }}
                className="flex flex-1 gap-2"
              >
                <input
                  name="teamName"
                  defaultValue={team.name}
                  className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm font-semibold text-text-primary"
                />
                <button className="pop-interactive rounded-full border border-line px-3 py-1 text-sm font-semibold text-text-primary">Kaydet</button>
              </form>
              <form
                action={async () => {
                  'use server';
                  const result: { error?: string } = await deleteTeam(team.id);
                  if (result.error) {
                    redirect(`/admin/teams?err=${encodeURIComponent(result.error)}`);
                  }
                }}
              >
                <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-sm font-semibold text-ferrari-red">Takımı Sil</button>
              </form>
            </div>
            <ul className="mb-3 flex flex-col gap-1">
              {team.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm text-text-primary">
                  <span>{p.name}{p.number ? ` (#${p.number})` : ''}</span>
                  <form
                    action={async () => {
                      'use server';
                      await removePlayer(p.id);
                    }}
                  >
                    <button className="text-ferrari-red">Sil</button>
                  </form>
                </li>
              ))}
            </ul>
            <form
              action={async (formData) => {
                'use server';
                const number = formData.get('number') as string;
                await addPlayer(
                  team.id,
                  formData.get('playerName') as string,
                  number ? parseInt(number, 10) : undefined
                );
              }}
              className="flex gap-2"
            >
              <input name="playerName" placeholder="Oyuncu adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <button className="pop-interactive rounded-full border border-line px-3 py-1 text-sm font-semibold text-text-primary">Ekle</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
