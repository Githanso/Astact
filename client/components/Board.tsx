import React from 'react';
import { BoardState, Coords, PlacedPiece, Player , Language } from '../types';
import { FOREST_COORDS } from '../constants';
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

const Board: React.FC<BoardProps> = ({ board, onSquareClick, onDropAction, highlightedPiece, validMoves, currentPlayer, perspectivePlayer, lang, lastCombatCoords }) => {
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
                    className="grid grid-cols-11 grid-rows-10 gap-0.5 p-1.5 rounded-xl shadow-2xl flex-1 bg-slate-900 border-4 border-slate-700/80 shadow-slate-950/80 aspect-[11/10]"
                >
                {board.map((row, rowIndex) =>
                    row.map((square, colIndex) => {
                        const isMove = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                        const isSelected = highlightedPiece?.position.row === rowIndex && highlightedPiece?.position.col === colIndex;
                        const forestMatch = FOREST_COORDS.find(f => f.row === rowIndex && f.col === colIndex);
                        
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
                                isForest={!!forestMatch}
                                forestDensity={forestMatch?.density || 2}
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
