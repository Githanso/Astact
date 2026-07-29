import React from 'react';
import { Language } from '../types';
import { PIECE_COUNTS, TRANSLATIONS, getPieceLabel } from '../constants';

// Secili tasin TURUNE ait sayac. Tahtada bir tasa tiklandiginda tahtanin ustunde
// beliriyor, secim kalkinca kayboluyor.
//
// Neden yalnizca secilen tur: butun turlerin listesi (14 satir) her secimde
// ekrani kaplardi ve oyuncunun o an sordugu soru tek bir sey — "elimde bundan kac
// tane kaldi". Tam liste zaten menudeki kurallar bolumunde duruyor.
interface PieceCountChipProps {
    pieceName: string;
    kalanBende: number;
    rakipKaybi: number;
    lang: Language;
}

const PieceCountChip: React.FC<PieceCountChipProps> = ({ pieceName, kalanBende, rakipKaybi, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const toplam = PIECE_COUNTS[pieceName] ?? 0;

    return (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-sm text-[11px] whitespace-nowrap">
                <span className="font-black text-slate-100">{getPieceLabel(pieceName, lang)}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                    {t.countYoursLabel}{' '}
                    <strong className="font-mono text-emerald-400">{kalanBende}</strong>
                    <span className="text-slate-600">/{toplam}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                    {t.countOpponentLostLabel}{' '}
                    <strong className="font-mono text-rose-400">{rakipKaybi}</strong>
                    <span className="text-slate-600">/{toplam}</span>
                </span>
            </div>
        </div>
    );
};

export default PieceCountChip;
