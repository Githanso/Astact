import React, { useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Globe, Users, RotateCcw, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { VolumeControl } from './SettingsControls';

// Tahtanin sagindaki ayarlar panosu: online/yeniden baslat + ses.
// Sure on ayari ve dil BILINCLI olarak yok — ikisi de oyun oncesi kararlar, menudeki
// ayarlar penceresinde yapiliyor. Sure zaten oyun basladiginda kilitleniyordu.
// Oyun durumu / ele gecirilenler / carpisma gecmisi bu panoda YOK — onlar PlayerPanel'de.
interface SettingsPanelProps {
    lang: Language;
    volume: number;
    onVolumeChange: (volume: number) => void;
    isOnlineMode: boolean;
    roomCode: string | null;
    onOpenOnline: () => void;
    onRestart: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    lang,
    volume,
    onVolumeChange,
    isOnlineMode,
    roomCode,
    onOpenOnline,
    onRestart,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl flex-shrink-0">
            {/* Pano basligi — tiklayinca acilip kapaniyor */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800/60 transition-colors rounded-xl ${isOpen ? 'rounded-b-none border-b border-slate-800' : ''}`}
            >
                <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>{t.settingsPanelTitle}</span>
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {!isOpen ? null : (
        <div className="p-4 flex flex-col space-y-3">
            {/* Online oyun + yeniden baslat */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onOpenOnline}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border font-bold text-xs transition-all shadow-md active:scale-95 ${
                        isOnlineMode
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                            : 'bg-indigo-700 hover:bg-indigo-600 border-indigo-500/60 text-indigo-50'
                    }`}
                >
                    {isOnlineMode ? <Globe className="w-4 h-4 text-emerald-400" /> : <Users className="w-4 h-4" />}
                    <span className="truncate">{isOnlineMode ? `${t.roomLabel}: ${roomCode}` : t.onlineButton}</span>
                </button>

                <button
                    onClick={onRestart}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 font-bold text-xs transition-all shadow-md active:scale-95"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span className="truncate">{t.restartButton}</span>
                </button>
            </div>

            <VolumeControl volume={volume} onVolumeChange={onVolumeChange} lang={lang} />
        </div>
            )}
        </div>
    );
};

export default SettingsPanel;
