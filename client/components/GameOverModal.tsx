import React from 'react';
import { Player, GamePhase, Language, GameOverReason, RestartNotice } from '../types';
import { PLAYERS, TRANSLATIONS, MAX_MISSED_TURNS } from '../constants';

interface GameOverModalProps {
    winner: Player | null;
    // Beraberlik. Sebep TEK değil: iki oyuncu da tur kaçırma sınırına ulaşmış
    // (TIMEOUT_DRAW) ya da iki tarafın da oynayacak taşı kalmamış (NO_MOVES)
    // olabilir. Eskiden yalnızca zaman aşımı beraberliği biliniyordu ve diğer
    // beraberlikte kapak hiç açılmıyordu (aşağıdaki görünürlük koşulu).
    isDraw?: boolean;
    notice?: string | null;    // online: yeniden başlatma isteği durumu
    // Rakip "Yeniden Başlat" dediğinde bu DURUM, notice ise metni taşıyor. REQUESTED
    // olunca kazanan tarafa "Tekrar Oyna" + "Lobiye Dön" menüsü çıkıyor; WAITING iken
    // kendi isteğimizi bekliyoruz ve tek "Yeniden Başlat" butonu kalıyor.
    restartNotice?: RestartNotice;
    // Online'da bu oyuncunun takımı. Doluysa ekran KİŞİSELLEŞTİRİLİR: kazanan
    // "ZAFER", kaybeden "YENİLDİN" görür. Yerel modda (aynı ekran) null gelir ve
    // iki taraf da aynı ekrana baktığı için tarafsız "Kazanan: X" metni kalır.
    myTeam?: Player | null;
    reason?: GameOverReason;
    onRestart: () => void;
    // Beraberlik ve "rakip çekildi" sonrası yeniden başlatmanın anlamı yok
    // (rakip odada değil); bunun yerine "Lobiye Dön" gösterilir. Bu buton
    // odayı terk edip lobiye (menüye) döndürür.
    onLeaveLobby: () => void;
    // ZORUNLU: gorunurlugun olcutu bu. Istege bagli birakilirsa gecilmedigi
    // durumda modal sessizce hic gorunmez olurdu.
    gamePhase: GamePhase;
    lang?: Language;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ winner, isDraw = false, notice = null, restartNotice = null, myTeam = null, reason = null, onRestart, onLeaveLobby, gamePhase, lang = 'TR' }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    // Görünürlüğün TEK ölçütü FAZ. Eskiden yalnızca winner/isTimeoutDraw'a bakılıyordu
    // ve bu, ekranı kilitleyen bir duruma yol açıyordu: fazı GAME_OVER'dan çeken bazı
    // dallar (room_started_setup gibi) bu iki değeri temizlemiyordu, sonuç ekranı da
    // dizilimin üstünde asılı kalıyordu. Oyuncu için "Yeniden Başlat çalışmıyor" gibi
    // görünüyordu — oysa oyun çoktan yeniden başlamıştı, sadece kapak kalkmıyordu.
    // Artık bayat değer ekranı kilitleyemez: faz oyun sonundan çıkınca kapak da kalkar.
    if (gamePhase !== 'GAME_OVER') return null;
    // Beraberlikte kazanan YOK; burada koşulsuz null dönülürse beraberlik ekrana
    // hiç düşmez.
    if (!winner && !isDraw) return null;

    const winnerColor = winner === PLAYERS.RED ? 'text-amber-400' : 'text-sky-300';
    const kisisel = !!(winner && myTeam);
    const kazandim = kisisel && winner === myTeam;
    const online = !!myTeam;

    // YALNIZCA "rakip odadan çekildi" durumunda yeniden başlatmanın anlamı yok:
    // rakip odada değil, onay hiç gelmeyecek. Orada tek seçenek lobiye dönmek.
    //
    // BERABERLİK bu gruba GİRMİYOR (eskiden giriyordu ve hataydı): iki oyuncu da
    // 3 tur kaçırdığında ikisi de odada ve bağlı, dolayısıyla yeniden başlatma
    // onayı pekâlâ gelebiliyor. Oyuncu beraberlikte lobiye çıkıp yeni oda kurmak
    // zorunda kalıyordu.
    const sadeceLobi = online && reason === 'OPPONENT_QUIT';
    // Lobiye dönme seçeneği yalnızca online oyunda var; yerel modda lobi yok.
    const lobiSecenegi = online;

    // Başlık: kişiselleştirilmiş modda kazanan/kaybeden ayrı; beraberlikte ortak.
    const baslik = !winner ? t.drawHeading
        : kisisel ? (kazandim ? t.victoryHeading : t.defeatHeading)
        : t.gameOverStatus;

    const baslikRengi = !winner ? 'from-slate-200 via-slate-300 to-slate-400'
        : kisisel && !kazandim ? 'from-rose-300 via-rose-400 to-rose-500'
        : 'from-amber-200 via-amber-400 to-amber-500';

    // Açıklama satırı: neden kazandın/kaybettin. Sebep başına AYRI metin var;
    // "rakip odadan ayrıldı" ile "bağlantısı koptu" aynı şey değil.
    const zaferMetni: Record<string, string> = {
        OPPONENT_LEFT: t.victoryOpponentLeft,
        OPPONENT_QUIT: t.victoryOpponentQuit,
        NO_MOVES: t.victoryNoMoves,
    };
    const yenilgiMetni: Record<string, string> = {
        OPPONENT_LEFT: t.defeatYouLeft,
        OPPONENT_QUIT: t.defeatOpponentQuit,
        NO_MOVES: t.defeatNoMoves,
    };
    const aciklama = kazandim
        ? (reason && zaferMetni[reason]) || t.victoryFlag
        : (reason && yenilgiMetni[reason]) || t.defeatFlag;
    // Beraberlik açıklaması da sebebe bağlı.
    const beraberlikMetni = reason === 'NO_MOVES'
        ? t.drawNoMoves
        : (t.drawTimeoutReason || '').replace(/\{n\}/g, String(MAX_MISSED_TURNS));

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in">
            <div className={`bg-slate-900 rounded-2xl shadow-2xl p-8 text-center border-2 max-w-sm w-full relative ${
                kisisel && !kazandim ? 'border-rose-500/50' : 'border-amber-500/50'
            }`}>
                <h2 className={`text-3xl font-black mb-3 bg-gradient-to-r bg-clip-text text-transparent ${baslikRengi}`}>
                    {baslik}
                </h2>
                {!winner ? (
                    <p className="text-sm font-semibold text-slate-300 mb-8 leading-relaxed">
                        {beraberlikMetni}
                    </p>
                ) : kisisel ? (
                    <p className="text-sm font-semibold text-slate-300 mb-8 leading-relaxed">
                        {aciklama}
                    </p>
                ) : (
                    <p className={`text-xl font-extrabold mb-8 ${winnerColor}`}>
                        {t.winnerLabel}: {winner === PLAYERS.RED ? t.playerRed : t.playerBlue}!
                    </p>
                )}
                {/* Rakip odadan cekildiyse tek secenek lobi — restart onayi gelmeyecek. */}
                {sadeceLobi ? (
                    <button
                        onClick={onLeaveLobby}
                        className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500/40 text-white font-black py-3 px-6 rounded-xl text-sm transition-all shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
                    >
                        {t.returnToLobby}
                    </button>
                ) : (
                    /* Diger butun bitislerde (galibiyet, yenilgi, BERABERLIK ve rakip
                       "Tekrar Oyna" dedigi an) ayni ikili: Tekrar Oyna = onayla — iki
                       taraf da onaylayinca oyun bastan baslar; Lobiye Don = odayi birak.
                       Lobi secenegi yalnizca online oyunda anlamli. */
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onRestart}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 px-6 rounded-xl text-sm transition-all shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
                        >
                            {t.playAgain}
                        </button>
                        {lobiSecenegi && (
                            <button
                                onClick={onLeaveLobby}
                                className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500/40 text-white font-black py-3 px-6 rounded-xl text-sm transition-all shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
                            >
                                {t.returnToLobby}
                            </button>
                        )}
                    </div>
                )}
                {/* Online oyunda sunucu, yeniden başlatmayı iki taraf da isteyene kadar
                    yapmıyor. Bu not olmadan düğme "çalışmıyor" gibi görünüyordu. */}
                {!sadeceLobi && notice && (
                    <p className="mt-4 text-xs font-semibold text-amber-300 leading-relaxed">{notice}</p>
                )}
            </div>
        </div>
    );
};

export default GameOverModal;