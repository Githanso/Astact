import React, { useState } from 'react';
import { CombatResult, SpecialAbility, Language } from '../types';
import { PLAYERS, TRANSLATIONS, getPieceLabel, MAX_MISSED_TURNS } from '../constants';
import { Swords, Info, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { MuteToggle } from './SettingsControls';

// Carpisma gecmisi cekmecesi: PENCERENIN sag kenarina yapisik durur (fixed right-0).
// Acildiginda 500px genisligindedir; kapaliyken sagda ince bir tutamak kalir.
interface PlayerPanelProps {
    combatHistory: CombatResult[];
    missedTurns: { red: number; blue: number };   // süresi dolduğu için kaçırılan tur
    isOnlineMode: boolean;   // online modda kaçırma kuralı işlemiyor, kutu gizlenir
    gecenSure: number;       // oyun basindan beri gecen sure (saniye)
    volume: number;          // ses duzeyi (0-1) — MuteToggle'in durumu
    onVolumeChange: (v: number) => void;
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
    // Online modda gizli kalan tasin rank alani null gelir (ormanda saklanan tas).
    // String(null) "null" basardi; bilinmeyen deger "?" ile gosteriliyor.
    // (Yardimcinin adi bilerek Ingilizce: i18n denetimi "Rutbe" kelimesini sabit
    // metin sanip uyariyor, bkz. test/i18n-denetim.mjs TR_KELIME.)
    const rankMetni = (r: number | null | undefined) => (typeof r === 'number' ? String(r) : '?');
    const fill = (tpl: string) => (tpl || '')
        .replace(/\{a\}/g, aLabel)
        .replace(/\{d\}/g, dLabel)
        .replace(/\{ar\}/g, rankMetni(attacker.rank))
        .replace(/\{dr\}/g, rankMetni(defender.rank))
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
            if (defender.name === 'Bomba') { winnerText = fill(t.combatBombHit); }
            else if (defender.special === SpecialAbility.SPY && attacker.rank === 10) { winnerText = t.combatSpy; }
            else { winnerText = fill(t.combatDefenderWins); }
            break;
        case 'EQUAL_RANK':
        case 'BOTH_LOSE':
            if (defender.name === 'Bomba') { winnerText = fill(t.combatBombHit); }
            else { winnerText = fill(t.combatEqualRank); }
            break;
    }

    return (
        <div className="p-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-xs leading-relaxed shadow-sm">
            <div className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-slate-700/60 pb-1 mb-1">
                <span className={`${attackerColor} font-bold`}>{ownerLabel(attacker.owner)} {aLabel}</span>
                <span className="text-slate-500">{rankMetni(attacker.rank)}</span>
                <Swords className="w-3.5 h-3.5 text-amber-400 mx-0.5" />
                <span className={`${defenderColor} font-bold`}>{ownerLabel(defender.owner)} {dLabel}</span>
                <span className="text-slate-500">{rankMetni(defender.rank)}</span>
            </div>
            <p className="font-medium text-amber-200">{winnerText}</p>
        </div>
    );
};

const PlayerPanel: React.FC<PlayerPanelProps> = ({
    combatHistory,
    missedTurns,
    isOnlineMode,
    gecenSure,
    volume,
    onVolumeChange,
    lang,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Cekmece VARSAYILAN KAPALI baslar: acikken tahtanin ustune bindigi icin
    // oyuncu her acilista once kapatmak zorunda kalmasin.
    const [isOpen, setIsOpen] = useState(false);

    // Gecen sureyi MM:SS, 60 dk gecerse H:MM:SS biciminde yaz.
    const formatSure = (sn: number) => {
        const s = Math.max(0, Math.floor(sn));
        const dk = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, '0');
        if (dk < 60) return `${String(dk).padStart(2, '0')}:${ss}`;
        return `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}:${ss}`;
    };

    // KAPALI: yalnizca sag kenarda ince bir tutamak duruyor.
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                aria-expanded={false}
                aria-label={t.combatHistory}
                title={t.combatHistory}
                className="fixed right-0 top-[calc(var(--baslik-h,129px)_+_16px)] z-30 flex items-center gap-1 py-3 pl-2 pr-1.5 rounded-l-xl bg-slate-900/95 border border-r-0 border-slate-800 shadow-2xl backdrop-blur-sm text-slate-300 hover:text-amber-300 hover:bg-slate-800/95 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                <Info className="w-4 h-4 text-amber-400" />
                {combatHistory.length > 0 && (
                    <span className="text-[10px] font-black text-amber-400">{combatHistory.length}</span>
                )}
            </button>
        );
    }

    return (
        <aside className="fixed right-0 top-[calc(var(--baslik-h,129px)_+_16px)] z-30 w-[500px] max-w-[92vw] bg-slate-900/95 border border-r-0 border-slate-800 rounded-l-xl shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden">
            {/* Panel basligi. Sag ok = kapat; kapaliyken sol ok cikiyor (ac). */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 border-b border-slate-800">
                <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>{t.combatHistory}</span>
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-black text-[11px] tracking-normal" title={t.gameTime}>
                    <Clock className="w-3.5 h-3.5" />
                    {t.gameTime}: {formatSure(gecenSure)}
                </span>
                <span className="flex items-center gap-1.5">
                    {/* Sustur / sesi ac — menu ekranindakiyle ayni tek nokta; buradan
                        da cekmeceyi kapatmadan kontrol edilebiliyor. */}
                    <MuteToggle
                        volume={volume}
                        onVolumeChange={onVolumeChange}
                        lang={lang}
                        className="p-1.5 rounded-lg bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-400"
                        iconClassName="w-3.5 h-3.5"
                    />
                    <button
                        onClick={() => setIsOpen(false)}
                        aria-expanded={true}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <span className="text-[10px] font-normal">({combatHistory.length})</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </span>
            </div>

            <div className="p-4 flex flex-col space-y-4">
            {/* Panodan CIKARILANLAR ve nedenleri:
                  - durum cumlesi + geri sayim -> header'in orta seridinde, tek kutuda,
                  - rutbe hiyerarsisi          -> menudeki Ayarlar penceresinde,
                  - galibiyet sayaci           -> kaldirildi (gerek gorulmedi),
                  - ele gecirilenler           -> kaldirildi; hangi tastan kac kaldigi
                    zaten tasa tiklayinca tahtanin ustunde tur bazinda cikiyor. */}

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

            {/* Carpisma gecmisi. Basligi panelin kendi basligi tasiyor, burada
                tekrarlanmiyor — yalnizca sayac kaldi. */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="h-72 overflow-y-auto bg-slate-800/80 rounded-xl p-2 space-y-2 text-xs border border-slate-700 custom-scrollbar">
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
        </aside>
    );
};

export default PlayerPanel;
