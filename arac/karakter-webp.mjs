// Karakter gorsellerini oyunun servis ettigi bicime cevirir.
//
//   node arac/karakter-webp.mjs <kaynak-klasoru>
//   npm run karakter:webp -- <kaynak-klasoru>
//
// KAYNAK: Illustrator'dan cikan .svg dosyalari. Bunlar gercek vektor DEGIL —
// 1024x1536 PNG'ler base64 olarak SVG'ye gomulu, dosya basi ~3 MB. Kaynaklar
// public/ ALTINDA DURMAMALI: wrangler public/'in tamamini servis ediyor, orada
// birakilirsa 40 MB'lik ham dosya hem deploy'a hem repoya giriyor.
//
// CIKTI: public/assets/characters/<ad>.webp, 384x384. Oyun bunlari okuyor
// (client/constants.ts -> getPieceArt).
//
// ── DEGISTIRILMEMESI GEREKEN KURAL ─────────────────────────────────────────
// Gomulu PNG DOGRUDAN kucultulmez. Once SVG'nin viewBox kompozisyonu birebir
// yeniden kurulur: PNG, <image> etiketindeki `scale` ile olceklenip `translate`
// ile ayni yere konur, viewBox boyutunda bir tuvale basilir, tuval sonra hedef
// boyuta indirilir.
//
// Sebep: figurlerin ortak taban cizgisi ve rutbeye gore artan boy hiyerarsisi o
// transform'un icinde yasiyor. PNG'yi dogrudan olceklemek bu iki seyi de bozar —
// figurler karelerde farkli yuksekliklerde durur (bu hata bir kez yasandi).
// ───────────────────────────────────────────────────────────────────────────
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const HEDEF = 384;   // tas 79 px cizilyor, hover'da (scale-200) 158 px, 2x ekranda 316 px
const CIKTI_DIZIN = path.resolve('public/assets/characters');
const SEFFAF = { r: 0, g: 0, b: 0, alpha: 0 };

// Ortak zemin cizgisi kurali INSAN FIGURLERI icin. Bu listedekiler figur degil,
// yerdeki nesne: zemin cizgisine oturtulunca karenin dibinde kaliyorlar, o yuzden
// kendi karelerinin tam ortasina alinirlar.
const ORTALANACAK = new Set(['mayin']);

const kaynakDizin = process.argv[2];
if (!kaynakDizin) {
  console.error('Kullanim: node arac/karakter-webp.mjs <kaynak-klasoru>');
  console.error('Ornek   : node arac/karakter-webp.mjs ../astact-kaynak/askerler');
  process.exit(1);
}

const dosyalar = (await readdir(kaynakDizin)).filter(f => f.toLowerCase().endsWith('.svg')).sort();
if (dosyalar.length === 0) {
  console.error(`${kaynakDizin} icinde .svg yok.`);
  process.exit(1);
}
await mkdir(CIKTI_DIZIN, { recursive: true });

// Alfa sinir kutusu — hem dogrulama hem ortalama icin.
async function sinirKutusu(tampon) {
  const { data, info } = await sharp(tampon).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x1 = info.width, x2 = -1, y1 = info.height, y2 = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] >= 8) {
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
  return { x1, x2, y1, y2, en: x2 - x1 + 1, boy: y2 - y1 + 1, W: info.width, H: info.height };
}

let toplamOnce = 0, toplamSonra = 0;
const rapor = [];

for (const dosya of dosyalar) {
  const ad = path.basename(dosya, path.extname(dosya));
  const metin = await readFile(path.join(kaynakDizin, dosya), 'utf8');
  toplamOnce += Buffer.byteLength(metin);

  const vbEsleme = metin.match(/viewBox="([\d.\-\s]+)"/);
  if (!vbEsleme) { console.error(`${dosya}: viewBox yok, atlandi`); continue; }
  const [, , kutuW, kutuH] = vbEsleme[1].trim().split(/\s+/).map(Number);

  const imgBas = metin.indexOf('<image');
  if (imgBas < 0) { console.error(`${dosya}: <image> yok, atlandi`); continue; }
  const imgEtiket = metin.slice(imgBas, imgBas + 600);
  const olcek = Number((imgEtiket.match(/scale\(([\d.\-]+)\)/) || [, 1])[1]);
  const tEsleme = imgEtiket.match(/translate\(([\d.\-]+)[\s,]+([\d.\-]+)\)/);
  const tx = tEsleme ? Number(tEsleme[1]) : 0;
  const ty = tEsleme ? Number(tEsleme[2]) : 0;

  const b64Bas = metin.indexOf('base64,');
  if (b64Bas < 0) { console.error(`${dosya}: gomulu resim yok, atlandi`); continue; }
  const png = Buffer.from(metin.slice(b64Bas + 7, metin.indexOf('"', b64Bas)).replace(/\s/g, ''), 'base64');

  // 1) viewBox kompozisyonunu yeniden kur
  const ust = await sharp(png).metadata();
  const W = Math.round(ust.width * olcek), H = Math.round(ust.height * olcek);
  let katman = await sharp(png).resize(W, H, { fit: 'fill' }).png().toBuffer();

  // Negatif translate'te sharp negatif konum kabul etmiyor; goruntunun o kadari
  // bastan kirpiliyor — SVG'nin viewBox disini kirpmasiyla ayni sonuc.
  let sol = Math.round(tx), yukari = Math.round(ty);
  let kirpSol = 0, kirpUst = 0;
  if (sol < 0) { kirpSol = -sol; sol = 0; }
  if (yukari < 0) { kirpUst = -yukari; yukari = 0; }
  katman = await sharp(katman).extract({
    left: kirpSol, top: kirpUst,
    width: Math.min(W - kirpSol, kutuW - sol),
    height: Math.min(H - kirpUst, kutuH - yukari),
  }).png().toBuffer();

  let tuval = await sharp({ create: { width: kutuW, height: kutuH, channels: 4, background: SEFFAF } })
    .composite([{ input: katman, left: sol, top: yukari }])
    .png().toBuffer();

  // 2) figur olmayanlari karenin ortasina al
  if (ORTALANACAK.has(ad)) {
    const k = await sinirKutusu(tuval);
    const kirpik = await sharp(tuval).extract({ left: k.x1, top: k.y1, width: k.en, height: k.boy }).png().toBuffer();
    tuval = await sharp({ create: { width: kutuW, height: kutuH, channels: 4, background: SEFFAF } })
      .composite([{ input: kirpik, left: Math.round((kutuW - k.en) / 2), top: Math.round((kutuH - k.boy) / 2) }])
      .png().toBuffer();
  }

  // 3) hedef boyut + webp
  const cikti = await sharp(tuval)
    .resize(HEDEF, HEDEF, { fit: 'fill' })
    .webp({ quality: 82, alphaQuality: 92, effort: 6 })
    .toBuffer();

  await writeFile(path.join(CIKTI_DIZIN, `${ad}.webp`), cikti);
  toplamSonra += cikti.length;

  const k = await sinirKutusu(cikti);
  const olcekGeri = kutuH / HEDEF;
  rapor.push({
    tas: ad,
    KB: +(cikti.length / 1024).toFixed(1),
    boy: +(k.boy * olcekGeri).toFixed(1),
    taban: +((k.y2 + 1) * olcekGeri).toFixed(1),
    ortalandi: ORTALANACAK.has(ad) ? 'evet' : '',
  });
}

console.table(rapor);
console.log(`${rapor.length} dosya  |  ${(toplamOnce / 1048576).toFixed(1)} MB -> ${(toplamSonra / 1024).toFixed(0)} KB` +
  `  (${Math.round(toplamOnce / toplamSonra)}x kucuk)`);
console.log(`cikti: ${CIKTI_DIZIN}`);
console.log('Not: taban degerleri birbirine yakin olmali (ortalananlar haric) — ' +
  'saciliyorsa kaynaktaki <image> transform bozulmus demektir.');
