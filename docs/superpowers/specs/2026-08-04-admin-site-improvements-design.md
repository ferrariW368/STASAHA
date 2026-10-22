# Admin Panel + Site Geneli 10 Maddelik İyileştirme Paketi — Tasarım Dokümanı

Tarih: 2026-08-04

## Amaç

Kullanıcının 2026-08-03'te verdiği, 10 maddelik admin panel + site geneli iyileştirme talebini karşılamak. Görevler bağımsız ama birbirine bağlı üç grup halinde: (A) admin kullanıcı yönetimi + audit log, (B) at yarışı araştırma + tasarım düzeltmeleri, (C) doğrulama görevleri (A/B'nin çıktısına bağlı, gerçek sunucu testi gerektirir).

## Kapsam Dışı

- Var olan ilişkilerde (`Bet`, `HorseBet`, `HorseOwnership`, `Lineup`) Prisma seviyesinde `onDelete: Cascade` tanımlamak — bunun yerine hard-delete işlemi transaction içinde manuel sıralı silme yapar (bkz. Task 1), mevcut foreign key davranışı değişmez.
- Admin panelindeki takım/oyuncu/maç/at/kadro CRUD işlemlerinin audit loglanması — sadece kullanıcı yönetimi işlemleri loglanır (kullanıcının açık kararı).
- `simulatedBetCount` sahte kupon-sayısı boost'unun kaldırılması veya UI'da etiketlenmesi — bilinçli bir ürün kararı olarak olduğu gibi bırakılır, sadece rapor edilir (Task 4).
- Yeni realtime kanal (WebSocket/SSE) — mevcut 2sn polling deseni korunur.

---

## Task 1 — Admin: Oyuncu (kullanıcı) yönetimi

### Şema değişikliği

`User` modeline yeni alan:

```prisma
model User {
  // ...mevcut alanlar
  status String @default("active") // "active" | "banned"
}
```

Yeni migration: `add_user_status`.

### Server actions (`src/actions/users.ts`)

- `updateUserProfile(userId, { username?, status? })` — admin guard (`requireAdmin`), username değişiyorsa unique çakışmasını `Prisma.PrismaClientKnownRequestError` (P2002) ile yakalayıp Türkçe hata döner. Başarılı işlem sonunda `logAdminAction(adminId, userId, 'EDIT_USER', detail)` çağrılır.
- `deleteUser(userId)` — admin guard. Tek bir `prisma.$transaction` içinde, foreign key sırasına göre: `lineupSlot` (kullanıcının `Lineup`'larına ait `LineupSlot`'lar) → `lineup` → `betSelection` (kullanıcının `Bet`'lerine ait) → `bet` → `horseBet` → `horseOwnership` → `user` silinir. İşlem başarılıysa `logAdminAction(adminId, null, 'DELETE_USER', detail)` çağrılır (silinen kullanıcıya artık referans verilemez, `detail` alanına silinen username yazılır).
- Mevcut `adjustBalance` ve `adminResetPassword` fonksiyonlarına da `logAdminAction` çağrısı eklenir (`'ADJUST_BALANCE'`, `'RESET_PASSWORD'`).

### UI (`src/app/admin/users/page.tsx`)

Her kullanıcı kartına eklenir:
- Username düzenleme input'u + kaydet butonu.
- Status toggle butonu (`active` ⇄ `banned`).
- "Hesabı Sil" butonu — `window.confirm(...)` ile onay, onaylanırsa `deleteUser(u.id)` çağrılır.

### Giriş engeli

`src/lib/auth.ts` → `authorize()` içinde, `user.status === 'banned'` ise `null` döner (giriş reddedilir), tıpkı yanlış şifre gibi.

---

## Task 2 — Admin: Kullanıcı yönetimi görünürlüğü

Büyük ölçüde zaten mevcut (tüm username'ler görünür, şifreler asla plaintext gösterilmez, `adminResetPassword` var). Task 1 ile birlikte tamamlanmış olur — ek iş yok, sadece audit log entegrasyonu (yukarıda kapsandı).

---

## Task 3 — Admin: Kupon görünürlüğü

### Yeni sayfa: `src/app/admin/bets/page.tsx`

- Admin nav'a (`src/app/admin/layout.tsx`) "Kuponlar" linki eklenir.
- Query-param tabanlı iki sekme: `?tab=football` (varsayılan) ve `?tab=horse`.
- **Futbol sekmesi:** `prisma.bet.findMany({ include: { user: { select: { username: true } }, match: { include: { homeTeam: true, awayTeam: true } }, selections: true }, orderBy: { createdAt: 'desc' } })`. Kart tasarımı `src/app/bets/page.tsx`'teki mevcut desenle aynı, ek olarak kullanıcı adı gösterilir.
- **At yarışı sekmesi:** `prisma.horseBet.findMany({ include: { user: { select: { username: true } }, horse: true, race: true }, orderBy: { createdAt: 'desc' } })`. Benzer kart düzeni: kullanıcı adı, at adı, stake, durum, tarih.

---

## Task 8 — Admin: İşlem kayıtları (audit log)

### Yeni Prisma modeli

```prisma
model AdminActionLog {
  id           String   @id @default(cuid())
  adminUserId  String
  adminUser    User     @relation("AdminActions", fields: [adminUserId], references: [id])
  targetUserId String?
  targetUser   User?    @relation("TargetedActions", fields: [targetUserId], references: [id], onDelete: SetNull)
  action       String   // "DELETE_USER" | "EDIT_USER" | "RESET_PASSWORD" | "ADJUST_BALANCE"
  detail       String?  // ör. "eski: ahmet -> yeni: ahmet2" veya "silinen kullanıcı: ahmet"
  createdAt    DateTime @default(now())
}
```

`targetUserId` nullable + `onDelete: SetNull`: hedef kullanıcı hard-delete edildiğinde log kaybolmaz, sadece referans kopar (silinen kullanıcı adı `detail` alanında zaten saklı).

`User` modeline karşılık gelen ters ilişkiler eklenir: `adminActions AdminActionLog[] @relation("AdminActions")`, `targetedActions AdminActionLog[] @relation("TargetedActions")`.

### Yardımcı fonksiyon: `src/lib/auditLog.ts`

```ts
export async function logAdminAction(
  adminUserId: string,
  targetUserId: string | null,
  action: 'DELETE_USER' | 'EDIT_USER' | 'RESET_PASSWORD' | 'ADJUST_BALANCE',
  detail?: string
): Promise<void>
```

`adjustBalance`, `adminResetPassword`, `updateUserProfile`, `deleteUser` içinde çağrılır (Task 1'de kapsandı).

### Görüntüleme

`/admin/users` sayfasının altına (veya ayrı `/admin/audit-log` sayfasına — nav'da yer sıkışıklığına göre karar verilecek, uygulama sırasında değerlendirilir) en son N kayıt tarih sıralı (`orderBy: { createdAt: 'desc' }`) listelenir: admin adı, hedef kullanıcı adı (null ise "silinmiş kullanıcı"), işlem, detay, tarih.

---

## Task 4 — At yarışı: diğer kullanıcı aktivitesi araştırması (bulgu raporu, kod değişikliği yok)

**Bulgular** (final rapora aynen eklenecek):

- `HorseRace`/`HorseRaceEntry` kayıtları gerçek ve paylaşılan: her turda sunucu tek bir `HorseRace` satırı oluşturur (`startNewRace()`, `src/lib/horseRaceEngine.ts`), tüm kullanıcılar `getCurrentRace()` ile aynı en-son-oluşturulan satırı görür — bir "yayın" mekanizması değil, gerçekten paylaşılan tek bir aktif yarış.
- `HorseBet` kayıtları tamamen gerçek: `@@unique([userId, raceId])` kısıtı her kullanıcının bir yarışa yalnızca kendi adına bir kez bahis koyabilmesini garanti eder. Bot/demo kullanıcı oluşturma mekanizması yok.
- **Tek sahte unsur:** at yanındaki "🎟️ X kupon" rozeti. `simulatedBetCount()` (`src/lib/horseRace.ts:84-93`), gerçek `HorseBet` sayısı 5'in altındayken deterministik (seed'li) bir 0-4 arası "boost" ekliyor. Kod yorumunda bilinçli bir ürün kararı olarak belgelenmiş: yeni başlayan bir yarış "ölü" görünmesin diye. 5+ gerçek bahis birikince boost otomatik sıfıra iner.
- **Sonuç:** at sahipliği, kazanç payları, diğer kullanıcıların bahisleri hepsi gerçek veridir. Sadece görüntülenen kupon SAYISI düşük trafikte hafifçe şişirilir; bu para/sonuç etkilemeyen, kasıtlı bir "canlılık" hilesidir. Kullanıcının onayıyla olduğu gibi bırakılır.

---

## Task 5 — Performans: yarış bitişi kasması + eksik konfeti

### Bulgu 1 — Muhtemel kasma kaynağı

`src/app/at-yarisi/page.tsx`'te iki bağımsız `setInterval` var: 2sn'lik poll (`fetch` + `setRace`) ve 1sn'lik `nowTick` (sadece countdown metni için). `key={nowTick}` kullanımı (satır 134), banner `<div>`'ini her saniye komple remount ediyor. Bu, poll'un FINISHED faz geçişini yakaladığı anla (büyük state güncellemesi → `RaceTrack`'in tüm prop'ları değişir, `jackpot-pulse` animasyonu başlar) çakıştığında ekstra bir DOM remount + reflow ekliyor.

**Düzeltme:** `key={nowTick}` kaldırılır; banner metni ayrı, izole bir state/component'te tutulur (yalnızca metin `<span>`'i güncellenir, çevresindeki `<div>` remount edilmez).

### Bulgu 2 — Confetti'nin hiç tetiklenmeme nedeni

`prevBetStatusRef.current` başlangıçta `null`. Overlay/confetti tetikleme koşulu `prevStatus === 'pending' && currentStatus !== 'pending'` (satır 71-74) — yani kullanıcının tarayıcısı `pending` durumunu en az bir poll'da yakalamış olmalı. Sekme geç açılır/arka planda kalırsa veya kullanıcı sonucu ilk kez `won`/`lost` olarak görürse (ilk poll direkt son durumu döndürürse), bu koşul hiç sağlanmaz ve confetti hiç tetiklenmez. Bu, "confetti'yi hiç görmedim" şikayetinin en olası kök nedenidir.

**Düzeltme:** İlk poll'da `myBet.status !== 'pending'` VE bu `raceId` için daha önce overlay gösterilmemişse (`sessionStorage` kontrolü, mevcut `alreadyShownKey` deseniyle), yine de overlay/confetti tetiklenir.

### Doğrulama notu

Kod düzeltmeleri `tsc --noEmit` ve `eslint` ile statik doğrulanır. Gerçek jank hissi ve confetti'nin fiilen görünmesi ancak gerçek tarayıcı testinde doğrulanabilir (bkz. Task 9) — bunun için ayrıca kullanıcı onayı + port numarası istenecek, sunucu kullanıcı onayı olmadan arka planda başlatılmayacak, port 20128 kullanılmayacak.

---

## Task 6 — Tasarım: Banner hizalama (masaüstü + mobil)

### Kök neden

`FerrariBetBanner`'ın masaüstü versiyonu `fixed left-4/right-4 top-1/2 -translate-y-1/2` ile ekran kenarına göre konumlanıyor; sayfa içeriği ise `max-w-lg`/`max-w-2xl` ile kendi merkezine göre ortalanıyor. İki bağımsız konumlama sistemi olduğundan geniş ekranlarda banner-içerik arası boşluk ekran genişliğine göre değişiyor — "hizasız" görünümün sebebi bu.

### Düzeltme: 3 sütunlu grid

`src/app/layout.tsx`'te `children` + masaüstü banner'lar ortak bir grid'e alınır:

```
lg:grid lg:grid-cols-[9rem_1fr_9rem]
```

(9rem = mevcut `w-36` banner genişliğiyle eşleşir.)

- Sol/sağ grid hücreleri banner'ları barındırır; banner'lar artık `fixed` değil, grid akışının parçası (dikey ortalama için `sticky top-1/2` kullanılabilir).
- Orta hücre mevcut `max-w-lg`/`max-w-2xl` içerik kapsayıcılarını değiştirmeden barındırır.
- `header` (sticky nav) grid dışında kalır, sadece `children` + banner'lar grid'e taşınır.
- Mobil (`lg:hidden`) `MobileBannerStrip` değişmeden kalır — zaten normal doküman akışında, sorun masaüstüne özgü.

### Doğrulama notu

Gerçek ekran görüntüsü karşılaştırması Task 10'da yapılır.

---

## Task 7 — At yarışı mağaza: sahiplik/ortaklık gösterimi

`src/app/at-yarisi/magaza/page.tsx`'te zaten `coOwnerCount` (ortak sayısı) ve kullanıcının kendi payı gösteriliyor; eksik olan ortakların KİM olduğu (isimler).

- Query'deki `ownerships: true` → `ownerships: { include: { user: { select: { username: true } } }, orderBy: { staInvested: 'desc' } }` olarak genişletilir.
- Kart içine, mevcut `👥 X ortak` satırının yanına top-3 isim eklenir: `👥 ahmet, mehmet +2 ortak` — `src/app/at-yarisi/page.tsx`'teki `OwnerBadge` bileşeniyle aynı görsel/metin deseni (slice(0,3) + kalan sayı). Kod tekrarını önlemek için bu mantık ortak bir `OwnerNames` yardımcı bileşenine çıkarılabilir; uygulama sırasında değerlendirilir.

---

## Task 9 — Performans doğrulama (Task 5)

Task 5 kod değişikliklerinden sonra `tsc --noEmit` ve `eslint` ile statik doğrulama yapılır. Gerçek "önce/sonra" ölçüm (jank hissi, confetti'nin fiilen tetiklenmesi) gerçek sunucu + tarayıcı testi gerektirir. Bu noktada kullanıcıdan **port numarası onayı** istenecek (örn. 3001); sunucu onay alınmadan arka planda başlatılmayacak, port 20128 kesinlikle kullanılmayacak.

## Task 10 — Responsive görsel doğrulama (Task 6)

Banner grid değişikliğinden sonra gerçek sunucu üzerinde mobil/tablet/masaüstü ekran görüntüleri alınıp karşılaştırılır — Task 9 ile aynı onaylı test oturumunda yapılabilir.

---

## Süreç

Her görev ayrı bir implementasyon adımı olarak planlanır, sırayla uygulanır + statik doğrulanır (`tsc`, `eslint`, mevcut testler — sunucu gerektirmeyen her yerde), her görev sonunda commit atılır. Task 9/10 için gerçek sunucu testi gerektiğinde, kullanıcıdan açık onay + port numarası istenecek. Son olarak: hangi dosyaların değiştiği, hangi görevlerin tam doğrulandığı, hangilerinin gerçek sunucu testi beklediği özetleyen bir final rapor sunulacak.
