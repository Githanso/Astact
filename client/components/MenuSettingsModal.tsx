import React from 'react';
import { Language, TimerPreset } from '../types';
import { TRANSLATIONS } from '../constants';
import { Settings, X } from 'lucide-react';
import { TimerPresetPicker, VolumeControl } from './SettingsControls';

// Menudeki Ayarlar penceresi. Icerik bilincli olarak OYUN ONCESI anlamli olan seylerle
// sinirli: sure on ayari (oyun baslayinca zaten kilitleniyor, yani dogru yeri burasi) ve
// ses. Dil menude bayrak dugmeleri olarak duruyor, burada tekrarlanmiyor.
interface MenuSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    timerPreset: TimerPreset;
    onPresetChange: (preset: TimerPreset) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    lang: Language;
}

const MenuSettingsModal: React.FC<MenuSettingsModalProps> = ({
    isOpen, onClose, timerPreset, onPresetChange, volume, onVolumeChange, lang,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    aria-label={t.close}
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-5">
                    <Settings className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">{t.settingsPanelTitle}</h2>
                </div>

                <div className="space-y-3">
                    {/* Oyun menuden baslamadigi icin burada kilit yok. */}
                    <TimerPresetPicker timerPreset={timerPreset} onPresetChange={onPresetChange} isLocked={false} lang={lang} />
                    <VolumeControl volume={volume} onVolumeChange={onVolumeChange} lang={lang} />
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-lg text-xs uppercase tracking-wider active:scale-95"
                >
                    {t.close}
                </button>
            </div>
        </div>
    );
};

export default MenuSettingsModal;
