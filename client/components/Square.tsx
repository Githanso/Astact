import React from 'react';
import { Coords, Player, SquareState , Language } from '../types';
import Piece from './Piece';
import ForestOverlay from './ForestOverlay';
import LakeOverlay from './LakeOverlay';

interface SquareProps {
    squareData: SquareState;
    coords: Coords;
    onClick: (coords: Coords) => void;
    onDropAction?: (source: any, targetCoords: Coords) => void;
    isMoveHighlight: boolean;
    isSelectedHighlight: boolean;
    currentPlayer: Player | null;
    perspectivePlayer?: Player | null;
    isForest?: boolean;
    lang?: Language;
    isCombatSquare?: boolean;
    forestDensity?: number;
}

const Square: React.FC<SquareProps> = ({ 
    squareData, 
    coords, 
    onClick, 
    onDropAction, 
    isMoveHighlight, 
    isSelectedHighlight, 
    currentPlayer,
    perspectivePlayer,
    isForest,
    forestDensity = 2,
    lang,
    isCombatSquare = false
}) => {
    let content = null;
    const activeViewPlayer = perspectivePlayer || currentPlayer;

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'BOARD_PIECE', coords }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!onDropAction) return;
        try {
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            onDropAction(parsed, coords);
        } catch (err) {
            console.warn(err);
        }
    };

    if (squareData === 'LAKE') {
        content = <LakeOverlay />;
    } else if (squareData === 'FOREST') {
        content = <ForestOverlay density={forestDensity} />;
    } else if (squareData) {
        content = (
            <div className="relative w-full h-full">
                {isForest && (
                    <div className="absolute inset-0 z-0 opacity-40">
                        <ForestOverlay density={1} />
                    </div>
                )}
                <div className="relative z-10 w-full h-full">
                    <Piece
                        lang={lang}
                        piece={squareData}
                        isOpponent={squareData.owner !== activeViewPlayer}
                        onDragStart={handleDragStart}
                    />
                </div>
            </div>
        );
    } else if (isForest) {
        content = <ForestOverlay density={forestDensity} />;
    }

    const isLightGrid = (coords.row + coords.col) % 2 === 0;
    const bgTileStyle = isLightGrid ? 'bg-slate-800/80' : 'bg-slate-800/50';

    return (
        <div
            className={`relative w-full h-full cursor-pointer group border border-slate-700/30 ${bgTileStyle} transition-all duration-150 select-none${isCombatSquare ? ' combat-shake' : ''}`}
            onClick={() => onClick(coords)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Base Content */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {content}
            </div>
            
            {/* Move & Selection Highlights */}
            {isMoveHighlight && (
                <div className="absolute inset-0 bg-amber-400/30 ring-2 ring-amber-400 z-20 flex items-center justify-center animate-pulse pointer-events-none">
                    <div className="w-3 h-3 rounded-full bg-amber-300 shadow-lg shadow-amber-400/50"></div>
                </div>
            )}
            
            {isSelectedHighlight && (
                <div className="absolute inset-0 ring-4 ring-amber-300 bg-amber-500/20 z-30 pointer-events-none animate-pulse"></div>
            )}
        </div>
    );
};

export default React.memo(Square);
