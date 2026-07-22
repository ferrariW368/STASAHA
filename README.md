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
3. Vercel projenin ortam değişkenlerine `DATABASE_URL` (Neon bağlantı dizesi), `NEXTAUTH_SECRET` (rastgele uzun bir gizli anahtar) ve `NEXTAUTH_URL` (canlı site adresin) ekle.
4. Vercel'e bu repoyu bağla ve deploy et; ilk deploy sonrası `npx prisma migrate deploy` çalıştırılmasını sağla (Vercel build komutuna ekleyebilirsin: `prisma migrate deploy && next build`).
5. Deploy sonrası bir kere `npx prisma db seed` çalıştırarak admin hesabını oluştur, ardından admin şifresini `/admin/users` üzerinden değiştir (not: şifre değiştirme UI'ı bu sürümde yok — gerekirse admin şifresini doğrudan veritabanından güncelle).
