// Tas sayimi denetimi — client/lib/tasSayimi.ts'in birim testi.
//
// Neden gerekli: sayaclar oyuncuya SAYI soyluyor ("elinde 3 Yüzbaşı kaldi",
// "rakip 2 Er kaybetti"). Yanlis sayi, sayi olmamasindan kotudur — oyuncu ona
// gore karar veriyor. Mantik dort carpisma sonucunun kime ait olduguna dayaniyor
// ve orasi kolayca ters cevrilebiliyor (bu test yazilirken bir kez ters cevrildi:
// DEFENDER_WINS'te olen SALDIRANDIR, savunan degil).
//
// Diger testlerden farki: bu, sunucuya baglanmayan bir BIRIM testi. .ts dosyasi
// dogrudan import ediliyor; Node 22.18+ tipleri kendisi ayikliyor, ayri derleme
// adimi yok. (tasSayimi.ts bunun icin `import type` kullaniyor — degeri olan tek
// bir import bile olsa types.ts yuklenmek zorunda kalirdi.)
//
// Kullanim: node test/tas-sayimi-testi.mjs   (hata varsa exit 1)

import { kalanTaslarim, rakipKayiplari } from '../client/lib/tasSayimi.ts';

const KIRMIZI = '1. Oyuncu';
const MAVI = '2. Oyuncu';

let hata = 0;
const kontrol = (ad, beklenen, gercek) => {
  const a = JSON.stringify(beklenen), b = JSON.stringify(gercek);
  if (a === b) {
    console.log(`  GECTI  ${ad}`);
  } else {
    console.log(`  HATA   ${ad}`);
    console.log(`         beklenen: ${a}`);
    console.log(`         gercek:   ${b}`);
    hata++;
  }
};

// Tahtada gizli rakip taslari da owner ile duruyor ama ADSIZ geliyor; kendi
// sayimima girmemeli, ad'siz kayit tur sayimina eklenmemeli.
const tahta = [
  [{ owner: KIRMIZI, name: 'Er' }, null, 'LAKE', { owner: MAVI, name: 'Er' }],
  ['FOREST', { owner: KIRMIZI, name: 'Er' }, { owner: KIRMIZI, name: 'Casus' }, { owner: MAVI }],
];

console.log('=== 1) TAHTADAN SAYIM ===');
kontrol('kendi taslarim tur tur sayiliyor', { Er: 2, Casus: 1 }, kalanTaslarim(tahta, KIRMIZI));
kontrol('rakibin taslari kendi sayimima girmiyor', { Er: 1 }, kalanTaslarim(tahta, MAVI));
kontrol('adsiz (gizli) tas tur sayimina girmiyor', 1, Object.keys(kalanTaslarim(tahta, MAVI)).length);
kontrol('gol ve orman kareleri sayilmiyor', {}, kalanTaslarim(tahta, 'yok'));
kontrol('takim yoksa bos donuyor', {}, kalanTaslarim(tahta, null));

console.log('\n=== 2) RAKIP KAYIPLARI ===');
const k = (owner, name) => ({ owner, name });
const gecmis = [
  // Ben saldirdim ve kazandim -> olen SAVUNAN (mavi)
  { outcome: 'ATTACKER_WINS', attacker: k(KIRMIZI, 'Albay'), defender: k(MAVI, 'Teğmen') },
  // Rakip saldirdi, ben savundum ve kazandim -> olen SALDIRAN (mavi)
  { outcome: 'DEFENDER_WINS', attacker: k(MAVI, 'Er'), defender: k(KIRMIZI, 'Binbaşı') },
  // Rakip saldirdi ve kazandi -> olen BENIM tasim
  { outcome: 'ATTACKER_WINS', attacker: k(MAVI, 'Mareşal'), defender: k(KIRMIZI, 'Yüzbaşı') },
  // Ben saldirdim ve kaybettim -> olen BENIM tasim
  { outcome: 'DEFENDER_WINS', attacker: k(KIRMIZI, 'Er'), defender: k(MAVI, 'Mayın') },
  // Esit rutbe: IKISI DE oluyor -> rakip (mavi) Albay kayip sayilir
  { outcome: 'EQUAL_RANK', attacker: k(KIRMIZI, 'Albay'), defender: k(MAVI, 'Albay') },
  // Mayın patlamasi: ikisi de oluyor -> rakip taraf kayip sayilir
  { outcome: 'BOTH_LOSE', attacker: k(KIRMIZI, 'Er'), defender: k(MAVI, 'Mayın') },
  // Sancak dustu
  { outcome: 'GAME_OVER', attacker: k(KIRMIZI, 'Er'), defender: k(MAVI, 'Sancak') },
  // Kimligi bilinmeyen kayit atlanmali (uydurma sayim uretilmemeli)
  { outcome: 'ATTACKER_WINS', attacker: k(KIRMIZI, 'Er'), defender: k(MAVI, '???') },
];

const kirmiziGozuyle = rakipKayiplari(gecmis, KIRMIZI);
kontrol('rakip kayiplari dogru', { 'Teğmen': 1, 'Er': 1, 'Albay': 1, 'Mayın': 1, 'Sancak': 1 }, kirmiziGozuyle);
kontrol('esit rutbede rakip tasi kayip sayiliyor', 1, kirmiziGozuyle['Albay']);
kontrol('kendi kaybim rakip kaybi sayilmiyor', undefined, kirmiziGozuyle['Yüzbaşı']);
kontrol('bilinmeyen kimlik atlandi', undefined, kirmiziGozuyle['???']);

// AYNA: ayni gecmisi mavi okuyunca kirmizi kayiplari cikmali.
// DIKKAT: 1. kayitta olen mavi savunan, 2. kayitta olen mavi saldiran — ikisi de
// mavinin KENDI kaybi. Geriye 3. (kirmizi savunurken oldu) ve 4. (kirmizi
// saldirirken oldu) kaliyor. Esit rutbede kirmizi Albay, BOTH_LOSE'da kirmizi Er
// de rakip kaybi olarak ekleniyor (kural: ikisi de oyundan cikar).
kontrol('ayna: mavinin gozunden kirmizi kayiplari', { 'Yüzbaşı': 1, 'Er': 2, 'Albay': 1 }, rakipKayiplari(gecmis, MAVI));
kontrol('gecmis bossa bos donuyor', {}, rakipKayiplari([], KIRMIZI));

console.log(hata === 0 ? '\n=== TAS SAYIMI DENETIMI TEMIZ ===' : `\n=== ${hata} BULGU ===`);
process.exit(hata === 0 ? 0 : 1);
