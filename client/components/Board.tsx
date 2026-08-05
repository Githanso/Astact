import React from 'react';
import { BoardState, Coords, PlacedPiece, Player , Language } from '../types';
import { CANLI, HAREKET_AZALT } from '../constants';
import { suDalgasiniBaslat } from '../lib/suDalgasi';
import Square from './Square';

interface BoardProps {
    board: BoardState;
    onSquareClick: (coords: Coords) => void;
    onDropAction?: (source: any, targetCoords: Coords) => void;
    highlightedPiece: PlacedPiece | null;
    validMoves: Coords[];
    currentPlayer: Player | null;
    perspectivePlayer?: Player | null;
    lang?: Language;
    lastCombatCoords?: Coords | null;
    // Son hamlenin INDIGI kare ve onu oynayan takim; o karede halka animasyonu doner.
    lastMove?: { coords: Coords; owner: Player } | null;
    // Secili Izci'nin gorebilecegi dusman kareleri (hamle degil, istihbarat hedefi).
    scoutTargets?: Coords[];
    // Bu oyunun ormanlari. SABITTEN DEGIL sunucudan geliyor: arazi her oyunda
    // yeniden uretiliyor, iki oyuncunun ayni tahtayi gormesi buna bagli.
    forests?: { row: number; col: number; density: number }[];
}

// Kenar koordinatlari: HER IKI oyuncunun dizilimi ayni anda gosterilir; her oyuncu
// kendi kenarindaki seritleri okur. Perspektife gore degismez, sira gectikce donmez.
//
//   MAVI  (sutun 0-3, solda)  -> UST harf seridi (a..k) + SOL sayi seridi (1..10)
//   KIRMIZI (sutun 7-10, sagda) -> ALT harf seridi (k..a) + SAG sayi seridi (10..1)
//
// Boylece her oyuncunun kendi kenarindaki ilk karesi 'a', kendi solundaki ilk
// karesi '1' olur. (Bkz. public/00.jpg — istenen duzen.)
const FILES = Array.from({ length: 11 }, (_, i) => String.fromCharCode(97 + i)); // a..k
const RANKS = Array.from({ length: 10 }, (_, i) => String(i + 1));               // 1..10
const FILES_TERS = [...FILES].reverse();                                         // k..a
const RANKS_TERS = [...RANKS].reverse();                                         // 10..1

const fileStrip = (keyPrefix: string, labels: string[]) => (
    <div className="grid grid-cols-11 gap-0.5 px-1.5" aria-hidden="true">
        {labels.map((f, i) => (
            <div key={`${keyPrefix}-${i}`} className="text-center text-[10px] font-bold text-slate-500 select-none leading-4">
                {f}
            </div>
        ))}
    </div>
);

const rankStrip = (keyPrefix: string, labels: string[]) => (
    <div className="grid grid-rows-10 gap-0.5 py-1.5 w-4 shrink-0" aria-hidden="true">
        {labels.map((r, i) => (
            <div key={`${keyPrefix}-${i}`} className="flex items-center justify-center text-[10px] font-bold text-slate-500 select-none">
                {r}
            </div>
        ))}
    </div>
);

const Board: React.FC<BoardProps> = ({ board, onSquareClick, onDropAction, highlightedPiece, validMoves, currentPlayer, perspectivePlayer, lang, lastCombatCoords, lastMove, scoutTargets = [], forests = [] }) => {
    // Gol yuzeyinin dalgasi. Tahta ekranda oldugu surece donuyor, tahta gidince
    // duruyor — menude bos yere rAF cevirmenin anlami yok.
    React.useEffect(() => {
        if (!CANLI || HAREKET_AZALT) return;
        return suDalgasiniBaslat();
    }, []);

    return (
        <div className="w-full max-w-[900px] mx-auto flex flex-col items-center">
            {/* ust harf seridi — solda/sagda sayi seritleri kadar bosluk birakilir */}
            <div className="flex w-full">
                <div className="w-4 shrink-0" />
                <div className="flex-1">{fileStrip('top', FILES)}</div>
                <div className="w-4 shrink-0" />
            </div>

            <div className="flex w-full items-stretch">
                {rankStrip('left', RANKS)}
                {/* 10 satir x 11 sutun — oyuncular sag-sol karsi karsiya */}
                <div
                    className="relative grid grid-cols-11 grid-rows-10 gap-0.5 p-1.5 rounded-xl shadow-2xl flex-1 bg-slate-900 border-4 border-slate-700/80 shadow-slate-950/80 aspect-[11/10]"
                >
                {/* Zeminin canliligi: tahtanin ustunden gecen bulut golgesi.
                    Toprak dalgalanmaz — zemini canlandiran sey uzerinden gecen isik.

                    TEK katman, kare basina degil: 110 karenin her birine ayri katman
                    hem pahali olurdu hem de desen 110 kez tekrar ederdi. Tekrar,
                    sahteligin en cabuk yakalanan turu. Tek katman ayrica kare
                    sinirlarinda kesilmiyor, tahtayi butun olarak gecıyor.

                    Yigindaki yeri kasitli: z-index verilmedigi icin zemin/gol/orman
                    uzerine biniyor ama TASLARIN ALTINDA kaliyor (Piece koku z-10).
                    Boylece 8 piksellik rutbe rozeti hic soluklasmiyor — rozet
                    okunurlugu oyunun temeli, bulut golgesi ondan onemli degil. */}
                {CANLI && (
                    <div
                        className="zemin-isik absolute pointer-events-none mix-blend-soft-light"
                        style={{
                            left: '-15%', top: '-15%', width: '130%', height: '130%',
                            backgroundImage:
                                'radial-gradient(ellipse 30% 34% at 18% 22%, rgba(255,246,214,0.55), transparent 68%),' +
                                'radial-gradient(ellipse 26% 30% at 72% 38%, rgba(0,0,0,0.60), transparent 70%),' +
                                'radial-gradient(ellipse 34% 26% at 44% 76%, rgba(255,246,214,0.45), transparent 70%),' +
                                'radial-gradient(ellipse 22% 28% at 86% 80%, rgba(0,0,0,0.50), transparent 72%),' +
                                'radial-gradient(ellipse 28% 22% at 8% 62%, rgba(0,0,0,0.40), transparent 72%)',
                        }}
                    />
                )}
                {board.map((row, rowIndex) =>
                    row.map((square, colIndex) => {
                        const isMove = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                        const isSelected = highlightedPiece?.position.row === rowIndex && highlightedPiece?.position.col === colIndex;
                        const forestMatch = forests.find(f => f.row === rowIndex && f.col === colIndex);
                        // Sirasi OLMAYAN oyuncunun taslari soluk cizilir. currentPlayer null
                        // ise (menu/oyun sonu) dim yok; mevcut davranis korunur.
                        const isDimmed = !!(currentPlayer && square && typeof square === 'object' && square.owner !== currentPlayer);
                        
                        return (
                            <Square
                                key={`${rowIndex}-${colIndex}`}
                                squareData={square}
                                coords={{ row: rowIndex, col: colIndex }}
                                onClick={onSquareClick}
                                onDropAction={onDropAction}
                                isMoveHighlight={isMove}
                                isSelectedHighlight={isSelected}
                                currentPlayer={currentPlayer}
                                perspectivePlayer={perspectivePlayer}
                                lang={lang}
                                isCombatSquare={!!lastCombatCoords && lastCombatCoords.row === rowIndex && lastCombatCoords.col === colIndex}
                                rippleOwner={lastMove && lastMove.coords.row === rowIndex && lastMove.coords.col === colIndex ? lastMove.owner : null}
                                isScoutTarget={scoutTargets.some(t => t.row === rowIndex && t.col === colIndex)}
                                isForest={!!forestMatch}
                                forestDensity={forestMatch?.density || 2}
                                isDimmed={isDimmed}
                            />
                        );
                    })
                )}
                </div>
                {rankStrip('right', RANKS_TERS)}
            </div>

            {/* alt harf seridi */}
            <div className="flex w-full">
                <div className="w-4 shrink-0" />
                <div className="flex-1">{fileStrip('bottom', FILES_TERS)}</div>
                <div className="w-4 shrink-0" />
            </div>
        </div>
    );
};

export default Board;
