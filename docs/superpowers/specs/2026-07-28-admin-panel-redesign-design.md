# Admin Paneli Görsel Yenileme — Tasarım Dokümanı

Tarih: 2026-07-28

## Amaç

`/admin/*` sayfaları, sitenin geri kalanı (siyah/Ferrari kırmızısı/altın tema, Bebas Neue + Inter fontları, `pitch-night`/`gold`/`ferrari-red`/`line` design token'ları) yeniden tasarlanırken hiç dokunulmadan kaldı — düz `text-green-400` link satırı, kart yok, başlık stili yok. Bu doküman sadece **görsel** bir yenilemeyi kapsıyor; hiçbir admin işlevi, veri akışı veya form davranışı değişmiyor.

## Kapsam Dışı

- Yeni admin özelliği/sayfası yok (at yarışı adminliği ayrı bir spec'te: `2026-07-28-horse-racing-game-design.md`).
- Layout yapısı değişmiyor (sidebar'a geçiş yok) — mevcut üst nav + tek sütun içerik yapısı korunuyor, sadece stillendiriliyor.
- Form/aksiyon mantığı (server actions, validasyon) birebir aynı kalıyor.

## Mimari / Yaklaşım

Etkilenen dosyalar: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/teams/page.tsx`, `src/app/admin/players/page.tsx`, `src/app/admin/transfers/page.tsx`, `src/app/admin/lineups/page.tsx` + `LineupsList.tsx`, `src/app/admin/matches/new/page.tsx`, `src/app/admin/matches/[id]/page.tsx`, `src/app/admin/users/page.tsx`.

1. **Nav (`admin/layout.tsx`)**: düz link satırı yerine, sitenin "chip" desenine benzer bir yatay tab çubuğu — her link `pop-interactive rounded-full border px-3 py-1.5 text-sm font-semibold`, aktif sayfa `border-gold bg-gold/10 text-gold`, pasifler `border-line text-text-muted`. Üstte `font-display` bir "Admin Panel" başlığı.
2. **Kartlar**: her sayfadaki `<ul>`/`<li>` veya tablo satırları `border border-line bg-pitch-night-raised rounded-xl p-3/p-4` kart desenine taşınır (siteki `MatchGallery`/`LeaderboardList` kartlarıyla aynı görsel dil).
3. **Başlıklar**: her `<h1>`/`<h2>` `font-display tracking-wide text-text-primary` olur.
4. **Form elemanları**: input/select/textarea `border-line bg-pitch-night rounded-lg px-3 py-2 text-text-primary` ortak stiline; birincil aksiyon butonları (`Kaydet`, `Onayla`, `Sonuçlandır` vb.) `bg-gold text-pitch-night pop-interactive rounded-full`, ikincil/nötr butonlar (`Şifre Güncelle`, `Uygula` gibi az riskli aksiyonlar) `border border-line text-text-primary`, **yıkıcı aksiyonlar** (sil, reddet, iptal et) `border border-ferrari-red text-ferrari-red` olarak ayırt edilir — bu, hangi butonun geri alınamaz olduğunu görsel olarak netleştirir.
5. Zaten doğru token'lara sahip olan (bu oturumda migrate edilen) `bg-pitch-night-raised`/`border-line`/`text-text-muted` sınıfları olduğu gibi kalır, sadece yapısal sarmalama (kart/başlık/buton) eklenir.

## Test / Doğrulama

- Her admin sayfası için `tsc --noEmit` temiz olmalı.
- Görsel doğrulama: admin girişi yapılamadığından (parola girme kısıtı) Browser pane ile tam tıklama testi mümkün değil — kod incelemesi + statik render mantığı üzerinden doğrulanacak, kullanıcıdan gerçek girişle bir göz atması istenecek.
- Hiçbir server action imzası/dönüş tipi değişmeyeceği için mevcut davranış riski yok.
