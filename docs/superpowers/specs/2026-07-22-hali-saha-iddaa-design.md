# Hali Saha İddaa Sitesi — Tasarım Dokümanı

Tarih: 2026-07-22

## Amaç

Kullanıcının arkadaş grubuyla oynadığı hali saha maçları için, gerçek para karşılığı olmayan "STA" adlı sanal para birimi üzerinden eğlence amaçlı bir tahmin/iddaa sitesi. Yönetim (admin) kullanıcıda, maç/takım/kadro bilgilerini admin girer, oranlar sistem tarafından otomatik hesaplanır. Link arkadaş grubuna paylaşılacak, çoğunluk mobil (telefon) üzerinden erişecek.

## Kapsam Dışı

- Gerçek para / ödeme entegrasyonu yok.
- Email doğrulama, şifre sıfırlama akışı yok (arkadaş grubu ölçeğinde gereksiz).
- Gelişmiş istatistik/analitik dashboard'u yok.

## Mimari

- **Next.js (App Router)** tek proje: kullanıcı arayüzü (`/`), admin paneli (`/admin/*`), API route'ları aynı projede.
- **Veritabanı:** Neon (ücretsiz Postgres), **Prisma ORM** ile erişim.
- **Auth:** NextAuth, credentials provider (kullanıcı adı + bcrypt ile hashlenmiş şifre). Kayıt sırasında rol `user` olarak atanır; admin hesabı seed script ile oluşturulur.
- **Stil:** Tailwind CSS, mobil öncelikli responsive tasarım. Abartısız, sade/profesyonel görünüm.
- **Hosting:** Vercel ücretsiz katman. Vercel Cron ile maç saatine göre kupon kilitleme durumu periyodik güncellenir (yedek mekanizma — asıl kilit kontrolü her API isteğinde anlık yapılır, cron sadece UI/durum senkronizasyonu için).

## Veri Modeli

- **User**: id, username (unique), passwordHash, staBalance (Int), role (`user`|`admin`), createdAt
- **Team**: id, name, logo (opsiyonel emoji/renk kodu)
- **Player**: id, teamId (FK), name, number (opsiyonel)
- **Match**: id, homeTeamId (FK), awayTeamId (FK), kickoffTime (DateTime), status (`upcoming`|`locked`|`finished`), finalHomeScore (nullable Int), finalAwayScore (nullable Int)
- **PlayerGoal**: matchId (FK), playerId (FK), goalCount (Int) — maç sonuçlandırılırken admin girer
- **Odds**: matchId (FK), market (`1X2`|`SCORE`|`OU_GOALS`|`PLAYER_GOALS`), selectionKey (örn. `"1"`, `"2-1"`, `"OVER_4.5"`, `"player:<id>:2+"`), oddsValue (Decimal) — maç oluşturulduğunda bir kez hesaplanıp yazılır, sonradan değişmez
- **Bet**: id, userId (FK), matchId (FK), stake (Int), totalOdds (Decimal), potentialWin (Int), status (`pending`|`won`|`lost`), createdAt — **unique(userId, matchId)** kısıtı ile kullanıcı başına maç başına tek kupon garanti edilir
- **BetSelection**: id, betId (FK), market, selectionKey, oddsValueAtBet (Decimal) — kupon oluşturulduğu andaki oranın kopyası (Odds tablosu değişmese de, ekstra güvenlik için satır bazında saklanır)

## Bahis Marketleri ve Oran Hesaplama

Tüm oranlar **Poisson dağılımı** temelinde, hali saha ortalama gol beklentisi varsayımıyla (örn. toplam maç başına ortalama 5-6 gol) ve **iki takımın gücü eşit kabul edilerek** hesaplanır — "2026 Dünya Kupası finali" esinlenmesi burada karşılığını buluyor: iki güçlü/yakın rakip, net favori yok.

- **1X2:** Ev sahibine hafif ev sahibi avantajı (örn. 1 → ~2.60, X → ~3.20, 2 → ~2.70). Berabere (X) hali sahada nispeten az görüldüğünden odds biraz yüksek tutulur.
- **Skor tahmini (SCORE):** Poisson ile her makul skorun (0-0 ... 6-6 aralığı) olasılığı hesaplanır, oran = (1 / olasılık) × house margin katsayısı.
- **Toplam gol alt/üst (OU_GOALS):** Sabit çizgi (örn. 4.5), Poisson toplam gol dağılımından ÜST/ALT olasılığı çıkarılır.
- **Oyuncu gol sayısı (PLAYER_GOALS):** Takımın beklenen gol sayısı kadroya eşit dağıtılır (kaleci hariç tutulabilir, basitlik için ilk versiyonda tüm oyunculara eşit dağıtım da kabul edilebilir), "0 / 1 / 2+ gol" bantlarına oran hesaplanır.

House margin: tüm oranlara küçük bir kesinti payı (örn. %5-8) uygulanır ki oranlar toplamı olasılık toplamının biraz üzerinde olsun (gerçekçi iddaa hissi).

## Kupon (Bet) Akışı

1. Kullanıcı bir maça girer, istediği market(ler)den birer seçim yapar (kombine kupon — 1X2 + skor + oyuncu golü aynı kuponda birleşebilir).
2. Stake (STA miktarı) girer, mevcut bakiyeyi aşamaz.
3. Sistem seçilen oranları çarpar, toplam oran ve olası kazancı gösterir; kullanıcı onaylar.
4. Kupon oluşur (Bet + BetSelection kayıtları), stake bakiyeden düşülür.
5. Aynı maça ikinci kupon denemesi DB unique kısıtıyla engellenir, kullanıcıya anlamlı hata mesajı gösterilir.
6. `kickoffTime` geçtiyse hem UI'da kupon oluşturma butonu devre dışı kalır hem API seviyesinde istek reddedilir (403 + "kupon süresi doldu").
7. Maç bitince admin final skoru ve (varsa) oyuncu gol dağılımını girer, "Sonuçlandır" işlemiyle:
   - Match.status → `finished`, skorlar yazılır
   - Sistem o maça ait tüm Bet kayıtlarını değerlendirir: kupondaki TÜM BetSelection'lar doğruysa `won` (staBalance += potentialWin), biri bile yanlışsa `lost`
   - Bu işlem tekrar tetiklenemez (status kontrolü ile engellenir — yanlışlıkla çifte sonuçlandırma önlenir)

## Liderlik Tablosu (Leaderboard)

`/leaderboard` sayfası: tüm kullanıcılar güncel `staBalance`'a göre büyükten küçüğe sıralanır. Gösterilenler: sıra, kullanıcı adı, STA bakiyesi, toplam kupon sayısı, kazanma oranı (win/total). Ana sayfada ilk 3'ü gösteren küçük bir widget, tam liste ayrı sayfada. Mobil kart/liste görünümü.

## Admin Paneli (`/admin/*`, sadece role=admin)

- **Maç oluşturma:** Takım seç/oluştur, kickoff saati gir → kaydedince oranlar otomatik hesaplanıp yazılır.
- **Kadro yönetimi:** Takım başına oyuncu ekle/çıkar (isim, forma no opsiyonel).
- **Maç listesi:** Durum filtreli (upcoming/locked/finished).
- **Sonuç girişi:** Final skor + oyuncu gol dağılımı gir → "Sonuçlandır" → otomatik kupon değerlendirme. Geri alınamaz uyarısı gösterilir.
- **Kullanıcı yönetimi:** Kullanıcı listesi + manuel STA ekleme/çıkarma (bakiyesi biten kullanıcı talep ederse).

## Kimlik Doğrulama

NextAuth credentials provider, bcrypt hash. Kayıt formunda kullanıcı adı benzersizliği kontrolü, başlangıç STA bakiyesi (örn. 1000) otomatik atanır. Email doğrulama yok.

## Hata Yönetimi / Kenar Durumları

- Bakiyeden fazla stake → engelle, "yetersiz bakiye"
- Maç saati geçtikten sonra kupon denemesi → engelle (UI + API çift kontrol)
- Aynı maça ikinci kupon → DB unique constraint + anlamlı hata mesajı
- Maçın iki kez sonuçlandırılması → status kontrolüyle engelle
- Kullanıcı adı çakışması → kayıt formunda anlık uyarı

## Test Stratejisi

Küçük ölçekli eğlence projesi olduğundan ağır bir test suite yerine, kritik iş mantığı için hedefli birim testleri (Vitest):
- Oran hesaplama fonksiyonları (Poisson tabanlı skor/gol/oyuncu golü oranları)
- Kupon kilitleme zaman kontrolü (kickoffTime karşılaştırması)
- Kombine kupon sonuçlandırma mantığı (tüm seçimler doğru mu kontrolü)

Ek olarak manuel uçtan uca deneme: kayıt ol → kupon yap → admin sonuçlandırır → bakiye/leaderboard güncellendi mi.
