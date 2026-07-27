import React from 'react';
import { GameStats, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { soundManager } from '../lib/soundFX';
import { Volume2, VolumeX, BarChart2, X } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: GameStats;
  volume: number;
  onVolumeChange: (vol: number) => void;
  lang: Language;
}

const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  volume,
  onVolumeChange,
  lang,
}) => {
  if (!isOpen) return null;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onVolumeChange(val);
    soundManager.setVolume(val);
  };

  const volumePercent = Math.round(volume * 100);
  // Yuzde isareti Turkce'de ONE, diger dillerde SONA gelir: %50 / 50%
  const percentText = lang === 'TR' ? `%${volumePercent}` : `${volumePercent}%`;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              {t.statsHeading}
            </h2>
            <p className="text-xs text-slate-400">{t.statsSubtitle}</p>
          </div>
        </div>

        {/* Audio Volume Settings */}
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              {volumePercent === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              <span>{t.bgMusicVolume}</span>
            </span>
            <span className="font-mono text-xs font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
              {percentText}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleSliderChange}
            className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />
        </div>

        {/* Dashboard Analytics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <div className="text-slate-400 text-[11px] font-bold uppercase mb-1">{t.totalGames}</div>
            <div className="text-2xl font-black text-amber-300">{stats.gamesPlayed}</div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
            <div className="text-slate-400 text-[11px] font-bold uppercase mb-1">{t.totalBattles}</div>
            <div className="text-2xl font-black text-rose-400">{stats.totalBattles}</div>
          </div>

          <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/30 text-center">
            <div className="text-amber-400 text-[11px] font-bold uppercase mb-1">{t.redWins}</div>
            <div className="text-2xl font-black text-amber-400">{stats.redWins}</div>
          </div>

          <div className="bg-sky-950/30 p-3 rounded-xl border border-sky-500/30 text-center">
            <div className="text-sky-300 text-[11px] font-bold uppercase mb-1">{t.blueWins}</div>
            <div className="text-2xl font-black text-sky-300">{stats.blueWins}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-lg text-xs uppercase tracking-wider"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};

export default StatsModal;
