# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bu depodaki kod yorumları, testler ve README Türkçedir; buradaki notlar da öyle.

## Komutlar

```bash
npm run build:client   # client/ -> public/ (index.html + assets/index-*.js|css)
npm run dev            # wrangler dev --port 8787 -> http://127.0.0.1:8787
npm run typecheck      # YALNIZCA src/**/*.ts (Worker). client/ bu kapsamda değil.
npm run karakter:webp -- <kaynak-klasoru>   # asker SVG'lerini characters/*.webp'ye çevirir
```

**Sıra önemli:** `wrangler dev` çalışırken `build:client` yapılırsa statik dosya
manifesti bayatlar, sayfa bembeyaz açılıp asset'ler 404 döner. Önce derle, sonra
sunucuyu başlat; takılırsa `wrangler dev`'i yeniden başlat. `clean:assets` bu yüzden
`public/assets` **dizinini değil içeriğini** siliyor.

Yol içinde `&` olan klasörde (`C:\Users\Design&Motion\...`) npm script'leri kırılıyor —
derleme `D:\` altında yapılmalı.

### Testler

Hepsi `test/*.mjs`, bağımlılıksız Node script'leri; **dev sunucusu ayaktayken** çalışır
ve `ws://127.0.0.1:8787/ws/game-room` adresine bağlanır. Tek test çalıştırmak
`npm run test:<ad>` demek — package.json'daki listeye bak (`protokol`, `tur-saati`,
`oyun-sonu`, `oda-ayar`, `yeniden-baslat`, `carpisma`, `izci`, `sayim`, `dagilim`,
`dizilim-saati`, `serbest-hamle`, `oda-terk`, `oda-kilit`). Süreleri 20sn ile 2.5dk arasında değişir
(gerçek tur/kopma saatlerini bekliyorlar).

```bash
ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room npm run test:protokol   # canlıya karşı
```

`npm run test:i18n` sunucu gerektirmez: `client/**/*.tsx` içinde sabit Türkçe metin ve
çevrilmemiş değişken basımı arar.

Testler odayı `?seed=` ve `?setupMs=` sorgu parametreleriyle kuruyor (sabit arazi,
kısaltılmış dizilim süresi). Bunlar **yalnızca test içindir**, oyuncu akışında yok.

İki istemciyi elle denerken sekmeler **ayrı origin**'de olmalı (`localhost` ve
`127.0.0.1`): `astact_player_token` sessionStorage'da tutuluyor ve aynı origin'de iki
sekme aynı slota oturuyor.

## Mimari

Tek Cloudflare Worker (`src/server.ts`) hem statik dosyaları hem çok oyunculu protokolü
servis ediyor. Ayrı bir API katmanı ya da vite dev sunucusu **yok**: vite yalnızca
derleyici (`client/vite.config.ts`, `outDir: '../public'`, `emptyOutDir: false`), çıktı
Worker'ın servis ettiği klasöre yazılıyor. Tek adres, tek origin.

```
istek → Worker.fetch
  POST /api/game-room/create → oda kodu üret (TAK-XXXX)
  /ws/game-room?room=…       → GAME_ROOM Durable Object stub'ına devret
  geri kalan her şey         → env.ASSETS (public/)
```

`GameRoom` bir **SQLite tabanlı** Durable Object (`wrangler.toml` → `new_sqlite_classes`;
`new_classes` ücretli plan gerektirir, değiştirmeyin). Oda başına bir örnek,
WebSocket Hibernation API ile.

### Sunucu tek doğruluk kaynağı

İstemcideki her sayaç yalnızca görseldir. Aşağıdakilerin hepsine **sunucu** karar verir
ve sonucu yayınlar:

- **Tur saati** — süre dolunca `alarm()` sırayı çevirip `turn_timeout` yayınlar. İstemci
  sırayı asla kendi çevirmez (çevirdiğinde iki taraf ayrışıyor, hamleler `NOT_YOUR_TURN`
  ile reddediliyordu).
- **Dizilim saati** — süre dolunca hazır olmayan oyuncunun kalan taşlarını sunucu
  rastgele dizer (`rastgeleDizilimUret`, kısmi dizilimi korur). İstemci her taş
  değişiminde `setup_update` ile güncel tahtasını akıtıyor ki sunucu ne dizildiğini bilsin.
- **Arazi** — her oyunda `araziUret(seed)` ile üretilir (deterministik mulberry32 PRNG,
  `Math.random` değil). Göller/ormanlar 180° dönme ile aynalanır: `dondur(r,c) = (9-r, 10-c)`.
  İstemci araziyi kendi sabitinden değil `roomState.terrain`'den çizer.
- **Çarpışma, İzci görevi, hamle geçerliliği** — istemcideki `calculateValidMoves` ve
  `scoutTargets` yalnızca hangi karelerin tıklanabilir olduğunu göstermek için; sunucu
  hepsini yeniden doğruluyor.

Durable Object'te **tek alarm slotu** var; tur saati, dizilim saati, bağlantı kopma
zaman aşımı ve oda TTL'i onu paylaşıyor. Bu yüzden her değişiklikten sonra
`scheduleAlarm()` en yakın son tarihe yeniden kuruluyor ve `alarm()` içinde hangisinin
zamanı geldiğine bakılıyor — doğrudan `setAlarm` çağırmayın.

Hibernation kuralı: `serializeAttachment`, `acceptWebSocket`'**ten sonra** çağrılmalı.
Ters sırada attachment kalıcı olmuyor, `webSocketMessage` içinde `deserializeAttachment()`
null dönüyor ve mesajlar sessizce düşüyor.

### Bilgi gizliliği (kritik değişmez)

Sunucu her oyuncuya **ayrı** bir tahta görünümü kuruyor; bu bir sunum tercihi değil,
oyunun kuralı:

- `buildBoardView(pieces, isOwn)` — rakip taşları yalnızca `revealed` ise ad/rütbe taşır.
- İzci durumu (`scoutIn`) yalnızca kendi taşlarında gönderilir; sızarsa hangi İzcinin
  hazır olduğu ele verilir.
- Çarpışma sonucu `carpismaGorunumu(benSaldiran)` ile taraf başına kurgulanır; ormandaki
  taş kimliğini açmaz.
- İzci görevinin **hedef koordinatı yalnızca görevi yapana** gider — karşı taraf turun
  geçtiğini görür, hangi taşının deşifre olduğunu görmez.

Yeni bir mesaj alanı eklerken "bu bilgi rakibe gitmeli mi" sorusunu açıkça cevaplayın.

### İstemci

`client/App.tsx` (~1100 satır) tüm oyun durumunu tutuyor; alt bileşenler
(`client/components/*.tsx`) sunum. `handleWsMessage` **boş bağımlılıklı** bir
`useCallback` — güncel state'i göremez, bu yüzden dil, takım, arazi, tur ayarı gibi
değerler ayrıca ref'te tutuluyor (`terrainRef`, `myOnlineTeamRef`, `langRef`, …).
Bu kalıbı bozmayın; state okumaya kalkarsanız bayat değer alırsınız.

Mesajlarda ortak alanlar (turnTimeMs, setupRemainingMs, terrain) `switch`'ten **önce**
tek noktada uygulanıyor — birden çok mesaj tipi aynı alanı taşıdığı için.

Ekran kapısı: `screen === 'MENU' || !oyunGorselleriHazir || !araziHazir` iken oyun
ekranı hiç render edilmez. Oda kuran oyuncu rakibi beklerken MENU'de kalır (lobi +
kod popup'ı üstte), geçişi yalnızca `room_started_setup` yapar.

## Senkron tutulması gereken ikizler

Aynı bilgi hem sunucuda hem istemcide yazılı; biri değişince diğeri de değişmeli:

| `src/server.ts` | `client/constants.ts` |
|---|---|
| `SUNUCU_TAS_TANIMLARI` | `PIECE_DEFINITIONS` |
| `SUNUCU_TAS_SAYILARI` (toplam 40) | `PIECE_COUNTS` / `TOPLAM_TAS` |
| `MAX_MISSED_TURNS` | `MAX_MISSED_TURNS` |
| `SCOUT_COOLDOWN` | `SCOUT_COOLDOWN` |
| `DEFAULT_TURN_TIME_MS` | `TIMER_PRESETS.NORMAL.turnTime` |
| `SETUP_SURESI_MS` | `DIZILIM_SURESI_SN` |
| `DISCONNECT_TIMEOUT_MS` | `KOPMA_PENCERESI_MS` (App.tsx) |

Taş sayısı tablolarını `npm run test:dagilim` denetliyor: iki tablonun eşitliği, toplamın
40 olması (dizilim alanı 4 sütun × 10 satır — fazla taş sessizce düşer) ve sunucunun
gerçekten bu dağılımı dizmesi. Test sayıları koddan okuyor, dağılım değişince güncellemek
gerekmiyor.

Arazi sözleşmesi (`GOL_KARE`, `BANT_ORMAN`, `BOLGE_ORMAN`) değişirse
`test/protokol-testi.mjs` senaryo 3b de güncellenmeli.

## Tahta ve kimlikler

Tahta **10 satır × 11 sütun**; oyuncular sağ-sol karşı karşıya. Kırmızı (1. Oyuncu)
7-10. sütunlar, mavi (2. Oyuncu) 0-3, tarafsız bant 4-6. Her oyuncunun tam 40 taşı var
ve dizilim alanı tam 40 kare — boşluk yok, bu yüzden sürükle-bırakta **takas** dalı şart.

`'1. Oyuncu'` / `'2. Oyuncu'` string'leri **protokol kimliğidir**, arayüz metni değil:
mesajlarda, `owner` alanlarında, kazanan bilgisinde bu literaller gider. Ekranda
gösterilirken `t.playerRed` / `t.playerBlue` ile çevrilir. Aynı şekilde taş adları
(`'Mayın'`, `'Sancak'`, …) protokol kimliği; ekrana `getPieceLabel(name, lang)` ile
basılır. `npm run test:i18n` bu ikisini de denetliyor.

## i18n

Dört dil: TR / EN / JA / KO, hepsi `client/constants.ts` içindeki `TRANSLATIONS` ve
`PIECE_LABELS` sözlüklerinde. **Bir metin değişince dördü de güncellenir.**

Hata metinleri sunucudan **kod** olarak gelir (`move_error`, `room_error` → `msg.code`),
istemci `TR_CODE` ile `'err' + CODE` anahtarını arar. Yeni bir hata kodu eklerken dört
dile de `errXXX` anahtarı ekleyin. Sayılı mesajlarda sunucu yalnızca `n` yollar, metindeki
`{n}` istemcide değiştirilir.

`document.documentElement.lang` seçili dile göre güncelleniyor — sabit `lang="tr"`
bırakılırsa CSS `text-transform: uppercase` Türkçe kuralını uygular ve "WINS" → "WİNS" olur.

## Varlıklar

`public/` hem **kaynak** hem **derleme çıktısı** barındırıyor:

- Kaynak (repoda durur): `logo.svg`, `favicon.svg`, `sfx/*.mp3`,
  `assets/{floor,forest,lake}.avif`, `assets/characters/*.webp`.
- Çıktı (`.gitignore`'da): `index.html`, `assets/index-*.js|css`.

Karakter görselleri `arac/karakter-webp.mjs` ile üretiliyor. Kaynak SVG'ler (gömülü
1024×1536 PNG taşıyan, dosya başı ~3 MB) **`public/` altında durmamalı** — wrangler
`public/`'in tamamını servis eder. Araç PNG'yi doğrudan küçültmez, önce viewBox
kompozisyonunu yeniden kurar: figürlerin ortak taban çizgisi ve boy hiyerarşisi o
transform'un içinde yaşıyor.

`assets/` (public dışı) arayüzdeki 56 SVG'nin envanteri — `assets/OKUBENI.md` ve
`assets/onizleme.html`.

## Deneysel URL bayrakları

Varsayılan davranışı bozmadan karşılaştırma için: `?stil=disk` (taş taban diski),
`?canli=0` (canlı tahta animasyonlarını kapatır). `constants.ts` içinde `TAS_STILI` /
`CANLI` sabitleri; karar verilince sabit ve kaybeden varyant birlikte silinecek.

## Yazım alışkanlığı

Kod yorumları Türkçe ve **nedeni** anlatıyor — çoğu bir kez yaşanmış hatanın kaydı
("eskiden şöyleydi, şu bozuluyordu"). Yeni kod aynı yoğunlukta yorumlanmalı; bir
davranışı değiştirirken onu açıklayan yorumu da güncelleyin, yoksa yanlış yönlendirir.

`README.md` (~100 KB) bu projenin karar günlüğü: her davranış değişikliği, nedeni ve
doğrulaması orada. Bir kuralın neden böyle olduğunu araştırırken önce oraya bakın.
Yalnızca "Yapı" bölümündeki bileşen listesi bayat (artık var olmayan `SettingsPanel.tsx` /
`PlayerPanel.tsx` geçiyor) — dizin listesi tek gerçek kaynak.

## Dağıtım

```bash
npx wrangler login
npm run build:client   # ZORUNLU
npm run deploy
```

`public/index.html` ve `public/assets/index-*` git'e dâhil değil; temiz bir klonda
derlemeden dağıtırsanız boş bir site yüklersiniz.
