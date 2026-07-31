import React from 'react';

const ForestOverlay: React.FC = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-emerald-950/40 rounded-sm flex items-center justify-center">
      <img
        src="/assets/forest.avif"
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />
      {/* Avif'in ustune hafif lacivert ton: tahtayla uyumlu ve tas alti zeminde soluk. */}
      <div className="absolute inset-0 bg-emerald-900/25" />
    </div>
  );
};

export default ForestOverlay;
