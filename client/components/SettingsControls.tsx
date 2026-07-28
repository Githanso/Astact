import React from 'react';
import { Language, TimerPreset } from '../types';
import { TRANSLATIONS, TIMER_PRESETS } from '../constants';
import { Volume2, VolumeX, Lock } from 'lucide-react';

// Sure ve ses denetimleri IKI yerde kullaniliyor: oyun icindeki SettingsPanel ve
// menudeki MenuSettingsModal. Ayni JSX'i iki dosyaya kopyalamak birinin digerinden
// sapmasina yol acardi; ortak parca burada.

interface TimerPresetPickerProps {
    timerPreset: TimerPreset;
    onPresetChange: (preset: TimerPreset) => void;
    isLocked: boolean;   // oyun basladiktan sonra degistirilemez
    // Online oyunda tur suresini ODA KURUCUSU belirler; katilan oyuncunun buradaki
    // secimi sunucuda yok sayilir. Menude hangi rolde olunacagi daha belli olmadigi
    // icin not kosulsuz gosteriliyor.
    showHostNote?: boolean;
    lang: Language;
}

export const TimerPresetPicker: React.FC<TimerPresetPickerProps> = ({ timerPreset, onPresetChange, isLocked, showHostNote = false, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    return (
        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`font-bold ${isLocked ? 'text-slate-500' : 'text-slate-300'}`}>{t.timerPresetsLabel}</span>
                {isLocked && <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {(['FAST', 'NORMAL', 'LONG'] as TimerPreset[]).map(preset => {
                    const config = TIMER_PRESETS[preset];
                    const isSelected = timerPreset === preset;
                    return (
                        <button
                            key={preset}
                            onClick={() => onPresetChange(preset)}
                            disabled={isLocked}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                                isSelected
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            } ${isLocked
                                    ? 'opacity-40 cursor-not-allowed'
                                    : `cursor-pointer ${isSelected ? 'scale-105' : 'hover:bg-slate-700'}`
                            }`}
                        >
                            <div>{preset === 'FAST' ? t.timerPresetFast : preset === 'NORMAL' ? t.timerPresetNormal : t.timerPresetLong}</div>
                            <div className="text-[9px] opacity-80">{config.turnTime}s / {config.setupTime}s</div>
                        </button>
                    );
                })}
            </div>
            {isLocked && <p className="mt-2 text-[10px] text-slate-500 leading-snug">{t.timerLockedHint}</p>}
            {!isLocked && showHostNote && <p className="mt-2 text-[10px] text-slate-500 leading-snug">{t.timerHostOnlyHint}</p>}
        </div>
    );
};

interface VolumeControlProps {
    volume: number;
    onVolumeChange: (volume: number) => void;
    lang: Language;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({ volume, onVolumeChange, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const volumePercent = Math.round(volume * 100);
    const isMuted = volumePercent === 0;
    // Yuzde isareti Turkce'de ONE, diger dillerde SONA gelir: %50 / 50%
    const percentText = lang === 'TR' ? `%${volumePercent}` : `${volumePercent}%`;

    return (
        <div className="flex items-stretch gap-2">
            <button
                onClick={() => onVolumeChange(isMuted ? 0.5 : 0)}
                aria-label={t.bgMusicVolume}
                className={`flex items-center justify-center px-3 rounded-xl border transition-all shadow-md active:scale-95 ${
                    isMuted
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/40'
                }`}
            >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 min-w-0">
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        <span className="truncate">{t.bgMusicVolume}</span>
                    </span>
                    <span className="font-mono text-[10px] font-black text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 flex-shrink-0">
                        {percentText}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
            </div>
        </div>
    );
};
