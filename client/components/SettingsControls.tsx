import React from 'react';
import { Language, TimerPreset } from '../types';
import { TRANSLATIONS, TIMER_PRESETS } from '../constants';
import { Volume2, VolumeX, Lock } from 'lucide-react';

// Ayarlar denetimleri: TimerPresetPicker (menudeki Ayarlar penceresi) ve
// MuteToggle (menu ekranindaki sustur dugmesi).
//
// Kaydiracli tam ses denetimi (VolumeControl) KALDIRILDI: tek musterisi oyun ici
// ayarlar panosuydu, o pano da kaldirildi. Ses artik tek noktadan yonetiliyor —
// menudeki sustur dugmesi (%0 <-> %50).

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

interface MuteToggleProps {
    volume: number;
    onVolumeChange: (volume: number) => void;
    lang: Language;
    // Yerlesim (dolgu, genislik, kose) cagirana ait: menude AYARLAR'in yanindaki
    // kare dugme ile kaydiracin yanindaki dar dugme ayni mantigi paylasiyor ama
    // ayni olcude degil. Renk/durum burada, boyut disarida.
    className?: string;
    iconClassName?: string;
}

// Sustur / sesi ac. Kapatirken 0, acarken %50 — kaydiraci olmayan yerlerde
// (menu ekrani) tek dokunusla makul bir seviyeye donmesi icin.
export const MuteToggle: React.FC<MuteToggleProps> = ({
    volume, onVolumeChange, lang, className = 'px-3 rounded-xl', iconClassName = 'w-4 h-4',
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const isMuted = Math.round(volume * 100) === 0;
    return (
        <button
            onClick={() => onVolumeChange(isMuted ? 0.5 : 0)}
            aria-label={t.bgMusicVolume}
            aria-pressed={!isMuted}
            className={`flex items-center justify-center border transition-all shadow-md active:scale-95 ${className} ${
                isMuted
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/40'
            }`}
        >
            {isMuted ? <VolumeX className={iconClassName} /> : <Volume2 className={iconClassName} />}
        </button>
    );
};

