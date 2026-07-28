# At Yarışı Mini-Oyunu — Tasarım Dokümanı

Tarih: 2026-07-28

## Amaç

Siteye kurgusal bir at yarışı bahis oyunu eklemek: sürekli otomatik dönen turlar, her turda değişken boyutlu bir at havuzundan rastgele seçilen 7 at yarışır, kullanıcılar STA ile bir ata bahis oynar, yarış 2D bir arayüzde ~30-45 saniye canlı izlenir. Ayrıca kullanıcıların atlara **ortak sahiplik payı** satın alabildiği bir mağaza: sahip olunan at yarış kazandığında, sahiplerine payları oranında pasif bir STA geliri öder.

Bu, mevcut futbol tahmin sisteminden tamamen ayrı bir domain (at, yarış, mağaza) ama aynı STA ekonomisini ve aynı kullanıcı/leaderboard altyapısını paylaşır.

## Kapsam Dışı

- Gerçek TJK verisi / canlı veri entegrasyonu yok — atlar tamamen kurgusal, admin-yönetimli.
- Gerçek para yok (mevcut sitenin genel kuralı).
- At payının yeniden satışı/transferi yok (bir kere alınan pay geri satılamaz, v1'de).
- Birden fazla eşzamanlı yarış pisti yok — tek, sürekli dönen bir "ana pist".

## Mimari

- Mevcut Next.js (App Router) + Prisma + Neon Postgres projesine entegre, ayrı bir servis/altyapı yok.
- **Kritik kısıt: Vercel serverless, gerçek 7/24 arka plan process çalıştıramaz** (Hobby planda sık aralıklı cron da yok). Bu yüzden "otomatik döngü" bir **lazy-tick (tembel tik)** deseniyle simüle edilir: `getCurrentRace()` adlı paylaşılan bir sunucu fonksiyonu, hem sayfa yüklemesinde hem `/api/horse-race/current` poll'unda çağrılır; mevcut `HorseRace` satırının faz/zaman damgalarını şu anki saatle kıyaslar, süresi dolmuşsa **o çağrı sırasında senkron olarak** turu ilerletir (bahisleri sonuçlandırır, ortak sahiplere ödeme yapar, yeni turu başlatır). Siteye hiç girilmeyen aralıkta zaman "duraklar", biri girdiğinde ana anda güncel duruma atlanır — geriye dönük kaçırılan turları simüle etmeye çalışmaz.
- İstemci, `/at-yarisi` sayfasındayken bu endpoint'i ~2 saniyede bir poll eder (leaderboard'daki polling deseniyle aynı yaklaşım) — faz geçişlerini ve yarış sonucunu/tohumunu yakalamak için. `RACING` fazındayken görsel animasyon, poll'dan bağımsız olarak elde edilen tohum + başlangıç zamanından **istemci tarafında** `requestAnimationFrame` ile hesaplanır (akıcı görünmesi için).

## Veri Modeli (yeni Prisma modelleri)

```
model Horse {
  id           String  @id @default(cuid())
  name         String
  number       Int?
  color        String  // hex renk kodu, görsel ayırt edicilik için
  speedRating  Int     // 1-10, admin girer
  formRating   Int     // 1-10, admin girer
  luckRating   Int     // 1-10, admin girer — varyans/sürpriz galibiyet katkısı
  price        Int     // STA, %100 sahiplik değeri, admin girer
  active       Boolean @default(true) // false = havuzda ama yarışlara seçilmiyor (emekli)
  ownerships   HorseOwnership[]
  raceEntries  HorseRaceEntry[]
  bets         HorseBet[]
}

model HorseOwnership {
  id          String @id @default(cuid())
  horseId     String
  horse       Horse  @relation(fields: [horseId], references: [id])
  userId      String
  user        User   @relation(fields: [userId], references: [id])
  staInvested Int    // bu kullanıcının bu ata toplam yatırdığı STA
  createdAt   DateTime @default(now())

  @@unique([horseId, userId])
}

model HorseRace {
  id            String   @id @default(cuid())
  phase         String   @default("BETTING") // "BETTING" | "RACING" | "FINISHED"
  bettingEndsAt DateTime
  raceEndsAt    DateTime
  seed          Int      // animasyon + kazanan belirleme için deterministik tohum
  createdAt     DateTime @default(now())
  entries       HorseRaceEntry[]
  bets          HorseBet[]
}

model HorseRaceEntry {
  id             String  @id @default(cuid())
  raceId         String
  race           HorseRace @relation(fields: [raceId], references: [id])
  horseId        String
  horse          Horse   @relation(fields: [horseId], references: [id])
  oddsValue      Float   // tur başında donmuş oran (Odds modeliyle aynı desen)
  finishPosition Int?    // 1 = kazanan, yarış bitince doldurulur

  @@unique([raceId, horseId])
}

model HorseBet {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  raceId        String
  race          HorseRace @relation(fields: [raceId], references: [id])
  horseId       String
  horse         Horse    @relation(fields: [horseId], references: [id])
  stake         Int
  oddsValueAtBet Float
  status        String   @default("pending") // "pending" | "won" | "lost"
  createdAt     DateTime @default(now())

  @@unique([userId, raceId])
}
```

`User` modeline `horseOwnerships HorseOwnership[]` ve `horseBets HorseBet[]` ters ilişkileri eklenecek.

## Algoritma

1. **Bileşik skor** (her at için, TJK kılavuzundaki ağırlıklı model iskeletinin küçültülmüş hali):
   `score = 0.45 * speedRating + 0.35 * formRating + 0.20 * luckRating`
2. **Olasılık**: o turdaki 7 atın skorları üzerinden **softmax** (`T` sabit bir sıcaklık parametresi, ör. 3.0 — favoriler ile zayıf atlar arasındaki farkı çok keskinleştirmeyecek şekilde kalibre edilir).
3. **Oran**: `oddsValue = clamp(1 / probability * (1 - HOUSE_MARGIN), MIN_ODDS, MAX_ODDS)` — mevcut `odds.ts`'teki cap deseniyle tutarlı (ör. `MIN=1.3`, `MAX=15`, `HOUSE_MARGIN=0.08`).
4. **Kazanan + tam bitiş sırası**: olasılıklarla ağırlıklı, **iadesiz çekiliş** (her adımda kalanlar arasından bir sonraki sırayı çek) — tüm 7 at için bir bitiş sırası üretir, seed'e bağlı deterministik (aynı seed = aynı sonuç, hem sunucu hem istemci animasyonu senkron kalır).
5. **Ortak sahip ödemesi**: kazanan at için `bonusPool = horse.price * OWNER_BONUS_RATE` (ör. 0.10). Bu pool, o ata ait `HorseOwnership` satırları arasında `staInvested / toplamYatırılanSTA` oranına göre bölüşülüp her sahibin `User.staBalance`'ına eklenir. **Bu gelir leaderboard "puan" hesabına dahil değil** (puan yalnızca bahis kazanç/kaybından hesaplanıyor, sahiplik pasif bir gelir — `computeUserScore` değişmiyor).

## Tur Akışı (lazy-tick ile)

> **Eşzamanlılık notu:** birden fazla kullanıcının aynı anda poll etmesi, aynı faz geçişini iki kez tetikleyebilir. Her geçiş, o an geçerli olması gereken önkoşulu (`phase = 'X'`) `where` koşuluna koyan bir `updateMany` ile yapılır; sadece `count=1` dönen çağrı işlemi gerçekleştirir, diğerleri no-op geçer. Bu, adım 2 (yeni tur oluşturma — `HorseRace` tablosunda "açık tur yok" durumunu bir `advisory lock` yerine ilk `create` başarılı olanın kazanması ilkesiyle), adım 3 ve adım 4'ün hepsi için geçerli.

1. `getCurrentRace()` çağrılır → en son `HorseRace` satırı okunur.
2. Yoksa veya `phase=FINISHED` ise ve `raceEndsAt` geçmişse: **yeni tur başlatılır** — havuzdan 7 aktif at rastgele seçilir (havuzda 7'den az aktif at varsa `null` dönülür, sayfa "yeterli at yok" mesajı gösterir), her biri için oran hesaplanıp `HorseRaceEntry` yazılır, `phase=BETTING`, `bettingEndsAt = now + 30sn`, `raceEndsAt = bettingEndsAt + rastgele(30-45sn)`, `seed` rastgele üretilir.
3. `phase=BETTING` ve `now > bettingEndsAt` ise: `phase=RACING`'e geçilir (DB'de sadece faz güncellenir, zamanlar sabit kalır).
4. `phase=RACING` ve `now > raceEndsAt` ise: sonuçlandırma tetiklenir. Eşzamanlı çağrılarda çifte ödeme olmaması için, sonuçlandırma **önce koşullu bir güncelleme** ile başlar: `prisma.horseRace.updateMany({ where: { id: raceId, phase: 'RACING' }, data: { phase: 'FINISHED' } })`. Bu çağrının `count` değeri 1 olan istek "kazanan" sayılır ve devamındaki hesaplamayı (kazanan + bitiş sırası hesapla, `HorseRaceEntry.finishPosition` doldur, `HorseBet` kayıtlarını değerlendir, ortak sahip ödemesini yap) o istek yapar; `count=0` dönen diğer eşzamanlı istekler hiçbir şey yapmadan çıkar (mevcut `Match` sonuçlandırma deseninde kullanılan "status kontrolüyle tekrar tetiklenemez" prensibinin eşzamanlılığa dayanıklı hali).
5. `phase=FINISHED` kısa bir süre (ör. 5sn "kazanan: X" ekranı) gösterildikten sonra adım 2'ye döner.

## Bahis Akışı

- Kullanıcı sadece `phase=BETTING` iken, `bettingEndsAt` geçmeden bir at seçip stake girer.
- Kullanıcı başına tur başına tek bahis (`@@unique([userId, raceId])`, mevcut `Bet` kısıtıyla aynı mantık).
- Bahis, o anki `HorseRaceEntry.oddsValue`'yu donmuş olarak (`oddsValueAtBet`) kopyalar.

## 2D Arayüz

- Yatay 7 şeritli pist (`div` katmanları), her şeritte bir at ikonu/renk bloğu.
- `BETTING` fazında: at listesi (isim, numara, renk, oran) + stake input + geri sayım.
- `RACING` fazında: her atın `translateX`'i, seed'den türetilen organik bir hız eğrisiyle, önceden belirlenmiş bitiş sırasına ve `raceEndsAt` anına tam denk gelecek şekilde `requestAnimationFrame` ile hesaplanır — kazanan görsel olarak da doğru anda bitiş çizgisini geçer.
- `FINISHED` fazında: kazanan duyurusu + bir sonraki tur geri sayımı.

## Mağaza (`/at-yarisi/magaza`)

- Havuzdaki tüm aktif atlar, her biri için: isim/numara/renk, fiyat, o ana kadar yatırılan toplam STA (`Σ staInvested`), kalan kapasite (`price - toplam`), kullanıcının kendi payı (varsa).
- "Pay Al" formu: STA miktarı girilir (kalan kapasiteyi aşamaz), `HorseOwnership` upsert edilir (`staInvested += miktar`), kullanıcının `staBalance`'ından düşülür.
- Kapasite dolan (`toplam >= price`) atlar "Tamamen Sahiplenildi" rozetiyle gösterilir, yeni pay alınamaz.

## Admin (`/admin/horses`)

- At havuzunu tam CRUD: ekle, düzenle (isim/numara/renk/speed/form/luck/price/active), sil (veya `active=false` yaparak "emekli" etme — gerçek silme yerine bu tercih edilir, çünkü geçmiş `HorseRaceEntry`/`HorseBet`/`HorseOwnership` kayıtları o at'a referans veriyor olabilir).
- Aktif at sayısı 7'nin altına düşerse panelde uyarı gösterilir ("yarış başlayamaz").

## Puan / Ekonomi Entegrasyonu

- `computeUserScore` (src/lib/score.ts) imzası aynı kalır (`{status, stake, potentialWin}[]` alır) — leaderboard ve home page, kullanıcının `bets` (futbol) ve `horseBets` (at yarışı) dizilerini **birleştirip** aynı fonksiyona geçirecek şekilde güncellenir. Tek bir net puan, iki bahis kaynağını da kapsar.
- Ortaklık geliri (`OWNER_BONUS_RATE` payı) sadece `staBalance`'a eklenir, puan hesabına girmez.

## Test / Doğrulama

- `src/lib/horseRace.ts` (skor→olasılık→oran→kazanan/sıra hesaplama) için birim testleri: sabit seed ile deterministik çıktı, olasılıkların toplamının 1'e yakın olması, oranların `[MIN,MAX]` aralığında kalması.
- Lazy-tick ilerletme mantığı için: aynı anda çağrılan iki `getCurrentRace()`'in turu **çift sonuçlandırmadığını** doğrulayan bir test.
- `tsc --noEmit` + mevcut `vitest` suite'i yeşil kalmalı.
- Browser pane ile `/at-yarisi` ve `/at-yarisi/magaza` üzerinde görsel + faz geçişi doğrulaması (dev server ile, gerçek zaman akışını hızlandırmak için testte kısa süreli faz süreleri kullanılabilir).
