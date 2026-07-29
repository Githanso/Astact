import React from 'react';
import { Language, Player, GamePhase, OnlineStatus, RoomState } from '../types';
import { PLAYERS, TRANSLATIONS } from '../constants';
import { oyunDurumu } from '../lib/durumMetni';
import { RotateCcw, LogOut, Shield, WifiOff, Clock } from 'lucide-react';

// Oyun ekraninin ust seridi. Iki satir:
//   1) solda marka, sagda RAKIBIN durumu + oda kodu,
//   2) solda KENDI rozetin, ortada durum cumlesi, sagda eylemler.
//
// Iki taraf da tam olarak bir kez basiliyor: rozet "ben kimim, bagli miyim",
// sag ust kunye "rakip kim, bagli mi". Ayni bilgiyi iki yerde gostermemek icin
// bolunme boyle secildi.
interface GameHeaderProps {
    lang: Language;
    isOnlineMode: boolean;
    isConnected: boolean;
    roomCode: string | null;
    myOnlineTeam: Player | null;
    roomState: RoomState | null;
    gamePhase: GamePhase;
    onlineStatus: OnlineStatus;
    currentPlayer: Player | null;
    turnTimeRemaining: number;
    onRestart: () => void;
    onLeaveRoom: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({
    lang, isOnlineMode, isConnected, roomCode, myOnlineTeam, roomState,
    gamePhase, onlineStatus, currentPlayer, turnTimeRemaining, onRestart, onLeaveRoom,
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const { metin: durumMetni, renk: durumRengi } = oyunDurumu(gamePhase, onlineStatus, currentPlayer, lang);

    const benKirmizi = myOnlineTeam === PLAYERS.RED;

    // Kendi kunyem — 2. satirdaki rozet. Ad istege bagli; bos birakildiysa takim
    // etiketi basiliyor.
    const benimAdim = (benKirmizi ? roomState?.redPlayer : roomState?.bluePlayer)
        || (benKirmizi ? t.playerRed : t.playerBlue);
    const benimBirligim = benKirmizi ? t.teamRedUnit : t.teamBlueUnit;

    // Rakibin kunyesi — 1. satirin sagi.
    const rakipKirmizi = !benKirmizi;
    const rakipVar = rakipKirmizi ? roomState?.redPresent : roomState?.bluePresent;
    const rakipBagli = rakipKirmizi ? roomState?.redConnected : roomState?.blueConnected;
    // "Bekleniyor" YALNIZCA slot gercekten bosken dogru — adsiz katilan biri
    // "bekleniyor" degil, sadece adini yazmamis.
    const rakipAdi = (rakipKirmizi ? roomState?.redPlayer : roomState?.bluePlayer)
        || (rakipVar ? (rakipKirmizi ? t.playerRed : t.playerBlue) : t.statusWaiting);
    const rakipDurumMetni = !rakipVar ? t.statusWaiting : (rakipBagli ? t.onlineLabel : t.offlineLabel);
    const rakipDurumRengi = !rakipVar ? 'text-slate-400' : (rakipBagli ? 'text-emerald-400' : 'text-rose-400');
    const rakipNoktaRengi = !rakipVar ? 'bg-slate-500' : (rakipBagli ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400');

    return (
        <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md">
            {/* 1. satir — marka SOLDA. Onceki tasarimda sagdaydi ve pano sutununa
                hizalanmak icin gorunmez bir bosluk kullaniyordu; panolar kalkinca o
                numaraya gerek kalmadi, duz bir justify-between yetiyor. */}
            <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-2 flex items-center justify-between gap-4">
                <div className="flex flex-col items-start flex-shrink-0">
                    {/* Tam lockup kare (684x711); yatay seride sigdirilinca yazi okunmaz
                        hale geliyor. viewBox ile "astact" yazisinin bandi kirpiliyor. */}
                    <svg viewBox="10 274 674 152" className="h-7 md:h-8 w-auto" role="img" aria-label={t.appTitle}>
                        <image href="/logo.svg" width="684" height="711" />
                    </svg>
                    <p className="mt-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                        {t.appSubtitle}
                    </p>
                </div>

                {/* Sag ust: RAKIBIN kunyesi + oda kodu. Kendi durumun asagidaki
                    rozette; ayni bilgi iki kez basilmiyor. */}
                {isOnlineMode && myOnlineTeam && (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 flex-wrap justify-end">
                        <span className={`flex items-center gap-1 ${rakipDurumRengi}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rakipNoktaRengi}`} />
                            {rakipDurumMetni}
                        </span>
                        <span>
                            {t.opponentShort}:{' '}
                            <strong className={rakipKirmizi ? 'text-red-400' : 'text-blue-400'}>
                                {rakipAdi}
                            </strong>
                        </span>
                        <span>{t.roomLabel}: <strong className="text-amber-400">{roomCode}</strong></span>
                    </div>
                )}
            </div>

            {isOnlineMode && (
                <div className="border-t border-slate-800/60">
                    <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-2 flex items-center gap-2 md:gap-3">
                        {/* KENDI rozetim: kim olduğum, hangi birlik, bagli miyim. */}
                        {myOnlineTeam && (
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex-shrink-0">
                                <Shield className={`w-5 h-5 flex-shrink-0 ${benKirmizi ? 'text-red-500' : 'text-blue-500'}`} />
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-200 truncate max-w-[9rem]">
                                        {benimAdim}
                                        <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">{t.youBadge}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[9rem]">{benimBirligim}</div>
                                </div>
                                {isConnected ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex-shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t.onlineLabel}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                                        <WifiOff className="w-3 h-3" /> {t.offlineLabel}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Durum seridi: sira kimde + kalan sure, TEK kutuda. Ayri bir
                            sure kutusu kurulmadi — ikisi ayni soruya cevap veriyor
                            ("simdi ne oluyor"), ayrildiklarinda goz iki yere gidiyordu.
                            Kutunun rengi zaten sirasi gelenin takim rengi, yani sure de
                            kimin suresi oldugunu renkten belli ediyor. */}
                        <div className={`flex-1 min-w-0 flex items-center justify-center gap-3 px-3 py-2 rounded-xl bg-slate-800/40 border text-xs font-bold ${durumRengi || 'text-slate-300 border-slate-700/60'}`}>
                            <span className="truncate">{durumMetni}</span>
                            {gamePhase.startsWith('PLAY') && (
                                <span className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-700/60 font-mono">
                                    <Clock className="w-3 h-3" />
                                    {turnTimeRemaining}{t.seconds}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={onRestart}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 transition-all active:scale-95"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.restartButton}</span>
                            </button>
                            <button
                                onClick={onLeaveRoom}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.leaveRoom}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default GameHeader;
