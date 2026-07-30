# At Yarışı Canlılık Paketi — Tasarım Dokümanı

Tarih: 2026-07-30

## Amaç

Mevcut at yarışı mini-oyununun ("At Yarışı Mini-Oyunu", 2026-07-28 spec) üzerine, oyuna daha canlı/heyecanlı bir his katan bir dizi UX iyileştirmesi eklemek:

1. Kazanma anında konfeti + kutlama ekranı, kaybetme anında ayrı bir sonuç ekranı — ikisi de yarışın kısa özetini (hangi at, kaç kupon) gösterir.
2. Yarış süresini 10-20sn'den 15-30sn'ye çıkarmak (bahis penceresi 7sn olarak kalır), akıcılığı korumak.
3. `/at-yarisi` sayfasında ve ana sayfadaki canlı yarış panosunda "bahisler şu an kapanıyor / yarış şu an bitiyor" bilgi kutusu.
4. Ana sayfada iki ayrı widget: (a) canlı/yaklaşan yarış özeti — zaten var olan `HorseRaceBoard` split-flap tablosu, küçük eklemelerle; (b) kullanıcının kendi at yarışı istatistikleri — hiç oynamamışsa kısa bir tanıtım + yönlendirme, oynamışsa özet performans kartı.

## Kapsam Dışı

- Yeni bir realtime kanal (WebSocket/SSE) — mevcut polling deseni (`/api/horse-race/current`, 2sn) korunur.
- Split-flap tablo bileşeninin (`HorseRaceBoard.tsx`) yeniden yazılması — zaten mevcut, sadece küçük eklemeler yapılır.
- Bahis penceresinin (7sn) uzatılması — kullanıcı tercihiyle aynı kalıyor.
- Gerçek zamanlı (sub-saniye) bahis sayacı — sayaç poll aralığında (2sn) güncellenir, bu yeterli kabul edilir.

## Mimari

Mevcut lazy-tick + polling mimarisi korunur, tek değişiklik: `/api/horse-race/current` artık oturum farkında.

- `getCurrentRace()` imzası `getCurrentRace(userId?: string)` olur. `userId` verilirse, dönüşe o kullanıcının **cari `raceId`'ye ait** `HorseBet` kaydı (`myBet`) eklenir.
- `/api/horse-race/current/route.ts` içinde `getServerSession(authOptions)` ile kullanıcı bulunur, `user.id` `getCurrentRace`'e geçirilir. Oturum yoksa `myBet: undefined` kalır (mevcut davranış, geriye dönük uyumlu).
- Hem `/at-yarisi` sayfası hem ana sayfadaki `HorseRaceBoard` **aynı** `/api/horse-race/current` endpoint'ini poll etmeye devam eder — ekstra istek yok.

## Veri Modeli Değişiklikleri

Yeni Prisma migration'ı **gerekmiyor** — tüm yeni alanlar mevcut tablolardan türetiliyor.

### `RaceEntryView` (genişletilir)

```ts
export type RaceEntryView = {
  // ...mevcut alanlar (horseId, horseName, number, color, speedRating, formRating, luckRating, oddsValue, finishPosition, ownerCount, topOwners)
  betCount: number; // bu turda bu ata yapılan toplam kupon sayısı (gerçek + canlandırma payı)
};
```

`betCount` hesaplama:
- Gerçek `HorseBet` sayısı `raceId + horseId` bazında sayılır (`prisma.horseBet.groupBy` veya mevcut `entries` include'una `_count` eklenmesi — Task 3'teki `raceInclude` genişletilir).
- Gerçek sayı **5'in altındaysa**, `mulberry32(seed + horseIndex + 5000)` ile türetilen deterministik bir canlandırma payı eklenir (0-4 arası, atın `oddsValue`'suna ters orantılı — favori atlar daha çok canlandırma kuponu alır, gerçekçi durur). Gerçek sayı 5+ ise canlandırma payı **sıfırdır**, sadece gerçek sayı gösterilir. Bu eşik, "gerçek trafik arttıkça simülasyon sessizce kaybolur" garantisini verir.
- `FINISHED` fazında canlandırma payı donar (o rakam artık değişmez, tıpkı gerçek veri gibi).

### `CurrentRaceView` (genişletilir)

```ts
export type CurrentRaceView =
  | {
      // ...mevcut alanlar
      myBet: {
        horseId: string;
        horseName: string;
        stake: number;
        potentialWin: number;
        status: 'pending' | 'won' | 'lost';
      } | null;
    }
  | { error: 'NOT_ENOUGH_HORSES' };
```

`myBet`, `userId` parametresi verildiğinde ve cari `race.id`'ye ait bir `HorseBet` varsa doldurulur; aksi halde `null`.

## Süre Sabitleri (`src/lib/horseRaceEngine.ts`)

```ts
const BETTING_DURATION_MS = 7_000;       // değişmiyor
const MIN_RACE_DURATION_MS = 15_000;     // 10_000 → 15_000
const MAX_RACE_DURATION_MS = 30_000;     // 20_000 → 30_000
const FINISHED_PAUSE_MS = 5_000;         // değişmiyor
```

`RaceTrack.tsx`'in mevcut `requestAnimationFrame` + jitter/rank-penalty mantığı süre parametresine zaten bağımlı (`totalMs = end - start`), ek bir değişiklik gerekmez — daha uzun süre otomatik olarak daha akıcı bir hareket eğrisine yayılır.

## `/at-yarisi` Sayfası Değişiklikleri

### a) Bilgi kutusu (`RaceStatusBanner`, sayfa içinde inline veya küçük component)

Sayfanın üstünde, `RaceTrack`'in üzerinde sabit bir şerit:

- `BETTING`: "🎫 Bahisler **{kalanSn}sn** sonra kapanıyor"
- `RACING`: "🏇 Yarış **{kalanSn}sn** sonra bitiyor"
- `FINISHED`: "🏁 Sonuçlandı — yeni tur **{kalanSn}sn** sonra başlıyor"

`kalanSn`, `bettingEndsAt`/`raceEndsAt`/`raceEndsAt + FINISHED_PAUSE_MS` ile `Date.now()` farkından **client-side** `setInterval(1000ms)` ile hesaplanır — poll'dan bağımsız, ekstra istek yaratmaz.

### b) Kupon sayacı rozeti

Mevcut `OwnerBadge`'in yanına, `BETTING` ve `RACING` fazlarında: `🎟️ {betCount} kupon`.

### c) Kazanma/kaybetme overlay'i

Yeni component: `src/components/RaceResultOverlay.tsx`

- Prop: `myBet: CurrentRaceView['myBet']`, `onDismiss: () => void`.
- `/at-yarisi/page.tsx`, poll sonucu gelen `race.myBet.status`'u bir önceki poll'daki değerle (`useRef`) karşılaştırır. `pending` → `won`/`lost` geçişi tespit edilince overlay state'i `{ status, horseName, stake, potentialWin, raceId }` ile set edilir.
- Aynı `raceId` için overlay'in tekrar açılmaması adına gösterilen `raceId` `sessionStorage`'a yazılır (`shown-horse-result-<raceId>`); poll her tetiklendiğinde bu kontrol edilir.
- **Kazanma:** tam ekran overlay, koyu yarı saydam backdrop, `canvas-confetti` patlaması (mevcut `matches/[id]/page.tsx`'teki palet: `['#dc0000', '#e8b923', '#ffffff']`, `prefers-reduced-motion` kontrolü aynen taşınır), "🎉 Kazandın!" başlığı, at adı, "+{potentialWin - stake} STA" net kazanç, "Devam Et" butonu (overlay'i kapatır).
- **Kaybetme:** aynı overlay iskeleti, konfetisiz, "Bu sefer olmadı" başlığı, kendi seçtiği at + kazanan at bilgisi, "Devam Et" butonu.
- Overlay açılış animasyonu: yeni `overlay-pop-in` keyframe (scale 0.9→1 + opacity), `prefers-reduced-motion` bloğuna eklenir.

## Ana Sayfa Değişiklikleri

### a) `HorseRaceBoard.tsx` güncellemeleri

- Üstte, split-flap tablonun hemen üzerinde aynı bilgi kutusu mantığı (`/at-yarisi` ile aynı hesaplama, sadece **en son/cari** satıra göre) — sadece `tab === 'live'` iken gösterilir.
- Cari (en son) satırda, `SIRALAMA` sütununun altına küçük alt metin: `🎟️ {betCount} kupon` (geçmiş/tamamlanmış satırlarda gösterilmez).
- `RaceBoardRow` tipine `betCount: number` (sadece cari satır için anlamlı, geçmiş satırlarda `0` gönderilebilir çünkü render edilmeyecek) eklenir — `page.tsx`'teki `raceBoardRows` map'i güncellenir, veri zaten `HorseRaceEntry` include'undan gelir.

### b) Yeni widget — `src/app/HorseRaceStatsWidget.tsx`

Ana sayfada `HorseRaceBoard` bölümünün hemen altında, ayrı bir `<section>`.

**Sunucu tarafında** (`page.tsx`), `currentUser` sorgusu genişletilir: `horseBets` include'una `status`, `stake`, `potentialWin`, `horse.name` eklenir (zaten kısmen çekiliyor, sadece `status`/`stake`/`potentialWin` eksik — Task: mevcut `select` genişletilir).

- **Oturum yoksa veya `horseBets.length === 0`:**
  - Başlık: "At Yarışı Nedir?"
  - 3 madde: (1) "Her turda 7 at yarışır, bahis penceresi sadece 7 saniye — hızlı karar ver." (2) "Oranlar atın hız/form/şans puanına göre otomatik hesaplanır." (3) "İstersen bir ata ortak olup pasif STA geliri kazanabilirsin (At Mağazası)."
  - "Hemen Oyna →" butonu, `/at-yarisi`'ye link.
- **`horseBets.length > 0`:**
  - `computeUserScore(horseBets)` ile net puan.
  - Toplam kupon sayısı, kazanma oranı (`won / (won+lost)`, pending hariç).
  - "En çok kazandığın at": `horseBets.filter(status==='won')` içinde `horseName`'e göre grupla, en sık geçeni göster (eşitlikte ilk bulunan).
  - "Tüm kuponlarım →" linki `HorseRaceBoard`'ın "Geçmiş Kuponlarım" sekmesine değil, mevcut `/bets` sayfası deseninden ayrı olarak zaten aynı sayfadaki `HorseRaceBoard`'a bir `#` anchor ile değil — basitçe kullanıcıyı `/at-yarisi` sayfasına yönlendirir (o sayfada geçmiş görünmüyor, bu yüzden alternatif: link **yok**, sadece özet 3 rakam + en çok kazanılan at gösterilir; detay için kullanıcı zaten yukarıdaki `HorseRaceBoard`'ın "Geçmiş Kuponlarım" sekmesini kullanabilir).

## Yarış Görselinin Canlılığı (`RaceTrack.tsx`)

- Süre sabitlerinin 15-30sn'ye çıkması, mevcut `requestAnimationFrame`/jitter mantığına otomatik yansır (ek kod değişikliği yok).
- Küçük iyileştirme: `FINISHED` fazında kazanan atın koşucu görseline mevcut `jackpot-pulse` class'ı eklenir (görsel vurgu, ekstra CSS gerekmez).

## CSS Eklemeleri (`globals.css`)

```css
@keyframes overlay-pop-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.overlay-pop-in {
  animation: overlay-pop-in 280ms cubic-bezier(0.4, 0, 0.2, 1) both;
}
```

`prefers-reduced-motion` bloğuna `.overlay-pop-in` eklenir (`animation: none !important`).

## Test / Doğrulama

- `betCount` hesaplama mantığı (gerçek sayı + eşik altı canlandırma payı, eşik üstü sıfır) için `tests/horseRace.test.ts`'e veya yeni bir `tests/horseRaceBetCount.test.ts`'e pure-function birim testi (Prisma'dan bağımsız bir yardımcı fonksiyon olarak çıkarılırsa test edilebilir — `src/lib/horseRace.ts` içine `simulatedBetCount(realCount, oddsValue, rng): number` gibi saf bir fonksiyon eklenmesi önerilir, mevcut "pure modules get full Vitest coverage" kuralına uymak için).
- `tsc --noEmit` + `vitest run` her görev sonrası yeşil kalmalı.
- Manuel doğrulama: dev server ile `/at-yarisi` ve ana sayfa üzerinde — bahis yapıp yarışın bitmesini bekleyerek kazanma/kaybetme overlay'inin doğru tetiklendiği, konfetinin sadece kazanmada patladığı, bilgi kutusu sayaçlarının doğru geri saydığı, kupon sayacının arttığı, hiç oynamamış/az önce kayıt olmuş bir hesapta tanıtım kartının göründüğü doğrulanır.
