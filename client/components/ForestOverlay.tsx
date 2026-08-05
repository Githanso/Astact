import React from 'react';
import { CANLI, ormanSavrulmasi } from '../constants';

interface ForestOverlayProps {
  // Sunucudan gelen orman yogunlugu (1-3, server.ts:173). Bugune kadar Board'dan
  // Square'e kadar tasinip KULLANILMIYORDU; artik savrulmanin genligini ve hizini
  // suruyor: sik orman agir ve yavas, seyrek orman serbest savruluyor.
  density?: number;
  // Faz dagitimi icin kare koordinati. Ayni fazda sallanan 30 kare tahtayi nefes
  // alan tek kutleye cevirir ve goz bunu aninda sahte olarak okur.
  row?: number;
  col?: number;
}

const ForestOverlay: React.FC<ForestOverlayProps> = ({ density = 2, row = 0, col = 0 }) => {
  const savrul = ormanSavrulmasi(row, col, density);

  return (
    <div className="relative w-full h-full overflow-hidden bg-emerald-950/40 rounded-sm flex items-center justify-center">
      {/* transform-origin: bottom center (index.css -> .orman-savrul): agac
          TEPESI savruluyor, dip sabit kaliyor. Govde de kayarsa orman yuruyor
          gibi gorunuyor. */}
      <img
        src="/assets/forest.avif"
        alt=""
        draggable={false}
        className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none${
          CANLI ? ' orman-savrul' : ''
        }`}
        style={
          CANLI
            ? ({
                animationDuration: `${savrul.sure}s`,
                animationDelay: `${savrul.gecikme}s`,
                '--genlik': savrul.genlik,
              } as React.CSSProperties)
            : undefined
        }
      />
      {/* Avif'in ustune hafif lacivert ton: tahtayla uyumlu ve tas alti zeminde soluk. */}
      <div className="absolute inset-0 bg-emerald-900/25" />

      {/* Sis. Yumusaklik gradyanin KENDISINDEN geliyor, filter: blur()'dan degil —
          30 orman karesinde blur kare butcesini tek basina yiyor.
          Katman kareden buyuk (140%) ve capraz suruklenirken kenari acmiyor. */}
      {CANLI && (
        <div
          className="orman-sis absolute pointer-events-none opacity-70"
          style={{
            left: '-20%',
            top: '-20%',
            width: '140%',
            height: '140%',
            animationDelay: `${savrul.gecikme * 1.7}s`,
            backgroundImage:
              'radial-gradient(ellipse 42% 26% at 30% 38%, rgba(214,228,224,0.28), transparent 70%),' +
              'radial-gradient(ellipse 34% 20% at 68% 62%, rgba(226,236,232,0.22), transparent 70%),' +
              'radial-gradient(ellipse 28% 16% at 52% 20%, rgba(200,218,214,0.18), transparent 72%)',
          }}
        />
      )}
    </div>
  );
};

export default ForestOverlay;
