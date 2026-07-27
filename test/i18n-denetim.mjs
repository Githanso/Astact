// i18n denetimi — sabit Turkce metin ve cevrilmemis degisken basimi arar.
//
// Neden gerekli: "Turkce karakter iceren satir" aramak YETMIYOR. Uc ayri sizinti
// bu yuzden gozden kacti:
//   1) `1. Oyuncu:` gibi tamami ASCII olan metinler,
//   2) `{p.name}` gibi degisken basimlari (metin degil, deger),
//   3) `{winner}` gibi Player degeri basimlari.
// Bu script ucunu birden tarar.
//
// Kullanim: node test/i18n-denetim.mjs   (hata varsa exit 1)

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const CLIENT = new URL('../client/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const files = [
  'App.tsx',
  ...readdirSync(join(CLIENT, 'components')).filter(f => f.endsWith('.tsx')).map(f => join('components', f)),
];

// Protokol kimligi olan degerler — CEVRILMEMELI, denetimde gormezden gelinir.
const KIMLIK = [/PLAYERS\./, /'Bomba'/, /'Bayrak'/, /localStorage/, /astact_player_token/,
  /'1\. Oyuncu'\s*\|/, /:\s*'1\. Oyuncu'/];  // Player tip literali = protokol kimligi

// Sabit Turkce metin isaretleri: hem ozel karakterler hem ASCII kelimeler.
const TR_KARAKTER = /[çğıöşüÇĞİÖŞÜ]/;
// DIKKAT: `i` bayragi sart. Desen buyuk/kucuk harfe duyarliyken 'ODA KODUNU KOPYALA'
// gibi TAMAMI BUYUK sabit metinler eleğe takilmiyordu — OnlineModal'daki kopyala
// dugmesi bu yuzden dort dilde de Turkce kalmisti.
const TR_KELIME = /\b(Oyuncu|Oda|Kod|Kodu|Tas|Taş|Hazir|Hazır|Diz|Dizilim|Sira|Sıra|Yeniden|Kapat|Bekleniyor|Kazanan|Siz|Temizle|Rastgele|Rutbe|Rütbe|Sure|Süre|Baslat|Başlat|Kopyala|Kopyalandi|Kopyalandı)\b/i;

// Çevrilmemiş değişken basımı: JSX içinde bu değerler doğrudan basılmamalı.
// Taş adları getPieceLabel(), oyuncu adları t.playerRed/t.playerBlue üzerinden gitmeli.
// İsteğe bağlı zincir (`a?.name`) ve indeksleme (`a[0].name`) de yakalanır — düz
// `[A-Za-z]+\.name` deseni bunları kaçırıyordu.
const YOL = String.raw`[A-Za-z_$][\w$]*(?:\??\.[\w$]+|\[[^\]]*\])*`;
const CIG_DEGISKEN = new RegExp(
  String.raw`\{\s*(?:winner|currentPlayer|playerTeam|myOnlineTeam|${YOL}\??\.(?:owner|name))\s*\}`
);

let hata = 0;
const bildir = (dosya, no, satir, sebep) => {
  console.log(`  ${dosya}:${no}  [${sebep}]`);
  console.log(`      ${satir.trim().slice(0, 120)}`);
  hata++;
};

// Bir satırdaki yorumları siler. Blok yorumu satırlar arasına yayılabildiği için
// tarama satır satır YAPILAMAZ: `{/* birinci satır` ... `ikinci satır */}` deseninde
// ikinci satır `*` ile başlamaz, kodmuş gibi görünür ve Türkçe alarmı verir.
// `blokta` bayrağı dosya boyunca taşınır.
const yorumlariSil = (satir, durum) => {
  let kalan = '';
  let i = 0;
  while (i < satir.length) {
    if (durum.blokta) {
      const kapanis = satir.indexOf('*/', i);
      if (kapanis === -1) return { metin: kalan, durum };
      durum.blokta = false;
      i = kapanis + 2;
      continue;
    }
    const acilis = satir.indexOf('/*', i);
    // DİKKAT: `$` kullanma. Dosyaların bir kısmı CRLF; `.` satır sonundaki \r'yi
    // eşlemez, `$` orada tutmaz ve yorum HİÇ silinmez. [^\r\n]* bunu aşar.
    // (?<!:) → "wss://" gibi protokolleri kesmesin.
    const satirYorumu = satir.slice(i).search(/(?<!:)\/\//);
    const satirYorumuMutlak = satirYorumu === -1 ? -1 : i + satirYorumu;

    if (satirYorumuMutlak !== -1 && (acilis === -1 || satirYorumuMutlak < acilis)) {
      return { metin: kalan + satir.slice(i, satirYorumuMutlak), durum };
    }
    if (acilis === -1) return { metin: kalan + satir.slice(i), durum };
    kalan += satir.slice(i, acilis);
    durum.blokta = true;
    i = acilis + 2;
  }
  return { metin: kalan, durum };
};

for (const rel of files) {
  const metin = readFileSync(join(CLIENT, rel), 'utf8').split('\n');
  const durum = { blokta: false };
  metin.forEach((satir, i) => {
    const no = i + 1;
    const yorumsuz = yorumlariSil(satir, durum).metin;
    const s = yorumsuz.trim();
    if (!s) return;
    if (KIMLIK.some(re => re.test(satir))) return;
    if (/t\.[a-zA-Z]+|TRANSLATIONS|getPieceLabel/.test(satir)) return;

    // key= React anahtarı, ekrana gitmez; ayrıca prop={değer} bir NİTELİK geçişidir,
    // ekrana basım değil.
    const anahtarsiz = yorumsuz
      .replace(/key=\{[^}]*\}/g, '')
      .replace(/[A-Za-z][A-Za-z0-9]*=\{[^}]*\}/g, '');

    if (TR_KARAKTER.test(anahtarsiz) || TR_KELIME.test(anahtarsiz)) {
      bildir(rel, no, satir, 'sabit Turkce metin');
      return;
    }
    if (CIG_DEGISKEN.test(anahtarsiz) && !/id:|`\$\{/.test(anahtarsiz)) {
      bildir(rel, no, satir, 'cevrilmemis deger basimi');
    }
  });
}

// TRANSLATIONS anahtar butunlugu: dort dilde ayni anahtar kumesi olmali
const tumSabitler = readFileSync(join(CLIENT, 'constants.ts'), 'utf8');
// DIKKAT: dosyada iki ayri `TR: {` var (PIECE_LABELS ve TRANSLATIONS).
// Ayristirmayi TRANSLATIONS tanimindan SONRASI ile sinirla.
const sabitler = tumSabitler.slice(tumSabitler.indexOf('export const TRANSLATIONS'));
const bloklar = {};
for (const L of ['TR', 'EN', 'JA', 'KO']) {
  // Son blok (KO) sondaki virgul olmadan kapaniyor; dosya ayrica CRLF kullaniyor.
  const m = sabitler.match(new RegExp(`\\r?\\n  ${L}: \\{([\\s\\S]*?)\\r?\\n  \\},?\\r?\\n`));
  if (!m) { bloklar[L] = new Set(); continue; }
  // DIKKAT: bir satirda birden fazla anahtar olabiliyor
  // (`restartButton: '...', statsButton: '...',`). Satir basina cakili bir desen
  // yalnizca ILKINI sayar ve satir ici anahtarlarin eksigini hic goremez.
  // Once metin degerlerini sil (icindeki `Oda:` gibi iki nokta yanilticidir),
  // sonra kalan her `anahtar:` eslesmesini al.
  const degersiz = m[1].replace(/'(?:[^'\\]|\\.)*'/g, "''");
  bloklar[L] = new Set([...degersiz.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)].map(x => x[1]));
}
const temel = bloklar.TR;
console.log(`\nTRANSLATIONS anahtar sayisi: TR=${temel.size} EN=${bloklar.EN.size} JA=${bloklar.JA.size} KO=${bloklar.KO.size}`);
for (const L of ['EN', 'JA', 'KO']) {
  const eksik = [...temel].filter(k => !bloklar[L].has(k));
  const fazla = [...bloklar[L]].filter(k => !temel.has(k));
  if (eksik.length) { console.log(`  ${L} dilinde EKSIK: ${eksik.join(', ')}`); hata++; }
  if (fazla.length) { console.log(`  ${L} dilinde FAZLA: ${fazla.join(', ')}`); hata++; }
}

console.log(hata === 0 ? '\n=== i18n DENETIMI TEMIZ ===' : `\n=== ${hata} BULGU ===`);
process.exit(hata === 0 ? 0 : 1);
