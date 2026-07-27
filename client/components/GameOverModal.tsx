import React from 'react';
import { Player, GamePhase, Language, GameOverReason } from '../types';
import { PLAYERS, TRANSLATIONS, MAX_MISSED_TURNS } from '../constants';

interface GameOverModalProps {
    winner: Player | null;
    isTimeoutDraw?: boolean;   // iki oyuncu da tur kaçırma sınırına ulaştı
    notice?: string | null;    // online: yeniden başlatma isteği durumu
    // Online'da bu oyuncunun takımı. Doluysa ekran KİŞİSELLEŞTİRİLİR: kazanan
    // "ZAFER", kaybeden "YENİLDİN" görür. Yerel modda (aynı ekran) null gelir ve
    // iki taraf da aynı ekrana baktığı için tarafsız "Kazanan: X" metni kalır.
    myTeam?: Player | null;
    reason?: GameOverReason;
    onRestart: () => void;
    gamePhase?: GamePhase;
    lang?: Language;
    onClose?: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ winner, isTimeoutDraw = false, notice = null, myTeam = null, reason = null, onRestart, lang = 'TR' }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Beraberlikte kazanan YOK; eskiden burada koşulsuz null dönülüyordu, o yüzden
    // beraberlik ekrana hiç düşmezdi.
    if (!winner && !isTimeoutDraw) return null;

    const winnerColor = winner === PLAYERS.RED ? 'text-amber-400' : 'text-sky-300';
    const kisisel = !!(winner && myTeam);
    const kazandim = kisisel && winner === myTeam;

    // Başlık: kişiselleştirilmiş modda kazanan/kaybeden ayrı; beraberlikte ortak.
    const baslik = !winner ? t.drawHeading
        : kisisel ? (kazandim ? t.victoryHeading : t.defeatHeading)
        : t.gameOverStatus;

    const baslikRengi = !winner ? 'from-slate-200 via-slate-300 to-slate-400'
        : kisisel && !kazandim ? 'from-rose-300 via-rose-400 to-rose-500'
        : 'from-amber-200 via-amber-400 to-amber-500';

    // Açıklama satırı: neden kazandın/kaybettin.
    const aciklama = kazandim
        ? (reason === 'OPPONENT_LEFT' ? t.victoryOpponentLeft : t.victoryFlag)
        : (reason === 'OPPONENT_LEFT' ? t.defeatYouLeft : t.defeatFlag);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in">
            <div className={`bg-slate-900 rounded-2xl shadow-2xl p-8 text-center border-2 max-w-sm w-full relative ${
                kisisel && !kazandim ? 'border-rose-500/50' : 'border-amber-500/50'
            }`}>
                <h2 className={`text-3xl font-black mb-3 bg-gradient-to-r bg-clip-text text-transparent ${baslikRengi}`}>
                    {baslik}
                </h2>
                {!winner ? (
                    <p className="text-sm font-semibold text-slate-300 mb-8 leading-relaxed">
                        {(t.drawTimeoutReason || '').replace(/\{n\}/g, String(MAX_MISSED_TURNS))}
                    </p>
                ) : kisisel ? (
                    <p className="text-sm font-semibold text-slate-300 mb-8 leading-relaxed">
                        {aciklama}
                    </p>
                ) : (
                    <p className={`text-xl font-extrabold mb-8 ${winnerColor}`}>
                        {t.winnerLabel}: {winner === PLAYERS.RED ? t.playerRed : t.playerBlue}!
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