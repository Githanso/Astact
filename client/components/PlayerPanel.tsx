import React, { useState } from 'react';
import { CombatResult, SpecialAbility, Language } from '../types';
import { PLAYERS, TRANSLATIONS, getPieceLabel, MAX_MISSED_TURNS } from '../constants';
import { ChevronLeft, ChevronRight, Swords, Info } from 'lucide-react';

// Carpisma gecmisi cekmecesi: PENCERENIN sag kenarina yapisik, tahtanin ustune
// binen bir panel. Eskiden sabit genislikte bir sutundu ve tahta o genisligi hep
// kaybediyordu; artik yer ayirmiyor, tahta bosalan alani aliyor.
//
// `fixed` (main'e gore absolute degil): main max-w-7xl ile sinirli ve ortalanmis,
// yani genis ekranda sagda 300px+ bosluk kaliyor — cekmece oraya degil PENCERE
// kenarina yapismali. Dikey konum --baslik-h'ten geliyor, boylece baslik
// yuksekligi degisince cekmece de kayiyor.
//
// Geriye tek is kaldi: carpisma gecmisi (yerel modda ayrica kacirilan tur kutusu).
// Panodan cikarilanlar ve nedenleri asagida, govdedeki yorumda.
interface PlayerPanelProps {
    combatHistory: CombatResult[];
    missedTurns: { red: number; blue: number };   // süresi dolduğu için kaçırılan tur
    isOnlineMode: boolean;   // online modda kaçırma kuralı işlemiyor, kutu gizlenir
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
    combatHistory,
    missedTurns,
    isOnlineMode,
    lang,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Oyun bilgisi panosu sayfa açıldığında KAPALI başlar.
    const [isOpen, setIsOpen] = useState(false);

    // KAPALI: yalnizca sag kenarda ince bir tutamak duruyor. Cekmece acikken
    // tahtanin ustune bindigi icin kapali baslamak sart — aksi halde oyuncu her
    // acilista once onu kapatmak zorunda kalirdi.
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
        <div className="fixed right-0 top-[calc(var(--baslik-h,129px)_+_16px)] z-30 w-72 max-w-[85vw] bg-slate-900/95 border border-r-0 border-slate-800 rounded-l-xl shadow-2xl backdrop-blur-sm">
            {/* Cekmece basligi. Sag ok = "kapat, saga kaysin"; kapaliyken sol ok
                cikiyor ("ac, sola gelsin"). Yon boyle secildi cunku cekmece SAG
                kenardan aciliyor — okun isaret ettigi yer, dugmeye basinca panelin
                gidecegi yer. */}
            <button
                onClick={() => setIsOpen(false)}
                aria-expanded={true}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800/60 transition-colors rounded-tl-xl border-b border-slate-800"
            >
                <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>{t.combatHistory}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <div className="p-4 flex flex-col space-y-4">
            {/* Panodan CIKARILANLAR ve nedenleri:
                  - durum cumlesi + geri sayim -> header'in orta seridinde, tek kutuda,
                  - rutbe hiyerarsisi          -> menudeki Ayarlar penceresinde,
                  - galibiyet sayaci           -> kaldirildi (gerek gorulmedi),
                  - ele gecirilenler           -> kaldirildi; hangi tastan kac kaldigi
                    zaten tasa tiklayinca tahtanin ustunde tur bazinda cikiyor.
                Pano varsayilan KAPALI basladigi icin buradaki kopyalar zaten cogu
                zaman hic okunmuyordu. */}

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

            {/* Rutbe hiyerarsisi buradan KALDIRILDI: ayni icerik menudeki Ayarlar
                penceresinde, daha eksiksiz haliyle duruyor (RulesSection — adetler,
                ozel taslar ve dokuz kural maddesi). Oyun ortasinda ikinci bir kopya
                tutmak hem yer harciyor hem de ikisinin ayrisma riskini doguruyordu. */}

            {/* Carpisma gecmisi. Basligi cekmecenin kendi basligi tasiyor, burada
                tekrarlanmiyor — yalnizca sayac kaldi. */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="text-[10px] text-slate-400 font-normal text-right mb-1">({combatHistory.length})</div>
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
        </div>
    );
};

export default PlayerPanel;
