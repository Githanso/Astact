import React from 'react';

const LakeOverlay: React.FC = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 rounded-sm flex items-center justify-center border border-cyan-500/20 shadow-inner">
      {/* Water ripple subtle motion effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent animate-pulse" />
      <div className="absolute top-1 left-2 w-2/3 h-1 bg-cyan-200/20 rounded-full blur-[1px]" />
      <div className="absolute bottom-2 right-2 w-1/2 h-1 bg-cyan-300/15 rounded-full blur-[1px]" />
      
      {/* Reeds / shoreline details */}
      <div className="absolute bottom-0 left-1 flex gap-0.5 opacity-60">
        <div className="w-0.5 h-3 bg-amber-700/80 rounded-t" />
        <div className="w-0.5 h-4 bg-amber-800/80 rounded-t" />
      </div>
    </div>
  );
};

export default LakeOverlay;
