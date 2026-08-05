// Gol karelerinin yuzey dalgasini suren tek dongu.
//
// NEDEN JS: dalga, index.html'deki #su-dalga SVG filtresinin icinde yasiyor ve
// CSS bir filtrenin ICINI animate edemiyor. Akla ilk gelen cozum SMIL <animate>
// olurdu; kullanilmadi, cunku CSS'ten (filter: url(...)) referans verilen bir
// filtrenin SMIL ile yeniden ornekleniyor olmasi tarayicilar arasinda guvenilir
// degil. Burasi 20 satir ve her yerde ayni sekilde calisiyor.
//
// MALIYET: her guncelleme 6 gol karesinin filtresini yeniden cizdiriyor. Bu
// yuzden ekran tazeleme hizinda DEGIL, ~25 Hz'de guncelleniyor: su yavas, fark
// edilmiyor, is yaklasik ucte birine iniyor. Sekme arka plana dustugunde rAF
// zaten durdugu icin ayrica bir gorunurluk kontrolu gerekmiyor.

const HEDEF_ARALIK_MS = 40; // ~25 Hz

/**
 * Dalgayi baslatir, durdurma fonksiyonu dondurur. Filtre sayfada yoksa (veya
 * cagiran taraf efekti istemiyorsa) hicbir sey yapmaz.
 */
export function suDalgasiniBaslat(): () => void {
  const filtre = document.getElementById('su-dalga');
  const kaydir = filtre?.querySelector('feOffset');
  const bozunum = filtre?.querySelector('feDisplacementMap');
  if (!kaydir || !bozunum) return () => {};

  let raf = 0;
  let sonGuncelleme = 0;
  const baslangic = performance.now();

  const dongu = (simdi: number) => {
    raf = requestAnimationFrame(dongu);
    if (simdi - sonGuncelleme < HEDEF_ARALIK_MS) return;
    sonGuncelleme = simdi;

    const t = (simdi - baslangic) / 1000;
    // Uc ayri periyot: hicbiri digerinin tam kati degil, boylece bilesim
    // gozle yakalanabilir bir noktada tekrar etmiyor.
    kaydir.setAttribute('dx', (Math.sin(t / 3.1) * 13).toFixed(2));
    kaydir.setAttribute('dy', (Math.cos(t / 2.3) * 8).toFixed(2));
    bozunum.setAttribute('scale', (6.5 + Math.sin(t / 1.9) * 2).toFixed(2));
  };

  raf = requestAnimationFrame(dongu);
  return () => cancelAnimationFrame(raf);
}
