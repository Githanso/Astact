// Astact — tas dagilimi testi.
//
// Iki soru soruyor:
//   1) Istemcideki PIECE_COUNTS ile sunucudaki SUNUCU_TAS_SAYILARI BIREBIR ayni
//      mi ve toplamlari 40 mi?
//   2) Sunucu gercekten bu dagilimi mi diziyor?
//
// Neden gerekli: tablo IKI yerde yazili ve ayrisirsa hata SESSIZ. Oyuncunun
// havuzunda 7 Er varken sunucunun tablosunda 3 kalirsa, dizilim suresi dolan
// oyuncuya sunucu farkli bir ordu diziyor. Toplam 40'i asarsa fazla tas hic
// tahtaya cikmiyor: dizilim alani 4 sutun x 10 satir = 40 kare ve
// rastgeleDizilimUret bos kare kalmayinca kalani atiyor — hangi tasin dustugu
// karistirma sirasina bagli oldugu icin ayni tabloyla her oyunda baska bir tas
// eksiliyor. ("Bir tasim eksik" hatasi bir kez tam olarak boyle yasandi.)
//
// Mevcut testler bunu YAKALAMIYORDU: dizilim-saati testi yalnizca "40 tas var"
// diyor, yani toplami 40 tutan yanlis bir tablo (ornegin Er 6 / Mayın 7) tum
// testlerden geciyordu.
//
// Test SAYI EZBERLEMIYOR. Beklenen dagilim koddaki tablodan okunuyor; sayilar
// degistiginde test kendiliginden uyum sagliyor, denetledigi sey "iki tablo ve
// sunucunun davranisi birbiriyle tutarli mi" sorusu.
//
// Tablolar kaynaktan METIN olarak okunuyor. src/server.ts bir Worker modulu
// ("cloudflare:workers" import ediyor), Node'da import edilemez; client/
// constants.ts ise types.ts'teki enum yuzunden Node'un tip ayiklamasindan
// gecmiyor (bkz. tas-sayimi-testi.mjs). Ikisini de ayni yoldan okumak simetrik
// ve i18n-denetim.mjs zaten ayni idiomu kullaniyor.
//
// 2. bolum dev sunucusu gerektirir.
//   node test/tas-dagilimi-testi.mjs
//   ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room node test/tas-dagilimi-testi.mjs

import { readFileSync } from 'node:fs';

const BASE = process.env.ASTACT_WS || 'ws://127.0.0.1:8787/ws/game-room';
// Testler 3 dakika bekleyemez: odayi KURAN baglanti ?setupMs= ile dizilim
// suresini kisaltiyor. Sunucunun MIN_SETUP_TIME_MS siniri (5sn) uzerinde olmali.
const DIZILIM_MS = 6000;
// Dizilim alani: 4 sutun x BOARD_ROWS(10) satir. Tablonun toplami bunu ASAMAZ.
const DIZILIM_KARE = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let hata = 0;
const check = (ok, etiket, ek = '') => {
  console.log(`  ${ok ? 'GECTI' : 'KALDI'}  ${etiket}${ek ? ' ' + ek : ''}`);
  if (!ok) hata++;
};

const koke = (p) => new URL('../' + p, import.meta.url);

// `const AD ... = { ... };` govdesini cikarir.
function govdeOku(dosya, degisken) {
  const kaynak = readFileSync(koke(dosya), 'utf8');
  const m = kaynak.match(new RegExp(`${degisken}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`${dosya} icinde ${degisken} bulunamadi`);
  return m[1];
}

// 'ad': sayi ciftleri — sayi tablolari icin (PIECE_COUNTS, SUNUCU_TAS_SAYILARI).
function tabloOku(dosya, degisken) {
  const tablo = {};
  for (const m of govdeOku(dosya, degisken).matchAll(/['"]([^'"]+)['"]\s*:\s*(\d+)/g)) tablo[m[1]] = Number(m[2]);
  return tablo;
}

// Yalnizca anahtarlar — degeri NESNE olan tablolar icin (SUNUCU_TAS_TANIMLARI).
// Nesne icindeki `special: "SCOUT"` gibi tirnakli DEGERLER elenir: desen tirnaktan
// sonra iki nokta bekliyor, "SCOUT"'u virgul/kapanis izliyor.
function adlariOku(dosya, degisken) {
  return [...govdeOku(dosya, degisken).matchAll(/['"]([^'"]+)['"]\s*:/g)].map((m) => m[1]);
}

console.log('=== 1) iki tablo ayni mi (sunucu baglantisi gerekmez) ===');
const istemci = tabloOku('client/constants.ts', 'PIECE_COUNTS');
const sunucu = tabloOku('src/server.ts', 'SUNUCU_TAS_SAYILARI');

const adlar = [...new Set([...Object.keys(istemci), ...Object.keys(sunucu)])].sort();
check(adlar.length > 0, 'tablolar okunabildi', `(${adlar.length} tas turu)`);
for (const ad of adlar) {
  check(istemci[ad] === sunucu[ad], `${ad} ayni`, `(istemci ${istemci[ad] ?? '-'} / sunucu ${sunucu[ad] ?? '-'})`);
}

const topla = (t) => Object.values(t).reduce((a, b) => a + b, 0);
check(topla(istemci) === DIZILIM_KARE, `istemci toplami ${DIZILIM_KARE}`, `(${topla(istemci)})`);
check(topla(sunucu) === DIZILIM_KARE, `sunucu toplami ${DIZILIM_KARE}`, `(${topla(sunucu)})`);

// Tabloda tanimi olmayan bir ad = hayalet tas: rastgele dizilim SUNUCU_TAS_TANIMLARI'ndan
// rutbe/ozellik okuyor, ad yazim hatasiysa undefined donup tas bozuk uretiliyor.
const tanimlar = adlariOku('src/server.ts', 'SUNUCU_TAS_TANIMLARI');
const tanimsiz = adlar.filter((a) => !tanimlar.includes(a));
check(tanimsiz.length === 0, 'her tasin sunucuda tanimi var', tanimsiz.length ? `(eksik: ${tanimsiz.join(', ')})` : '');

console.log('\n=== 2) sunucu bu dagilimi mi diziyor ===');
console.log(`  (iki oyuncu da dizmiyor, dizilim suresi ${DIZILIM_MS / 1000}sn sonra doluyor)`);

function connect(url) {
  const ws = new WebSocket(url);
  ws.messages = [];
  ws.addEventListener('message', (e) => ws.messages.push(JSON.parse(e.data)));
  return new Promise((res, rej) => {
    ws.addEventListener('open', () => res(ws));
    ws.addEventListener('error', rej);
  });
}
const waitFor = async (ws, type, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = ws.messages.find((x) => x.type === type);
    if (m) return m;
    await sleep(50);
  }
  return null;
};
// Tahta gorunumundeki taslari ada gore sayar. Bos kareler null, arazi kareleri
// "LAKE"/"FOREST" — yalnizca nesne olanlar tas.
const sayim = (board) => {
  const o = {};
  for (const kare of (board || []).flat()) {
    if (kare && typeof kare === 'object' && kare.name) o[kare.name] = (o[kare.name] ?? 0) + 1;
  }
  return o;
};

const oda = 'TAK-' + Math.random().toString(36).slice(2, 6).toUpperCase();
const tok = Date.now();
let p1, p2;
try {
  p1 = await connect(`${BASE}?room=${oda}&name=P1&token=a${tok}&setupMs=${DIZILIM_MS}`);
  await sleep(300);
  p2 = await connect(`${BASE}?room=${oda}&name=P2&token=b${tok}`);
} catch (e) {
  console.log(`  KALDI  sunucuya baglanilamadi (${BASE}) — dev sunucusu ayakta mi?`);
  process.exit(1);
}

// myPieces yalnizca KENDI taslarini ad/rutbe ile tasiyor (rakibinki gizli), bu
// yuzden dagilim her iki oyuncunun kendi gorunumunden ayri ayri sayiliyor.
const bs1 = await waitFor(p1, 'both_setup_complete', DIZILIM_MS + 10000);
const bs2 = await waitFor(p2, 'both_setup_complete', 3000);
check(!!bs1 && !!bs2, 'dizilim suresi dolunca oyun basladi (iki oyuncu da both_setup_complete aldi)');

for (const [etiket, mesaj] of [['P1', bs1], ['P2', bs2]]) {
  const s = sayim(mesaj?.myPieces);
  check(topla(s) === DIZILIM_KARE, `${etiket} tahtasinda ${DIZILIM_KARE} tas`, `(${topla(s)})`);
  const yanlis = adlar.filter((ad) => (s[ad] ?? 0) !== istemci[ad]);
  check(yanlis.length === 0, `${etiket} dagilimi tabloyla ayni`,
    yanlis.length ? `(${yanlis.map((a) => `${a} ${s[a] ?? 0}/${istemci[a]}`).join(', ')})` : '');
  const fazla = Object.keys(s).filter((a) => !adlar.includes(a));
  check(fazla.length === 0, `${etiket} tahtasinda tabloda olmayan tas yok`, fazla.length ? `(${fazla.join(', ')})` : '');
}

p1.close(); p2.close();
console.log(hata === 0 ? '\n=== SONUC: TUM KONTROLLER GECTI ===' : `\n=== SONUC: ${hata} KALDI ===`);
process.exit(hata === 0 ? 0 : 1);
