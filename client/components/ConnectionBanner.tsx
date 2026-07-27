import React from 'react';
import { Language, ConnectionNotice } from '../types';
import { TRANSLATIONS } from '../constants';
import { WifiOff, Wifi, Hourglass } from 'lucide-react';

// Baglanti serididir, modal DEGIL: rakip koptugunda oyun bitmis olmuyor, oyuncu
// tahtayi gormeye devam etmeli. Modal koysaydik bekleyen oyuncunun ekranini
// gereksizce kilitlerdik.
//
// Geri sayim sunucudan gelen KALAN sureden turetiliyor (roomState.*DisconnectMs);
// istemci onu saniyede bir azaltiyor. Sure dolunca sunucu zaten game_over yayinliyor.
interface ConnectionBannerProps {
    notice: ConnectionNotice;
    remainingSec: number | null;
    lang: Language;
}

const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ notice, remainingSec, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    if (!notice) return null;

    const kopuk = notice === 'OPPONENT_GONE' || notice === 'SELF_GONE';
    const kendi = notice === 'SELF_GONE' || notice === 'SELF_BACK';

    const baslik = kopuk
        ? (kendi ? t.youDisconnectedTitle : t.opponentDisconnectedTitle)
        : (kendi ? t.youReconnected : t.opponentReconnected);

    // {n} yalnizca geri sayimli durumlarda var; kalan sure bilinmiyorsa alt satir hic basilmaz.
    const detay = kopuk && remainingSec !== null
        ? (kendi ? t.youDisconnectedWait : t.opponentDisconnectedWait).replace(/\{n\}/g, String(remainingSec))
        : null;

    return (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[900] w-[92%] max-w-md animate-fade-in" role="status" aria-live="polite">
            <div className={`rounded-xl border-2 shadow-2xl px-4 py-3 backdrop-blur-md flex items-start gap-3 ${
                kopuk ? 'bg-rose-950/90 border-rose-500/50' : 'bg-emerald-950/90 border-emerald-500/50'
            }`}>
                <div className={`mt-0.5 flex-shrink-0 ${kopuk ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {kopuk ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                    <p className={`text-sm font-black leading-tight ${kopuk ? 'text-rose-200' : 'text-emerald-200'}`}>
                        {baslik}
                    </p>
                    {detay && (
                        <p className="mt-1 text-xs font-semibold text-slate-300 leading-relaxed flex items-center gap-1.5">
                            <Hourglass className="w-3 h-3 flex-shrink-0" />
                            <span>{detay}</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionBanner;
