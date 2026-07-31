import React from 'react';
import { PieceDefinition, Player, Language } from '../types';
import { PLAYERS, TRANSLATIONS, getPieceLabel } from '../constants';
import { Shuffle, Trash2, CheckCircle2, Hourglass } from 'lucide-react';

interface SetupUIProps {
    piecesToPlace: PieceDefinition[];
    onPieceSelect: (piece: PieceDefinition) => void;
    selectedPieceName?: string;
    onFinishSetup: () => void;
    onAutoSetup: () => void;
    onClearSetup: () => void;
    player: Player;
    // Oyuncu online modda ad girmisse adi, girmemisse null/boş. Başlıkta
    // "Kırmızı Oyuncu - Dizilim" yerine girilen ad gosterilir.
    playerName?: string | null;
    lang: Language;
    isWaitingOpponent?: boolean;
    // Dizilim icin kalan sure (saniye). null = saat islemiyor (yerel oyun,
    // rakip henuz katilmadi) ve sayac hic basilmaz. Sure dolunca sunucu kalan
    // taslari rastgele diziyor, o yuzden bu geri sayim SUSTURULMAMALI.
    remainingSec?: number | null;
}

const SetupUI: React.FC<SetupUIProps> = ({ 
    piecesToPlace, 
    onPieceSelect, 
    selectedPieceName, 
    onFinishSetup, 
    onAutoSetup, 
    onClearSetup, 
    player,
    playerName = null,
    lang,
    isWaitingOpponent = false,
    remainingSec = null
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const isRed = player === PLAYERS.RED;
    const playerLabel = isRed ? t.playerRedColor : t.playerBlueColor;
    const playerColor = isRed ? 'text-amber-400' : 'text-sky-300';
    const hasPiecesToPlace = piecesToPlace.length > 0;

    // Geri sayim, eskiden burada duran "0 / 40" rozetinin YERINE geciyor: kac tas
    // kaldigini havuz listesi ve "Hazir" dugmesinin kilidi zaten soyluyordu, oysa
    // surenin dolmak uzere oldugunu hicbir sey soylemiyordu.
    const geriSayim = remainingSec === null ? null
        : `${Math.floor(Math.max(0, remainingSec) / 60)}:${String(Math.max(0, remainingSec) % 60).padStart(2, '0')}`;
    const geriSayimRengi = remainingSec === null ? ''
        : remainingSec <= 10 ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
        : remainingSec <= 30 ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
        : 'bg-slate-800 border-slate-700 text-slate-200';

    return (
        <div className="w-full lg:w-72 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-2xl flex-shrink-0 flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                    <h2 className={`text-lg font-black tracking-wide ${playerColor}`}>{playerName?.trim() || playerLabel}</h2>
                    {geriSayim !== null && (
                        <span
                            title={t.setupTimer}
                            className={`flex items-center gap-1.5 text-lg font-black font-mono px-2.5 py-1 rounded-lg border tabular-nums ${geriSayimRengi}`}
                        >
                            <Hourglass className="w-4 h-4" />
                            {geriSayim}
                        </span>
                    )}
                </div>

                {hasPiecesToPlace ? (
                    <div className="h-80 overflow-y-auto pr-1 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-2">
                            {piecesToPlace.map(piece => (
                                <div
                                    key={piece.name}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'SETUP_PIECE', pieceName: piece.name }));
                                        e.dataTransfer.effectAllowed = 'move';
                                        onPieceSelect(piece);
                                    }}
                                    onClick={() => onPieceSelect(piece)}
                                    className={`p-2 rounded-lg text-xs font-semibold text-left transition-all cursor-grab active:cursor-grabbing select-none flex items-center justify-between ${
                                        selectedPieceName === piece.name 
                                            ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300 shadow-md scale-[1.02]' 
                                            : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80'
                                    }`}
                                >
                                    <span className="truncate">{getPieceLabel(piece.name, lang)}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/40 font-mono font-bold">
                                        x{piece.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-80 flex flex-col items-center justify-center text-center p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                        <p className="text-sm font-bold text-emerald-300">{t.allPlaced}</p>
                        <p className="text-xs text-slate-400 mt-1">{t.allPlacedHint}</p>
                    </div>
                )}
            </div>

            <div className="mt-4 space-y-2 pt-3 border-t border-slate-800">
                {isWaitingOpponent ? (
                    <div className="p-4 bg-amber-950/60 border border-amber-500/50 rounded-xl text-center space-y-2 animate-pulse">
                        <CheckCircle2 className="w-8 h-8 text-amber-400 mx-auto" />
                        <p className="text-xs font-black text-amber-300 uppercase">{t.setupLocked}</p>
                        <p className="text-[11px] text-slate-300">{t.waitingOpponentSetup}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={onAutoSetup}
                                className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!hasPiecesToPlace}
                            >
                                <Shuffle className="w-3.5 h-3.5" />
                                <span>{t.randomSetup}</span>
                            </button>
                            <button
                                onClick={onClearSetup}
                                className="flex items-center justify-center gap-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-bold text-xs py-2 px-3 rounded-lg transition-all border border-rose-700/60"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{t.clearSetup}</span>
                            </button>
                        </div>

                        <button
                            onClick={onFinishSetup}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
                            disabled={hasPiecesToPlace}
                        >
                            {t.readyButton}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SetupUI;
