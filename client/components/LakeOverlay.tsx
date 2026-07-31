import React from 'react';

const LakeOverlay: React.FC = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 rounded-sm flex items-center justify-center border border-cyan-500/20 shadow-inner">
      {/* public/assets/lake.avif: gol dokusu. build (clean:assets) yalnizca
          index-*.js/css siliyor, bu dosyaya dokunmuyor. */}
      <img
        src="/assets/lake.avif"
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />
      {/* Avif'in ustune hafif cyan tonu: tahtanin lacivertiyle uyumlu duruyor. */}
      <div className="absolute inset-0 bg-cyan-900/30" />
      {/* Su dokusu: hafif nabiz animasyonu */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent animate-pulse" />
      <div className="absolute top-1 left-2 w-2/3 h-1 bg-cyan-200/20 rounded-full blur-[1px]" />
      <div className="absolute bottom-2 right-2 w-1/2 h-1 bg-cyan-300/15 rounded-full blur-[1px]" />
    </div>
  );
};

export default LakeOverlay;
