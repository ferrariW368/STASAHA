import { prisma } from '@/lib/prisma';
import { createMatch } from '@/actions/matches';
import { redirect } from 'next/navigation';

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Yeni Maç Oluştur</h2>
      <form
        action={async (formData) => {
          'use server';
          const homeTeamId = formData.get('homeTeamId') as string;
          const awayTeamId = formData.get('awayTeamId') as string;
          const kickoff = formData.get('kickoffTime') as string;
          const ouLine = parseFloat(formData.get('ouLine') as string);
          const htOuLine = parseFloat(formData.get('htOuLine') as string);
          const result = await createMatch(homeTeamId, awayTeamId, new Date(kickoff), ouLine, htOuLine);
          if (!('error' in result)) redirect('/admin');
        }}
        className="flex flex-col gap-4"
      >
        <select name="homeTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required>
          <option value="">Ev sahibi takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="awayTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required>
          <option value="">Deplasman takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="datetime-local" name="kickoffTime" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
        <div>
          <label className="mb-1 block text-sm text-text-muted">Toplam Gol Alt/Üst Çizgisi</label>
          <input
            type="number"
            name="ouLine"
            step="0.5"
            min="0.5"
            defaultValue={9.5}
            className="w-full rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary"
            required
          />
          <p className="mt-1 text-xs text-text-muted">
            Buçuklu bir sayı kullan (örn. 9.5) — tam sayıda beraberlik ihtimali oluşur.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-muted">İlk Yarı Toplam Gol Alt/Üst Çizgisi</label>
          <input
            type="number"
            name="htOuLine"
            step="0.5"
            min="0.5"
            defaultValue={4.5}
            className="w-full rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary"
            required
          />
        </div>
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 font-semibold text-pitch-night">Maçı Oluştur</button>
      </form>
    </div>
  );
}
