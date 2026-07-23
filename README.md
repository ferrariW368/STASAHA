# Hali Saha İddaa Sitesi

Arkadaş grubu maçları için eğlence amaçlı, gerçek para karşılığı olmayan STA para birimiyle çalışan tahmin sitesi.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Seed admin girişi: kullanıcı adı `admin`, şifre `admin123` (canlıya almadan önce mutlaka değiştir).

## Testler

```bash
npm test
```

## Canlıya alma (Vercel + Neon)

Bu adımlar senin kendi hesaplarınla yapman gereken adımlardır:

1. [neon.tech](https://neon.tech) üzerinde ücretsiz bir Postgres veritabanı oluştur, bağlantı dizesini kopyala.
2. `prisma/schema.prisma` dosyasında `datasource db` bloğundaki `provider`'ı `"postgresql"` yap.
3. **Mevcut `prisma/migrations/` klasörünü sil.** Bu klasördeki migration SQLite'a özel yazılmıştır ve Postgres'e uygulanamaz (`migration_lock.toml` provider uyuşmazlığından `prisma migrate deploy` hata verir).
4. Yerelde, `.env` dosyandaki `DATABASE_URL`'i geçici olarak Neon bağlantı dizesine çevirip `npx prisma migrate dev --name init` çalıştır — bu, Postgres için yeni ve doğru bir migration oluşturur. Bunu commit'le.
5. Vercel projenin ortam değişkenlerine `DATABASE_URL` (Neon bağlantı dizesi), `NEXTAUTH_SECRET` (rastgele uzun bir gizli anahtar) ve `NEXTAUTH_URL` (canlı site adresin) ekle.
6. Vercel'e bu repoyu bağla ve deploy et; build komutuna `prisma migrate deploy && next build` ekleyerek migration'ın otomatik uygulanmasını sağla.
7. Deploy sonrası bir kere `npx prisma db seed` çalıştırarak admin hesabını oluştur, ardından admin şifresini `/admin/users` üzerinden değiştir (not: şifre değiştirme UI'ı bu sürümde yok — gerekirse admin şifresini doğrudan veritabanından güncelle).
