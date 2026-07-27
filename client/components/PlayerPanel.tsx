import React, { useState } from 'react';
import { Player, GamePhase, CombatResult, SpecialAbility, Language, GameStats, OnlineStatus } from '../types';
import { PIECE_DEFINITIONS, PLAYERS, TRANSLATIONS, getPieceLabel, MAX_MISSED_TURNS } from '../constants';
import { Clock, ChevronDown, ChevronUp, ShieldAlert, Swords, Trophy, Info } from 'lucide-react';

// Tahtanin yanindaki oyuncu panosu. Ust kisimda o oyuncunun galibiyet sayisi,
// altinda tur durumu, ele gecirilenler, rutbe hiyerarsisi ve carpisma gecmisi.
// Dil secici / istatistik butonu / sure on ayarlari bu panoda YOK — onlar GameInfo'da.
interface PlayerPanelProps {
    panelPlayer: Player;           // Panonun ait oldugu oyuncu (galibiyet kutusu bunu gosterir)
    currentPlayer: Player | null;
    gamePhase: GamePhase;
    combatHistory: CombatResult[];
    redCapturedCount: number;
    blueCapturedCount: number;
    stats: GameStats;
    turnTimeRemaining: number;
    missedTurns: { red: number; blue: number };   // süresi dolduğu için kaçırılan tur
    isOnlineMode: boolean;   // online modda kaçırma kuralı işlemiyor, kutu gizlenir
    onlineStatus: OnlineStatus;   // doluysa durum satırı rakibe göre yazılır
    lang: Language;
}

const CombatHistoryItem: React.FC<{ result: CombatResult; lang: Language }> = ({ result, lang }) => {
    const { outcome, attacker, defender } = result;

    if (!attacker || !defender) return null;

    const attackerColor = attacker.owner === PLAYERS.RED ? 'text-amber-400' : 'text-sky-300';
    const defenderColor = defender.owner === PLAYERS.RED ? 'text-amber-400' : 'text-sky-300';

    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const aLabel = getPieceLabel(attacker.name, lang);
    const dLabel = getPieceLabel(defender.name, lang);
    const fill = (tpl: string) => (tpl || '')
        .replace(/\{a\}/g, aLabel)
        .replace(/\{d\}/g, dLabel)
        .replace(/\{ar\}/g, String(attacker.rank))
        .replace(/\{dr\}/g, String(defender.rank))
        .replace(/\{rw\}/g, t.rankWord);
    const ownerLabel = (owner: string) => owner === PLAYERS.RED ? t.playerRed : t.playerBlue;

    let winnerText = '';
    switch (outcome) {
        case 'ATTACKER_WINS':
            if (attacker.special === SpecialAbility.MINER && defender.name === 'Bomba') {
                winnerText = t.combatMiner;
            } else if (attacker.special === SpecialAbility.SPY && defender.rank === 10) {
                winnerText = t.combatSpy;
            } else {
                winnerText = fill(t.combatHigherWins);
            }
            break;
        case 'GAME_OVER':
            winnerText = fill(t.combatFlagCaptured);
            break;
        case 'DEFENDER_WINS':
            winnerText = defender.name === 'Bomba' ? fill(t.combatBombHit) : fill(t.combatDefenderWins);
            break;
        case 'EQUAL_RANK':
        case 'BOTH_LOSE':
            winnerText = fill(t.combatEqualRank);
            break;
    }

    return (
        <div className="p-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-xs leading-relaxed shadow-sm">
            <div className="font-semibold flex items-center justify-between gap-1 mb-1 border-b border-slate-700/60 pb-1">
                <span className={`${attackerColor} font-bold`}>{ownerLabel(attacker.owner)} {aLabel}</span>
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span className={`${defenderColor} font-bold`}>{ownerLabel(defender.owner)} {dLabel}</span>
            </div>
            <p className="font-medium text-amber-200">{winnerText}</p>
        </div>
    );
};

const PlayerPanel: React.FC<PlayerPanelProps> = ({
    panelPlayer,
    currentPlayer,
    gamePhase,
    combatHistory,
    redCapturedCount,
    blueCapturedCount,
    stats,
    turnTimeRemaining,
    missedTurns,
    isOnlineMode,
    onlineStatus,
    lang,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Oyun bilgisi panosu sayfa açıldığında KAPALI başlar (ayarlar panosu açık kalır).
    const [isOpen, setIsOpen] = useState(false);
    const [showPowers, setShowPowers] = useState(false);

    const isRed = panelPlayer === PLAYERS.RED;
    const winLabel = isRed ? t.redWins : t.blueWins;
    const winCount = isRed ? stats.redWins : stats.blueWins;
    const winBoxStyle = isRed
        ? 'border-amber-500/50 bg-amber-950/30 text-amber-400'
        : 'border-sky-500/50 bg-sky-950/30 text-sky-300';

    const powerRanking = Object.values(PIECE_DEFINITIONS)
        .filter(p => p.movable)
        .sort((a, b) => b.rank - a.rank);

    let statusText = '';
    let playerColor = '';

    if (currentPlayer) {
        playerColor = currentPlayer === PLAYERS.RED ? 'text-amber-400 border-amber-500/50' : 'text-sky-300 border-sky-500/50';
    }

    switch (gamePhase) {
        case 'SETUP_RED': statusText = t.setupRedStatus; break;
        case 'SETUP_BLUE': statusText = t.setupBlueStatus; break;
        case 'PLAY_RED': statusText = t.turnRedStatus; break;
        case 'PLAY_BLUE': statusText = t.turnBlueStatus; break;
        case 'GAME_OVER': statusText = t.gameOverStatus; break;
    }

    // Online modda durum satırı RAKİBE göre yazılır — kendi durumunu göstermenin bilgi
    // değeri yok. onlineStatus yalnızca online modda doluyor, yani yerel (aynı ekran)
    // oyunda yukarıdaki switch aynen geçerli kalıyor.
    if (onlineStatus) {
        switch (onlineStatus) {
            case 'OPPONENT_WAITING':
                statusText = t.opponentWaiting;
                playerColor = 'text-slate-300 border-slate-600/60';
                break;
            case 'OPPONENT_OFFLINE':
                statusText = t.opponentOffline;
                playerColor = 'text-rose-400 border-rose-500/50';
                break;
            case 'OPPONENT_SETTING_UP':
                statusText = t.opponentSettingUp;
                playerColor = 'text-slate-300 border-slate-600/60';
                break;
            case 'OPPONENT_READY':
                statusText = t.opponentReady;
                playerColor = 'text-emerald-300 border-emerald-500/50';
                break;
            case 'YOUR_TURN':
                statusText = t.yourTurnStatus;
                playerColor = 'text-emerald-300 border-emerald-500/50';
                break;
            case 'OPPONENT_TURN':
                statusText = t.opponentTurnStatus;
                playerColor = 'text-slate-300 border-slate-600/60';
                break;
        }
    }

    return (
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl flex-shrink-0">
            {/* Pano basligi — tiklayinca acilip kapaniyor */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800/60 transition-colors rounded-xl ${isOpen ? 'rounded-b-none border-b border-slate-800' : ''}`}
            >
                <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>{t.gameInfoPanelTitle}</span>
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {!isOpen ? null : (
        <div className="p-4 flex flex-col space-y-4">
            {/* Galibiyet sayaci */}
            <div className={`rounded-xl border-2 p-3 text-center shadow-md ${winBoxStyle}`}>
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>{winLabel}</span>
                </div>
                <div className="text-2xl font-black leading-tight mt-0.5">{winCount}</div>
            </div>

            {/* Tur durumu ve geri sayim */}
            <div className={`text-sm font-black p-3 rounded-xl border ${playerColor} bg-slate-800/90 shadow-md flex items-center justify-between`}>
                <span>{statusText}</span>
                {gamePhase.startsWith('PLAY') && (
                    <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-950/60 font-mono text-amber-400 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        <span>{turnTimeRemaining}{t.seconds}</span>
                    </div>
                )}
            </div>

            {/* Ele gecirilenler */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-2">{t.capturedPieces}</h3>
                <div className="flex justify-between text-xs font-bold">
                    <span className="text-amber-400">{t.playerRed}: {redCapturedCount} / 40</span>
                    <span className="text-sky-300">{t.playerBlue}: {blueCapturedCount} / 40</span>
                </div>
            </div>

            {/* Kaçırılan tur — ikisi de sınıra ulaşınca oyun berabere biter.
                Online modda kural işlemediği için kutu hiç gösterilmiyor. */}
            {!isOnlineMode && (
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-2">{t.missedTurnsLabel}</h3>
                    <div className="flex justify-between text-xs font-bold">
                        <span className={missedTurns.red >= MAX_MISSED_TURNS ? 'text-rose-400' : 'text-amber-400'}>
                            {t.playerRed}: {missedTurns.red} / {MAX_MISSED_TURNS}
                        </span>
                        <span className={missedTurns.blue >= MAX_MISSED_TURNS ? 'text-rose-400' : 'text-sky-300'}>
                            {t.playerBlue}: {missedTurns.blue} / {MAX_MISSED_TURNS}
                        </span>
                    </div>
                </div>
            )}

            {/* Rutbe hiyerarsisi (acilir) */}
            <div>
                <button
                    className="w-full font-bold text-xs text-amber-300 bg-slate-800/80 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center transition-all"
                    onClick={() => setShowPowers(!showPowers)}
                >
                    <span className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{t.piecePowers} & {t.specialRules}</span>
                    </span>
                    {showPowers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPowers && (
                    <div className="mt-2 text-xs bg-slate-800/90 rounded-xl p-3 border border-slate-700 animate-fade-in space-y-2">
                        <ul className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                            {powerRanking.map(p => (
                                <li key={p.name} className="flex items-center justify-between border-b border-slate-700/40 py-0.5">
                                    <span className="font-bold text-amber-400">{getPieceLabel(p.name, lang)}</span>
                                    <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">{p.rank}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-2 border-t border-slate-700 text-[11px] text-slate-300 space-y-1 leading-relaxed">
                            <p>• {t.spyRule}</p>
                            <p>• {t.minerRule}</p>
                            <p>• {t.bombRule}</p>
                            <p>• {t.sameRankRule}</p>
                            <p>• {t.noBackwardRule}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Carpisma gecmisi */}
            <div className="flex-1 flex flex-col min-h-0">
                <h3 className="font-bold text-xs text-amber-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>{t.combatHistory}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({combatHistory.length})</span>
                </h3>
                <div className="h-44 overflow-y-auto bg-slate-800/80 rounded-xl p-2 space-y-2 text-xs border border-slate-700 custom-scrollbar">
                    {combatHistory.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-6">{t.noCombatYet}</p>
                    ) : (
                        combatHistory.map((result, index) => (
                            <CombatHistoryItem key={index} result={result} lang={lang} />
                        ))
                    )}
                </div>
            </div>
        </div>
            )}
        </div>
    );
};

export default PlayerPanel;
