import React from 'react';

interface ForestOverlayProps {
  density?: number;
}

const ForestOverlay: React.FC<ForestOverlayProps> = ({ density = 2 }) => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-emerald-950/40 rounded-sm flex items-center justify-center">
      {/* Background layer: pale small trees */}
      <div className="absolute inset-0 flex items-center justify-around opacity-40 blur-[0.3px] scale-75 transform -translate-y-1">
        <svg viewBox="0 0 100 100" className="w-6 h-6 text-emerald-700 fill-current">
          <path d="M50 10 L80 60 L65 60 L85 90 L15 90 L35 60 L20 60 Z" />
        </svg>
        <svg viewBox="0 0 100 100" className="w-5 h-5 text-emerald-800 fill-current">
          <path d="M50 15 L75 60 L60 60 L80 88 L20 88 L40 60 L25 60 Z" />
        </svg>
      </div>

      {/* Middle layer: normal size trees */}
      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-80">
        <svg viewBox="0 0 100 100" className="w-8 h-8 text-emerald-600 fill-current drop-shadow">
          <path d="M50 5 L85 55 L70 55 L90 85 L10 85 L30 55 L15 55 Z" />
          <rect x="45" y="85" width="10" height="15" className="fill-amber-900" />
        </svg>
        {density >= 2 && (
          <svg viewBox="0 0 100 100" className="w-7 h-7 text-green-700 fill-current drop-shadow -ml-2">
            <path d="M50 10 L80 50 L65 50 L85 82 L15 82 L35 50 L20 50 Z" />
            <rect x="45" y="82" width="10" height="18" className="fill-amber-950" />
          </svg>
        )}
      </div>

      {/* Foreground layer: large dark trees with depth shadow */}
      <div className="absolute inset-0 flex items-end justify-between px-0.5 pb-0.5 opacity-95 z-10">
        <svg viewBox="0 0 100 100" className="w-9 h-9 text-emerald-900 fill-current filter drop-shadow-lg transform scale-110">
          <path d="M50 0 L90 50 L72 50 L95 85 L5 85 L28 50 L10 50 Z" />
          <rect x="44" y="85" width="12" height="15" className="fill-amber-950" />
        </svg>
        {density >= 3 && (
          <svg viewBox="0 0 100 100" className="w-8 h-8 text-green-950 fill-current filter drop-shadow-lg transform scale-125">
            <path d="M50 5 L88 52 L70 52 L92 88 L8 88 L30 52 L12 52 Z" />
          </svg>
        )}
      </div>
    </div>
  );
};

export default ForestOverlay;
