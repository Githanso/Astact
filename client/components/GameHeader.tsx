import React from 'react';
import { Language, Player, GamePhase, OnlineStatus, RoomState } from '../types';
import { PLAYERS, TRANSLATIONS } from '../constants';
import { oyunDurumu } from '../lib/durumMetni';
import { RotateCcw, LogOut, Shield, WifiOff, Clock } from 'lucide-react';
import { MuteToggle } from './SettingsControls';

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
    // Oyun basindan beri gecen sure (saniye). Once carpisma gecmisi cekmecesinin
    // basligindaydi; cekmece varsayilan KAPALI oldugu icin sure cogu zaman hic
    // gorunmuyordu, o yuzden ust seride tasindi.
    gecenSure: number;
    onRestart: () => void;
    onLeaveRoom: () => void;
    volume: number;          // ses duzeyi (0-1) — MuteToggle'in durumu
    onVolumeChange: (v: number) => void;
}

// Gecen sureyi MM:SS, 60 dk gecerse H:MM:SS biciminde yaz.
const formatSure = (sn: number) => {
    const s = Math.max(0, Math.floor(sn));
    const dk = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    if (dk < 60) return `${String(dk).padStart(2, '0')}:${ss}`;
    return `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}:${ss}`;
};

const GameHeader: React.FC<GameHeaderProps> = ({
    lang, isOnlineMode, isConnected, roomCode, myOnlineTeam, roomState,
    gamePhase, onlineStatus, currentPlayer, turnTimeRemaining, gecenSure, onRestart, onLeaveRoom,
    volume, onVolumeChange,
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
            {/* 1. satir UC BOLMELI: solda rakip kunyesi, ORTADA marka, sagda eylemler.
                grid-cols-[1fr_auto_1fr] kullaniliyor cunku yan bloklar farkli
                genislikte; flex + justify-between olsaydi logo merkezden kayardi. */}
            <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* SOL: RAKIBIN kunyesi + oda kodu. Kendi durumun asagidaki rozette;
                    ayni bilgi iki kez basilmiyor. */}
                <div className="justify-self-start min-w-0">
                    {isOnlineMode && myOnlineTeam && (
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 flex-wrap">
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

                {/* ORTA: marka */}
                <div className="justify-self-center flex flex-col items-center flex-shrink-0">
                    {/* Tam lockup kare (684x711); yatay seride sigdirilinca yazi okunmaz
                        hale geliyor. viewBox ile "astact" yazisinin bandi kirpiliyor. */}
                    <svg viewBox="10 274 674 152" className="h-7 md:h-8 w-auto" role="img" aria-label={t.appTitle}>
                        <image href="/logo.svg" width="684" height="711" />
                    </svg>
                    <p className="mt-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                        {t.appSubtitle}
                    </p>
                </div>

                {/* SAG: oyun eylemleri. Eskiden 2. satirin sagindaydi; sure gostergeleri
                    oraya tasininca yer degistirdiler. */}
                <div className="justify-self-end flex items-center gap-2 flex-shrink-0">
                    {isOnlineMode && (<>
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
                    </>)}
                </div>
            </div>

            {isOnlineMode && (
                <div className="border-t border-slate-800/60">
                    {/* 2. satir da UC BOLMELI (1. satirla ayni gerekce): solda kendi
                        rozetim, ORTADA durum cumlesi, sagda ses + sure gostergeleri.
                        Yan bloklar farkli genislikte oldugu icin cumleyi TAM ortada
                        tutmanin yolu 1fr_auto_1fr; flex olsaydi merkezden kayardi. */}
                    <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-3">
                        {/* SOL — KENDI rozetim: kim olduğum, hangi birlik, bagli miyim. */}
                        {myOnlineTeam ? (
                            <div className="justify-self-start flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex-shrink-0">
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
                        ) : <span />}

                        {/* ORTA: sira kimde cumlesi. Kutunun rengi sirasi gelenin takim
                            rengi — sureler disari tasindigi icin renk artik tek basina
                            "kimin turu" ipucunu tasiyor. */}
                        <div className={`justify-self-center min-w-0 px-4 py-2 rounded-xl bg-slate-800/40 border text-xs font-bold ${durumRengi || 'text-slate-300 border-slate-700/60'}`}>
                            <span className="block truncate text-center">{durumMetni}</span>
                        </div>

                        {/* SAG: ses + sure gostergeleri. Sureler eskiden durum kutusunun
                            icindeydi (uc bolmeli serit); kutu sadelesince disari alindi. */}
                        <div className="justify-self-end flex items-center gap-2 flex-shrink-0">
                            {/* Sustur / sesi ac. Once sag kenardaki cekmecenin basligindaydi;
                                cekmece kaldirilinca (icinde carpisma gecmisi vardi, o da
                                kaldirildi) oyun icindeki TEK ses denetimi olarak buraya
                                tasindi. Menu ekranindaki dugmeyle ayni bileseni kullaniyor. */}
                            <MuteToggle
                                volume={volume}
                                onVolumeChange={onVolumeChange}
                                lang={lang}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                                iconClassName="w-3.5 h-3.5"
                            />
                            {gamePhase.startsWith('PLAY') && (<>
                                {/* Sirasi gelenin kalan oynama suresi */}
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-mono text-lg tabular-nums">
                                    <Clock className="w-5 h-5" />
                                    {turnTimeRemaining}{t.seconds}
                                </span>
                                {/* Oyun basindan beri gecen sure. Etiket yok, yalnizca ikon +
                                    sure; ne oldugu title'dan okunuyor. Kehribar rengi sart:
                                    ayni boyuttalar, tur suresinden ayirt ettiren tek ipucu bu. */}
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 font-mono text-lg tabular-nums whitespace-nowrap" title={t.gameTime}>
                                    <Clock className="w-5 h-5" />
                                    {formatSure(gecenSure)}
                                </span>
                            </>)}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default GameHeader;
