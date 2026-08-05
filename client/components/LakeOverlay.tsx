import React from 'react';
import { CANLI, HAREKET_AZALT } from '../constants';

interface LakeOverlayProps {
  // Karenin tahtadaki yeri. Kaustik deseni bu koordinata gore kaydiriliyor;
  // olmazsa bitisik gol kareleri BIREBIR AYNI goruntuyu basar ve 2x2 gol blogu
  // tek su kutlesi degil, dort ayri doseme gibi okunur.
  row?: number;
  col?: number;
}

// Kaustik katmani karenin DORT KATI alani (200%x200%) kapliyor ve kare kendi
// ceyregini gosteriyor. Komsu kare komsu ceyregi gosterdigi icin desen kare
// sinirinda devam ediyor.
//
// Esitlik (%2) yeterli: desenin kenarlari BOS birakildigi icin (isik lekeleri
// kenara degmiyor) ceyrek sarmasi yaptigi yerde de gorunur bir dikis olusmuyor.
const ceyrek = (row: number, col: number): React.CSSProperties => ({
  width: '200%',
  height: '200%',
  left: `${-(col % 2) * 100}%`,
  top: `${-(row % 2) * 100}%`,
});

// Suyun dibindeki isik agi. Iki katman ayni lekeleri FARKLI olcek ve yonde
// tasiyor; tek katmanin donusu birkac saniyede fark ediliyor, ikisinin girisimi
// tekrari gizliyor.
const AG_1 =
  'radial-gradient(ellipse 16% 7% at 21% 26%, rgba(186,246,255,0.55), transparent 72%),' +
  'radial-gradient(ellipse 12% 5% at 44% 15%, rgba(186,246,255,0.42), transparent 72%),' +
  'radial-gradient(ellipse 19% 6% at 68% 33%, rgba(210,250,255,0.50), transparent 72%),' +
  'radial-gradient(ellipse 13% 8% at 33% 58%, rgba(186,246,255,0.38), transparent 72%),' +
  'radial-gradient(ellipse 17% 6% at 74% 66%, rgba(210,250,255,0.45), transparent 72%),' +
  'radial-gradient(ellipse 11% 5% at 52% 79%, rgba(186,246,255,0.35), transparent 72%)';
const AG_2 =
  'radial-gradient(ellipse 22% 6% at 34% 20%, rgba(255,255,255,0.32), transparent 74%),' +
  'radial-gradient(ellipse 15% 8% at 63% 44%, rgba(186,246,255,0.40), transparent 74%),' +
  'radial-gradient(ellipse 18% 5% at 26% 71%, rgba(255,255,255,0.28), transparent 74%),' +
  'radial-gradient(ellipse 14% 7% at 79% 24%, rgba(186,246,255,0.34), transparent 74%),' +
  'radial-gradient(ellipse 16% 6% at 47% 62%, rgba(210,250,255,0.30), transparent 74%)';

const LakeOverlay: React.FC<LakeOverlayProps> = ({ row = 0, col = 0 }) => {
  const konum = ceyrek(row, col);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 rounded-sm flex items-center justify-center border border-cyan-500/20 shadow-inner">
      {/* public/assets/lake.avif: gol dokusu. build (clean:assets) yalnizca
          index-*.js/css siliyor, bu dosyaya dokunmuyor.

          filter: bozunum dokunun KENDISINI dalgalandiriyor (index.html -> #su-dalga).
          scale-110 sart: bozunum pikselleri kenardan disari itiyor, olcek olmazsa
          karenin kenarinda saydam serit aciliyor. */}
      <img
        src="/assets/lake.avif"
        alt=""
        draggable={false}
        style={CANLI && !HAREKET_AZALT ? { filter: 'url(#su-dalga)' } : undefined}
        className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none${
          CANLI && !HAREKET_AZALT ? ' scale-110' : ''
        }`}
      />
      {/* Avif'in ustune hafif cyan tonu: tahtanin lacivertiyle uyumlu duruyor. */}
      <div className="absolute inset-0 bg-cyan-900/30" />

      {CANLI ? (
        <>
          {/* Kaustik. mix-blend-mode: screen -> isik EKLENIYOR, uzerine boya
              surulmuyor; koyu su dokusu altta okunmaya devam ediyor. */}
          <div
            className="su-kaustik-1 absolute pointer-events-none mix-blend-screen opacity-60"
            style={{ ...konum, backgroundImage: AG_1 }}
          />
          <div
            className="su-kaustik-2 absolute pointer-events-none mix-blend-screen opacity-45"
            style={{ ...konum, backgroundImage: AG_2 }}
          />
          {/* Yuzey parildamasi: iki cizgi, kaustikten bagimsiz nefes aliyor. */}
          <div className="su-parilti absolute inset-0 pointer-events-none">
            <div className="absolute top-1 left-2 w-2/3 h-1 bg-cyan-200/25 rounded-full blur-[1px]" />
            <div className="absolute bottom-2 right-2 w-1/2 h-1 bg-cyan-300/20 rounded-full blur-[1px]" />
          </div>
        </>
      ) : (
        // ?canli=0 — bugunku durgun gol. Karsilastirma icin oldugu gibi duruyor.
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent animate-pulse" />
          <div className="absolute top-1 left-2 w-2/3 h-1 bg-cyan-200/20 rounded-full blur-[1px]" />
          <div className="absolute bottom-2 right-2 w-1/2 h-1 bg-cyan-300/15 rounded-full blur-[1px]" />
        </>
      )}
    </div>
  );
};

export default LakeOverlay;
