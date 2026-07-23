# STASAHA

Arkadaş grubu maçları için eğlence amaçlı, gerçek para karşılığı olmayan STA para birimiyle çalışan tahmin sitesi.

Veritabanı: Postgres (Neon). Canlı ortam Vercel üzerinde çalışır.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env   # DATABASE_URL'i kendi Postgres/Neon bağlantı dizenle doldur
npx prisma migrate deploy
npm run dev
```

Admin girişi: kullanıcı adı `admin`, şifre `admin123` (deploy sonrası `/admin/users` üzerinden ya da veritabanından değiştir — şifre değiştirme UI'ı bu sürümde yok).

## Testler

```bash
npm test
```

## Canlı ortam (Vercel + Neon)

- Vercel'in build komutu `prisma migrate deploy && next build` olarak ayarlı (bkz. `vercel.json` / proje ayarları), böylece her deploy'da migration otomatik uygulanır.
- Ortam değişkenleri (Vercel proje ayarlarında): `DATABASE_URL` (Neon bağlantı dizesi), `NEXTAUTH_SECRET` (rastgele uzun bir gizli anahtar), `NEXTAUTH_URL` (canlı site adresi).
- Yeni bir maç eklemek, kadro girmek, sonuçlandırmak için `/admin` panelini kullan (sadece `admin` rolündeki hesap erişebilir).
