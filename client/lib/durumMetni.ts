import { GamePhase, OnlineStatus, Player, Language } from '../types';
import { PLAYERS, TRANSLATIONS } from '../constants';

// Oyunun o anki durum cumlesi ve rengi. IKI yerde kullaniliyor: header'daki orta
// seridin durum kutusu. Ayni switch'i iki dosyaya kopyalamak
// birinin digerinden sapmasina yol acardi (bir kez oldu: cevirilerden once
// panoda sabit Turkce metinler kalmisti).
//
// Online modda durum RAKIBE gore yazilir — kendi durumunu gostermenin bilgi degeri
// yok, oyuncu kendi dizilim panelini zaten goruyor. onlineStatus yalnizca online
// modda doluyor; bos gelirse asagidaki faz switch'i aynen gecerli kaliyor.
export const oyunDurumu = (
    gamePhase: GamePhase,
    onlineStatus: OnlineStatus,
    currentPlayer: Player | null,
    lang: Language,
): { metin: string; renk: string } => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

    let metin = '';
    let renk = '';

    if (currentPlayer) {
        renk = currentPlayer === PLAYERS.RED
            ? 'text-amber-400 border-amber-500/50'
            : 'text-sky-300 border-sky-500/50';
    }

    switch (gamePhase) {
        case 'SETUP_RED': metin = t.setupRedStatus; break;
        case 'SETUP_BLUE': metin = t.setupBlueStatus; break;
        case 'PLAY_RED': metin = t.turnRedStatus; break;
        case 'PLAY_BLUE': metin = t.turnBlueStatus; break;
        case 'GAME_OVER': metin = t.gameOverStatus; break;
    }

    if (onlineStatus) {
        switch (onlineStatus) {
            case 'OPPONENT_WAITING':
                metin = t.opponentWaiting; renk = 'text-slate-300 border-slate-600/60'; break;
            case 'OPPONENT_OFFLINE':
                metin = t.opponentOffline; renk = 'text-rose-400 border-rose-500/50'; break;
            case 'OPPONENT_SETTING_UP':
                metin = t.opponentSettingUp; renk = 'text-slate-300 border-slate-600/60'; break;
            case 'OPPONENT_READY':
                metin = t.opponentReady; renk = 'text-emerald-300 border-emerald-500/50'; break;
            case 'YOUR_TURN':
                metin = t.yourTurnStatus; renk = 'text-emerald-300 border-emerald-500/50'; break;
            case 'OPPONENT_TURN':
                metin = t.opponentTurnStatus; renk = 'text-slate-300 border-slate-600/60'; break;
        }
    }

    return { metin, renk };
};
