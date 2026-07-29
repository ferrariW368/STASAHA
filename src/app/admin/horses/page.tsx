import { prisma } from '@/lib/prisma';
import { createHorse, updateHorse, setHorseActive } from '@/actions/horses';

export default async function AdminHorsesPage() {
  const horses = await prisma.horse.findMany({ orderBy: { name: 'asc' } });
  const activeCount = horses.filter((h) => h.active).length;

  return (
    <div>
      <h2 className="mb-1 font-display text-lg tracking-wide text-text-primary">At Yarışı Havuzu</h2>
      {activeCount < 7 && (
        <p className="mb-4 rounded-lg bg-ferrari-red/10 p-2 text-sm text-ferrari-red">
          Aktif at sayısı {activeCount}/7 — yarış turu başlayamaz, en az 7 aktif at gerekli.
        </p>
      )}

      <form
        action={async (formData) => {
          'use server';
          const number = formData.get('number') as string;
          await createHorse({
            name: formData.get('name') as string,
            number: number ? parseInt(number, 10) : null,
            color: (formData.get('color') as string) || '#e8b923',
            speedRating: parseInt(formData.get('speedRating') as string, 10),
            formRating: parseInt(formData.get('formRating') as string, 10),
            luckRating: parseInt(formData.get('luckRating') as string, 10),
            price: parseInt(formData.get('price') as string, 10),
          });
        }}
        className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
      >
        <h3 className="font-semibold text-text-primary">Yeni At</h3>
        <div className="flex gap-2">
          <input name="name" placeholder="At adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
          <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
          <input name="color" type="color" defaultValue="#e8b923" className="h-10 w-12 rounded-lg border border-line bg-pitch-night text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-0.5 text-text-muted">
            Hız (1-10)
            <input name="speedRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" required />
          </label>
          <label className="flex flex-col gap-0.5 text-text-muted">
            Form (1-10)
            <input name="formRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" required />
          </label>
          <label className="flex flex-col gap-0.5 text-text-muted">
            Şans (1-10)
            <input name="luckRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" required />
          </label>
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-text-muted">
          Fiyat (STA, %100 sahiplik değeri)
          <input name="price" type="number" min={1} defaultValue={5000} className="w-40 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" required />
        </label>
        <button className="pop-interactive self-start rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">
          Ekle
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {horses.map((horse) => (
          <form
            key={horse.id}
            action={async (formData) => {
              'use server';
              const number = formData.get('number') as string;
              await updateHorse(horse.id, {
                name: formData.get('name') as string,
                number: number ? parseInt(number, 10) : null,
                color: formData.get('color') as string,
                speedRating: parseInt(formData.get('speedRating') as string, 10),
                formRating: parseInt(formData.get('formRating') as string, 10),
                luckRating: parseInt(formData.get('luckRating') as string, 10),
                price: parseInt(formData.get('price') as string, 10),
              });
            }}
            className="flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
          >
            <div className="flex gap-2">
              <input name="name" defaultValue={horse.name} className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm font-semibold text-text-primary" />
              <input name="number" defaultValue={horse.number ?? ''} className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <input name="color" type="color" defaultValue={horse.color} className="h-9 w-11 rounded-lg border border-line bg-pitch-night text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="flex flex-col gap-0.5 text-text-muted">
                Hız
                <input name="speedRating" type="number" min={1} max={10} defaultValue={horse.speedRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              </label>
              <label className="flex flex-col gap-0.5 text-text-muted">
                Form
                <input name="formRating" type="number" min={1} max={10} defaultValue={horse.formRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              </label>
              <label className="flex flex-col gap-0.5 text-text-muted">
                Şans
                <input name="luckRating" type="number" min={1} max={10} defaultValue={horse.luckRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              </label>
            </div>
            <label className="flex flex-col gap-0.5 text-xs text-text-muted">
              Fiyat (STA)
              <input name="price" type="number" min={1} defaultValue={horse.price} className="w-40 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
            </label>
            <div className="flex gap-2">
              <button className="pop-interactive rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-text-primary">Kaydet</button>
            </div>
          </form>
        ))}
        {horses.map((horse) => (
          <form
            key={`toggle-${horse.id}`}
            action={async () => {
              'use server';
              await setHorseActive(horse.id, !horse.active);
            }}
          >
            <button
              className={`pop-interactive w-full rounded-full border px-3 py-1.5 text-sm font-semibold ${
                horse.active ? 'border-ferrari-red text-ferrari-red' : 'border-line text-text-muted'
              }`}
            >
              {horse.name}: {horse.active ? 'Emekli Et' : 'Yeniden Aktif Et'}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
