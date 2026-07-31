import React from 'react';
import { Coords, Player, SquareState , Language } from '../types';
import { Eye } from 'lucide-react';
import { PLAYERS } from '../constants';
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
    // Tasin bu kareye YENI indigini gosteren halka. Hamleyi yapanin takimini
    // tasiyor: halka o takimin rengini aliyor, boylece kimin oynadigi da belli
    // oluyor. null = halka yok.
    rippleOwner?: Player | null;
    // Secili Izci bu dusman tasini gorebilir. Hamle isaretinden AYRI renk: tiklama
    // sonucu farkli (tas alinmaz, kimligi acilir) ve karisirsa oyuncu tur harcar.
    isScoutTarget?: boolean;
    // Sirasi olmayan oyuncunun tasi: soluk (alfa) cizilir. Board hesaplar.
    isDimmed?: boolean;
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
    isCombatSquare = false,
    rippleOwner = null,
    isScoutTarget = false,
    isDimmed = false
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
        content = <ForestOverlay />;
    } else if (squareData) {
        content = (
            <div className="relative w-full h-full">
                {isForest && (
                    <div className="absolute inset-0 z-0 opacity-40">
                        <ForestOverlay />
                    </div>
                )}
                <div className="relative z-10 w-full h-full">
                    <Piece
                        lang={lang}
                        piece={squareData}
                        isOpponent={squareData.owner !== activeViewPlayer}
                        onDragStart={handleDragStart}
                        dimmed={isDimmed}
                    />
                </div>
            </div>
        );
    } else if (isForest) {
        content = <ForestOverlay />;
    }

    const isLightGrid = (coords.row + coords.col) % 2 === 0;

    return (
        <div
            className={`relative w-full h-full cursor-pointer group border border-slate-700/30 bg-slate-900 transition-all duration-150 select-none${isCombatSquare ? ' combat-shake' : ''}`}
            onClick={() => onClick(coords)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Zemin dokusu: public/assets/floor.avif. Satranc deseni karartma
                katmaniyla korunuyor (acik kare daha aydinlik). Gol veya orman
                kendi overlay'ini bastigi icin bu doku yalnizca bos/tasli karelerde gorunur. */}
            <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
                <img src="/assets/floor.avif" alt="" draggable={false} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 ${isLightGrid ? 'bg-slate-800/35' : 'bg-slate-800/60'}`} />
            </div>
            {/* Base Content */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {content}
            </div>            <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
                <img src="/assets/floor.avif" alt="" draggable={false} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 ${isLightGrid ? 'bg-slate-800/35' : 'bg-slate-800/60'}`} />
            </div>
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

            {/* Izci hedefi: hamle isaretleri kehribar, bu CAMGOBEGI. Ayni renkte
                olsalardi oyuncu saldiri sanip tur harcayabilirdi. */}
            {isScoutTarget && (
                <div className="absolute inset-0 ring-2 ring-cyan-300 bg-cyan-400/25 z-20 flex items-center justify-center pointer-events-none animate-pulse">
                    <Eye className="w-4 h-4 text-cyan-200 drop-shadow" />
                </div>
            )}

            {/* Hamle halkasi. Kapsayicida overflow-hidden YOK: cember kareden tasarak
                buyuyor. pointer-events-none sart, yoksa sondugu 0.65sn boyunca kareye
                tiklamayi yutar ve oyuncu "tiklama calismiyor" sanar. */}
            {rippleOwner && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                    <div className={`move-ripple w-full h-full rounded-full border-2 ${
                        rippleOwner === PLAYERS.RED ? 'border-amber-300' : 'border-sky-300'
                    }`}></div>
                </div>
            )}
        </div>
    );
};

export default React.memo(Square);
