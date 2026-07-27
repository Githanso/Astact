import React, { useState, useRef } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Copy, Check, X } from 'lucide-react';

// Oda kurulur kurulmaz kodu buyuk buyuk gosterir. Onceden kod yalnizca baslik seridinde
// ve OnlineModal icinde goruluyordu; kopyalamak icin modali tekrar acmak gerekiyordu.
// Rakip odaya katilinca App bunu kendiliginden kapatir.
interface RoomCodeModalProps {
    isOpen: boolean;
    roomCode: string | null;
    onClose: () => void;
    lang: Language;
}

const RoomCodeModal: React.FC<RoomCodeModalProps> = ({ isOpen, roomCode, onClose, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const [copied, setCopied] = useState(false);
    const kodRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !roomCode) return null;

    // navigator.clipboard birkac durumda reddediyor (belge odakta degil, izin yok,
    // guvensiz baglam). Sessizce yutulursa kullanici dugmeye basip hicbir sey olmadigini
    // gorur. Basarisizlikta kodu SECIYORUZ ki Ctrl+C ile alinabilsin; "kopyalandi"
    // durumunu ise yalnizca gercekten kopyalandiysa gosteriyoruz.
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(roomCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const el = kodRef.current;
            if (el) {
                const aralik = document.createRange();
                aralik.selectNodeContents(el);
                const secim = window.getSelection();
                secim?.removeAllRanges();
                secim?.addRange(aralik);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    aria-label={t.close}
                >
                    <X className="w-4 h-4" />
                </button>

                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">{t.roomLabel}</p>

                <div ref={kodRef} className="font-mono text-3xl sm:text-4xl font-black tracking-[0.15em] text-amber-400 bg-slate-950/70 border border-slate-700 rounded-xl py-4 px-2 select-all break-all">
                    {roomCode}
                </div>

                <button
                    onClick={handleCopy}
                    className={`mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 ${
                        copied
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
                    }`}
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? t.codeCopied : t.copyCode}</span>
                </button>

                <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">{t.shareCodeHint}</p>
                <p className="mt-2 text-[11px] text-amber-300/80 leading-relaxed">{t.waitingOpponentJoin}</p>
            </div>
        </div>
    );
};

export default RoomCodeModal;
