import React from 'react';
import { Player, GamePhase, Language } from '../types';
import { PLAYERS, TRANSLATIONS, MAX_MISSED_TURNS } from '../constants';

interface GameOverModalProps {
    winner: Player | null;
    isTimeoutDraw?: boolean;   // iki oyuncu da tur kaçırma sınırına ulaştı
    notice?: string | null;    // online: yeniden başlatma isteği durumu
    onRestart: () => void;
    gamePhase?: GamePhase;
    lang?: Language;
    onClose?: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ winner, isTimeoutDraw = false, notice = null, onRestart, lang = 'TR' }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Beraberlikte kazanan YOK; eskiden burada koşulsuz null dönülüyordu, o yüzden
    // beraberlik ekrana hiç düşmezdi.
    if (!winner && !isTimeoutDraw) return null;

    const winnerColor = winner === PLAYERS.RED ? 'text-amber-400' : 'text-sky-300';

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 text-center border-2 border-amber-500/50 max-w-sm w-full relative">
                <h2 className="text-3xl font-black mb-3 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                    {winner ? t.gameOverStatus : t.drawHeading}
                </h2>
                {winner ? (
                    <p className={`text-xl font-extrabold mb-8 ${winnerColor}`}>
                        {t.winnerLabel}: {winner === PLAYERS.RED ? t.playerRed : t.playerBlue}!
                    </p>
                ) : (
                    <p className="text-sm font-semibold text-slate-300 mb-8 leading-relaxed">
                        {(t.drawTimeoutReason || '').replace(/\{n\}/g, String(MAX_MISSED_TURNS))}
                    </p>
                )}
                <button
                    onClick={onRestart}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 px-6 rounded-xl text-sm transition-all shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
                >
                    {t.restartButton}
                </button>
                {/* Online oyunda sunucu, yeniden başlatmayı iki taraf da isteyene kadar
                    yapmıyor. Bu not olmadan düğme "çalışmıyor" gibi görünüyordu. */}
                {notice && (
                    <p className="mt-4 text-xs font-semibold text-amber-300 leading-relaxed">{notice}</p>
                )}
            </div>
        </div>
    );
};

export default GameOverModal;