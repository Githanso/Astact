import React from 'react';
import { PlacedPiece, Language } from '../types';
import { PLAYERS, getPieceLabel } from '../constants';
import { Shield, Bomb, Flag, User } from 'lucide-react';

interface PieceProps {
    piece: PlacedPiece;
    isOpponent: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    lang?: Language;
}

const Piece: React.FC<PieceProps> = ({ piece, isOpponent, onDragStart, lang = 'TR' }) => {
    const label = getPieceLabel(piece.name, lang);
    const showBack = isOpponent && !piece.revealed;

    const isRed = piece.owner === PLAYERS.RED;
    
    const teamStyle = isRed 
        ? 'bg-gradient-to-b from-red-800 to-red-950 border-amber-500/80 text-amber-100 shadow-red-950/50'
        : 'bg-gradient-to-b from-blue-800 to-blue-950 border-sky-400/80 text-sky-100 shadow-blue-950/50';

    const canDrag = !isOpponent && !!onDragStart;

    if (showBack) {
        return (
            <div className="relative w-full h-full flex items-center justify-center p-0.5 group z-10 hover:z-[999]">
                <div className={`w-full h-full rounded-md ${isRed ? 'bg-slate-900 border-red-700' : 'bg-slate-900 border-blue-700'} border-2 flex items-center justify-center shadow-md relative overflow-hidden transition-all duration-200 transform group-hover:scale-200 group-hover:shadow-2xl`}>
                    <Shield className={`w-5 h-5 ${isRed ? 'text-red-500' : 'text-blue-500'} opacity-80`} />
                </div>
            </div>
        );
    }
    
    return (
        <div 
            className="relative w-full h-full flex items-center justify-center p-0.5 group z-10 hover:z-[999]"
            draggable={canDrag}
            onDragStart={canDrag ? onDragStart : undefined}
        >
            <div 
                className={`w-full h-full rounded-md ${teamStyle} border-2 flex flex-col items-center justify-center p-1 shadow-lg cursor-grab active:cursor-grabbing transition-transform duration-200 transform group-hover:scale-200 group-hover:shadow-2xl group-hover:ring-2 group-hover:ring-amber-300 relative overflow-hidden select-none`}
            >
                {piece.name === 'Bayrak' ? (
                    <div className="flex flex-col items-center justify-center">
                        <Flag className="w-5 h-5 text-amber-300 animate-pulse" />
                        <span className="text-[10px] font-extrabold uppercase tracking-tight mt-0.5">{label}</span>
                    </div>
                ) : piece.name === 'Bomba' ? (
                    <div className="flex flex-col items-center justify-center">
                        <Bomb className="w-5 h-5 text-red-400" />
                        <span className="text-[10px] font-extrabold uppercase tracking-tight mt-0.5">{label}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full px-0.5">
                        <span className="text-sm font-black leading-none drop-shadow-sm">{piece.rank}</span>
                        <span className="text-[9px] font-bold leading-tight truncate w-full text-center mt-0.5 opacity-90">
                            {label}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Piece;
