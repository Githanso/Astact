import React, { useState } from 'react';
import { Language } from '../types';
import {
    PIECE_DEFINITIONS, PIECE_COUNTS, TRANSLATIONS, getPieceLabel,
    SCOUT_COOLDOWN, MAX_MISSED_TURNS, DIZILIM_SURESI_SN,
} from '../constants';
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

// Menudeki Ayarlar penceresinde acilir kurallar bolumu. VARSAYILAN KAPALI:
// pencerenin asil isi sure on ayari, kurallar ise bir kez okunup birakilan
// referans — acik baslasa her acilista o kutuyu asmak gerekirdi.

// Rutbe tablosu PIECE_DEFINITIONS'tan TURETILIYOR, elle yazilmiyor: rutbe veya
// adet degistiginde (ki daha once degisti — Izci 4->2) bu liste kendiliginden
// dogru kaliyor. Hareket edemeyen taslar (Mayın, Sancak) ayri gruba aliniyor:
// Mayın'in ic rutbesi 11 ama bu bir SIRALAMA degeri degil, resolveCombat onu
// rutbe karsilastirmasindan once ozel dalda ele aliyor — tabloda 11 yazmak
// "Mareşal'i yener" gibi yanlis bir izlenim verirdi.
const HAREKETLI = Object.values(PIECE_DEFINITIONS)
    .filter(p => p.movable)
    .sort((a, b) => b.rank - a.rank);
const SABIT = Object.values(PIECE_DEFINITIONS).filter(p => !p.movable);

interface RulesSectionProps {
    lang: Language;
}

export const RulesSection: React.FC<RulesSectionProps> = ({ lang }) => {
    const [isOpen, setIsOpen] = useState(false);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

    const kurallar = [
        t.ruleSpy,
        t.ruleMiner,
        t.ruleScout.replace('{n}', String(SCOUT_COOLDOWN)),
        t.ruleEqual,
        t.ruleMove,
        t.ruleLake,
        t.ruleForest,
        t.ruleFlag,
        t.ruleNoMoves,
        t.ruleTimeout.replace('{n}', String(MAX_MISSED_TURNS)),
        t.ruleSetupTime.replace('{n}', String(DIZILIM_SURESI_SN)),
    ];

    return (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden">
            <button
                onClick={() => setIsOpen(o => !o)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-200 truncate">{t.rulesTitle}</span>
                </span>
                {isOpen
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </button>

            {/* Kapaliyken govde DOM'dan kalkiyor — pencerenin geri kalani ayni sekilde
                calisiyor, tutarli olsun diye ayni yol secildi. */}
            {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 max-h-[46vh] overflow-y-auto custom-scrollbar">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 mb-1.5">
                            {t.rulesRanksTitle}
                        </h3>
                        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{t.rulesColRank}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{t.rulesColPiece}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 text-right">{t.rulesColCount}</span>
                            {HAREKETLI.map(p => (
                                <React.Fragment key={p.name}>
                                    <span className="font-mono font-black text-amber-400">{p.rank}</span>
                                    <span className="text-slate-300 truncate">{getPieceLabel(p.name, lang)}</span>
                                    <span className="font-mono text-slate-400 text-right">×{PIECE_COUNTS[p.name]}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 mb-1.5">
                            {t.rulesSpecialPieces}
                        </h3>
                        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
                            {SABIT.map(p => (
                                <React.Fragment key={p.name}>
                                    <span className="font-mono text-slate-600">—</span>
                                    <span className="text-slate-300 truncate">
                                        {getPieceLabel(p.name, lang)}
                                        <span className="text-slate-500"> · {t.rulesImmobileNote}</span>
                                    </span>
                                    <span className="font-mono text-slate-400 text-right">×{PIECE_COUNTS[p.name]}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 mb-1.5">
                            {t.rulesSpecialTitle}
                        </h3>
                        <ul className="space-y-1.5">
                            {kurallar.map((kural, i) => (
                                <li key={i} className="flex gap-2 text-[11px] leading-snug text-slate-300">
                                    <span className="text-amber-500/70 flex-shrink-0">▸</span>
                                    <span>{kural}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RulesSection;
