# Halı Saha Oran Motoru — Maç Seed'li Kalibrasyon (Tasarım Dokümanı)

Tarih: 2026-07-29

## Amaç

Mevcut oran motoru (`src/lib/odds.ts`) her maç için **birebir aynı** 1X2 ve KG Var/Yok oranlarını üretiyor, çünkü `RESULT_HOME_LAMBDA`/`RESULT_AWAY_LAMBDA` sabit. Bu hem gerçekçi değil (her maç aynı favori/oran görünüyor) hem de kullanıcı tarafından açıkça reddedilen bir çözüme (takım/oyuncu rating'ini oran girdisi yapmak) davetiye çıkarıyordu.

Bu doküman, **takım veya oyuncu gücünü hiç okumadan**, sadece maçın kendi kimliğinden (id, takım id'leri, kickoff zamanı) türeyen **deterministik bir seed** ile her maça küçük ama görünür bir varyasyon kazandıran tasarımı tarifler. Aynı maç her hesaplandığında birebir aynı oranları üretir; farklı maçlar birbirinden farklı ama sınırlandırılmış oranlar alır.

Ayrıca mevcut kodda tespit edilen bir tutarsızlık düzeltilir: `computeBothTeamsScore()` düşük gollü `RESULT_*` lambda'larını kullanıyor, oysa yorum satırı `GOALS_*`'ın "her yüksek-gol marketini tutarlı besleyen ortak kaynak" olduğunu iddia ediyor — bu iddia kodla örtüşmüyordu. KG Var artık kendi başına kalibre edilmiş bir lambda çiftiyle hesaplanacak.

## Kapsam Dışı

- Takım/oyuncu rating alanları (`pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`, `teamStarRating`, `playerOverall`) oran hesaplamasına **hiçbir şekilde** girmeyecek. Bunlar UI-only kalmaya devam eder.
- `Match` şemasına yeni bir `seed` kolonu eklenmiyor — seed, zaten var olan `match.id + homeTeamId + awayTeamId + kickoffTime` alanlarından anlık türetiliyor, ayrıca saklanmasına gerek yok.
- `NOVELTY`, `FIGHT`, `LATE` marketleri bu turda **sabit** kalıyor (sonuçla/takım gücüyle ilişkilendirilemeyen eğlence marketleri). İleride seed'e bağlı dar bir varyasyon eklenebilir ama kapsam dışı.
- Yeni market eklenmiyor — sadece mevcut marketlerin kalibrasyonu ve seed varyasyonu.
- `src/actions/odds.ts` üzerinden admin'in elle oran düzenlemesi davranışı değişmiyor; bu tasarım sadece **üretim zamanı** hesaplamasını etkiliyor.

## Seed ve Determinizm

```ts
function hashSeed(input: string): number {
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- Seed string'i çağıran taraf (`src/actions/matches.ts`) oluşturur: `` `${match.id}:${homeTeamId}:${awayTeamId}:${kickoffTime.toISOString()}` ``. `match.id` zaten `createMatch` içinde odds hesaplanmadan önce mevcut (bkz. mevcut kod, `prisma.match.create` çağrısı `computeMatchOdds`'tan önce).
- `computeMatchOdds` artık bu string'i bir parametre olarak alır (bkz. "API Değişikliği"), Prisma'ya veya DB'ye bağımlı değildir — test edilebilirliği korumak için saf string.
- `mulberry32(hashSeed(seedString))` (zaten `src/lib/horseRace.ts`'te var olan PRNG, aynen tekrar kullanılıyor) tek bir `rng()` fonksiyonu üretir; bu fonksiyon üzerinden **sıralı, bağımsız** birkaç sayı çekilir (taraf eğilimi, KG eğilimi, gol temposu, gol temposu eğilimi). Aynı seed → aynı sıradaki aynı sayılar → aynı oranlar.
- Farklı `matchId`/takım/kickoff kombinasyonu → farklı hash → farklı ama bantlanmış oranlar.
- Oyuncu ID'leri seed'e **dahil değil** — oyuncu gol marketlerinde satır anahtarı olarak kullanılmaya devam ediyorlar, güç sinyali olarak değil (mevcut davranış korunuyor).

## 1X2 — RESULT lambda çifti

```ts
const RESULT_LAMBDA_BASE = 2.0;
const RESULT_TILT_MIN = 0.045;
const RESULT_TILT_MAX = 0.11;
```

- `sign = rng() < 0.5 ? 1 : -1` (ev mi deplasman mı hafif avantajlı, %50/%50).
- `magnitude = RESULT_TILT_MIN + rng() * (RESULT_TILT_MAX - RESULT_TILT_MIN)`.
- `homeLambda = RESULT_LAMBDA_BASE + sign * magnitude`, `awayLambda = RESULT_LAMBDA_BASE - sign * magnitude`.
- `RESULT_TILT_MIN > 0` kasıtlı: sıfıra çok yakın bir tilt, favori tarafı "diğer taraf" bandının içine düşürüp iki oranı pratikte eşitler (doğrulama sırasında `tilt=0` → her iki taraf da 2.70, hedef "diğer taraf ≥2.82" bandını ihlal ediyordu). Alt sınır bu boşluğu kapatıyor.
- Poisson tabanlı 1X2 hesaplaması (mevcut `compute1X2` mantığı, sadece lambda kaynağı değişiyor) bu aralıkta şu bantları garanti eder (`HOUSE_MARGIN = 1.07` ile, `tilt` 0.045–0.11 arasında 0.0005 adımlarla tam taranarak doğrulandı):

| Seçim | Oran bandı |
|---|---:|
| Avantajlı taraf | 2.44 – 2.58 |
| Beraberlik | 5.17 – 5.20 |
| Diğer taraf | 2.82 – 3.02 |

Bu, kullanıcının onayladığı önceki bantla (favori 2.43–2.82, X 4.28–5.35, diğer 2.82–3.45) uyumlu ve tamamen içinde.

## KG Var/Yok (BTS) — ayrı, yüksek-gollü lambda çifti

Mevcut kod `computeBothTeamsScore()` içinde `RESULT_*`'ı kullanıyordu; bu, düşük olasılıklı KG Var (~%37) ve gerçekçi olmayan bir KG Yok/Var oranı üretiyordu. Yeni tasarımda KG Var kendi kalibrasyonunu alır:

```ts
const BTS_LAMBDA_BASE = 2.5;
const BTS_TILT_MAX = 0.3;
```

- Aynı `sign` (1X2 ile aynı yön — maç anlatısı tutarlı kalsın: hangi taraf hafif avantajlıysa BTS de aynı yönde hafif kayar) ama farklı bir `rng()` çekilişinden gelen `magnitude = rng() * BTS_TILT_MAX` (burada alt sınır gerekmiyor — `tilt=0` bile hedef bandın içinde kalıyor, doğrulandı).
- `homeLambda = BTS_LAMBDA_BASE + sign * magnitude`, `awayLambda = BTS_LAMBDA_BASE - sign * magnitude`.
- Doğrulanmış bant (tilt 0–0.3 arası, 0.0005 adımlarla tam taranarak):

| Seçim | Oran bandı |
|---|---:|
| KG Var (YES) | 1.27 – 1.28 |
| KG Yok (NO) | 6.48 – 6.79 |

Kullanıcının onayladığı bantla (KG Var 1.23–1.34, KG Yok 5.35–8.23) uyumlu.

## SCORE / OU_GOALS / HT_OU_GOALS / PLAYER_GOALS — ortak "gol temposu" modeli

Bu dört market, adı üstünde aynı maçın gol sayısına dayanıyor; tek bir seed-türevli gol temposundan beslenmeleri gerekiyor (mevcut kodun yorum satırının iddia ettiği ama tam sağlamadığı tutarlılık burada gerçekleşiyor):

```ts
const GOALS_TOTAL_MIN = 10.0;
const GOALS_TOTAL_MAX = 11.6;
const GOALS_TILT_MAX = 0.3;
```

- `total = GOALS_TOTAL_MIN + rng() * (GOALS_TOTAL_MAX - GOALS_TOTAL_MIN)` — maçın toplam gol beklentisi (halı sahanın yüksek-gollü doğasını koruyan aralık, mevcut `5.5 + 5.0 = 10.5` sabitinin merkezinde).
- `sign`/`magnitude = rng() * GOALS_TILT_MAX` ile `homeLambda = total/2 + sign*magnitude`, `awayLambda = total/2 - sign*magnitude`.
- `computeScores`, `computeOverUnder`, `computeHalfTimeOverUnder` (ilk yarı için `homeLambda/2`, `awayLambda/2` — mevcut varsayım korunuyor), `computePlayerGoals` bu tek `homeLambda`/`awayLambda` çiftinden türer; mevcut fonksiyon gövdeleri değişmiyor, sadece girdi kaynağı sabitten seed-türevli değere geçiyor.
- Doğrulanmış bantlar (varsayılan OU çizgisi 9.5, İY çizgisi 4.5; `total`/`tilt` uzayı 0.05 adımlarla tam taranarak):

| Market | Oran bandı |
|---|---:|
| 9.5 Üst/Alt | ÜST 1.48–1.97, ALT 2.34–3.83 |
| İY 4.5 Üst/Alt | ÜST 1.56–1.91, ALT 2.43–3.42 |
| Oyuncu 1+ gol (5 kişilik kadro) | 1.52–1.76 |
| Oyuncu 2+ gol (5 kişilik kadro) | 3.11–4.42 |
| Oyuncu 1+ gol (8 kişilik kadro) | 2.01–2.41 |
| Oyuncu 2+ gol (8 kişilik kadro) | 6.02–9.08 |

Not: 8 kişilik kadroda "2+ gol" oranı 9.08'e kadar çıkabiliyor — bu, kullanıcının genel "6.00+ uzak ihtimal oranından kaçının" yönergesi 1X2/underdog bağlamı için verilmişti; oyuncu bazlı düşük-olasılıklı bir bant (bir oyuncunun tek başına 2+ atması) için doğası gereği daha yüksek kalması makul kabul edildi. Gerekirse `PLAYER_GOALS` için ayrı bir üst sınır (cap) eklenmesi implementasyon planında değerlendirilebilir.

- `computeScores`'un rank-tabanlı yayılımı (`MIN_SCORE_ODDS`/`MAX_SCORE_ODDS`, `Math.pow(t, 0.7)` eğrisi) **değişmiyor** — o mantık zaten göreli olasılık sıralamasına dayanıyor, hangi mutlak lambda'dan geldiği önemli değil.
- Admin'in elle seçtiği `ouLine`/`htOuLine` parametreleri aynen korunuyor (varsayılanları değil, sadece lambda kaynağını değiştiriyoruz).

## NOVELTY / FIGHT / LATE — değişmiyor

Fixed odds aynen kalıyor (`RED_CARD_YES: 3.5` vb.) — bunlar sonuçtan/gol modelinden bağımsız, kasıtlı olarak sabit eğlence marketleri.

## API Değişikliği

```ts
export function computeMatchOdds(
  homePlayerIds: string[],
  awayPlayerIds: string[],
  matchSeed: string,
  ouLine: number = DEFAULT_OU_LINE,
  htOuLine: number = DEFAULT_HT_OU_LINE
): OddsRow[]
```

- Yeni **zorunlu** üçüncü parametre `matchSeed: string`. Prisma/DB tiplerine bağımlılık yok — çağıran taraf hazır string üretir, `odds.ts` saf/test edilebilir kalır.
- `src/actions/matches.ts` → `createMatch`, `computeMatchOdds` çağrısından hemen önce şunu üretir:
  ```ts
  const matchSeed = `${match.id}:${homeTeamId}:${awayTeamId}:${kickoffTime.toISOString()}`;
  ```
- Mevcut `tests/odds.test.ts` çağrıları (`computeMatchOdds(['p1','p2'], ['p3','p4'])`) üçüncü parametre olmadan artık derlenmez; testler sabit literal seed string'leri (`'seed-a'`, `'seed-b'` vb.) geçecek şekilde güncellenecek — bu implementasyon planının bir parçası, bu dokümanın kapsamında değil.

## Geriye Dönük Uyumluluk

- Odds, maç oluşturulurken **bir kez** hesaplanıp `Odds` tablosuna yazılıyor (mevcut davranış, bu tasarımla değişmiyor). Var olan (zaten oluşturulmuş) maçların satırları geriye dönük olarak yeniden hesaplanmayacak — bu tasarım yalnızca **yeni** `createMatch` çağrılarını etkiler. Migration/backfill script'i kapsam dışı.

## Test Stratejisi

`tests/odds.test.ts` şunları kanıtlayacak:

1. **Determinizm**: aynı `matchSeed` ile iki kez çağrılan `computeMatchOdds`, satır satır birebir aynı sonucu üretir.
2. **Seed'e duyarlılık**: farklı `matchSeed` değerleri, en az 1X2 ve BTS oranlarında farklı (ama sınırlı) sonuçlar üretir — iki farklı seed'in oranları birebir aynı olmamalı.
3. **Rating bağımsızlığı**: fonksiyon imzasında hiçbir rating/güç parametresi yok (statik güvence) — ayrıca `grep`/kod incelemesiyle `teamRating.ts` fonksiyonlarının `odds.ts` içinde import edilmediği doğrulanır.
4. **1X2 bandı**: her seed için favori 2.44–2.58, beraberlik 5.17–5.20, diğer taraf 2.82–3.02 aralığında (yukarıdaki tabloyla birebir).
5. **KG Var/Yok bandı**: YES 1.27–1.28, NO 6.48–6.79 aralığında.
6. **OU/İY OU/oyuncu gol marketleri** birbirleriyle aynı `homeLambda`/`awayLambda` çiftinden türediği için, aynı seed'de tutarlı kalır (örn. yüksek tempo seed'i hem OU hem oyuncu gol oranlarını aynı yönde etkiler — dolaylı olarak, iki marketin "aynı maçın" ürünü olduğunu doğrulayan bir test eklenir).
7. Mevcut testlerden korunacak olanlar (fixed novelty/FIGHT/LATE selection key'leri, admin-seçili OU line desteği, "0 gol" bandının olmaması vb.) aynen kalır, sadece çağrı imzasına `matchSeed` eklenir.

Ek olarak manuel doğrulama: iki farklı sahte maç (`createMatch` simülasyonu) için üretilen oranlar karşılaştırılıp görsel olarak "iki farklı ama makul maç" hissi verdiği teyit edilir.
