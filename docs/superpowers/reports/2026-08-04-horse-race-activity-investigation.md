# At Yarışı — Diğer Kullanıcı Aktivitesi Araştırması

Tarih: 2026-08-04 (spec) / uygulama: bugünün tarihi

## Soru

At yarışı sayfasındaki diğer kullanıcıların bahisleri/sahiplikleri gerçek mi, yoksa simüle mi?

## Bulgular

- `HorseRace`/`HorseRaceEntry` kayıtları gerçek ve paylaşılan: her turda sunucu tek bir `HorseRace` satırı oluşturur (`startNewRace()`, `src/lib/horseRaceEngine.ts`), tüm kullanıcılar `getCurrentRace()` ile aynı en-son-oluşturulan satırı görür.
- `HorseBet` kayıtları tamamen gerçek: `@@unique([userId, raceId])` kısıtı her kullanıcının bir yarışa yalnızca kendi adına bir kez bahis koyabilmesini garanti eder. Bot/demo kullanıcı oluşturma mekanizması yoktur.
- **Tek sahte unsur:** at yanındaki "🎟️ X kupon" rozeti. `simulatedBetCount()` (`src/lib/horseRace.ts:84-93`), gerçek `HorseBet` sayısı 5'in altındayken deterministik (seed'li) bir 0-4 arası "boost" ekler. Kod yorumunda bilinçli bir ürün kararı olarak belgelenmiştir: yeni başlayan bir yarış "ölü" görünmesin diye. 5+ gerçek bahis birikince boost otomatik sıfıra iner.

## Sonuç

At sahipliği, kazanç payları, diğer kullanıcıların bahisleri hepsi gerçek veridir. Sadece görüntülenen kupon SAYISI düşük trafikte hafifçe şişirilir; bu para/sonuç etkilemeyen, kasıtlı bir "canlılık" hilesidir. Kullanıcının onayıyla olduğu gibi bırakılmıştır — kod değişikliği yapılmamıştır (bkz. spec Kapsam Dışı bölümü).
