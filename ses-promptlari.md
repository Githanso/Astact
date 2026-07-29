# Astact — ses efekti üretim promptları

Bu dosya, oyunda eksik olan ses efektlerini üretmek için hazırlandı. Promptlar **İngilizce**,
çünkü üretici modeller İngilizce betimlemeye çok daha iyi cevap veriyor. Açıklamalar Türkçe.

Şu an `client/lib/soundFX.ts:116-120` içindeki beş metot da **boş gövde** — yani oyunda arka plan
müziği dışında hiçbir ses yok. Dosyalar hazır olunca kodu ben bağlayacağım.

> **Prompt başına 500 karakter sınırı var.** Aşağıdaki promptların hepsi kendi kendine yeterli;
> **olduğu gibi yapıştır, başına veya sonuna bir şey ekleme.** Her birinin karakter sayısı
> başlığında yazıyor, en uzunu 373 — yani düzenlemek istersen payın var.

---

## Önce: teslim kuralları

| Konu | Kural |
|---|---|
| Klasör | `D:\proje\astact\astact-cf\public\` — doğrudan `public/` kökü (`game_music.mp3` da orada) |
| Dosya adı | Aşağıdaki başlıklarda verilen adların **birebir aynısı** — kodda o adla aranacak |
| Biçim | **MP3**, 44.1 kHz. Mono tercih edilir, stereo da olur |
| Bit hızı | 128 kbps yeter; efektler kısa, fark duyulmaz |
| Seviye | Hepsini **-3 dBFS tepe değerine** normalize et. Göreli yükseklikleri (tıklama kısık, patlama gür) **kodda ben ayarlayacağım** — sen hepsini eşit ver |
| Baştaki sessizlik | 20 ms'den az olmalı. Baştaki boşluk, oyunda "geç tepki" gibi duyulur |
| Sondaki kuyruk | Efektin kendisinden uzun reverb kuyruğu olmasın |
| Toplam boyut | Tüm efektler toplamı **500 KB altında** kalsın (`game_music.mp3` zaten 3.6 MB) |

**Durum:** `sfx-move.mp3` geldi ve **bağlandı** — oyunda çalıyor (49 KB). Kalan on efekt bekliyor.

Kırpma gerekiyorsa: bu makinede `ffmpeg` **kurulu değil**. İki seçenek var — ya üreticinin/Audacity'nin
içinde kırparsın, ya da olduğu gibi bırakırsın, ben baştaki sessizliği kodda `start(0, offset)` ile
atlarım (dosyaya dokunmadan). İkincisi dosya boyutunu düşürmez ama iş görür.

**Tutarlılık notu:** 500 karakter, "hepsi aynı stüdyodan çıkmış gibi olsun" talimatını uzun uzun
yazmaya yetmiyor. Bunun yerine her promptta aynı üç ifade geçiyor: `Dry`, `close-miked`,
`small room`. Yine de en emin yol `sfx-select` ile `sfx-move`'u **aynı oturumda peş peşe** üretmek —
en çok duyulan ikili onlar ve uyumsuzlukları hemen fark ediliyor.

---

## Zorunlu beş efekt

### 1. `sfx-select.mp3` — seçim / yerleştirme

| | |
|---|---|
| Kodda | `playSelect()` |
| Ne zaman çalıyor | Dizilimde taş yerleştirme (`App.tsx:607`), otomatik dizilim (`App.tsx:588`), İzci görevi sonucu (`App.tsx:258`) |
| Sıklık | **Çok yüksek** — dizilimde arka arkaya 40 taş yerleştiriliyor |
| Süre | **80–150 ms** |

En kritik efekt bu, çünkü en çok tekrar eden o. Ne kadar "karakterli" olursa 40. tekrarda o kadar
sinir bozucu olur. Sade ve kısa olsun. Kabul ölçütü: arka arkaya 10 kez çaldığında rahatsız
etmiyorsa doğru.

**Prompt (349 karakter):**

```
Single soft wooden click: a small carved wood game piece set down on a felt-lined board. Very short, about 100 ms. Warm low-mid body around 400-800 Hz, soft attack, almost no ring. Quiet and neutral - it repeats 40 times in a row, so nothing sharp or bright. Dry, close-miked, small room. No metallic ping, no UI beep, no reverb, no music, no synth.
```

---

### 2. `sfx-move.mp3` — taş hamlesi

| | |
|---|---|
| Kodda | `playMove()` |
| Ne zaman çalıyor | Taş boş kareye ilerlediğinde — yerelde `App.tsx:648`, onlinede `App.tsx:237`. Ayrıca dizilimi temizlerken (`App.tsx:595`) |
| Sıklık | **Yüksek** — her turda, iki taraf için de |
| Süre | **200–350 ms** |

`sfx-select`'ten biraz daha dolu olmalı ama aynı malzemeden: aynı tahta, aynı oda.

**Prompt (340 karakter):**

```
Wooden game piece sliding one square across a wooden board and settling: a short low friction scrape of about 120 ms, then a soft wooden set-down thud. Total under 300 ms. Dry and close, small room, no reverb. Slightly heavier than a plain click but still quiet - it plays on every turn. No synth whoosh, no footsteps, no sparkle, no music.
```

---

### 3. `sfx-combat.mp3` — çarpışma

| | |
|---|---|
| Kodda | `playCombat()` |
| Ne zaman çalıyor | Bomba dışındaki her çarpışma: rütbe karşılaştırması (`App.tsx:620`), Casus Mareşal'i alınca (`App.tsx:619`), İstihkamcı bombayı imha edince (`App.tsx:618`), onlinede `App.tsx:237` |
| Sıklık | Orta — oyun başına 10-30 kez |
| Süre | **500–800 ms** |

Tek darbe. Dövüş sahnesi değil: iki taş çarpışıyor, sonuç anında belli oluyor.

**Prompt (341 karakter):**

```
Two steel blades clashing once, hard and dry: one sharp metallic impact with a bright fast transient and quick decay, with a faint low leather-and-armor thud underneath. Under 700 ms. Close-miked, small dry room, no long ring-out. One hit only - not a fight sequence, not a loop. No orchestral hit, no laser, no crowd, no shouting, no music.
```

---

### 4. `sfx-explosion.mp3` — bomba

| | |
|---|---|
| Kodda | `playExplosion()` |
| Ne zaman çalıyor | Saldıran taş Bomba'ya çarpıp yok olduğunda (`App.tsx:618`) |
| Sıklık | **Düşük** — oyun başına birkaç kez |
| Süre | **900–1400 ms** |

Nadir olduğu için en dramatik olanı bu olabilir. Ama kuyruk uzun olmasın; oyun kuyruğun ortasında
devam ediyor.

**Prompt (338 karakter):**

```
Single close land-mine detonation on soil: tight punchy low-end thump, sharp mid crack, then a short tail of scattering dirt and splintered wood that fully dies out within one second. Dry outdoor field recording, minimal reverb. No long cinematic rumble, no sub-bass sweep, no screams, no cartoon explosion, no sci-fi layer, no music bed.
```

---

### 5. `sfx-victory.mp3` — zafer

| | |
|---|---|
| Kodda | `playVictory()` |
| Ne zaman çalıyor | Bayrak düştüğünde (`App.tsx:617`), oyun bittiğinde (`App.tsx:272`, `App.tsx:237`) |
| Sıklık | Oyun başına bir kez |
| Süre | **1.5–2.5 s** |

**Prompt (373 karakter):**

```
Short military brass fanfare of victory: three or four notes on muted trumpets and horns in a bright major key, led in by a single snare roll and closed by one soft timpani hit. Confident but restrained, resolving cleanly and ending within two seconds. Dry, close, small room. No vocals, no cinematic riser, no epic trailer sound design, no fade-out longer than the phrase.
```

---

## Kodda bir sorun var: `playVictory` üç ayrı iş yapıyor

Şu an `playVictory()` şuralardan da çağrılıyor:

- **Oyun başlarken** — iki taraf da dizilimi bitirince (`App.tsx:200`) ve yerelde mavi dizilimi
  bitirince (`App.tsx:701`). Yani "zafer" sesi oyunun **başında** çalıyor.
- **Yenilgide** — `game_over` her iki tarafa da gidiyor ve ikisinde de aynı zafer sesi çalıyor
  (`App.tsx:272`). Kaybeden oyuncu kendi yenilgisinde fanfar duyuyor.

Bu, kodun düzeltilmesi gereken bir yeri; sen üç ayrı dosya üretirsen ben çağrı yerlerini ayırırım.
**Öncelik sırası: `sfx-start` > `sfx-defeat`.** İkisini de üretmezsen mevcut davranış aynen kalır,
sadece "zafer" sesini duyar.

### `sfx-start.mp3` — oyun başlıyor (önerilen)

Süre: **800–1200 ms**

**Prompt (325 karakter):**

```
Short military call to attention: a half-second snare drum roll ending on two firm hits, with one low horn note underneath. Signals that the battle is beginning - anticipation, not celebration. Under 1.2 seconds. Dry, close-miked, small room. No melody line, no fanfare resolution, no cymbal crash, no vocals, no reverb tail.
```

### `sfx-defeat.mp3` — yenilgi (önerilen)

Süre: **1.2–1.8 s**

**Prompt (273 karakter):**

```
Short somber military cue of defeat: a single muted horn note falling a minor third, closing on one dull timpani thud and a soft snare buzz. Brief and dignified, not tragic. Under 1.5 seconds. Dry, close, small room. No strings, no choir, no cinematic reverb, no long fade.
```

---

## İsteğe bağlı: şu an tamamen sessiz olan olaylar

Bunlar için kodda henüz çağrı yok; dosyaları üretirsen hem dosyayı hem çağrıyı ben eklerim.
Sırayla en çok fayda getireni yukarıda.

### `sfx-error.mp3` — hamle reddedildi

Şu an ekranda kırmızı şerit çıkıyor (`MoveErrorToast`) ama sessiz. "Sıra rakibinizde", "Taş
bulunamadı", "İzci beklemede" gibi tüm redler burada. Süre: **150–250 ms**

**Prompt (270 karakter):**

```
Short dull negative thud: a soft muted low wooden knock with a slight downward pitch drop at the end. Reads clearly as a refusal without being harsh. Under 250 ms, quiet and quick. Dry, close-miked. No buzzer, no electronic error beep, no synth tone, no alarm, no music.
```

### `sfx-timeout.mp3` — süren doldu

Tur süresi dolup sıra karşıya geçtiğinde. Şu an sadece yazı çıkıyor. Süre: **400–600 ms**

**Prompt (250 karakter):**

```
Chess clock flag falling: a dry wooden tick followed by a low muted mechanical thud, like a mechanical timer releasing. Quiet and matter-of-fact, under 600 ms. Dry, close-miked, small room. No bell, no alarm ring, no ticking loop, no music, no synth.
```

### `sfx-scout.mp3` — İzci kimlik açtı

Şu an `playSelect()` kullanılıyor, yani düşman taşının kimliğini açmak sıradan bir tıklama gibi
duyuluyor. Oysa oyunun en değerli hamlesi bu. Süre: **400–600 ms**

**Prompt (321 karakter):**

```
Intelligence reveal: a soft airy lens-focus movement - a quiet high shimmer rising and settling within half a second, with a faint paper or canvas rustle underneath. Subtle and cold, like a spyglass being adjusted. Under 600 ms. Dry, close-miked. No magic sparkle, no synth arpeggio, no chime melody, no whoosh, no music.
```

### `sfx-join.mp3` — rakip odaya katıldı

Online modda karşı taraf bağlandığında. Süre: **500–800 ms**

**Prompt (248 karakter):**

```
Two short soft knocks on wood followed by one quiet warm low note: someone has taken their seat at the table. Friendly, brief, understated. Under 800 ms. Dry, close-miked, small room. No melody, no notification chime, no digital blip, no music bed.
```

---

## Üretirken

- Aracın **müzik** değil **ses efekti** modunu kullan. Müzik modu kaçınılmaz olarak ritim ve melodi
  ekler; `sfx-victory` / `sfx-start` / `sfx-defeat` dışındaki hiçbiri melodi istemiyor.
- Promptlarda süre zaten yazılı ("under 700 ms" gibi) — çoğu araç bunu dikkate alıyor. 500 karakter
  sınırı yüzünden başka bir şey ekleme; bir şey ekleyeceksen yasak listesinden ("no ...") kısalt.
- Her efekt için **3-5 varyant** üret, sonra seç. İlk çıkan nadiren en iyisi oluyor.
- Araç yalnızca uzun klip üretebiliyorsa: 5-10 saniyelik üret, işine yarayan parçayı kırp. Kırpma
  yapamıyorsan bana ham dosyayı ver, kodda `offset`/`duration` ile o aralığı çalarım.
- `sfx-select` ve `sfx-move` **birlikte** dinlenmeli: aynı tahtadan gelmiş gibi duymalılar. Farklı
  oturumlarda üretilen ikisi çoğu zaman uyuşmuyor, aynı oturumda peş peşe üret.

## Ben ne yapıyorum

Altyapı `soundFX.ts` içinde **kuruldu** (`sfx-move.mp3` ile birlikte):

- Efekt ilk kullanımda çekiliyor (`fetch` → `decodeAudioData`), sonra önbellekte duruyor. Önden
  yükleme yok, açılış süresi uzamıyor.
- Çalma zinciri `BufferSource → efekt kazancı → masterGain`, yani **ses kaydıracı ve sustur
  düğmesi efektleri de kısıyor**. Her çalmada yeni kaynak kuruluyor, üst üste binen sesler
  birbirini kesmiyor.
- Dosya yoksa sessiz düşülüyor: bir kez denenir, `null` yazılır, oyun bozulmaz.
- `sfx-move.mp3` kazancı **0.7** — çok gür ya da çok kısık gelirse söyle, tek satır.

Yeni dosya geldiğinde yapacağım:

1. Metot gövdesini bağlamak (tek satır) ve o efektin kazancını dengelemek.
2. `sfx-start` / `sfx-defeat` gelirse `playVictory`'nin üç işini ayırmak.
3. `sfx-error` / `sfx-timeout` / `sfx-scout` / `sfx-join` gelirse çağrı yerlerini eklemek.
4. README'ye işlemek.
