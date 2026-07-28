# Astact — kendi Cloudflare Workers dağıtımı

Higgsfield'a bağımlılık olmadan, doğrudan **Cloudflare Workers Free** planında çalışan
sürüm. Oyun statik bir sayfa; çok oyunculu kısım bir Durable Object üzerinde WebSocket ile
yürüyor.

## Neden bu klasör var

Higgsfield beş revize turu boyunca üretilen paketleri canlıya hiç almadı
(`../CANLI-DURUM-TESPITI.md`). Sunucu kodu zaten Cloudflare Workers + Durable Objects için
yazılmış olduğundan, taşıma maliyeti neredeyse sıfırdı: SSR sarmalayıcısı ve iframe route
dolayımı sökülüp yerine statik dosya servisi konuldu.

## Ücret

Her şey ücretsiz kademede: 100.000 istek/gün, 13.000 GB-s/gün, 5 GB DO depolama, sınırsız
statik dosya. Tek şart Durable Object'in **SQLite tabanlı** olması — `wrangler.toml` içindeki
`new_sqlite_classes` bunu sağlıyor (`new_classes` ücretli plan gerektirir, değiştirmeyin).

## Çalıştırma

```bash
npm install
cd client && npm install && cd ..

npm run build:client   # client/ -> public/ (index.html + assets/)
                       # public/assets ICERIGINI once temizler: vite emptyOutDir:false
                       # kullaniyor (game_music.mp3 silinmesin diye), bu yuzden
                       # temizlenmezse eski hash'li bundle'lar birikir
npm run dev            # http://127.0.0.1:8787
npm run typecheck
npm run test:protokol  # dev sunucusu ayaktayken
npm run test:tur-saati # dev sunucusu ayaktayken, ~35sn surer (tur saatini bekliyor)
npm run test:oyun-sonu # dev sunucusu ayaktayken, ~2dk (beraberlik + kopma penceresi)
npm run test:oda-ayar  # dev sunucusu ayaktayken, ~50sn (tur suresi senkronu + oda omru)
npm run test:yeniden-baslat # dev sunucusu ayaktayken, ~2.5dk (rovans akisi + sayac sifirlama)
npm run test:carpisma  # dev sunucusu ayaktayken, ~1dk (carpisma kurallari + bilgi sizintisi)
npm run test:izci      # dev sunucusu ayaktayken, ~20sn (Izci gorevi + istihbarat gizliligi)
```

Testler varsayilan olarak `ws://127.0.0.1:8787`'e baglanir; canliya karsi kosmak icin
`ASTACT_WS` verin:

```bash
ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room npm run test:tur-saati
```

**Uyarı:** Yol içinde `&` karakteri olan bir klasörde (`C:\Users\Design&Motion\...` gibi)
npm script'leri kırılıyor. Derlemeyi `D:\` altında yapın.

**`wrangler dev` çalışırken `build:client` yaptıysanız:** sayfa bembeyaz açılıp asset'ler 404
dönebilir. `wrangler dev` statik dosya manifestini başlangıçta kuruyor ve `public/assets`
klasörü **silinip yeniden yaratılırsa** manifest eski (artık var olmayan) dosyalarda kalıyor.
Bu yüzden `clean:assets` dizini değil **içeriğini** siliyor. Yine de takılırsa `wrangler dev`'i
yeniden başlatmak çözüyor. Tarayıcı önbelleğe alınmış `index.html` tutuyorsa sert yenileme
(veya `?v=2` gibi bir sorgu) gerekir — vite dosya adlarını hash'lediği için eski `index.html`
silinmiş asset'leri ister.

## Dağıtım

```bash
npx wrangler login     # tarayıcıda Cloudflare hesabı yetkilendirilir
npm run build:client   # ZORUNLU: public/index.html + public/assets üretir
npm run deploy
```

`public/index.html` ve `public/assets/` derleme çıktısı ve **git'e dâhil değil** (bkz.
`.gitignore`) — temiz bir klonda derlemeden dağıtırsanız boş bir site yüklersiniz.
`public/` içindeki `logo.svg`, `favicon.svg` ve `game_music.mp3` ise kaynak varlık, repoda
duruyor.

Sonuç: `https://astact.<hesap-adı>.workers.dev`

## Yapı

```
src/server.ts              Worker + GameRoom Durable Object
client/                    oyunun React kaynağı (derlenebilir)
client/components/
  MenuScreen.tsx           giriş ekranı (logo, online, ayarlar, dil)
  MenuSettingsModal.tsx    menüdeki ayarlar penceresi (süre + ses)
  RestartNoticeModal.tsx   yeniden başlatma isteği popup'ı (onay düğmeli)
  SettingsControls.tsx     süre/ses denetimleri — menü ve oyun içi panelde ortak
  RoomCodeModal.tsx        oda kurulunca kodu büyük gösteren popup
  SettingsPanel.tsx        sağ sütun ÜST pano — ayarlar (dil, online/yeniden başlat,
                           süre ön ayarları, ses)
  PlayerPanel.tsx          sağ sütun ALT pano — oyuncu (galibiyet, durum,
                           ele geçirilenler, rütbe hiyerarşisi, çarpışma geçmişi)
  StatsModal.tsx           şu an KULLANILMIYOR (İstatistikler düğmesi kaldırıldı)
public/index.html          derleme çıktısı — elle düzenlemeyin
public/assets/*.js|css     derleme çıktısı
public/game_music.mp3      derlemeden bağımsız, elle konuldu
public/logo.svg            giriş ekranı logosu — saydam vektör, elle konuldu
public/favicon.svg         amblem (kelimesiz) — sekme ikonu, elle konuldu
                           (clean:assets yalnızca public/assets içini siler, kök korunur)
test/protokol-testi.mjs    online protokolün uçtan uca testi
```

## İstemci kaynağı (astact-v5)

`client/`, `astact-v5.zip` içindeki `src/` klasörü. **Doğrulandı:** bu kaynaktan yapılan
derleme, Higgsfield'ın gönderdiği bundle ile byte byte aynı çıktıyı üretiyor
(`index-oJIcuZtt.js` ve `index-CY-PSFgP.css`, md5 eşleşiyor). Yani istemci tarafında da
değişiklik yapılabilir.

Önceki paketlerde durum böyle değildi: `astact-full-package-.zip` içindeki
`index-kWzYEzjm.js` bozuktu (`handleRestartGame` ve üç oda fonksiyonu tanımsız → mount'ta
`ReferenceError` → siyah ekran), ondan önceki `src/` ise Socket.IO sürümünün kaynağıydı.
v5 ilk tutarlı paket.

### v5 kaynağında yapılan iki düzeltme

- **`index.html`**: v5'in kaynağındaki HTML hâlâ Tailwind CDN'i ve `aistudiocdn.com`
  importmap'ini üretiyordu (`lang="en"` ile birlikte); gönderilen `game.html` ise derlemeden
  sonra elle temizlenmişti. Yani kaynaktan derleyince CDN geri geliyordu. Temiz sürüm
  kaynağa alındı — artık HTML de yeniden üretilebilir.
- **`vite.config.ts`**: AI Studio'dan kalan `GEMINI_API_KEY` / `API_KEY` define'ları
  kaldırıldı (oyun kullanmıyordu), çıktı `../public` klasörüne yönlendirildi
  (`emptyOutDir: false` — `game_music.mp3` silinmesin diye).
- **`App.tsx` → `SetupUI` prop adları**: aşağıya bakın.

### Prop adı uyuşmazlığı — dizilim onay butonu ölüydü

`SetupUI` bileşeni `onFinishSetup`, `onPieceSelect`, `selectedPieceName` proplarını
bekliyordu; `App.tsx` ise `onReady`, `onSelectPiece`, `selectedPieceToPlace` geçiyordu.
Üçü de `undefined` kalıyordu, dolayısıyla:

- "Dizilimi Onayla & Hazırım" butonu `onClick={undefined}` ile render ediliyordu —
  görünüyor, aktifleşiyor, tıklanıyor, **hiçbir şey olmuyordu.**
- Listeden elle taş seçmek çalışmıyordu (yalnızca "Rastgele Diz" ile dizilim yapılabiliyordu).
- Seçili taşın vurgulanması çalışmıyordu.

Ayrıca `selectedPieceName` bir **string** (taş adı) bekliyor ama nesne geçiliyordu; yalnızca
ad değişikliği yetmez, `selectedPieceToPlace?.name` gerekir. Çağrı satırı düzeltildi.

**Neden derlemede yakalanmadı:** `vite build` tip kontrolü yapmıyor (esbuild sadece tipleri
söküyor). `tsc --noEmit` çalıştırıldığında hata görünüyor. Bu yüzden istemci tarafında
değişiklik yaptıktan sonra tip kontrolü şart:

```bash
cd client && npx tsc --noEmit
```

### Tahta 10 satır × 11 sütuna alındı (yatay)

Önceki tahta 15 satır × 10 sütundu: dikey, `aspect-[10/15]` yüzünden ~930px yükseklikte ve
**oyuncunun kendi taşları ekranın altında kalıyordu** (kırmızının dizilim alanı 11-14.
satırlardı).

Yeni düzen: **10 satır × 11 sütun**, oyuncular sağ-sol karşı karşıya.

Tarafsız bant yalnızca 4-6. sütunlar; sağdaki şema o üç sütunu gösteriyor.

```
      sütun:  4 5 6
 satır 0      ♠ · ·      ░ mavi dizilim (0-3)   ▓ kırmızı dizilim (7-10)
       1      ♠ ~ ~      ~ göl   ♠ orman   · boş
       2      ♠ ~ ~
       3      ♠ · ♠      dizilim: 4 sütun × 10 satır = 40 kare = 40 taş
       4      · ♠ ·                → BOŞLUK YOK
       5      · ♠ ·
       6      · · ♠
       7      ~ ~ ♠
       8      ~ ~ ♠
       9      · · ♠
```

- Dizilim alanı **tam 40 kare**, taş havuzu (`PIECE_COUNTS` toplamı 40) değişmedi.
- Tarafsız bant 3 sütun × 10 satır = 30 kare — göller ve ormanlar rahat sığdı, orman rütbe
  gizleme mekaniği korundu.
- Desen **180° dönme simetrik**: `(r, c) → (9-r, 10-c)`. Üst uçta ağaç koridoru 4. sütunda
  (mavinin yanında), alt uçta 6. sütunda (kırmızının yanında); göller her uçta koridorun
  karşı tarafında. Tek istisna `(3,6)` ormanı — karşılığı olan `(6,4)` boş.
- Ayna (sol-sağ) simetri **bilerek kullanılmadı**: koridoru tek sütuna koyup aynalasaydık
  bir oyuncu koridora yandan girerken diğeri gölleri dolaşmak zorunda kalırdı. Dönme
  simetrisinde iki oyuncu da kendi ucundaki koridora yandan giriyor.
- `FOREST_COORDS` içindeki `density` yalnızca kaç ağaç çizileceğini belirler; kurala etkisi
  yoktur.
- **Hareket ekseni satırdan sütuna döndü.** Kırmızı sağda, sola ilerler (`dc < 0`); mavi
  solda, sağa ilerler (`dc > 0`). Yanal hareket artık satır ekseninde. Hem istemcideki
  `calculateValidMoves` hem sunucudaki doğrulama buna göre değişti.
- Oran `aspect-[11/10]`, tahta tamamen ekrana sığıyor.

**Not:** `BOARD_ROWS`/`BOARD_COLS` ve göl/orman koordinatları **iki dosyada birden** tanımlı
(`client/constants.ts` ve `src/server.ts`) — birini değiştirirken diğerini de değiştirin,
yoksa sunucu ile istemci farklı tahta görür. Bu ayrışma sessizdir: istemci geçerli gösterdiği
bir hamleyi sunucu reddeder ve `move_error` oyun ekranında basılmadığı için kullanıcıya
"tıklama çalışmıyor" gibi görünür. `npm run test:protokol` senaryo 3b artık iki listeyi
**kare kare** karşılaştırıyor; istemci sabitlerini metin olarak okuyup sunucunun bildirdiği
tahtayla eşleştiriyor. Testin gerçekten yakaladığı, bir gölü tek taraftan silip koşularak
doğrulandı.

**Yan bulgu:** eski `grid-rows-15` sınıfı hiç CSS üretmiyordu — Tailwind'in varsayılan
`grid-rows` değerleri 1-6 ile sınırlı ve `theme.extend` boştu. Tahta yalnızca `grid-cols-10`
ve `aspect-[10/15]` ile, satırlar örtük akarak çiziliyordu. `tailwind.config.js`'e
`gridTemplateRows: { 10: ... }` eklendi, artık satırlar açıkça eşit.

### Tam dil desteği (TR/EN/JA/KO)

Oyundaki **tüm** görünen metinler `TRANSLATIONS`'a taşındı. Kapsam: üst bar, dizilim paneli,
durum satırı, süre ön ayarları, ele geçirilenler, çarpışma geçmişi, istatistik modalı, online
oda modalı (başlıklar, sekmeler, etiketler, placeholder'lar, durum satırları) ve tüm hata
mesajları.

**Sunucu hata mesajları kod hâline getirildi.** Sunucu artık `move_error` / `error`
mesajlarında `code` alanı gönderiyor (`NOT_YOUR_TURN`, `PIECE_IMMOBILE`, `BACKWARD`,
`ONE_SQUARE`, `STRAIGHT_ONLY`, `OUT_OF_BOUNDS`, `LAKE`, `OWN_PIECE`, `PIECE_NOT_FOUND`,
`INVALID_MOVE`, `SERVER_ERROR`). İstemci `err<CODE>` anahtarıyla çeviriyor. `message` alanı
insan-okur yedek olarak korundu — kod tanınmazsa o gösterilir.

Dil değişimi render dışında da doğru çalışsın diye `App.tsx`'e `langRef` + `TR_KEY()` /
`TR_CODE()` yardımcıları eklendi (WebSocket callback'leri render kapsamı dışında çalışıyor,
`lang`'i doğrudan okusalar eski değere takılırdı).

**Çevrilmeyecek olanlar (bilinçli):** `PLAYERS.RED = '1. Oyuncu'` / `PLAYERS.BLUE` ve
`PIECE_DEFINITIONS[*].name` (`"Bayrak"`, `"Bomba"`) **protokol kimlikleridir** — sunucu
`resolveCombat` içinde bunlarla karar verir, istemci de ikon seçer. Çevrilirlerse oyun
bozulur. Ekranda `t.playerRed`/`t.playerBlue` ve `getPieceLabel()` üzerinden gösterilirler.

### `<html lang>` seçili dile göre güncellenir

`index.html` sabit `lang="tr"` ile geliyor. CSS'in `text-transform: uppercase` dönüşümü
**belgenin diline göre** çalıştığı için, Türkçe kuralı İngilizce metni bozuyordu:
`WINS` → `WİNS` (noktalı I). `App.tsx` içinde bir `useEffect` artık
`document.documentElement.lang`'i seçili dile ayarlıyor.

Büyük harfe çevrilen her metni etkiliyordu; yeni panonun galibiyet başlığında fark edildi.

### i18n denetimi: `npm run test:i18n`

"Türkçe karakter içeren satır" aramak **yetmiyor.** Bu yüzden altı sızıntı sırayla gözden
kaçtı ve ancak ekran görüntüsüne bakınca fark edildi:

| Kaçan | Neden taramaya düşmedi |
|---|---|
| `1. Oyuncu: {sayı} / 40` (ele geçirilenler) | tamamı ASCII, özel karakter yok |
| `{p.name}` (rütbe hiyerarşisi) | düz metin değil, **değişken** basımı |
| `Kazanan: {winner}` | "Kazanan" ASCII + `winner` bir Player değeri |
| `Oyuncu Bekleniyor...` (mavi yuva yedeği) | ASCII |
| `(Siz)` rozetleri | ASCII |
| `'1. Oyuncu'` varsayılan oyuncu adı | ASCII, üstelik sunucuya gönderiliyordu |

`test/i18n-denetim.mjs` bu üç sınıfı birden tarar: Türkçe **karakter**, Türkçe **kelime**
(ASCII olsa da), ve çevrilmemiş **değer basımı** (`{winner}`, `{x.name}`, `{x.owner}` …).
Ayrıca dört dilin anahtar kümesinin birebir aynı olduğunu doğrular — bir dilde eksik anahtar
sessizce Türkçeye düşer, denetim bunu yakalar.

Yanlış alarmları ayıklar: JSX nitelik geçişleri (`prop={değer}`), React `key=`, JSX
yorumları (`{/* … */}`) ve protokol kimlikleri (`PLAYERS.*`, `'Bomba'`, `'Bayrak'`, Player
tip literalleri).

**İstemcide metin değiştirdikten sonra çalıştırın.** Şu an: 108 anahtar × 4 dil, temiz.

#### Anahtar sayımındaki hata (düzeltildi)

Anahtar eşitliği kontrolü `^\s{4}(anahtar):` deseniyle çalışıyordu — yani **satır başındaki
ilk anahtarı**. `constants.ts` bir satıra birden çok anahtar koyuyor
(`restartButton: '…', statsButton: '…',`), dolayısıyla satır içi 28 anahtar hiç
sayılmıyordu: `roomLabel`, `youAre`, `statsButton`, `errINVALID_MOVE`, `errONE_SQUARE` …
Bir dilde bunlardan biri eksik olsa denetim **temiz** derdi.

Düzeltme: önce metin değerleri siliniyor (değerin içindeki `Oda:` gibi iki noktalar
yanıltıyordu), sonra kalan her `anahtar:` eşleşmesi alınıyor. Sayı 79'dan **108**'e çıktı —
29 yeni anahtar eklendiği için değil, 28'i zaten görülmüyordu diye (+1 gerçek yeni).
Dört dil de 108'de eşit, yani fiilen eksik anahtar yokmuş.

#### Satır sonu yorumları ve CRLF tuzağı

Kod açıklamaları Türkçe yazılıyor. Satır **başındaki** yorumlar zaten eleniyordu ama
`const x = 1;   // açıklama` gibi satır sonu yorumları elenmiyordu — satır kodla başladığı
için yorum eleğine takılmıyor, içindeki `ç/ğ/ı` ise "sabit Türkçe metin" alarmı veriyordu.

İlk denemem `/(?<!:)\/\/.*$/` idi ve **çalışmadı**: dosyaların bir kısmı CRLF (paketten
gelenler), bir kısmı LF (bu oturumda yazılanlar). `.` satır sonundaki `\r`'yi eşlemediği
için `.*` orada duruyor, `$` ise `\r`'den önce eşleşmiyor — yorum hiç silinmiyordu. Aynı
dosyada LF olsaydı sorun görünmeyecekti. Doğrusu `$` yerine `[^\r\n]*` kullanmak.

`(?<!:)` kısmı `wss://` gibi protokolleri kesmemek için.

#### Büyük harfli sabit metinler görünmüyordu

ASCII kelime listesi (`Oda|Kod|Oyuncu|…`) büyük/küçük harfe **duyarlıydı**. Bu yüzden
`OnlineModal`'daki kopyala düğmesi — `{copied ? 'KOD KOPYALANDI!' : 'ODA KODUNU KOPYALA'}` —
denetimden geçiyordu: "KOD" ve "ODA" tamamı büyük olduğu için `\b(Oda|Kod)\b` eşleşmiyordu.
Sonuç: düğme dört dilde de Türkçe kalmıştı. Desene `i` bayrağı eklendi, metinler
`t.copyCode` / `t.codeCopied`'e bağlandı.

Ders: sabit metin taramasında büyük/küçük harf varyantı bir sızıntı sınıfıdır. Denetime
kasıtlı bir `ODA KODUNU KOPYALA` satırı enjekte edilip yakalandığı doğrulandı, sonra silindi.

#### Blok yorumları satır satır taranamaz

Çok satırlı JSX yorumunun (`{/* birinci satır` … `ikinci satır */}`) **ikinci** satırı `*`
ile başlamıyor, kodmuş gibi görünüyor ve içindeki Türkçe alarm veriyordu. Yorum eleği tek
satıra bakıyordu. Artık dosya boyunca taşınan bir `blokta` bayrağıyla yorumlar gerçekten
ayrıştırılıyor.

#### Denetim gevşetildikçe körleşmediği doğrulanmalı

Yorum eleği her genişletildiğinde denetimin hâlâ **gerçek** sızıntı yakaladığı sınanmalı.
Bu turda geçici olarak iki sızıntı enjekte edildi ve ikisi de yakalandı:

- `<p>Sızıntı denemesi: Oyuncu Bekleniyor</p>` → sabit Türkçe metin
- `<p>{combatHistory[0]?.attacker?.name}</p>` → çevrilmemiş değer basımı

İkincisi ilk denemede **yakalanmadı**: eski desen düz `[A-Za-z]+\.name` idi, isteğe bağlı
zincir (`a?.name`) ve indekslemeyi (`a[0].name`) görmüyordu. Desen yol ifadesine çevrildi.

### Varsayılan oyuncu adı artık dile bağlı

İsim alanı boş bırakılınca istemci sabit `'1. Oyuncu'` gönderiyordu — bu ad sunucuda saklanıp
**her iki oyuncuya** Türkçe olarak gösteriliyordu. Artık boş gönderiliyor; sunucu boşu olduğu
gibi saklıyor (`?? ""`, eskiden `|| "Oyuncu"`), `getRoomState()` `null` döndürüyor ve her
istemci kendi dilindeki `t.playerRed` / `t.playerBlue` yedeğini gösteriyor.

### Kenar koordinatları (satranç gibi)

`Board.tsx`'e dört kenar şeridi eklendi: üstte ve altta sütun harfleri **a–k**, solda ve
sağda satır numaraları **1–10**. Şeritler tahtanın `gap-0.5` / `p-1.5` ölçüleriyle aynı
ızgarayı kullandığı için karelerle hizalı kalıyor; `aria-hidden` oldukları için ekran
okuyucularda gürültü yapmıyorlar.

**Her iki oyuncunun koordinatları aynı anda gösterilir** — her oyuncu kendi kenarındaki
şeritleri okur. Perspektife göre değişmez, sıra geçtikçe dönmez.

| Şerit | Kimin | Sıra |
|---|---|---|
| **Üst** harfler | Mavi | `a b c … k` (sol→sağ) |
| **Sol** sayılar | Mavi | `1 … 10` (üst→alt) |
| **Alt** harfler | Kırmızı | `k j i … a` (sol→sağ) |
| **Sağ** sayılar | Kırmızı | `10 … 1` (üst→alt) |

Böylece her oyuncunun kendi kenarındaki ilk karesi `a`, kendi solundaki ilk karesi `1` olur:
mavi solda oturup sağa ilerler (solu = üst), kırmızı sağda oturup sola ilerler (solu = alt).

**Not:** aynı kare iki oyuncuda farklı ad alır (mavinin `a1`'i kırmızının `k10`'u). Tahta
döndürülmediği için kaçınılmaz, istenen davranış bu. Dört şerit birden durduğu için tek
ekranda oynarken de her oyuncu kendi koordinatını okuyabiliyor.

### Dizilim paneli tahtanın üstünde (overlay)

`SetupUI` artık tahtanın yanında değil, **üzerinde** duruyor (`absolute`, `z-30`), tahtaya
**dikeyde ortalanmış** (`top-1/2 -translate-y-1/2`) ve tarafı dizilim yapan oyuncuya göre:

| Dizen oyuncu | Kendi taşlarını dizdiği sütunlar | Panel tarafı |
|---|---|---|
| Kırmızı | 7-10 (sağ) | **sol** (`left-3`) |
| Mavi | 0-3 (sol) | **sağ** (`right-3`) |

Panel bilinçli olarak oyuncunun **karşı** tarafında: kendi dizilim alanını kapatmasın diye.
`App.tsx` içinde `setupPlayer` / `setupSide` ile hesaplanıyor.

### Tahta genişliği yükseklikten sınırlanıyor

Panolar sağa toplanınca tahta boşalan genişliği aldı ve dikeyde taştı — 857px yüksekliğinde
bir pencerede **son satır görünmüyordu**. Tahta `aspect-[11/10]` olduğu için genişliği
serbest bırakmak yüksekliği de büyütüyor.

Çözüm, `App.tsx`'te tahta sarmalayıcısına yükseklikten türetilmiş bir genişlik sınırı:

```
lg:max-w-[min(900px,calc((100vh-136px)*1.1+32px))]   // yerel
lg:max-w-[min(900px,calc((100vh-172px)*1.1+32px))]   // online (başlık bir satır uzun)
```

`136` = başlık (72) + `main` dikey dolgusu (32) + koordinat şeritleri (32); `+32px` şeritleri
geri ekler; `1.1` = 11/10 en-boy oranı. `lg:` öneki mobilde (panolar alt alta) devre dışı
bırakır. Sınıf adları JIT'in görebilmesi için ternary içinde **tam metin** yazılmalı.

**Kalan taşma:** tahta tam sığıyor ama sağ sütun taşıyor. 857px'lik pencerede:

| Sağ sütun durumu | Sayfa taşması |
|---|---|
| iki pano da açık | 171px |
| biri kapalı | 0px |
| ikisi de kapalı | 0px |

Açılır/kapanır başlıklar taşmayı ~89px'ten 171px'e çıkardı (iki başlık çubuğu ≈ 82px), ama
kullanıcıya kapatma imkânı verdiği için pratikte çözüm de o. Sıfırlamak istenirse: sağ
sütuna `lg:overflow-y-auto` verip sayfa yerine sütunu kaydırmak, ya da panolardan birini
varsayılan kapalı başlatmak yeterli.

**Dikkat:** `setupPlayer` tanımı `currentPlayer` (`useMemo`) tanımından **sonra** gelmeli.
Önce koyulursa `tsc` "Block-scoped variable used before its declaration" verir ve çalışma
zamanında `ReferenceError` olur — `vite build` bunu yakalamaz.

### Yan panolar ikiye ayrıldı, ikisi de sağda

Eski tek `GameInfo.tsx` her şeyi taşıyordu. Artık iki ayrı pano var ve **ikisi de tahtanın
sağında, alt alta** duruyor (tek bir `w-full lg:w-72` sarmalayıcı içinde):

| Sıra | Pano | İçerik |
|---|---|---|
| üstte | `SettingsPanel.tsx` | dil seçici, Online Oyun + Yeniden Başlat, süre ön ayarları, ses (sustur + kaydıraç) |
| altta | `PlayerPanel.tsx` | galibiyet sayacı, tur durumu + geri sayım, ele geçirilenler, rütbe hiyerarşisi, çarpışma geçmişi |

Genişliği **sarmalayıcı** belirliyor; panoların kendisi `w-full`. İkisinde de `lg:w-72`
bırakılsaydı sarmalayıcıyla çakışırdı.

**İkisi de açılır/kapanır.** Her panonun tepesinde `aria-expanded` taşıyan bir başlık
düğmesi var (⚙ Ayarlar / ⓘ Oyun Bilgisi); tıklanınca gövde **DOM'dan kaldırılıyor**
(`{!isOpen ? null : …}`), yalnızca gizlenmiyor. Durum her panonun kendi `useState`'inde:
ayarlar **açık**, oyun bilgisi **kapalı** başlar. Başlık kapalıyken tam yuvarlak, açıkken alt köşeleri düz + alt çizgili
(`rounded-b-none border-b`).

Oyun bilgisi panosunun içindeki "Rütbe Hiyerarşisi" zaten açılır bir bölümdü — artık iç içe
iki seviye var, bu bilinçli.

`GameInfo.tsx` silindi. Online / ses / yeniden başlat düğmeleri başlıktan ayarlar panosuna
taşındı, İstatistikler düğmesi de kaldırıldı — **başlıkta artık hiç düğme yok.**

### Süre ön ayarı oyun başlayınca kilitleniyor

`isTimerLocked = gamePhase.startsWith('PLAY')`. Dizilim sırasında ve oyun bittikten sonra
değiştirilebilir, oyun sırasında değiştirilemez — ortada süre değiştirmek sırası gelen
oyuncuya avantaj/dezavantaj yaratıyordu.

Kilit iki katmanlı: düğmeler `disabled` **ve** `handlePresetChange` başında `if
(isTimerLocked) return;`. Sadece `disabled` bırakmak yetmez — çağrı başka bir yerden de
gelebilir.

### Tur kaçırma sınırı: iki oyuncu da 3 kez kaçırırsa berabere

Bir oyuncunun süresi dolduğunda sırası geçer ve o oyuncunun kaçırma sayacı artar
(`MAX_MISSED_TURNS = 3`, `constants.ts`). **İki oyuncu da** sınıra ulaşınca oyun berabere
biter. Tek taraflı 3 kaçırma oyunu bitirmez — kural, iki tarafın da masayı terk ettiği
durumu kapatmak için.

Sayaçlar **birikimli**, ardışık değil: oyun boyunca toplam kaçırma sayılıyor. Ardışık
istenirse hamle yapıldığında ilgili sayacı sıfırlamak yeterli.

Sayaç oyun bilgisi panosunda görünüyor (`Kaçırılan Tur — 1. Oyuncu: 0/3   2. Oyuncu: 0/3`),
sınıra ulaşan taraf kırmızıya dönüyor. Görünür olmasa kural oyuncuya sürpriz gelirdi.

**İki tuzak vardı:**

1. *Sayacın çift artması.* Eski geri sayım, faz değiştirmeyi `setTurnTimeRemaining`
   güncelleyicisinin **içinde** yapıyordu. Yan etkiyi oradan çıkarıp ayrı bir efekte
   taşıyınca, efektler bildirim sırasına göre çalıştığı için efekt bir kez daha
   `turnTimeRemaining === 0` ile çalışıyor ve sayacı iki kez artırıyordu. Çözüm: süreyi
   **aynı toplu güncellemede** sıfırdan çıkarmak (`setTurnTimeRemaining(timerConfig.turnTime)`
   doğrudan timeout efektinin içinde).
2. *Beraberlik ekrana hiç düşmüyordu.* `GameOverModal` `if (!winner) return null;` ile
   başlıyordu; beraberlikte kazanan olmadığı için modal hiç açılmazdı. Artık
   `if (!winner && !isTimeoutDraw) return null;`.

**Kural ONLINE MODDA İŞLEMEZ — kasıtlı.** Tur saati tamamen istemcide; sunucu tur
süresini bilmiyor. İstemcinin oyunu kendi başına bitirmesi sunucuyu "oyun sürüyor"
durumunda bırakıyor ve oyuncu biten bir ekranda kilitli kalıyordu (bkz. aşağıdaki
"Online yeniden başlat" maddesi). Bu yüzden `isOnlineMode` iken kaçırma sayılmıyor,
beraberlik tetiklenmiyor ve kaçırma kutusu panoda gösterilmiyor; süre dolunca yalnızca
sıra devrediliyor (eski davranış). Kuralın online tarafta da işlemesi için tur saatinin
sunucuya (DO alarm'ı) taşınması gerekir — ayrı bir iş.

### Online "Yeniden Başlat" çalışmıyor görünüyordu

Sunucu (`request_restart`) yeniden başlatmayı **iki taraf da isteyene kadar** yapmıyor:
`if (room.restartRequested[0] && room.restartRequested[1])`. İstemci tarafında
`handleRestartGame` online modda isteği yollayıp erken dönüyor, hiçbir yerel durum
değişmiyor. Geri bildirim `onlineErrorMessage`'a yazılıyordu ama o **yalnızca
`OnlineModal` içinde** basılıyor — oyun sırasında o modal kapalı. Sonuç: düğmeye basılıyor,
ekranda hiçbir şey olmuyor, düğme bozuk sanılıyor.

Düzeltme:

- Ayrı bir `restartNotice` durumu, **popup** olarak gösteriliyor
  (`RestartNoticeModal.tsx`). Önce başlık şeridinde ufak bir yazıydı ve gözden kaçıyordu.
- Sunucu `restart_requested`'ı **isteği yapana da** yolluyor. Artık `msg.slot` kendi
  slotumuzla karşılaştırılıyor: isteyen "rakibin onayı bekleniyor", karşı taraf "rakip
  yeniden başlatma istedi" görüyor. Önceden isteyen kişi kendi isteğini "rakip istedi"
  diye görüyordu.

**Kendi düşürdüğüm tuzak — `setState` güncelleyicisinden okumak.** `handleWsMessage` boş
bağımlılıkla `useCallback`, yani `myOnlineTeam`'i doğrudan okuyamıyor. İlk çözümüm bu
dosyada zaten kullanılan `setMyOnlineTeam(prev => { …; return prev; })` numarasıydı. Ama
güncelleyici **render sırasında** çalışıyor: sunucu `restart_requested` ve `game_restarted`
mesajlarını arka arkaya yolladığı için, bildirim `game_restarted`'ın temizliğinden SONRA
yeniden yazılıyordu. Sonuç: **onaylayan** oyuncuda oyun sıfırlandığı hâlde "rakip yeniden
başlatma istedi" notu ekranda kalıyordu (isteyen tarafta görünmüyordu, o yüzden gözden
kaçması kolaydı). Çözüm: `myOnlineTeamRef` — güncelleyici içinde yan etki yok.

Aynı numara dosyada `room_started_setup` ve `game_restarted` içinde de var; oralarda
yalnızca `setGamePhase` çağrıldığı ve sonuç aynı olduğu için sorun çıkarmıyor.

**Bildirim METİN değil DURUM olarak saklanıyor** (`RestartNotice = 'WAITING' | 'REQUESTED'
| null`, `types.ts`). Çevrilmiş metni saklamak iki sorun doğuruyordu: dil değişirse
bildirim eski dilde donuyordu, ve popup hangi tarafta olduğumuzu bilemediği için onay
düğmesi gösteremiyordu. Metin artık render anında `t`'den türetiliyor.

Popup'ta **rakip istediyse onay düğmesi de var** — "Yeniden Başlat butonuna basın" deyip
kullanıcıyı düğme aramaya göndermek yerine düğme metnin yanında.

**z-index çakışması:** oyun bittiğinde `GameOverModal` zaten `z-[1000]`'de açık oluyor;
ayrı bir popup üstüne binerdi. Bu yüzden `gamePhase === 'GAME_OVER'` iken bildirim
modalin **içinde** basılıyor (orada zaten bir Yeniden Başlat düğmesi var), diğer tüm
durumlarda popup çıkıyor.

### Giriş (menü) ekranı

Oyun eskiden doğrudan tahtayla açılıyordu. Artık `screen: 'MENU' | 'GAME'` durumu var
(`App.tsx`), açılışta `MENU`. `MenuScreen.tsx`: logo, alt başlık, **Online Oyun**
(birincil), **Ayarlar** (ikincil), dil seçici.

`gamePhase` mantığına dokunulmadı — menü yalnızca render'ı kapılıyor. Online düğmesi
mevcut `OnlineModal`'ı açıyor, yeni protokol kodu yok. `room_created` / `room_joined` /
`room_started_setup` gelince `screen='GAME'`, "Odayı Terk Et" ise `MENU`'ye döndürüyor.
Menüde tahta **hiç** render edilmiyor (bir an bile görünmüyor), ama `OnlineModal` orada da
render ediliyor çünkü oda kurma akışı oradan yürüyor.

### Yerel (aynı ekran) mod menüden kaldırıldı

Menüde önce bir "Yerel Oyun" düğmesi vardı. Kaldırıldı: bu oyunda dizilim sırasında
rakibin ekrana bakmaması gerekiyor, dolayısıyla tek ekranda sırayla oynamak anlamlı değil.
Ürün karşılıklı iki kişi için — **oyuna tek giriş artık online.**

**Sonucu:** "iki oyuncu da 3 tur kaçırırsa berabere" kuralı yalnızca yerel modda
çalışıyordu (sunucuda tur saati olmadığı için online'da bilinçli devre dışı) —
dolayısıyla şu an **erişilemez durumda**. `missedTurns` state'i ve `PlayerPanel`'deki
kutu duruyor ama tetiklenmiyor. Kuralın işler hâle gelmesi için tur saatinin sunucuya
(DO alarm'ı) taşınması gerekir.

Kaldırılanlar: `handleStartLocal`, `localGameButton` çevirisi (4 dil), `App.tsx`'teki
kullanılmayan `Swords` importu.

### Menüdeki Ayarlar penceresi

`MenuSettingsModal.tsx` — içerik bilinçli olarak **oyun öncesi anlamlı** olanlarla sınırlı:
süre ön ayarı ve ses. Süre ayarı oyun başlayınca zaten kilitleniyor, yani doğru yeri menü.
Dil menüde bayrak düğmesi olarak duruyor, pencerede tekrarlanmıyor. Yeni çeviri anahtarı
gerekmedi — başlık için mevcut `settingsPanelTitle` kullanıldı.

**Ortak parça:** `SettingsControls.tsx` içinde `TimerPresetPicker` + `VolumeControl`.
Ses denetimi hem menüde hem oyun içi panelde kullanılıyor; iki kopya zamanla birbirinden
sapardı.

### Oyun içi panelden süre ve dil kaldırıldı

Ayarlar oyun öncesi menüde yapıldığı için oyun içi `SettingsPanel`'de artık sadece
**Online / Yeniden Başlat / ses** var. Süre ön ayarı zaten oyun başlayınca kilitleniyordu —
yani oyun içinde işlevsiz bir kutuydu. Dil de aynı mantıkla kaldırıldı.

**Sonucu:** oyuna girdikten sonra dil değiştirilemiyor. Yanlış dille girildiyse odadan
çıkıp menüden değiştirmek gerekiyor.

`TimerPresetPicker`'ın `isLocked` dalı artık ulaşılmıyor (tek çağıran menü, o da `false`
geçiyor); `handlePresetChange` içindeki `if (isTimerLocked) return;` savunma amaçlı duruyor.
Süre ön ayarı ileride oyun içine dönerse ikisi de hazır.

**Müzik logo ekrana gelir gelmez başlıyor.** Eskiden `volume` varsayılanı `0` olduğu için
müzik hiç çalmıyordu; ayrıca autoplay engelini aşmak diye sayfaya global bir ilk-tıklama
dinleyicisi kuruluyordu ve o da `setVolume(0)` çağırdığı için işe yaramıyordu.

Yeni düzen: varsayılan ses `0.5` ve açılışta **iki aşamalı** deneme (`App.tsx`, mount
efekti):

1. `soundManager.setVolume(volume)` hemen çağrılır → `startBackgroundMusic()` tetiklenir.
   Tarayıcı izin veriyorsa müzik logoyla **aynı anda** girer.
2. Engellenirse `pointerdown` / `keydown` / `touchstart` üzerine `once` dinleyiciler
   kurulur; ilk etkileşimde başlar. `startBackgroundMusic` zaten çalıyorsa erken döndüğü
   için çift çalma olmaz, ses kapalıysa yedek yol hiç devreye girmez.

Bu, belirli bir düğmeye bağlamaktan iyi: izin varsa anında, yoksa mümkün olan **en erken**
anda başlıyor.

**Sınır:** sayfa yüklenir yüklenmez çalıp çalmaması tamamen tarayıcının autoplay
politikasına bağlı (Chrome'da Media Engagement Index — siteyle daha önce etkileşmiş
ziyaretçide izin verilir, ilk ziyarette genelde verilmez). Otomasyonda bu kesin
ölçülemiyor: CDP navigasyonu kullanıcı aktivasyonu veriyor (`hasBeenActive: true`) ve
`navigator.getAutoplayPolicy` bu Chrome sürümünde yok. Doğrulanabilen: **hiç tıklamadan**
`game_music.mp3` isteği yapılıyor (`initiatorType: audio`, 1.78 MB), yani deneme mount
anında gerçekten yapılıyor; etkileşimden sonra `play` + `playing` olayları `volume: 0.5`
ile tetikleniyor.

### Favicon ve açılış zemini

`public/favicon.svg` (11.9 KB) — logonun **kelimesiz** amblem hâli, saydam gerçek vektör,
`viewBox="0 0 656.57 711.01"`. `client/index.html`'e
`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` olarak bağlandı. 64px'te
net; 32px'te kalkan silueti seçiliyor, 16px'te doğal olarak bulanıklaşıyor (detaylı çizim).
Saydam olduğu için hem koyu hem açık sekme temasında çalışıyor.

Sayfa başlığı da düzeltildi: "Strateji ve Taktik **Oyunu**" → "**Savaşı**".

`<body>` sınıfı `bg-slate-800` idi ama uygulama kökü `slate-950` — React boyanmadan önce
bir kare açık gri parlama görülüyordu. `bg-slate-950` yapıldı, giriş artık temiz.

### Oda kodu artık popup olarak geliyor

Oda kurulunca kod yalnızca başlık şeridinde ve `OnlineModal` içinde görünüyordu; kopyalamak
için modalı tekrar açmak gerekiyordu. `RoomCodeModal.tsx` artık `room_created` gelir gelmez
kodu büyük puntoyla gösteriyor, kopyala düğmesi ve paylaşım ipucuyla birlikte.
`room_started_setup` (rakip katıldı) gelince **kendiliğinden kapanıyor** — koda artık gerek
yok. Katılan oyuncuda hiç açılmıyor.

**Pano hatası artık sessiz değil.** `navigator.clipboard.writeText` birkaç durumda
reddediyor (belge odakta değil, izin yok, güvensiz bağlam). İlk hâlinde `catch` boştu:
kullanıcı düğmeye basıp hiçbir şey olmadığını görürdü. Artık başarısızlıkta kod metni
**seçiliyor** (Range/Selection) ki Ctrl+C ile alınabilsin, "kopyalandı" durumu ise yalnızca
gerçekten kopyalandıysa gösteriliyor. `OnlineModal.handleCopyCode` da `await` + `try/catch`
oldu — öncesinde promise hiç yakalanmıyordu, red durumunda unhandled rejection üretip
üstelik "kopyalandı" yazıyordu.

### Logo: alt yazı görselden çıkarıldı, metin olarak geri kondu

`public/logo.svg` (16.9 KB) saydam, gerçek vektör (55 `<path>`, gömülü raster yok),
`viewBox="0 0 684.18 711.01"`, yazılar path'e çevrilmiş.

Önceki sürüm `astact-logo.avif` idi ve iki sorunu vardı: **dolu arka planı** uygulamanın
`slate-950` zemininde açık bir leke bırakıyordu, **alt yazısı görsele gömülü** olduğu için
EN/JA/KO'da da Türkçe kalıyordu. SVG ikisini de çözdü — saydam olduğu için kart çerçevesi
veya gradyanla gizleme gerekmedi.

Alt yazının yeri rastgele değil: SVG tuvalinde **426-499 satırları tamamen boş**
(yüksekliğin %59.9-%70.2'si) — "astact" ile alt kalkan arasındaki, yazının orijinal yeri.
Metin `absolute` olarak tam o banda oturtuluyor, böylece lockup'ın parçası gibi okunuyor.
Punto `cqw` (container query birimi) ile kabın genişliğine bağlı, her boyutta orantılı
kalıyor. En uzun çeviri (EN, 32 karakter) 300px kapta 221px — hepsi rahat sığıyor.

### Başlıkta logonun kelime markası bandı

Tam lockup kare (684×711); yatay başlık şeridine sığdırılınca yazı okunmaz hâle geliyor —
ölçüldü: 72px'te sıkışık, 32px'te okunmaz. Ayrı bir dosya üretmek yerine **aynı SVG**
`viewBox` ile kırpılıyor:

```jsx
<svg viewBox="10 274 674 152" className="h-7 md:h-8 w-auto">
  <image href="/logo.svg" width="684" height="711" />
</svg>
```

`274-425` satırları "astact" yazısının tam yeri — tuval satır satır taranıp bulundu
(parlak piksel yoğunluğu iki blok veriyor: `40-215` üst kalkan, `274-425` yazı). Kırpılmış
band 674×152, yani 4.43:1 — başlık şeridine oturuyor ve 28-32px yükseklikte net okunuyor.

Yazı logonun içinde olduğu için başlıktaki `<h1>ASTACT</h1>` kaldırıldı; alt başlık
(`appSubtitle`) yazının altında duruyor.

**Sağa dayama — "text-align: right" yetmiyor.** Marka bloğu ve altındaki online şeridi
(Bağlı / Siz / Oda) sağa dayalı. İlk denemede `items-end` verildi ve blok `max-w-7xl`
kapsayıcısının kenarına yaslandı, ama **sağdaki ayarlar panosunun 95px dışına taşıdı**.
Sebep: `main` satırı `justify-center` ve tahta yükseklikten sınırlı olduğu için satır
kapsayıcıyı doldurmuyor, iki yanda boşluk kalıyor — yani panonun sağ kenarı kapsayıcının
sağ kenarı değil.

Çözüm: başlık, `main`'in satır yapısını **birebir yansıtıyor** — aynı kapsayıcı
(`max-w-7xl mx-auto w-full px-2 md:px-4`), aynı satır (`flex flex-col lg:flex-row
justify-center gap-4`), önce tahta genişliğinde görünmez bir boşluk
(`flex-grow w-full` + aynı max-width), sonra pano genişliğinde (`lg:w-72`) marka bloğu.
Aynı kısıtlar aynı yerleşimi üretiyor, dolayısıyla hizalama **her pencere boyutunda**
tutuyor — tek bir boyutta denk gelmiş değil. Ölçüldü: boşluk ve tahta sarmalayıcısı
birebir aynı (411→1197), marka bloğu ve sağ sütun birebir aynı (1213→1501).

Tahtanın max-width ifadesi artık `tahtaGenislikSiniri` değişkeninde **tek yerde**; başlık
ve main aynı değeri kullanıyor, yoksa iki kopya zamanla birbirinden sapardı. Tailwind JIT
sınıf adlarını kaynakta aradığı için iki seçenek de tam metin yazılı, string birleştirmeyle
üretilmiyor.

Başlığın yatay dolgusu `p-3`'ten `py-3`'e çekildi ve yatay dolgu iç kapsayıcılara
(`px-2 md:px-4`) taşındı — `main` ile aynı içerik kutusu olsun diye. Favicon için ayrı bir amblem dosyası kullanılıyor
(`favicon.svg`) — tek başına kalkan bu lockup'tan temiz kırpılamıyor çünkü kelime markası
üst kalkanın alt yarısıyla üst üste biniyor.

### Slogan düzeltildi: "Alanı" → "Savaşı"

`appSubtitle` "Strateji ve Taktik **Alanı**" idi; kullanıcı bunun yanlış yazıldığını, doğru
sloganın **"Strateji ve Taktik Savaşı"** olduğunu belirtti. Diğer üç dil de yanlış metnin
üzerine kurulmuştu ("Field", "フィールド"), hepsi düzeltildi:

| Dil | Eski | Yeni |
|---|---|---|
| TR | Strateji ve Taktik Alanı | Strateji ve Taktik Savaşı |
| EN | Strategy & Tactics Field | A Battle of Strategy and Tactics |
| JA | 戦術・戦略フィールド | 戦略と戦術の戦い |
| KO | 전략과 전술의 전장 | 전략과 전술의 전쟁 |

Anahtar başlıkta da kullanıldığı için düzeltme menüyle sınırlı değil.

### `animate-fade-in` hiç çalışmıyormuş

Sınıf `GameOverModal`, `StatsModal`, `OnlineModal` ve `PlayerPanel`'de kullanılıyordu ama
ne `index.css`'te `fadeIn` keyframe'i ne de Tailwind config'inde `animation` tanımı vardı —
**sınıf hiç CSS üretmiyordu**, o fade'ler baştan beri yoktu. Daha önce düzeltilen
`grid-rows-15` ile aynı sınıf hata: Tailwind'de var olmayan bir utility sessizce hiçbir şey
üretir, ne derleme ne `tsc` uyarır. `fadeIn`/`fadeInUp` keyframe'leri + `theme.extend.animation`
eklendi; dört modalin fade'i artık gerçekten çalışıyor, menü de `animate-fade-in-up` kullanıyor.

### Online modda durum satırı rakip odaklı

Oyun bilgisi panosunda 1. Oyuncu'ya "1. Oyuncu Taşlarını Diziyor" yazmanın bilgi değeri
yok — oyuncu kendi dizilim panelini zaten görüyor. Değerli olan rakibin durumu.

**Neden düz etiket takası yetmiyor:** online'da dizilim **eşzamanlı**. `room_started_setup`
her istemciyi kendi fazına alıyor (1. Oyuncu `SETUP_RED`, 2. Oyuncu `SETUP_BLUE`), ikisi
aynı anda diziyor. Etiketi ters çevirseydik rakip onayladığı anda yazı yanlış kalırdı —
üstelik oyuncunun asıl merak ettiği an tam orası.

Gerçek kaynak `roomState`: `player_setup_status` `redReady`/`blueReady` getiriyor,
`player_connection_change` tüm durumu yeniliyor. İkisi de zaten geliyordu ama oyun
ekranında hiç gösterilmiyordu.

`App.tsx` `onlineStatus` (`types.ts` içindeki `OnlineStatus`) türetip panoya geçiriyor:

| Durum | Yazı |
|---|---|
| `OPPONENT_WAITING` | Rakip bekleniyor |
| `OPPONENT_OFFLINE` | Rakibin bağlantısı koptu |
| `OPPONENT_SETTING_UP` | Rakip taşlarını diziyor |
| `OPPONENT_READY` | Rakip hazır — seni bekliyor |
| `YOUR_TURN` / `OPPONENT_TURN` | Sıra sende / Sıra rakipte |

Bağlantı kopukluğu dizilim ve sıra bilgisinin **önüne** geçiyor.

Oyun fazında da takas yapılmadı, çünkü `turnRedStatus`/`turnBlueStatus` doğru bilgi
veriyor; her şeyi ters çevirmek sıra sendeyken "Sıra: 2. Oyuncu" yazdırırdı. Onun yerine
oyuncuya göreli ("sende"/"rakipte") hâle getirildi.

**Yerel mod hiç değişmedi:** `onlineStatus` yalnızca online modda doluyor, boşken
`PlayerPanel` eski `gamePhase` switch'ini aynen kullanıyor. Aynı ekranda dizilim gerçekten
sırayla ilerlediği için oradaki etiketler zaten doğru.

### `StatsModal` şu an erişilemez durumda

İstatistikler düğmesi kaldırılınca `StatsModal`'a giriş kalmadı. Dosya **duruyor** ama
`App.tsx` onu artık import etmiyor (`isStatsOpen` state'i de silindi). Modaldeki
`redWins`/`blueWins` zaten `PlayerPanel`'de görünüyor; **`gamesPlayed` ve `totalBattles`
artık hiçbir yerde gösterilmiyor** — `stats` state'i toplanmaya devam ediyor.

Geri açmak istenirse: `App.tsx`'e import + `isStatsOpen` state'i + bir tetikleyici düğme
yeter, `StatsModal.tsx`'te değişiklik gerekmez.

`PlayerPanel` `panelPlayer` prop'u ile temalanıyor (kırmızı → amber, mavi → sky), yani
ikinci bir oyuncu panosu gerekirse `panelPlayer={PLAYERS.BLUE}` yeterli.

Ses tek noktadan yönetiliyor: `App.handleVolumeChange` hem `SettingsPanel`'e hem
`StatsModal`'a veriliyor, ikisi de aynı `volume` state'ini gösteriyor.

### Yüzde işaretinin yeri dile bağlı

Türkçe yüzdeyi **öne** yazar (`%50`), İngilizce/Japonca/Korece **sona** (`50%`). Ses
kaydıracının rozeti sabit `%{n}` kullanıyordu; dört dilde de Türkçe biçimde çıkıyordu.
`SettingsPanel` ve `StatsModal` artık `lang === 'TR' ? \`%${n}\` : \`${n}%\`` kullanıyor.

Bu, `test:i18n` denetiminin **yakalayamayacağı** bir sınıf: metin çevrilmiş, yalnızca
biçim yanlış. Sayı/tarih/para biçimlerinde dil başına gözle kontrol gerekiyor.

### Çarpışma geçmişi dil değiştirince Türkçe kalıyordu

`CombatHistoryItem` bileşeni (o sırada `GameInfo.tsx` içindeydi, sonradan
`PlayerPanel.tsx`'e taşındı) `lang` prop'unu alıyor ama **hiç kullanmıyordu**; yedi
çarpışma mesajı ve beş durum metni sabit Türkçe gömülüydü.

Çözüm: mesajlar `TRANSLATIONS`'a dört dilde şablon olarak taşındı
(`combatMiner`, `combatSpy`, `combatHigherWins`, `combatFlagCaptured`, `combatBombHit`,
`combatDefenderWins`, `combatEqualRank` + `setupRedStatus`/`turnRedStatus`/… ). Şablonlar
`{a}` (saldıran), `{d}` (savunan), `{ar}`/`{dr}` (rütbeler), `{rw}` ("Rütbe" kelimesi)
yer tutucularını kullanıyor. Taş adları `getPieceLabel()`, oyuncu adları `t.playerRed`/
`t.playerBlue` üzerinden çevriliyor.

### Taş adları dile göre değişmiyordu

`PIECE_DEFINITIONS` taş adlarını Türkçe sabit tutuyor ve bu ad **işlevsel bir kimlik**:
sunucu `resolveCombat` içinde `name === "Bayrak"` / `"Bomba"` diye karar veriyor
(`src/server.ts:117-118`), istemci de `Piece.tsx`'te ikon seçiyor. Bu yüzden saklanan ad
çevrilemez.

Çözüm: `constants.ts` içine `PIECE_LABELS` (TR/EN/JA/KO) tablosu ve `getPieceLabel()`
yardımcısı eklendi — yalnızca **görünen etiket** çevriliyor, kimlik Türkçe kalıyor.
`lang`, `Board → Square → Piece` zincirinden geçirildi; `SetupUI` zaten alıyordu.
`Piece.tsx`'te sabit yazılmış "Bayrak" / "Bomba" etiketleri de tabloya bağlandı.

### "Taş bulunamadı" yağmuru — hamleden sonra seçim temizlenmiyordu

Belirtiler: hamle yaptıktan sonra sarı "gidebileceğin kareler" işaretleri ekranda **takılı
kalıyor**, sonraki tıklamalar sık sık "Taş bulunamadı" veriyor, ve sıra rakipteyken tahtaya
basınca **hiçbir şey olmuyor**.

Üçü de tek kök nedene bağlı. `move_executed` işleyicisi `selectedPiece` ve `validMoves`'u
temizlemiyordu:

| Hamlenin bittiği yol | Seçimi temizliyor mu |
|---|---|
| `turn_timeout` | ✅ |
| `game_restarted` | ✅ |
| yerel mod `handleMoveOrAttack` | ✅ |
| **`move_executed` (online)** | ❌ — atlanmış |

Sonuç zinciri: seçim ayakta kalınca sarı işaretler ekranda kalıyor; `selectedPiece.position`
ise taşın **eski** karesini göstermeye devam ediyor. O takılı karelerden birine tıklandığında
`handleSquareClick` onu hâlâ geçerli hamle sanıp `handleMoveOrAttack`'e gidiyor ve sunucuya
`from` olarak artık **boş** olan kareyi yolluyor → `PIECE_NOT_FOUND` → "Taş bulunamadı".

Üçüncü belirtinin sebebi ayrı ama aynı kafa karışıklığını üretiyordu: sıra rakipteyken
`handleSquareClick` ilk satırda **sessizce** `return` ediyordu. Oyuncu tıklıyor, hiçbir şey
olmuyor, sebebini de göremiyor. Artık aynı şerit "Sıra rakibinizde." diyor (metin, sunucunun
`NOT_YOUR_TURN` kodu için zaten tanımlı olan çeviriden geliyor; yeni anahtar eklenmedi).

`game_state_restored` da temizliyor: yeniden bağlanmada tahta baştan kuruluyor, eldeki seçim
orada da bayat.

**Bu hata yeni değildi, yalnızca görünür oldu.** `move_error` daha önce kapalı modalın içine
yazıldığı için reddedilen hamleler sessizce düşüyordu; şerit eklenince aynı hata her
seferinde ekrana geldi. Tarayıcı doğrulamasında bunu bir kez ben de yaşayıp "çift gönderim
yarışı" diye yanlış yorumlamıştım.

### İzci görevi: düşman taşının kimliğini açma

Taş sayıları değişti: **İzci 4→2, Er 4→5, Bomba 3→4.** Net değişim sıfır — dizilim alanı
tam 40 kare olduğu için `PIECE_COUNTS` toplamı **40'ta kalmak zorunda**, bir taşı artırırken
başkasını azaltmak şart.

İzci artık sıradan bir rütbe-2 taşı değil, sınırlı bir **istihbarat** kaynağı. Kurallar
(`src/server.ts` → `case "scout"`):

| Kural | Davranış |
|---|---|
| Kim | Yalnızca İzci (`special === 'SCOUT'`) |
| Kaç kez | Her İzci ömründe **bir** kez (`scoutUsed`, taş başına) |
| Hedef | İzci ile **aynı satırdaki** herhangi bir düşman taşı |
| Göl | İzci ile hedef arasında göl varsa görüş kapalı |
| Orman | Hedef orman karesindeyse kimliği görülemez |
| Bedel | Görev **turu harcar** — hamle yerine geçer |
| Süre | Açılan taş oyun bitene ya da yenilene kadar açık kalır |

**Menzil sütunla sınırlanmadı, çünkü sınırlansaydı orman kuralı ölü kod olurdu.** İlk
uygulamada hedefi düşmanın dizilim sütunlarına (0-3 / 7-10) kısıtlamıştım; orman kareleri
ise yalnızca 4-6. sütunlarda. Menzil kontrolü orman kontrolüne sıra gelmeden reddediyordu,
yani `SCOUT_FOREST` dalına hiç girilemiyordu. Kural "aynı satırdaki herhangi bir düşman
taşı" olunca hem orman anlam kazanıyor hem de tarafsız banda ilerlemiş taşın kimliği
açılabiliyor — yeteneğin asıl değeri orada.

**İstihbarat gizli.** Açılan taşın koordinatı `scout_done` içinde **yalnızca görevi yapana**
gidiyor. Rakip de mesajı alıyor (turun geçtiğini bilmeli) ama `target`/`scout` alanları ona
gönderilmiyor — gönderilseydi kurban hangi taşının deşifre olduğunu öğrenip onu geri çeker,
istihbaratın bütün değeri kaçardı. Taşın `revealed` bayrağı da kurbanın görünümünü
değiştirmiyor: `buildBoardView(isOwn=true)` zaten her şeyi gösteriyor, yani sahibi taşının
deşifre olduğunu fark etmiyor. `scoutUsed` de aynı sebeple yalnızca kendi taşlarımızda
gönderiliyor.

Arayüzde hedefler **camgöbeği + göz ikonu** ile işaretli; hamle kareleri kehribar. İkisi aynı
renk olsaydı oyuncu saldırı sanıp turunu harcayabilirdi.

**Belirtilmemiş olup benim karar verdiğim iki nokta:** görevin tur harcaması ve her İzci'nin
bunu bir kez yapabilmesi. Gerekçe: bedeli olmasaydı oyunun ilk iki turunda iki İzci de
kullanılır, karar kalmazdı. İkisi de tek satırlık değişiklikle gevşetilebilir.

### Hamlenin nereye yapıldığı görünmüyordu

Rakip oynadığında tahtada ne değiştiğini fark etmek zordu: sade hamlelerde hiçbir işaret
yoktu. `lastCombatCoords` vardı ama o **yalnızca çarpışma olunca** doluyor (`combat-shake`
için), yani taş boş kareye ilerlediğinde hiçbir şey olmuyordu.

Eklenen: taşın **indiği** karede genişleyip sönen halka (`moveRipple`, 0,65 sn).

- Her `move_executed`'da çalışıyor — çarpışmalı da, sade hamle de.
- Halka hamleyi **yapanın takım rengini** alıyor (kırmızı kehribar, mavi gök mavisi), yani
  kimin oynadığı da belli oluyor. Takım bilgisi zaten sunucudan geliyor (`attackerTeam`).
- Kareden **taşarak** büyüyor; kapsayıcıda `overflow-hidden` yok. Böylece hareketin nereye
  olduğu komşu karelerden de ayırt ediliyor.
- `pointer-events-none` şart: yoksa söndüğü 0,65 sn boyunca o karenin tıklamasını yutar ve
  oyuncu yine "tıklama çalışmıyor" sanır.
- Durum 700 ms sonra temizleniyor. Temizlenmezse aynı kareye ikinci kez inildiğinde element
  DOM'da kaldığı için CSS animasyonu yeniden tetiklenmez.

Tarayıcıda iki taraf için de doğrulandı (kırmızı ve mavi hamlesi ayrı ayrı).

### Hamle hataları ekranda hiç görünmüyordu

`move_error` sunucudan geliyordu ama istemci onu yalnızca `onlineErrorMessage`'a yazıyordu —
o metin ise **sadece `OnlineModal` içinde** basılıyor ve oyun sırasında o modal kapalı.
Sunucu hamleyi reddediyor, ekranda hiçbir şey olmuyordu. Kullanıcıya "tıklama çalışmıyor"
gibi görünüyor.

Bu aynı tuzağın üçüncü kez tekrarı: "Yeniden Başlat" ve `room_error` da aynı sebeple
görünmüyordu (bkz. yukarıdaki bölümler). Ortak kök neden, **oyun sırasında kapalı olan bir
modalın içine geri bildirim yazmak**.

Düzeltme: `MoveErrorToast` — üstte, kendiliğinden kaybolan şerit.

- **Modal değil.** `ConnectionBanner` ile aynı gerekçe: hata oyuncunun kendi tıklamasının
  sonucu ve hemen tekrar denemesi gerekiyor, ekranı kilitlemek yanlış olurdu.
- **2,6 sn sonra kayboluyor**, kapatma düğmesi yok.
- Durum metinle birlikte bir **sayaç** tutuyor (`{ metin, no }`). Yalnızca metne bakılsaydı
  aynı reddi ikinci kez alan oyuncuda `useEffect` yeniden tetiklenmez, şerit canlanmaz ve
  hiç tepki yokmuş gibi olurdu.
- Bağlantı şeridi açıkken `top-24`'e iniyor; ikisi aynı anda çıkabiliyor (rakip kopmuşken
  hamle denemek gibi).
- `move_error` **artık `onlineErrorMessage`'a yazılmıyor**. Orada takılı kalıyordu: modal
  sonradan açıldığında çoktan geçmiş bir hamle hatası hâlâ duruyordu. Oda seviyesindeki
  hatalar (`room_error`) orada kalmaya devam ediyor — onlar zaten modalin konusu.

Metin çeviriden geçiyor: `TR_CODE` sunucunun `code` alanını `err<KOD>` anahtarına çeviriyor
ve 12 kodun hepsi dört dilde tanımlı. Bileşen bu yüzden `lang` almıyor, metni hazır alıyor.

Tarayıcıda doğrulandı: göl hamlesi → "Göl üzerine gidilemez.", 3 sn sonra kayboluyor, aynı
hata tekrar gelince süre sıfırlanıyor (2,2 sn'de tekrar gönderilip 3,8 sn'de hâlâ görünür
olduğu ölçüldü), ve EN'de "This piece cannot move." basılıyor.

### Adsız rakip "hiç katılmamış" sayılıyordu

Oyuncu adı **isteğe bağlı** ("Oyuncu Adınız (İsteğe Bağlı)"). Sunucu `getRoomState()`
içinde `redPlayer: r.players[0]?.name || null` yazıyor — yani **adsız oyuncunun adı da
`null`**. İstemci ise "rakip odaya girdi mi" sorusunu bu alana bakarak yanıtlıyordu:

```ts
if (rakipOyuncu === null) return 'OPPONENT_WAITING';   // App.tsx, onlineStatus
```

Sonuç: rakip adını yazmadan girdiyse, rastgele dizilip **Hazır**'a bassa bile karşı tarafta
"Rakip bekleniyor" yazıyordu. Dahası bu `null` kontrolü `PLAY` kontrolünden **önce** olduğu
için durum satırı **oyun boyunca** öyle kalıyordu — "Sıra sende / Sıra rakipte" hiç
görünmüyordu. `OnlineModal` da aynı alana bakıyordu: misafir satırı "Bekleniyor" kalıyor,
"⏳ Rakibinizin odaya katılması bekleniyor" bandı hiç kapanmıyordu.

Düzeltme: sunucu artık **varlığı addan ayrı** bildiriyor.

```ts
redPresent: !!r.players[0], bluePresent: !!r.players[1],   // slot dolu mu
redPlayer:  r.players[0]?.name || null,                    // yalnizca GORUNEN ad
```

İstemcinin üç yeri (`onlineStatus`, misafir satırı, bekleme bandı) `*Present` alanına
bağlandı. Ad boşsa ekranda takım etiketi (`t.playerRed` / `t.playerBlue`) basılıyor —
zaten amaçlanan davranış buydu.

`OnlineModal` `RoomState`'in **kendi kopyasını** tutuyordu; `types.ts`'teki tanımla
ayrışıyor ve sunucuya alan eklenince sessizce eskiyordu. Paylaşılan `RoomState` tipine
bağlandı.

Regresyon testi `test/oda-ayar-testi.mjs` senaryo 0'da: adsız oyuncunun **adı** `null`
gelirken **varlığı** `true`, boş slot ise `false`.

### Online çarpışma geçmişi yanlış bilgi basıyordu

`npm run test:carpisma` yazılırken çıktı: sunucudan gelen `combatResult`, panonun
beklediği `CombatResult`'a çevrilirken (`App.tsx`, `move_executed`) **yalnızca `name` ve
`rank`** dolduruluyordu. Eksik iki alanın üç ayrı sonucu vardı:

| Belirti | Sebep |
|---|---|
| Çarpışma geçmişinde **iki taş da** "2. Oyuncu" etiketiyle ve mavi renkte | `owner` hiç set edilmiyordu; `PlayerPanel` `owner === PLAYERS.RED` diye bakıyor, `undefined` hiçbir zaman tutmuyordu |
| İstihkamcı ve Casus mesajları **hiç görünmüyordu** | `special` hiç set edilmiyordu; `PlayerPanel` özel metni ona göre seçiyor |
| Ormanda gizlenen taş "Rütbe **0**" diye gösteriliyordu | `attackerRank ?? 0` — ama 0 gerçek bir rütbe (Bayrak) |

İkincisi kozmetik değildi: İstihkamcı bombayı aldığında ekranda **"İstihkamcı (Rütbe 1) >
Bomba (Rütbe 11) — Rütbesi büyük olan yendi"** yazıyordu. Kendi içinde çelişen, oyuncuya
kuralı yanlış öğreten bir cümle. Casus/Mareşal'de de aynısı.

Düzeltme üç parçalı:

- **Sunucu** `move_executed` içine `attackerTeam` ekliyor. İstemci bunu mesajdan
  çıkaramıyordu: `nextPhase` oyun bitince `GAME_OVER` oluyor ve sırayı kimin oynadığı
  kayboluyor.
- **Sunucu** `attackerSpecial` gönderiyor — ad/rütbe ile **aynı görünürlük koşuluna** bağlı.
  Özel yetenek de kimlik bilgisi: ormanda gizlenen taş için `"MINER"` sızsaydı rakip taşın
  İstihkamcı olduğunu anlardı. `test/carpisma-testi.mjs` bunu ayrıca ölçüyor.
- **İstemci** `owner`/`special` alanlarını dolduruyor, rütbeyi bilinmiyorsa `null`
  bırakıyor; `PlayerPanel` bilinmeyen rütbeyi `?` ile basıyor.

Bu arada `cP0`/`cP1` — her oyuncu için ayrı ayrı elle yazılmış iki ayna nesne — tek bir
`carpismaGorunumu(benSaldiran)` fonksiyonuna indirildi. Aynı görünürlük kuralını iki kez
yazmak, yeni alan eklenirken birini unutmaya davetiyeydi; nitekim `attackerSpecial`
eklenirken tam da bu olurdu. Refactor öncesi/sonrası davranış `test/carpisma-testi.mjs`
ile sabitlendi (her iki saldırı yönü + orman gizlemesi iki taraflı ölçülüyor).

**Ayrıca:** bayrağı **alan** oyuncuya `defenderName: null` gidiyor — `GAME_OVER` dalı
`targetPiece.revealed`'ı set etmeyen tek dal. Geçmişte "???" yazıyordu. Sunucuyu
değiştirmek yerine istemci bunu `outcome === 'GAME_OVER'` bilgisinden türetiyor: o sonuç
zaten yalnızca savunan Bayrak'ken üretiliyor, yani sunucudan fazladan bilgi almaya gerek yok.

### Müzik: mp3 yerine sentezlenmiş ses çalıyordu

v5'in `lib/soundFX.ts` dosyasında `game_music.mp3` **hiç kullanılmıyordu**;
`startBackgroundMusic()` Web Audio osilatörleriyle (`bassOsc` / `melOsc`) müzik üretiyordu —
"MIDI gibi" duyulmasının sebebi buydu. Dosya pakette duruyor ama çalınmıyordu.

Prosedürel müzik kaldırıldı, yerine `new Audio('/game_music.mp3')` ile döngülü çalma kondu.
`setVolume` artık `bgAudio.volume`'u da güncelliyor, `play()` promise'i `.catch()` ile
yakalanıyor (autoplay engeli sessiz hata vermesin diye). Ses varsayılan olarak **kapalı**
başlıyor; kullanıcı ses çubuğunu açınca çalmaya başlıyor.

**Kalan eksik:** `playSelect`, `playMove`, `playCombat`, `playExplosion`, `playVictory`
metotlarının tamamı **boş gövde** (`{}`) — yani ses efektlerinin hiçbiri çalışmıyor.
Uygulamaları v5 kaynağında hiç yok, yeniden yazılmaları gerekir.

### Prop uyuşmazlıkları — hepsi kapatıldı

`tsc --noEmit` artık **tamamen temiz**. Kapatılanlar:

| Bileşen | Neydi | Ne yapıldı |
|---|---|---|
| `SetupUI` | `onFinishSetup`/`onPieceSelect`/`selectedPieceName` gelmiyordu | çağrı adları düzeltildi; onay butonu ve elle taş seçimi çalışıyor |
| `OnlineModal` | `lang` arayüzde yok, panel hep Türkçe | `lang` prop'u eklendi, panel çeviriye bağlandı |
| `GameOverModal` | `gamePhase`/`lang`/`onClose` arayüzde yok | arayüze eklendi, başlık çevriliyor |
| `Board` | `lastCombatCoords` arayüzde yok, sarsıntı ölü | arayüze eklendi ve `Square`'e taşındı; `index.css`'teki `.combat-shake` sınıfı ilk kez gerçekten kullanılıyor |
| `App.tsx` | `PlacedPiece` → `PieceDefinition` state'ine atanıyordu | havuzdan bulunan `PieceDefinition` geçiliyor |

### 10×11 geçişinin gözden kaçan sonuçları

Dizilim alanlarını satırdan sütuna çevirirken **altı** kullanım yeri vardı; ilk turda
üçünü bulmuştum. Kalanlar farklı desen kullandığı için grep'e düşmedi ve hepsi sessiz
bozulmaya yol açıyordu:

- `handlePiecePlacement`: `{ start: 11, end: 14 }` satır kontrolü — 10 satırlık tahtada 11-14
  yok, yani **kırmızı için sürükleyerek/tıklayarak yerleştirme tamamen imkânsızdı**; mavi için
  de satır 0-3 kontrol edildiğinden rakip yarısına bırakılabiliyordu. Sütun bazlı yapıldı.
  Ayrıca engelleyici `alert()` kaldırıldı (alan dışına bırakma sessizce yok sayılıyor).
- `handleSquareClick` dizilim dalı: aynı satır kontrolü — **tıklayarak yerleştirme/değiştirme
  kırmızı için hiç çalışmıyordu.** Sütun bazlı yapıldı.
- `handleDragDrop`: aynı `{ start: 11, end: 14 }` satır kontrolü — **dizilim sırasında taşı
  sürükleyerek taşımak kırmızı için hiç çalışmıyordu**, mavi ise taşını rakip yarısına
  sürükleyebiliyordu. Sütun bazlı yapıldı. (Bu, ayarlar panosu işi sırasında bulundu; ilk iki
  turda gözden kaçmıştı.)

Ders: bu tür bir eksen değişikliğinde `BOARD_ROWS`/`BOARD_COLS` ve dizilim alanı kullanan
**her** yeri tek tek doğrulamak gerekiyor; `tsc` bu hataları yakalamıyor çünkü tipler doğru,
sadece değerler geçersiz.

## Higgsfield sürümünden ayrılan noktalar

- TanStack SSR sarmalayıcısı (`error-capture` / `error-page` / `server-entry`) kaldırıldı.
- iframe route dolayımı kaldırıldı; `/` doğrudan oyunu servis ediyor.
- `bindings.server.ts`'e elle binding ekleme adımı yerine `wrangler.toml`.
- `serializeAttachment` / `acceptWebSocket` **sırası düzeltildi.** Higgsfield sürümünde
  attachment kabul işleminden önce yazılıyordu; bu durumda attachment kalıcı olmuyor,
  `webSocketMessage` içinde `deserializeAttachment()` null dönüyor ve gelen bütün mesajlar
  sessizce düşüyordu — bağlantı kuruluyor ama hiçbir hamle işlenmiyordu.
- `PieceData` / `this.room` daralma sorunları giderildi, `npm run typecheck` temiz.

## Doğrulanan davranışlar

`node test/protokol-testi.mjs` şunları kontrol eder ve hepsi geçer:

- iki oyuncu bağlanıyor, takımlar doğru atanıyor
- `setup_complete` → `both_setup_complete` akışı çalışıyor
- **rütbe gizleme:** rakip taşlarında `rank`/`name` alanı yok, kendi taşlarında var
- sıra dışı hamle reddediliyor
- hareket edemeyen taş (Bayrak/Bomba) reddediliyor
- **yana hareket kabul ediliyor** (Higgsfield sürümünde bloke idi)
- geri hareket reddediliyor
- oda verisi DO depolamasında kalıcı (sunucu yeniden başlasa da oda duruyor)

`node test/carpisma-testi.mjs` çarpışma kurallarını ve **bilgi sızıntısını** ölçer (34 kontrol,
hepsi geçiyor). `resolveCombat` oyunun kalbi ama bugüne kadar otomatik testi yoktu:

- rütbe sıralaması her iki yönde (yüksek olan kazanır; zayıf saldıran ölür, savunan yerinde kalır)
- Bomba üzerine gelen normal taşı yok eder, kendisi sabit kalır
- İstihkamcı (MINER) rütbesi 1 olmasına rağmen Bombayı imha edip kareye geçer
- Casus **saldırdığında** Mareşal'i alır; Mareşal saldırdığında Casus ölür (kural tek yönlü)
- eşit rütbede ikisi de yaşar, saldıran eski karesine döner, ikisi de açığa çıkar
- Bayrak alınınca `GAME_OVER` + `reason: FLAG` iki tarafa da ulaşır

Sızıntı tarafı ayrı ölçülüyor, çünkü çarpışma sonucu her oyuncu için **ayrı** kurgulanıyor
(`cP0`/`cP1`, `server.ts:409-410`) ve oradaki tek bir yanlış koşul rakibin taşının rütbesini
sessizce sızdırır:

- açık alanda kazanan saldıran açığa çıkar (`attackerRank` karşı tarafa gider) — **kontrol grubu**
- ormanda kazanan saldıran gizli kalır: rakip `attackerName`/`attackerRank` olarak `null` alır,
  tahtada da `rank`/`name` alanı hiç yok
- ormanda kazanan savunan da gizli kalır: saldıran "kaybettim" bilgisini alır ama neye
  kaybettiğini öğrenemez (aynı çarpışma açık alanda Bombayı ele veriyor)

Orman senaryolarının açık alan kontrol grubu olması şart: yoksa gelen `null`, kural işlediği
için mi yoksa alan hiç doldurulmadığı için mi boş, ayırt edilemezdi.

Ayarlar panosu tarayıcıda elle doğrulandı:

- dört dilde tüm etiketler çevriliyor, `<html lang>` doğru (`tr`/`en`/`ja`/`ko`)
- sustur düğmesi %0 ↔ %50 arasında geçiyor, kaydıraç rozeti güncelliyor
- Online Oyun modalı açılıyor; Yeniden Başlat dizilimi sıfırlıyor (40/40 → 0/40)
- konsol temiz (uzantı gürültüsü dışında hata yok)
- panolar sağa alındıktan sonra tahtanın 10 satırı da tam görünüyor (alt kenar 825 ≤ 857)
- her iki pano da açılıp kapanıyor, kapalıyken gövde DOM'dan kalkıyor, başlıklar dört dilde
  çevriliyor (Ayarlar/Settings/設定/설정 — Oyun Bilgisi/Game Info/ゲーム情報/게임 정보)
- oyun başlayınca üç süre düğmesi de `disabled`, kilit notu görünüyor; Yeniden Başlat'tan
  sonra üçü de tekrar açılıyor
- tur kaçırma sayacı her süre dolumunda **bir** artıyor (çift artma yok) ve taraflar
  sırayla ilerliyor: 0/0 → 1/0 → 1/1 → 2/1 → 2/2 → 3/2 → 3/3
- tek taraf 3'e ulaştığında oyun **bitmiyor** (3/2'de oyun sürdü), 3/3'te bitiyor
- beraberlik modalı açılıyor ve açık kalıyor; dört dilde doğru ("BERABERE / DRAW /
  引き分け / 무승부", `{n}` yerine 3 basılıyor)
- modaldeki Yeniden Başlat: sayaçlar 0/0, süre ön ayarları tekrar açık, dizilim 0/40

Bu senaryo `FAST.turnTime` geçici olarak 3 sn'ye çekilerek koşuldu; sonra 15'e geri alındı.
Derleme özeti (`index-By0Ui6fM.js`) geçici değişiklik öncesiyle birebir aynı, yani geri alma
tam.

Panolar ve online akış (iki istemci, gerçek WebSocket) ayrıca elle doğrulandı:

- sayfa açılışında Ayarlar **açık**, Oyun Bilgisi **kapalı**
- kaçırma kutusu yerel modda görünüyor, online modda gizli (panonun geri kalanı duruyor)
- yerelde süre dolunca sayaç 0/0 → 1/0, süre ön ayarları oyun başlayınca `disabled`
- online: oda kur → katıl → iki taraf dizilim → oyun başlıyor
- online Yeniden Başlat: isteyende "rakibin onayı bekleniyor" popup'ı (Kapat düğmeli),
  karşı tarafta "rakip yeniden başlatma istedi" popup'ı (**Yeniden Başlat** düğmeli);
  onaydan sonra **iki taraf da** dizilime dönüyor (0/40), popup ikisinde de kapanıyor,
  oda kodu korunuyor; başlık şeridinde artık yazı yok
- oyun içi panelde süre ön ayarı ve dil seçici yok (sadece Online / Yeniden Başlat / ses)
- iki istemcide de konsol temiz

İki istemci **ayrı origin'de** açılmalı (`localhost` ve `127.0.0.1`): `astact_player_token`
localStorage'da ve origin başına ayrı tutuluyor. Aynı origin'de iki sekme açılırsa sunucu
ikinciyi aynı oyuncunun yeniden bağlanması sayar.

Giriş ekranı elle doğrulandı:

- açılışta menü; tahta (`.grid-cols-11`) DOM'da **hiç** yok
- Online Oyun → `OnlineModal` açılıyor, menüde kalınıyor; oda kurulunca oyuna geçiliyor;
  "Odayı Terk Et" menüye döndürüyor
- Ayarlar penceresi dört dilde çevrili (Ayarlar/Settings/設定/설정); süre ön ayarı ve ses
  menüde değiştirilip oyuna taşınıyor (Hızlı + %80 ile doğrulandı), menüde kilit yok
- alt yazı dört dilde doğru ve logonun boşluğuna oturuyor; EN (en uzun) 221px / 300px kap
- başlıkta kelime markası bandı dört dilde görünüyor, alt başlık altında
- müzik denemesi mount anında yapılıyor: **hiç tıklamadan** `game_music.mp3` çekiliyor;
  etkileşimden sonra `play`/`playing` olayları ses 0.5 ile tetikleniyor
- sekme başlığı "Astact — Strateji ve Taktik Savaşı", favicon `/favicon.svg` olarak bağlı
- `body` zemini `slate-950`, açılışta gri parlama yok
- oda kurulunca kod popup'ı açılıyor; rakip katılınca kendiliğinden kapanıyor; katılan
  oyuncuda hiç açılmıyor
- konsol temiz

Pano kopyalama otomasyonda doğrulanamıyor: `writeText` "Document is not focused" ile
reddediliyor (izin `granted`, bağlam güvenli) — ortam kısıtı, kod hatası değil. Yedek yol
(metni seçme) bu yüzden eklendi.

Rakip odaklı durum satırı da iki istemciyle uçtan uca doğrulandı:

| Adım | 1. Oyuncu | 2. Oyuncu |
|---|---|---|
| oda kuruldu, rakip yok | Rakip bekleniyor | — |
| rakip katıldı | Rakip taşlarını diziyor | Rakip taşlarını diziyor |
| yalnız 2. Oyuncu onayladı | Rakip hazır — seni bekliyor | Rakip taşlarını diziyor |
| ikisi de onayladı | Sıra sende | Sıra rakipte |
| sıra devretti | Sıra rakipte | Sıra sende |
| 2. Oyuncu sekmesi kapandı | Rakibin bağlantısı koptu | — |

Dört dilde de çevrili, konsol temiz.

**Bir kez tekrar etmeyen yanlış sonuç:** ilk denemede 2. Oyuncu dizilimi onayladığında
1. Oyuncu "Rakibin bağlantısı koptu" gördü. WebSocket trafiği kaydedilerek tekrarlanmaya
çalışıldı, aynı adımlarda çıkmadı — o turda gelen tek mesaj `player_setup_status` olmalıydı
ve o mesaj `connected` alanlarına dokunmuyor. Muhtemel sebep, önceki test turlarından kalan
bir soketin geç kapanıp `webSocketClose` → `player_connection_change` tetiklemesi.

Bu, sunucudaki bilinen bir yarış: aynı token'la yeniden bağlanıldığında ESKİ soketin
kapanması `disconnectedAt[slot]`'ı işaretliyor ve canlı bağlantıyı "kopuk" gösteriyor
(`server.ts` `webSocketClose`, slot'un hâlâ bağlı olup olmadığına bakmıyor). Bu değişiklik
o durumu ilk kez **görünür** kıldı, sebebi değil. Düzeltmek için `webSocketClose` içinde
kapanan soketin hâlâ aktif soket olup olmadığı kontrol edilmeli — ayrı bir iş.
