# Astact — arayüz grafik envanteri

Oyunun arayüzünde görünen **her grafik** burada tek tek SVG olarak duruyor: 56 dosya.
Hepsi vektör, ölçeklenebilir, metin editöründe açılıp rengi değiştirilebilir.

`onizleme.html` dosyasını tarayıcıda aç — hepsini tek sayfada gösterir.

| Klasör | Ne var | Adet |
|---|---|---|
| `ikonlar/` | Arayüzdeki tüm ikonlar (lucide-react) | 31 |
| `taslar/` | Oyun taşı görünümleri | 8 |
| `tahta/` | Tahta kareleri, arazi, hamle işaretleri | 15 |
| `marka/` | Logo ve favicon | 2 |

---

## `ikonlar/` — 31 ikon

Kaynak: **lucide-react v1.27.0**, ISC lisansı (`ikonlar/LISANS-lucide.txt`). Dosyalar
paketin ikon verisinden birebir üretildi, elle çizilmedi.

Hepsi 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`. **Rengi
`currentColor`'dan alıyorlar** — CSS'te `color` verirsen ikon o renge döner. Sabit renk
istersen `stroke="currentColor"` yerine renk kodu yaz.

| Dosya | Nerede kullanılıyor |
|---|---|
| `bar-chart-2.svg` | StatsModal (şu an arayüzden erişilemiyor) |
| `bomb.svg` | Taş — Bomba |
| `check.svg` | OnlineModal, RoomCodeModal — "kod kopyalandı" |
| `check-circle-2.svg` | SetupUI — Dizilimi Onayla |
| `chevron-down.svg` / `chevron-up.svg` | PlayerPanel, SettingsPanel — pano aç/kapa |
| `clock.svg` | PlayerPanel — tur saati |
| `copy.svg` | OnlineModal, RoomCodeModal — kodu kopyala |
| `eye.svg` | Square — İzci hedefi işareti |
| `flag.svg` | Taş — Bayrak |
| `globe.svg` | SettingsPanel — dil seçici |
| `hourglass.svg` | ConnectionBanner, RestartNoticeModal — bekleniyor |
| `info.svg` | PlayerPanel — "Oyun Bilgisi" başlığı |
| `lock.svg` | SettingsControls — süre ön ayarı kilidi |
| `log-out.svg` | OnlineModal — Odayı Terk Et |
| `rotate-ccw.svg` | SettingsPanel, RestartNoticeModal — Yeniden Başlat |
| `send.svg` | OnlineModal — Odaya Katıl |
| `settings.svg` | MenuScreen, MenuSettingsModal, SettingsPanel — Ayarlar |
| `shield.svg` | Kapalı taşın sırtı, OnlineModal oyuncu rozeti |
| `shield-alert.svg` | PlayerPanel, MoveErrorToast — hata şeridi |
| `shuffle.svg` | SetupUI — Rastgele Diz |
| `sparkles.svg` | OnlineModal — Yeni Oda Oluştur |
| `swords.svg` | PlayerPanel — çarpışma geçmişi |
| `trash-2.svg` | SetupUI — Temizle |
| `trophy.svg` | PlayerPanel — galibiyet sayacı |
| `users.svg` | MenuScreen, OnlineModal, SettingsPanel — Online Oyun |
| `volume-2.svg` / `volume-x.svg` | SettingsControls, StatsModal — ses açık / sustur |
| `wifi.svg` / `wifi-off.svg` | ConnectionBanner, OnlineModal — bağlantı durumu |
| `x.svg` | Modalların kapat düğmesi |

`User` ikonu `Piece.tsx`'te **import edilmiş ama hiç kullanılmıyor**, o yüzden buraya
alınmadı (ölü import — istersen kodda temizlenebilir).

---

## `taslar/` — 8 taş

100×100, `Piece.tsx`'in birebir karşılığı: yuvarlatılmış kare, üstten alta gradyan,
2px kenarlık, ortada rütbe + ad.

| Dosya | Ne |
|---|---|
| `tas-kirmizi.svg` / `tas-mavi.svg` | Normal taş (örnek: 10 / MAREŞAL) |
| `tas-kirmizi-bayrak.svg` / `tas-mavi-bayrak.svg` | Bayrak — rütbe yerine bayrak ikonu |
| `tas-kirmizi-bomba.svg` / `tas-mavi-bomba.svg` | Bomba — rütbe yerine bomba ikonu |
| `tas-kapali-kirmizi.svg` / `tas-kapali-mavi.svg` | Rakibin gizli taşı (kalkan sırtı) |

Normal taştaki **rütbe ve ad metin olarak duruyor**, dosyayı açıp `<text>` içeriğini
değiştirerek istediğin taşı üretebilirsin (`10` → `7`, `MAREŞAL` → `BİNBAŞI`).

---

## `tahta/` — 15 parça

| Dosya | Ne |
|---|---|
| `kare-acik.svg` / `kare-koyu.svg` | Satranç deseninin iki karesi |
| `orman-karesi.svg` | Orman karesi — üç katman ağaç, `ForestOverlay` düzeni |
| `gol-karesi.svg` | Göl karesi — köşegen gradyan, su parlaması, sazlık |
| `agac-arka-1/2`, `agac-orta-1/2`, `agac-on-1/2` | Orman karesindeki altı ağaç, tek tek |
| `isaret-hamle.svg` | Gidilebilir kare — kehribar çerçeve + nokta |
| `isaret-secili.svg` | Seçili taşın karesi — kalın kehribar çerçeve |
| `isaret-izci.svg` | İzci hedefi — camgöbeği çerçeve + göz ikonu |
| `halka-kirmizi.svg` / `halka-mavi.svg` | Hamle sonrası genişleyen halka |

Ağaç yolları `ForestOverlay.tsx`'ten **birebir kopyalandı**, yeniden çizilmedi.

Kare ve arazi dosyalarında altta uygulamanın zemini (`#020617`) var, böylece dosyayı tek
başına açtığında oyundaki gibi görünüyor. Şeffaf isteyen o alttaki `<rect>`'i silebilir.

---

## `marka/` — 2 dosya

`logo.svg` ve `favicon.svg` — `astact-cf/public/` içindeki dosyaların kopyası, dokunulmadı.
Kaynakta değişirlerse buradakiler eskir.

---

## Renk paleti

Arayüzün tamamı Tailwind renklerinden kuruldu. Yeni grafik üretirken bunları kullan:

| Kullanım | Renk | Kod |
|---|---|---|
| Zemin | slate-950 | `#020617` |
| Tahta karesi | slate-800 (%80 / %50) | `#1e293b` |
| Kare kenarı | slate-700 (%30) | `#334155` |
| Kırmızı taş | red-800 → red-950 | `#991b1b` → `#450a0a` |
| Kırmızı taş kenarı | amber-500 (%80) | `#f59e0b` |
| Kırmızı taş yazısı | amber-100 | `#fef3c7` |
| Mavi taş | blue-800 → blue-950 | `#1e40af` → `#172554` |
| Mavi taş kenarı | sky-400 (%80) | `#38bdf8` |
| Mavi taş yazısı | sky-100 | `#e0f2fe` |
| Kapalı taş gövdesi | slate-900 | `#0f172a` |
| Vurgu / hamle | amber-300/400 | `#fcd34d` / `#fbbf24` |
| İzci hedefi | cyan-200/300/400 | `#a5f3fc` / `#67e8f9` / `#22d3ee` |
| Orman | emerald-600…950, green-700/950 | `#059669` … `#022c22` |
| Ağaç gövdesi | amber-900/950 | `#78350f` / `#451a03` |
| Göl | cyan-900 → blue-900 → indigo-950 | `#164e63` → `#1e3a8a` → `#1e1b4b` |

Yazı tipi: ayrı bir font yüklenmiyor, Tailwind'in varsayılan sistem yığını kullanılıyor
(`ui-sans-serif, system-ui, Segoe UI, Roboto, …`). Taş dosyalarında da aynı yığın yazılı.

---

## Bilerek dışarıda bırakılanlar

- **Animasyonlar.** Sallanma, titreme, halka büyümesi, nabız gibi hareketler CSS keyframe
  (`client/index.css`) — statik SVG'ye girmiyor. Halka ve işaretler burada durgun hâlleriyle var.
- **Konfeti.** `canvas-confetti` kütüphanesi çalışma anında canvas'a çiziyor, dosyası yok.
- **Gradyan/gölge katmanları.** Panel ve düğme arka planları saf CSS (Tailwind sınıfı),
  bağımsız bir grafik dosyası değiller.
