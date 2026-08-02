import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { BoardState, Coords, GamePhase, PlacedPiece, Player, PieceDefinition, SpecialAbility, CombatResult, Language, TimerPreset, TimerConfig, GameStats, OnlineStatus, RestartNotice, GameOverReason, ConnectionNotice, RoomState, TerrainData } from './types';
import { BOARD_ROWS, BOARD_COLS, LAKE_COORDS, FOREST_COORDS, PIECE_DEFINITIONS, createInitialPiecePool, PLAYERS, TIMER_PRESETS, TRANSLATIONS, MAX_MISSED_TURNS, TOPLAM_TAS } from './constants';
import Board from './components/Board';
import SetupUI from './components/SetupUI';
import PlayerPanel from './components/PlayerPanel';
import MenuScreen from './components/MenuScreen';
import GameHeader from './components/GameHeader';
import PieceCountChip from './components/PieceCountChip';
import { kalanTaslarim, rakipKayiplari } from './lib/tasSayimi';
import RoomCodeModal from './components/RoomCodeModal';
import MenuSettingsModal from './components/MenuSettingsModal';
import RestartNoticeModal from './components/RestartNoticeModal';
import GameOverModal from './components/GameOverModal';
import OnlineModal from './components/OnlineModal';
import ConnectionBanner from './components/ConnectionBanner';
import MoveErrorToast from './components/MoveErrorToast';
import { soundManager } from './lib/soundFX';
import { oyunGorselleriYukle } from './lib/preloadAssets';

// Sunucudaki DISCONNECT_TIMEOUT_MS ile ayni: rakip donmezse oyun bu surenin
// sonunda hukmen bitiyor. Sunucu roomState.disconnectTimeoutMs ile de bildiriyor;
// bu sabit yalnizca o bilgi yokken (kendi baglantimiz koptugunda) kullaniliyor.
const KOPMA_PENCERESI_MS = 60_000;
const YENIDEN_BAGLANMA_ARALIGI_MS = 2_000;
const MAX_YENIDEN_BAGLANMA = Math.ceil(KOPMA_PENCERESI_MS / YENIDEN_BAGLANMA_ARALIGI_MS);

// Goller artik SABIT DEGIL, oyun basinda sunucuda uretiliyor; bu yuzden liste
// disaridan veriliyor. Varsayilan, sunucudan arazi gelmeden onceki ilk render
// icin (bos tahta yanip sonmesin).
const createEmptyBoard = (lakes: { row: number; col: number }[] = LAKE_COORDS): BoardState => {
    const board: BoardState = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    lakes.forEach(coord => { board[coord.row][coord.col] = 'LAKE'; });
    return board;
};

const mergeBoards = (mb: BoardState, pieces: any[]) => {
    if (!Array.isArray(pieces)) return;
    for (const row of pieces) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            if (cell && typeof cell === 'object' && cell.owner) {
                mb[cell.position?.row ?? 0][cell.position?.col ?? 0] = cell;
            }
        }
    }
};

const App: React.FC = () => {
    // Giris ekrani. gamePhase'e dokunmaz, yalnizca render'i kapilar.
    const [screen, setScreen] = useState<'MENU' | 'GAME'>('MENU');
    // Oyun tahtasi grafikleri (floor/forest/lake avif) hazir mi? Hazir olmadan
    // oyun ekranina gecilmez; yukleme MENUde gizli yapilir, bitince gecis aninda
    // acilir. Boylece oyun ekrani acilirken kareler bos gorunmez.
    const [oyunGorselleriHazir, setOyunGorselleriHazir] = useState(false);
    const [board, setBoard] = useState<BoardState>(createEmptyBoard);
    const [gamePhase, setGamePhase] = useState<GamePhase>('SETUP_RED');
    const [selectedPiece, setSelectedPiece] = useState<PlacedPiece | null>(null);
    const [validMoves, setValidMoves] = useState<Coords[]>([]);
    const [piecesToPlace, setPiecesToPlace] = useState<PieceDefinition[]>(createInitialPiecePool());
    const [selectedPieceToPlace, setSelectedPieceToPlace] = useState<PieceDefinition | null>(null);
    const [winner, setWinner] = useState<Player | null>(null);
    const [redCaptured, setRedCaptured] = useState<PlacedPiece[]>([]);
    const [blueCaptured, setBlueCaptured] = useState<PlacedPiece[]>([]);
    const [combatHistory, setCombatHistory] = useState<CombatResult[]>([]);
    const [lastCombatCoords, setLastCombatCoords] = useState<Coords | null>(null);
    // Oyunun (tur) basladigi an. Sunucudan gelir (both_setup_complete /
    // game_state_restored); yeniden baslatmada null'a doner. "Gecen oyun suresi"
    // sayaci bununla senkron hesaplaniyor (PlayerPanel).
    const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
    // Oyun basindan beri gecen sure (saniye). GAME_OVER'da sayac durur, son hali kalir.
    const [gecenSure, setGecenSure] = useState<number>(0);

    // Gecen oyun suresi sayaci: gameStartedAt'ten beri gecen sureyi her saniye
    // gunceller. Oyun bitince (GAME_OVER) interval durur, son sure ekranda kalir.
    useEffect(() => {
        if (gameStartedAt == null) return;
        const guncelle = () => setGecenSure(Math.floor((Date.now() - gameStartedAt) / 1000));
        guncelle();
        if (gamePhase !== 'PLAY_RED' && gamePhase !== 'PLAY_BLUE') return;
        const id = setInterval(guncelle, 1000);
        return () => clearInterval(id);
    }, [gameStartedAt, gamePhase]);
    // Son hamlenin INDIGI kare — orada halka animasyonu doner. lastCombatCoords'tan
    // ayri tutuluyor cunku o yalnizca CARPISMA olunca doluyor; oysa sade hamlelerin
    // de gorunmesi gerekiyor, rakip oynadiginda tahtada ne degistigi baska turlu
    // fark edilmiyor.
    const [lastMove, setLastMove] = useState<{ coords: Coords; owner: Player } | null>(null);
    // Bu oyunun arazisi. SUNUCU uretiyor (her oyunda farkli), istemci yalnizca
    // ciziyor — eskiden sabitten okunuyordu. Varsayilan yalnizca sunucudan ilk
    // mesaj gelene kadar gecerli; olmasaydi tahta bir an bombos gorunurdu.
    // Hem state hem ref: state cizim icin, ref handleWsMessage icin (o callback
    // bos bagimlilikla tanimli, state'in guncel halini goremez).
    const [terrain, setTerrain] = useState<TerrainData>({ lakes: LAKE_COORDS, forests: FOREST_COORDS });
    const terrainRef = useRef<TerrainData>({ lakes: LAKE_COORDS, forests: FOREST_COORDS });
    // Muzik oyun acilir acilmaz calsin diye varsayilan ses ACIK. Tarayici autoplay'i
    // kullanici jesti oncesi engelledigi icin gercek baslangic menudeki dugme tiklamasinda
    // oluyor (unlockAudio) — pratikte "oyun acilinca" demek.
    const [volume, setVolume] = useState<number>(0.5);
    const [lang, setLang] = useState<Language>('TR');
    const [timerPreset, setTimerPreset] = useState<TimerPreset>('NORMAL');
    const [timerConfig, setTimerConfig] = useState<TimerConfig>(TIMER_PRESETS.NORMAL);
    const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(TIMER_PRESETS.NORMAL.turnTime);
    const [isOnlineMode, setIsOnlineMode] = useState<boolean>(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [myOnlineTeam, setMyOnlineTeam] = useState<Player | null>(null);
    const [isOnlineModalOpen, setIsOnlineModalOpen] = useState<boolean>(false);
    const [onlineErrorMessage, setOnlineErrorMessage] = useState<string | null>(null);
    // Yeniden başlatma bildirimi. onlineErrorMessage YALNIZCA OnlineModal içinde
    // basılıyor, o da oyun sırasında kapalı — bu yüzden ayrı tutuluyor ve popup olarak
    // gösteriliyor. Metin değil DURUM saklanıyor (bkz. types.ts RestartNotice).
    const [restartNotice, setRestartNotice] = useState<RestartNotice>(null);
    // Oda kurulur kurulmaz kodu buyuk gosteren popup; rakip katilinca kendiliginden kapanir.
    const [showRoomCode, setShowRoomCode] = useState<boolean>(false);
    const [isMenuSettingsOpen, setIsMenuSettingsOpen] = useState<boolean>(false);
    const [isWaitingOpponentSetup, setIsWaitingOpponentSetup] = useState<boolean>(false);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    // Dizilim geri sayimi (saniye). Sunucu KALAN sureyi bildiriyor, istemci onu
    // saniyede bir azaltiyor — tur saatiyle ayni desen. null = saat islemiyor
    // (yerel oyun, rakip henuz katilmadi, dizilim bitti) ve panelde sayac cikmaz.
    const [setupTimeRemaining, setSetupTimeRemaining] = useState<number | null>(null);
    // Oyun sonu gerekcesi: ayni "kaybettin" ekrani bayrak dustugu icin mi yoksa
    // baglanti geri gelmedigi icin mi cikiyor, metin buna gore degisiyor.
    const [gameOverReason, setGameOverReason] = useState<GameOverReason>(null);
    // Baglanti seridi. Kopma anindan itibaren geri sayim gosterir.
    const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice>(null);
    const [connectionSec, setConnectionSec] = useState<number | null>(null);
    // Sunucunun reddettigi hamle. Ayni hata pes pese gelebildigi icin metinle
    // birlikte bir sayac tutuluyor: yalnizca metne baksaydik ikinci kez ayni
    // reddi alan oyuncuda serit yeniden canlanmaz, hic tepki yokmus gibi olurdu.
    const [moveError, setMoveError] = useState<{ metin: string; no: number } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    // Yeniden baglanmada sunucunun bildirdigi KALAN tur suresi (saniye); faz efekti
    // tarafindan bir kez okunup temizlenir.
    const sunucuKalanRef = useRef<number | null>(null);
    // Otomatik yeniden baglanma defteri.
    const odaBilgisiRef = useRef<{ room: string; name: string } | null>(null);
    const kastenAyrildiRef = useRef<boolean>(false);
    const denemeSayisiRef = useRef<number>(0);
    const yenidenBaglanTimerRef = useRef<number | null>(null);
    // connectWs kendi onclose'undan kendini cagiriyor; dogrudan referans dongu olurdu.
    const connectWsRef = useRef<((room: string, name: string) => WebSocket) | null>(null);
    // onclose closure'i eski state'i gorur; guncel degerler ref'ten okunuyor.
    const isOnlineModeRef = useRef<boolean>(false);
    useEffect(() => { isOnlineModeRef.current = isOnlineMode; }, [isOnlineMode]);
    const gamePhaseRef = useRef<GamePhase>('SETUP_RED');
    useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
    // room_created işlenirken kurucunun seçtiği süre lazım; handleWsMessage boş
    // bağımlılıkla useCallback olduğu için state'i doğrudan okuyamaz.
    const timerConfigRef = useRef<TimerConfig>(TIMER_PRESETS.NORMAL);
    useEffect(() => { timerConfigRef.current = timerConfig; }, [timerConfig]);
    const [stats, setStats] = useState<GameStats>({ gamesPlayed: 0, redWins: 0, blueWins: 0, totalBattles: 0, totalTurns: 0 });
    // Süresi dolduğu için kaçırılan tur sayısı (oyuncu başına, oyun boyunca birikimli).
    const [missedTurns, setMissedTurns] = useState<{ red: number; blue: number }>({ red: 0, blue: 0 });
    const [isDraw, setIsDraw] = useState<boolean>(false);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

    // Dil degisebildigi icin cevirici yardimcilar render disinda da guncel dili kullanir.
    const langRef = useRef<Language>(lang);
    useEffect(() => { langRef.current = lang; }, [lang]);
    // handleWsMessage bos bagimlilikla useCallback; guncel takimi buradan okur.
    const myOnlineTeamRef = useRef<Player | null>(null);
    useEffect(() => { myOnlineTeamRef.current = myOnlineTeam; }, [myOnlineTeam]);
    // "Hazir" dedim mi. both_setup_complete geldiginde HAYIR ise dizilimimi ben
    // degil sunucu yapti (sure doldu, kalan taslar rastgele dizildi) — oyuncuya
    // bunu soylemek sart, yoksa tahtasinin neden degistigini anlamiyor.
    const hazirDedimRef = useRef<boolean>(false);
    useEffect(() => { hazirDedimRef.current = isWaitingOpponentSetup; }, [isWaitingOpponentSetup]);
    // <html lang> secili dile gore guncellenir. Sabit lang="tr" birakilirsa CSS'in
    // text-transform: uppercase donusumu TURKCE kuralini uygular ve Ingilizce metni
    // bozar: "WINS" -> "WİNS" (noktali I).
    useEffect(() => { document.documentElement.lang = lang.toLowerCase(); }, [lang]);
    const TR_KEY = useCallback((key: string) => {
        const tt = TRANSLATIONS[langRef.current] || TRANSLATIONS.TR;
        return tt[key] ?? TRANSLATIONS.TR[key] ?? key;
    }, []);
    const TR_CODE = useCallback((code?: string, fallback?: string) => {
        if (!code) return fallback ?? '';
        const tt = TRANSLATIONS[langRef.current] || TRANSLATIONS.TR;
        return tt['err' + code] ?? TRANSLATIONS.TR['err' + code] ?? fallback ?? code;
    }, []);

    // Online oyunun TUM yerel durumunu temizleyip lobiye (menuye) doner. Hem
    // "Odadan Cik" (handleLeaveOnlineRoom) hem sunucunun room_closed bildirimi
    // buradan gecer — beraberlikte "Lobiye Don" gibi herkesi lobiye gonderen
    // akislar da bunu kullanir.
    const onlineDurumuSifirla = useCallback(() => {
        kastenAyrildiRef.current = true;
        if (yenidenBaglanTimerRef.current !== null) { clearTimeout(yenidenBaglanTimerRef.current); yenidenBaglanTimerRef.current = null; }
        setConnectionNotice(null); setConnectionSec(null); setGameOverReason(null);
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        setIsOnlineMode(false); setRoomCode(null); setMyOnlineTeam(null); setRoomState(null);
        setIsOnlineModalOpen(false); setIsWaitingOpponentSetup(false); setRestartNotice(null); setShowRoomCode(false);
        setMissedTurns({ red: 0, blue: 0 }); setIsDraw(false); setSetupTimeRemaining(null);
        setGameStartedAt(null); setGecenSure(0);
        setBoard(createEmptyBoard(terrainRef.current.lakes)); setGamePhase('SETUP_RED');
        setPiecesToPlace(createInitialPiecePool());
        setScreen('MENU');
    }, []);

    const handleWsMessage = useCallback((msg: any) => {
        // Tur süresinin tek doğruluk kaynağı SUNUCU (oda kurucusu belirler). Süreyi
        // taşıyan mesaj çok: roomState'liler, both_setup_complete, move_executed,
        // turn_timeout, game_state_restored, turn_time_changed. Her birinde ayrı ayrı
        // ele almak yerine tek noktada uyguluyoruz — katılan oyuncu kendi presetini
        // seçmiş olabilir ve ekranında YANLIŞ süre sayardı.
        const ms = msg.turnTimeMs ?? msg.roomState?.turnTimeMs;
        if (typeof ms === 'number' && isFinite(ms)) {
            const sn = Math.max(1, Math.round(ms / 1000));
            setTimerConfig(prev => (prev.turnTime === sn ? prev : { ...prev, turnTime: sn }));
        }
        // Dizilim saati ayni tek noktadan: sunucu KALAN sureyi yolluyor (mutlak son
        // tarih degil — istemci saati kayiksa mutlak damga dakikalarca yanlis sayar).
        // Dizilim suresi presete bagli DEGIL, herkes icin sabit; oda kurucusunun
        // secimi diye bir sey yok, o yuzden burada yalnizca geri sayim guncelleniyor.
        const srm = msg.setupRemainingMs ?? msg.roomState?.setupRemainingMs;
        if (typeof srm === 'number' && isFinite(srm)) setSetupTimeRemaining(Math.max(0, Math.ceil(srm / 1000)));
        else if (srm === null) setSetupTimeRemaining(null);
        // ARAZI de aynı mantıkla tek noktada uygulanıyor: her oyunda sunucuda
        // üretiliyor ve roomState taşıyan mesajlarla, ayrıca both_setup_complete /
        // game_state_restored / scout_done ile geliyor. Hem ref hem state tutuluyor:
        // ref'i bu callback okuyor (boş bağımlılıkla useCallback, state'i göremez),
        // state'i tahta çizimi kullanıyor.
        const gelenArazi = msg.terrain ?? msg.roomState?.terrain;
        if (gelenArazi && Array.isArray(gelenArazi.lakes)) {
            terrainRef.current = gelenArazi;
            setTerrain(gelenArazi);
            // Tahtanın GÖL hücreleri de tazelenmeli. room_started_setup tahtayı
            // yeniden kurmuyor; tazelemezsek dizilim boyunca ekranda VARSAYILAN
            // göller kalır — oyuncu gerçekte göl olmayan kareyi göl sanır.
            // Konmuş taşlar korunuyor (dizilim sürerken silinmemeli); göller
            // yalnızca tarafsız bantta olduğu için taşla çakışmıyorlar.
            setBoard(prev => {
                const nb = createEmptyBoard(gelenArazi.lakes);
                for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) {
                    const h = prev[r]?.[c];
                    if (h && typeof h === 'object') nb[r][c] = h;
                }
                return nb;
            });
        }
        switch (msg.type) {
            // Oda kurucusu kendi preset'ini HEMEN bildirmeli. Yukarıdaki senkron satırı
            // bu mesajla gelen sunucu VARSAYILANINI (35sn) uygulayıp kurucunun menüden
            // seçtiği süreyi eziyordu; kurucu 15sn seçmişken oyun 35sn ile başlıyordu.
            // Rakip beklenirken OYUN EKRANI HIC ACILMAZ: ekran MENU'de kalir, uzerinde
            // lobi (OnlineModal), onun da uzerinde kod popup'i durur. Eskiden burada
            // setScreen('GAME') vardi; perdeler animate-fade-in ile 250ms'de acildigi
            // icin oda her kuruldugunda once tahta+dizilim panosu bir an gorunup
            // kayboluyordu. Ekrani hic GAME'e cekmeyince gosterilecek tahta da olmuyor.
            // GAME'e gecisi tek bir yer yapiyor: room_started_setup (rakip katildiginda).
            // MENU'ye cekmek ATLANAMAZ, sadece setScreen'i kaldirmak yetmez: oyun
            // ekranindayken bagi kopup bos lobiye geri baglanan oyuncuda ekran GAME'de
            // kalir ve tahta yine lobinin arkasinda gorunurdu.
            case 'room_created': setRoomCode(msg.roomCode); setMyOnlineTeam(msg.playerTeam); setRoomState(msg.roomState); setIsOnlineMode(true); setOnlineErrorMessage(null); setScreen('MENU'); setIsOnlineModalOpen(true); setShowRoomCode(true); sendWsMessage({ type: 'set_turn_time', turnTime: timerConfigRef.current.turnTime }); break;
            case 'room_joined': setRoomCode(msg.roomCode); setMyOnlineTeam(msg.playerTeam); setRoomState(msg.roomState); setIsOnlineMode(true); setOnlineErrorMessage(null); setScreen('GAME'); if (msg.roomState?.gamePhase === 'SETUP') { setIsOnlineModalOpen(false); setGamePhase(msg.playerTeam === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); } break;
            // Oda dolu / oyun devam ediyor gibi KALICI redler: yeniden baglanmayi
            // burada durduruyoruz, yoksa istemci 2sn'de bir bosuna deneyip durur.
            // Modal katilma denemesinde kapaniyor, hata metni ise onun icinde
            // basiliyor — geri acilmazsa kullanici reddedildigini hic gormuyordu.
            case 'room_error': setOnlineErrorMessage(TR_CODE(msg.code, msg.message)); kastenAyrildiRef.current = true; setIsOnlineModalOpen(true); break;
            // Oda oyuncunun (odadan cikis/beraberlik "Lobiye Don"u ile) kapandigi
            // haber veriliyor: karsi taraf da lobiye doner. Tek seferlik kodun
            // odasi kapandigi icin yeniden baglanmak anlamsiz.
            case 'room_closed': onlineDurumuSifirla(); break;
            // Rakip katildi — kod popup'ina artik gerek yok.
            // DIKKAT: oyun sonu durumu da temizleniyor. Bu dal fazi GAME_OVER'dan
            // SETUP'a cekiyor; winner/isDraw/gameOverReason bayat kalirsa
            // sonuc ekrani dizilimin ustunde asili kaliyor (bkz. README, "berabere
            // sonrasi Yeniden Baslat calismiyor").
            // Gecen oyun suresi de SIFIRLANMALI: bu dal yeni bir oyunun dizilimini
            // acmis oluyor, eski oyunun sayaci birakilirsa yeni oyun sifirdan degil
            // onceki oyunun suresinden devam ediyormus gibi gorunuyordu.
            case 'room_started_setup': setRoomState(msg.roomState); setIsOnlineModalOpen(false); setScreen('GAME'); setShowRoomCode(false); setWinner(null); setGameOverReason(null); setIsDraw(false); setGameStartedAt(null); setGecenSure(0); setRestartNotice(null); setMyOnlineTeam(prev => { setGamePhase(prev === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); return prev; }); break;
            case 'player_setup_status': setRoomState(prev => prev ? { ...prev, redReady: msg.redReady, blueReady: msg.blueReady } : prev); break;
            case 'both_setup_complete': { const mb = createEmptyBoard(terrainRef.current.lakes); mergeBoards(mb, msg.myPieces); mergeBoards(mb, msg.opponentPieces); setBoard(mb); setGamePhase(msg.gamePhase || 'PLAY_RED'); setGameStartedAt(msg.gameStartedAt ?? Date.now()); setIsWaitingOpponentSetup(false); setIsOnlineModalOpen(false); setWinner(null); setGameOverReason(null); setIsDraw(false); setRestartNotice(null); setSetupTimeRemaining(null); setPiecesToPlace([]); setSelectedPieceToPlace(null); if (!hazirDedimRef.current) setMoveError(prev => ({ metin: TR_KEY('setupTimedOut'), no: (prev?.no ?? 0) + 1 })); soundManager.playVictory(); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); break; }
            // Yeniden baglanmada tahta bastan kuruluyor; eldeki secim de bayat.
            case 'game_state_restored': { const mb = createEmptyBoard(terrainRef.current.lakes); mergeBoards(mb, msg.myBoard); mergeBoards(mb, msg.opponentBoard); setBoard(mb); setSelectedPiece(null); setValidMoves([]); if (typeof msg.remainingMs === 'number') { const kalan = Math.max(0, Math.ceil(msg.remainingMs / 1000)); sunucuKalanRef.current = kalan; setTurnTimeRemaining(kalan); } if (msg.missedTurns) setMissedTurns(msg.missedTurns); setGameStartedAt(msg.gameStartedAt ?? Date.now()); setGamePhase(msg.gamePhase || 'PLAY_RED'); if (msg.gamePhase === 'GAME_OVER') { setWinner(msg.winner ?? null); setGameOverReason(msg.reason ?? null); setIsDraw(!msg.winner); setGamePhase('GAME_OVER'); } setOnlineErrorMessage(null); break; }
            // Tur suresini sunucu yurutuyor; sira degisimini o bildiriyor.
            // Suresi dolan taraf BEN isem bunu SOYLE. Eskiden sessizdi: secim ve
            // isaretler bir anda kayboluyor, sira karsiya geciyor, oyuncu sebebini
            // hicbir yerde goremiyordu. Geri sayim "Oyun Bilgisi" panosunda ama o
            // pano VARSAYILAN OLARAK KAPALI (PlayerPanel isOpen=false), yani sure
            // azalirken de bir uyari yok.
            //
            // nextPhase rakibin fazi ise sirasi biten benim demektir.
            case 'turn_timeout': {
                setSelectedPiece(null); setValidMoves([]);
                if (msg.missedTurns) setMissedTurns(msg.missedTurns);
                if (msg.nextPhase) setGamePhase(msg.nextPhase);
                const benimFazim = myOnlineTeamRef.current === PLAYERS.BLUE ? 'PLAY_BLUE' : 'PLAY_RED';
                if (msg.nextPhase && msg.nextPhase !== benimFazim) {
                    setMoveError(prev => ({ metin: TR_KEY('turnTimedOut'), no: (prev?.no ?? 0) + 1 }));
                }
                break;
            }
            // Sunucudan gelen carpisma sonucu, panonun bekledigi CombatResult'a
            // cevriliyor. Burada eskiden YALNIZCA name+rank dolduruluyordu; owner ve
            // special bos kaldigi icin pano her iki tasi da "2. Oyuncu" diye
            // etiketliyor (owner === RED hicbir zaman tutmuyordu) ve Istihkamci/Casus
            // metinleri hic secilemiyordu — Istihkamci mayını aldiginda ekranda
            // "Istihkamci (1) > Mayın (11) — rutbesi buyuk olan yendi" yaziyordu.
            //
            // Rutbe BILINCE null birakiliyor, 0'a cevrilmiyor: 0 gercek bir rutbe
            // (Sancak) ve ormanda gizlenen tasi "Rutbe 0" diye gosteriyordu.
            // Hamle onaylandi -> SECIM SIFIRLANMALI. Sifirlanmadiginda:
            //   1) sari "gidebilecegin kareler" isaretleri ekranda takili kaliyor,
            //   2) selectedPiece.position tasin ESKI karesini gostermeye devam ediyor;
            //      o takili karelerden birine tiklayinca istemci `from` olarak artik
            //      BOS olan kareyi yolluyor ve sunucu "Tas bulunamadi" ile reddediyor.
            // Hamle biten diger tum yollar (turn_timeout, game_restarted, yerel mod)
            // zaten temizliyordu; atlanan tek yer buydu.
            case 'move_executed': { const mb = createEmptyBoard(terrainRef.current.lakes); mergeBoards(mb, msg.myBoard); mergeBoards(mb, msg.opponentBoard); setBoard(mb); setSelectedPiece(null); setValidMoves([]); if (msg.nextPhase) setGamePhase(msg.nextPhase); const saldiranTakim: Player = msg.attackerTeam === PLAYERS.BLUE ? PLAYERS.BLUE : PLAYERS.RED; if (msg.to) setLastMove({ coords: { row: msg.to.row, col: msg.to.col }, owner: saldiranTakim }); if (msg.combatResult) { const c = msg.combatResult; const savunanTakim: Player = saldiranTakim === PLAYERS.RED ? PLAYERS.BLUE : PLAYERS.RED; const cr: CombatResult = { outcome: c.outcome as any, attacker: { name: c.attackerName || '???', rank: c.attackerRank ?? null, special: c.attackerSpecial ?? null, owner: saldiranTakim } as any, defender: { name: c.defenderName || (c.outcome === 'GAME_OVER' ? 'Sancak' : '???'), rank: c.defenderRank ?? null, owner: savunanTakim } as any, timestamp: Date.now() }; setCombatHistory(prev => [cr, ...prev]); setLastCombatCoords({ row: msg.to?.row ?? 0, col: msg.to?.col ?? 0 }); setStats(s => ({ ...s, totalBattles: s.totalBattles + 1 })); soundManager.playCombat(); } else { soundManager.playMove(); }                 if (msg.winner) { setWinner(msg.winner); setGamePhase('GAME_OVER'); } break; }
            // Hamle hatasi ARTIK onlineErrorMessage'a yazilmiyor: o alan yalnizca
            // OnlineModal icinde basiliyor, oyun sirasinda o modal kapali oldugu icin
            // red gorunmuyordu (bkz. MoveErrorToast). Ustelik metin orada takili
            // kaliyordu; modal sonradan acildiginda coktan gecmis bir hamle hatasi
            // hala duruyordu. Oda seviyesindeki hatalar (room_error) orada kalmaya
            // devam ediyor, onlar zaten modalin konusu.
            // msg.n varsa metindeki {n} onunla degistiriliyor (Izci bekleme suresi
            // gibi sayili mesajlar icin). Ceviri anahtarlari dort dilde de {n}
            // tasiyor, sunucu yalnizca sayiyi yolluyor.
            case 'move_error': setMoveError(prev => ({ metin: TR_CODE(msg.code, msg.message).replace(/\{n\}/g, String(msg.n ?? '')), no: (prev?.no ?? 0) + 1 })); break;
            // Izci gorevi sonucu. Tahta bastan kuruluyor: acilan tas artik rakip
            // gorunumunde ad/rutbe ile geliyor. Gorev TUR HARCIYOR, o yuzden faz da
            // degisiyor. Halka animasyonu ACILAN karede donuyor — hamle olmasa da
            // "burada bir sey oldu" geri bildirimi ayni dille veriliyor.
            case 'scout_done': {
                const mb = createEmptyBoard(terrainRef.current.lakes); mergeBoards(mb, msg.myBoard); mergeBoards(mb, msg.opponentBoard); setBoard(mb);
                setSelectedPiece(null); setValidMoves([]);
                if (msg.nextPhase) setGamePhase(msg.nextPhase);
                const bakan: Player = msg.byTeam === PLAYERS.BLUE ? PLAYERS.BLUE : PLAYERS.RED;
                if (msg.target) setLastMove({ coords: { row: msg.target.row, col: msg.target.col }, owner: bakan });
                soundManager.playSelect();
                break;
            }
            // Oyun sonu bes kaynaktan gelebiliyor: bayrak dustu (FLAG), iki taraf da
            // tur kacirma sinirina ulasti (TIMEOUT_DRAW), rakip geri donmedi
            // (OPPONENT_LEFT), rakip odadan cikti (OPPONENT_QUIT), bir tarafin
            // oynayacak tasi kalmadi (NO_MOVES). Konfeti yalnizca KAZANANA atiliyor —
            // kaybedenin ekranina konfeti yagdirmak alay gibi duruyordu.
            //
            // BERABERLIK olcutu artik sebep degil KAZANAN YOKLUGU: hem TIMEOUT_DRAW
            // hem NO_MOVES beraberlikle bitebiliyor, sebebe bakan eski kosul ikincisinde
            // oyun sonu kapagini hic actirmiyordu.
            case 'game_over': {
                setWinner(msg.winner ?? null);
                setGameOverReason(msg.reason ?? null);
                setIsDraw(!msg.winner);
                if (msg.missedTurns) setMissedTurns(msg.missedTurns);
                setGamePhase('GAME_OVER');
                setConnectionNotice(null);
                const kazandim = !!msg.winner && (!myOnlineTeamRef.current || msg.winner === myOnlineTeamRef.current);
                if (kazandim) {
                    soundManager.playWinner();
                    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                } else if (msg.winner && myOnlineTeamRef.current) {
                    soundManager.playDefeat();
                }
                break;
            }
            // Sunucu yeniden başlatmayı ancak İKİ taraf da isteyince yapıyor ve
            // restart_requested'ı isteği yapana da yolluyor. Kendi isteğimizi "rakip
            // istedi" diye göstermemek için slot karşılaştırılıyor.
            //
            // Takımı ref'ten okuyoruz. setMyOnlineTeam(prev => …) içinden okumak, o
            // güncelleyici RENDER sırasında çalıştığı için bildirimi hemen ardından gelen
            // game_restarted temizliğinden SONRA yeniden yazıyordu: onaylayan oyuncuda
            // oyun sıfırlandığı hâlde "rakip yeniden başlatma istedi" notu ekranda kalıyordu.
            case 'restart_requested': {
                const benimSlot = myOnlineTeamRef.current === PLAYERS.BLUE ? 1 : 0;
                setRestartNotice(msg.slot === benimSlot ? 'WAITING' : 'REQUESTED');
                break;
            }
            // Rakibin baglanti durumu degisti. Serit yalnizca OYUN SURERKEN anlamli:
            // dizilim/lobi asamasinda rakibin yoklugunu zaten pano gosteriyor.
            case 'player_connection_change': {
                setRoomState(msg.roomState);
                const benKirmizi = myOnlineTeamRef.current !== PLAYERS.BLUE;
                const rakipBagli = benKirmizi ? msg.roomState?.blueConnected : msg.roomState?.redConnected;
                const rakipKalanMs = benKirmizi ? msg.roomState?.blueDisconnectMs : msg.roomState?.redDisconnectMs;
                const gelenFaz = msg.roomState?.gamePhase;
                // Rakip dizilimde ayrildi: oda LOBBY'ye dondu. Kalan oyuncu yeni
                // rakip bekler — onu bekleme (lobi) ekranina tasi. Sunucu ayrilanin
                // slotunu bosaltti, dolayisiyla yeni biri ayni kodla katilabilir.
                if (gelenFaz === 'LOBBY') {
                    setWinner(null); setGameOverReason(null); setIsDraw(false); setRestartNotice(null);
                    setSetupTimeRemaining(null); setConnectionNotice(null); setConnectionSec(null);
                    // Oda kurulusundaki ile ayni kural: lobide beklerken arkada oyun
                    // ekrani DURMAZ. Burada da MENU'ye donuyoruz, yoksa kalan oyuncu
                    // lobinin arkasinda yarim kalmis dizilim tahtasini gormeye devam
                    // ediyordu. Yeni rakip katilinca room_started_setup GAME'e geciriyor.
                    setScreen('MENU');
                    setIsOnlineModalOpen(true);
                    break;
                }
                const oyunSuruyor = typeof gelenFaz === 'string' && gelenFaz.startsWith('PLAY');
                if (!oyunSuruyor) { setConnectionNotice(null); setConnectionSec(null); break; }
                if (rakipBagli === false) {
                    setConnectionNotice('OPPONENT_GONE');
                    setConnectionSec(typeof rakipKalanMs === 'number' ? Math.ceil(rakipKalanMs / 1000) : null);
                } else {
                    setConnectionNotice(prev => (prev === 'OPPONENT_GONE' ? 'OPPONENT_BACK' : prev));
                    setConnectionSec(null);
                }
                break;
            }
            // gecenSure'yi de SIFIRLA: gameStartedAt null olunca sayac effect'i basta
            // return ediyor, dolayisiyla eski deger kendiliginden temizlenmiyordu ve
            // yeni oyunun diziliminde onceki oyunun suresi ekranda asili kaliyordu.
            case 'game_restarted': setGameStartedAt(null); setGecenSure(0); setBoard(createEmptyBoard(terrainRef.current.lakes)); setSelectedPiece(null); setValidMoves([]); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null); setWinner(null); setGameOverReason(null); setConnectionNotice(null); setConnectionSec(null); setRedCaptured([]); setBlueCaptured([]); setCombatHistory([]); setIsWaitingOpponentSetup(false); setMissedTurns({ red: 0, blue: 0 }); setIsDraw(false); setRestartNotice(null); setRoomState(msg.roomState); setMyOnlineTeam(prev => { setGamePhase(prev === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); return prev; }); break;
        }
    }, []);

    // Baglanti koptugunda OTOMATIK yeniden baglanilir. Sunucu ayni token'i gorunce
    // oyuncuyu eski slotuna oturtup game_state_restored yolluyor, yani oyun kaldigi
    // yerden devam ediyor. Denemeler DISCONNECT penceresi boyunca surer; o sure
    // dolunca sunucu zaten oyunu hukmen bitiriyor, daha fazla denemenin anlami yok.
    const connectWs = useCallback((room: string, name: string) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Token SEKME BASINA (sessionStorage), pencere/profil basina DEGIL. localStorage
        // ayni origin'in tum sekmelerinde ortak oldugu icin, ayni bilgisayarda iki
        // sekmeyle oynamak isteyen iki kisi AYNI token'i yolluyordu; sunucu bunu
        // "ayni oyuncu geri dondu" sayip ikinci sekmeyi 1. oyuncunun SLOTUNA oturtuyor
        // ve ilk sekmenin soketini kapatiyordu (bkz. src/server.ts, token eslesmesi).
        // Sonuc: iki taraf da sonsuza kadar "rakip bekleniyor" ekraninda kaliyordu.
        // sessionStorage sayfa YENILEMESINI atlatir — kopma/refresh sonrasi yeniden
        // baglanma calismaya devam eder — ama her yeni sekme ayri oyuncu olur.
        // Bedeli bilincli: sekme TAMAMEN kapatilirsa kimlik kaybolur, o odaya eski
        // slotuyla geri donulemez.
        let token = sessionStorage.getItem('astact_player_token');
        if (!token) { token = crypto.randomUUID(); sessionStorage.setItem('astact_player_token', token); }
        const url = `${protocol}//${window.location.host}/ws/game-room?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`;
        odaBilgisiRef.current = { room, name };
        kastenAyrildiRef.current = false;
        const newWs = new WebSocket(url);
        newWs.onopen = () => {
            denemeSayisiRef.current = 0;
            setOnlineErrorMessage(null);
            setConnectionNotice(prev => (prev === 'SELF_GONE' ? 'SELF_BACK' : prev));
            setConnectionSec(null);
        };
        newWs.onmessage = (event) => { try { handleWsMessage(JSON.parse(event.data)); } catch (e) {} };
        newWs.onclose = () => {
            // Odayi kendi istegiyle terk eden oyuncuyu geri sokmaya calisma.
            if (kastenAyrildiRef.current || !isOnlineModeRef.current) return;
            setOnlineErrorMessage(TR_KEY('errConnectionLost'));
            // Oyun bittiyse geri sayimli "kaybedeceksin" uyarisi yaniltici olur.
            if (gamePhaseRef.current.startsWith('PLAY')) {
                setConnectionNotice('SELF_GONE');
                setConnectionSec(prev => prev ?? Math.round(KOPMA_PENCERESI_MS / 1000));
            }
            if (denemeSayisiRef.current >= MAX_YENIDEN_BAGLANMA) return;
            denemeSayisiRef.current++;
            yenidenBaglanTimerRef.current = window.setTimeout(() => {
                const bilgi = odaBilgisiRef.current;
                if (bilgi && !kastenAyrildiRef.current) connectWsRef.current?.(bilgi.room, bilgi.name);
            }, YENIDEN_BAGLANMA_ARALIGI_MS);
        };
        newWs.onerror = () => { setOnlineErrorMessage(TR_KEY('errWsError')); };
        wsRef.current = newWs;
        return newWs;
    }, [TR_KEY]);
    useEffect(() => { connectWsRef.current = connectWs; }, [connectWs]);

    const sendWsMessage = useCallback((msg: any) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg)); }, []);

    const handleCreateOnlineRoom = async (playerName: string) => {
        setIsOnlineModalOpen(false);
        try {
            const res = await fetch('/api/game-room/create', { method: 'POST' });
            const data = await res.json();
            const code = data.roomCode;
            connectWs(code, playerName);
        } catch (e) {
            setOnlineErrorMessage(TR_KEY('errRoomCreateFailed'));
        }
    };

    const handleJoinOnlineRoom = (code: string, playerName: string) => {
        setIsOnlineModalOpen(false);
        connectWs(code, playerName);
    };

    const handleLeaveOnlineRoom = () => {
        // Kasitli ayrilma: onclose'daki otomatik yeniden baglanma devreye girmesin.
        // Sunucuya AYRILDIGIMI SOYLE, sonra kapat. Soylemezsek sunucu bunu kopma
        // sanip karsi tarafa "baglantisi koptu, 60sn icinde donmezse..." seridini
        // gosteriyordu — oysa donmeyecegim, oyunu biraktim. Mesaj kapanmadan once
        // gitmeli; close() cagrildiktan sonra gonderilen mesaj dusuyor.
        sendWsMessage({ type: 'leave_room' });
        onlineDurumuSifirla();
    };

    // Dizilimdeki kismi tahtayi sunucuya akitir. Online modda oyuncu taslari
    // yalnizca "Hazir" ile gonderiyordu; sure dolunca sunucu HICBIR tasi bilmez
    // ve 40 tasi da rastgele dizerdi — oyuncunun dizdikleri bozulurdu. Artik her
    // tas degisiminde guncel listeyi yolluyoruz; sunucu setup_update ile sakliyor,
    // sure dolunca KORUYUP kalanlari rastgele dolduruyor. Yerel modda gerek yok.
    const gonderKismiDizilim = (tahta: BoardState) => {
        if (!isOnlineMode || !myOnlineTeam || !roomCode || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const isRed = myOnlineTeam === PLAYERS.RED; const cols = isRed ? [7, 8, 9, 10] : [0, 1, 2, 3];
        const placedPieces: PlacedPiece[] = [];
        for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) { const s = tahta[r][c]; if (s && typeof s === 'object' && s.owner === myOnlineTeam) placedPieces.push(s); }
        sendWsMessage({ type: 'setup_update', roomCode, team: myOnlineTeam, placedPieces });
    };

    // Muzik, logo ekrana gelir gelmez baslasin. HICBIR tarayici sesli autoplay'i
    // garanti etmez (jest olmadan bloklanir), bu yuzden uc asamali:
    //   1) acilista SESLI dene — izin varsa (Chrome MEI, site ses izni) muzik
    //      logoyla birlikte, hicbir etkilesim olmadan girer,
    //   2) reddedilirse SESSIZ baslat (bu her yerde serbest) — muzik zaten calmaya
    //      basladigi icin ilk jestte play() izni beklenmez, sadece muted=false yapilir,
    //   3) o ilk jestte sesi ac. Dinleyiciler `once`; unmuteBackgroundMusic zaten
    //      sesli caliyorsa is yapmadan donuyor, yani cift calma olmaz.
    // Ses kapaliysa (kullanici sustur demisse) yedek yol hic devreye girmez.
    useEffect(() => {
        soundManager.setVolume(volume);
        const basla = () => soundManager.unmuteBackgroundMusic();
        const olaylar: (keyof WindowEventMap)[] = ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'click', 'scroll'];
        olaylar.forEach(o => window.addEventListener(o, basla, { once: true }));
        // Arka planda acilan sekmede autoplay her halukarda reddedilir; sekme one
        // gelince yeniden denemek gerekiyor (bu tek basina jest sayilmaz ama
        // 1. asamanin izinli oldugu durumu kurtarir).
        const gorunurluk = () => { if (!document.hidden) soundManager.unmuteBackgroundMusic(); };
        document.addEventListener('visibilitychange', gorunurluk);
        return () => {
            olaylar.forEach(o => window.removeEventListener(o, basla));
            document.removeEventListener('visibilitychange', gorunurluk);
        };
        // Yalnizca acilista: sonraki ses degisiklikleri handleVolumeChange'den geciyor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Muzik menu muzigi: odaya girildigi anda susuyor, menuye donunce geri geliyor.
    // Olcut EKRAN, "online mod" degil — oda kurulunca da katilinca da screen 'GAME'
    // oluyor, ayrilinca 'MENU'ye donuyor, yani tek kosul her yolu kapsiyor.
    // Ilk render'da screen zaten 'MENU' oldugu icin bu efekt acilistaki uc asamali
    // autoplay akisina dokunmuyor (setMusicAllowed ayni degeri alinca is yapmiyor).
    useEffect(() => {
        soundManager.setMusicAllowed(screen === 'MENU');
    }, [screen]);

    // Oyun grafiklerini acilista gizlice on yukle: oyun ekranina gecis ancak
    // hazir olunca mumkun (asagida screen === 'MENU' || !oyunGorselleriHazir).
    useEffect(() => {
        oyunGorselleriYukle(() => setOyunGorselleriHazir(true));
    }, []);


    const currentPlayer = useMemo(() => { if (gamePhase === 'SETUP_RED' || gamePhase === 'PLAY_RED') return PLAYERS.RED; if (gamePhase === 'SETUP_BLUE' || gamePhase === 'PLAY_BLUE') return PLAYERS.BLUE; return null; }, [gamePhase]);

    // Dizilim panelini gosterecegimiz oyuncu ve panelin tahta uzerindeki tarafi.
    // Kirmizi kendi taslarini SAG sutunlara (7-10) diziyor -> panel SOLDA.
    // Mavi kendi taslarini SOL sutunlara (0-3) diziyor    -> panel SAGDA.
    const setupPlayer: Player = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : (currentPlayer || PLAYERS.RED);
    const setupSide: 'left' | 'right' = setupPlayer === PLAYERS.RED ? 'left' : 'right';
    // Dizilim paneli basligi: online'da oyuncu ad girmisse adi gosterilir.
    const setupPlayerName: string | null | undefined = setupPlayer === PLAYERS.RED ? roomState?.redPlayer : roomState?.bluePlayer;

    // Online modda oyun bilgisi panosunda KENDİ durumunu göstermenin bilgi değeri yok —
    // oyuncu kendi dizilim panelini zaten görüyor. Değerli olan rakibin durumu.
    // Online'da dizilim EŞZAMANLI (her istemci kendi SETUP_* fazında), o yüzden faz
    // yetmiyor; rakibin gerçek hâli roomState'in ready/connected alanlarından geliyor.
    // Yerel modda null döner ve pano eski davranışını aynen sürdürür.
    const onlineStatus: OnlineStatus = useMemo(() => {
        if (!isOnlineMode || !myOnlineTeam || !roomState) return null;
        if (gamePhase === 'GAME_OVER') return null;
        const rakipKirmizi = myOnlineTeam === PLAYERS.BLUE;
        // DIKKAT: "rakip katildi mi" sorusu redPlayer/bluePlayer ile SORULMAZ. O alan
        // yalnizca gorunen ad ve oyuncu adi istege bagli — adsiz girenin adi null
        // kaliyordu, dolayisiyla rakip hazir olsa da, hatta oyun oynanirken bile
        // durum satiri "Rakip bekleniyor" yaziyordu (null kontrolu PLAY'den once).
        const rakipVar = rakipKirmizi ? roomState.redPresent : roomState.bluePresent;
        const rakipBagli = rakipKirmizi ? roomState.redConnected : roomState.blueConnected;
        const rakipHazir = rakipKirmizi ? roomState.redReady : roomState.blueReady;
        if (!rakipVar) return 'OPPONENT_WAITING';
        if (!rakipBagli) return 'OPPONENT_OFFLINE';
        if (gamePhase.startsWith('PLAY')) {
            return currentPlayer === myOnlineTeam ? 'YOUR_TURN' : 'OPPONENT_TURN';
        }
        return rakipHazir ? 'OPPONENT_READY' : 'OPPONENT_SETTING_UP';
    }, [isOnlineMode, myOnlineTeam, roomState, gamePhase, currentPlayer]);

    // Sesin tek giriş noktası: menü ekranındaki sustur düğmesi. Oyun içinde ses
    // denetimi yok — müzik odaya girilince zaten susuyor.
    const handleVolumeChange = (v: number) => { setVolume(v); soundManager.setVolume(v); };

    // Online'da tur süresini ODA KURUCUSU (1. Oyuncu) belirler; katılan oyuncunun
    // seçimi sunucuda yok sayılıyordu ve ekranında yanlış süre sayıyordu. Artık
    // katılan için ayar kilitli ve gerçek süre sunucudan geliyor.
    const isRoomHost = !isOnlineMode || myOnlineTeam === PLAYERS.RED;
    // Süre ön ayarı YALNIZCA oyun başlamadan önce değiştirilebilir. Oyun sırasında
    // değiştirmek sırası gelen oyuncuya avantaj/dezavantaj yaratırdı.
    const isTimerLocked = gamePhase.startsWith('PLAY') || !isRoomHost;
    const handlePresetChange = (newPreset: TimerPreset) => {
        if (isTimerLocked) return;
        setTimerPreset(newPreset); const config = TIMER_PRESETS[newPreset];
        setTimerConfig(config); setTurnTimeRemaining(config.turnTime);
        // Rakip anında öğrensin; yoksa değişikliği ancak oyun başlayınca görürdü.
        if (isOnlineMode) sendWsMessage({ type: 'set_turn_time', turnTime: config.turnTime });
    };

    // Geri sayım. Sadece azaltır — sıfıra inince ne olacağını AŞAĞIDAKİ efekt karar
    // verir. Yan etkiyi setState güncelleyicisinin içine koymak StrictMode'da iki kez
    // çalışıp tur kaçırma sayacını çift artırırdı.
    useEffect(() => {
        if (!gamePhase.startsWith('PLAY')) return;
        const i = setInterval(() => setTurnTimeRemaining(p => (p <= 1 ? 0 : p - 1)), 1000);
        return () => clearInterval(i);
    }, [gamePhase]);

    // Süre doldu: sırası gelen oyuncunun tur kaçırma sayacını artır, sırayı devret.
    // İki oyuncu da MAX_MISSED_TURNS'e ulaştıysa oyun berabere biter.
    //
    // Sayacı burada AYNI toplu güncellemede sıfırdan çıkarıyoruz. Yalnızca faz
    // değiştirip süreyi aşağıdaki efekte bıraksaydık, efektler bildirim sırasına göre
    // çalıştığı için bu efekt bir kez daha turnTimeRemaining === 0 ile çalışır ve
    // kaçırma sayacını iki kez artırırdı.
    useEffect(() => {
        if (turnTimeRemaining > 0 || !gamePhase.startsWith('PLAY')) return;
        const sirasiGecen: Player = gamePhase === 'PLAY_RED' ? PLAYERS.RED : PLAYERS.BLUE;
        setTurnTimeRemaining(timerConfig.turnTime);
        setSelectedPiece(null); setValidMoves([]);

        // Online modda tur saatini SUNUCU yürütür (server.ts alarm()) ve süre dolunca
        // `turn_timeout` yayınlar. İstemci sırayı KENDİ ÇEVİRMEZ: çevirdiğinde sunucu
        // hâlâ eski sırada kalıyor, ekranda "sıra sende" yazarken hamleler
        // NOT_YOUR_TURN ile reddediliyordu. Buradaki geri sayım yalnızca görsel.
        if (isOnlineMode) return;

        const yeniSayac = sirasiGecen === PLAYERS.RED
            ? { red: missedTurns.red + 1, blue: missedTurns.blue }
            : { red: missedTurns.red, blue: missedTurns.blue + 1 };
        setMissedTurns(yeniSayac);
        if (yeniSayac.red >= MAX_MISSED_TURNS && yeniSayac.blue >= MAX_MISSED_TURNS) {
            setIsDraw(true);
            setGamePhase('GAME_OVER');
            setStats(s => ({ ...s, gamesPlayed: s.gamesPlayed + 1 }));
        } else {
            setGamePhase(sirasiGecen === PLAYERS.RED ? 'PLAY_BLUE' : 'PLAY_RED');
        }
    }, [turnTimeRemaining, gamePhase, missedTurns, timerConfig.turnTime, isOnlineMode]);

    // Faz degisince geri sayim bastan baslar. Tek istisna yeniden baglanma: sunucu
    // turun KALAN suresini bildirir (game_state_restored.remainingMs) ve tur ortasindan
    // devam edilmesi gerekir. Ref kullaniliyor cunku bu efekt setGamePhase'den SONRA
    // calisip dogrudan yazilan degeri ezerdi.
    useEffect(() => {
        const sunucuKalan = sunucuKalanRef.current;
        sunucuKalanRef.current = null;
        setTurnTimeRemaining(sunucuKalan !== null ? sunucuKalan : timerConfig.turnTime);
    }, [gamePhase, timerConfig.turnTime]);

    useEffect(() => { if (lastCombatCoords) { const t = setTimeout(() => setLastCombatCoords(null), 700); return () => clearTimeout(t); } }, [lastCombatCoords]);
    // Halka animasyonu 0.65sn; bitince durumu temizliyoruz ki bir sonraki hamlede
    // element yeniden takilsin ve animasyon BASTAN oynasin. Temizlemezsek ayni
    // kareye ikinci kez inildiginde CSS animasyonu yeniden tetiklenmez.
    useEffect(() => { if (lastMove) { const t = setTimeout(() => setLastMove(null), 700); return () => clearTimeout(t); } }, [lastMove]);

    // Hamle hatasi seridi kendiliginden kayboluyor. Bagimlilik metin degil SAYAC:
    // ayni hata pes pese geldiginde de sure bastan baslamali.
    useEffect(() => {
        if (!moveError) return;
        const t = setTimeout(() => setMoveError(null), 2600);
        return () => clearTimeout(t);
    }, [moveError?.no]);

    // Izci gorevinin secilebilir hedefleri. Kural: AYNI SATIRDA, dusmanin dizilim
    // sutunlarinda, arada gol yok, hedef ormanda degil. Sunucu hepsini yeniden
    // dogruluyor (src/server.ts "scout") — buradaki hesap yalnizca hangi karelerin
    // tiklanabilir oldugunu GOSTERMEK icin; istemciye guvenilmiyor.
    const scoutTargets = useMemo<Coords[]>(() => {
        if (!isOnlineMode || !myOnlineTeam || !selectedPiece) return [];
        if (!gamePhase.startsWith('PLAY') || currentPlayer !== myOnlineTeam) return [];
        // scoutIn > 0 ise bekleme suresi dolmamis; hedef gostermiyoruz ki oyuncu
        // bosuna tiklayip hata almasin.
        if (selectedPiece.special !== SpecialAbility.SCOUT || (selectedPiece.scoutIn ?? 0) > 0) return [];
        const r = selectedPiece.position.row, izciCol = selectedPiece.position.col;
        const hedefler: Coords[] = [];
        // Satirin TAMAMI taraniyor: hedef dusmanin dizilim sutunlarinda olmak
        // zorunda degil, tarafsiz banda ilerlemis tas da secilebilir.
        for (let c = 0; c < BOARD_COLS; c++) {
            const kare = board[r]?.[c];
            if (!kare || typeof kare !== 'object' || kare.owner === myOnlineTeam) continue;
            if (terrain.forests.some(f => f.row === r && f.col === c)) continue;
            const adim = c > izciCol ? 1 : -1;
            let engel = false;
            for (let x = izciCol + adim; x !== c; x += adim) {
                if (terrain.lakes.some(l => l.row === r && l.col === x)) { engel = true; break; }
            }
            if (!engel) hedefler.push({ row: r, col: c });
        }
        return hedefler;
    }, [isOnlineMode, myOnlineTeam, selectedPiece, gamePhase, currentPlayer, board, terrain]);

    // Secili tasin TURUNE ait sayac: elimde kac tane kaldi, rakip o turden kac
    // kaybetti. Sayim tahtadan ve carpisma gecmisinden turetiliyor (bkz.
    // lib/tasSayimi.ts) — redCaptured/blueCaptured dizileri online modda hic
    // dolmadigi icin onlara guvenilemez.
    const secimSayaci = useMemo(() => {
        if (!selectedPiece?.name || !gamePhase.startsWith('PLAY')) return null;
        const benim = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer;
        if (!benim) return null;
        return {
            ad: selectedPiece.name,
            kalanBende: kalanTaslarim(board, benim)[selectedPiece.name] ?? 0,
            rakipKaybi: rakipKayiplari(combatHistory, benim)[selectedPiece.name] ?? 0,
        };
    }, [selectedPiece, gamePhase, isOnlineMode, myOnlineTeam, currentPlayer, board, combatHistory]);

    // Baslik yuksekligini olcup CSS degiskenine yaziyoruz; tahta genisligi ondan
    // turetiliyor (bkz. tahtaGenislikSiniri). ResizeObserver sart: baslik sabit
    // yukseklikte degil — dil degisince metinler sarabiliyor, pencere daralinca
    // kunye alt satira iniyor.
    useEffect(() => {
        if (screen !== 'GAME') return;
        const baslik = document.querySelector('header');
        if (!baslik) return;
        const uygula = () => document.documentElement.style.setProperty(
            '--baslik-h', `${Math.round(baslik.getBoundingClientRect().height)}px`,
        );
        uygula();
        const gozlemci = new ResizeObserver(uygula);
        gozlemci.observe(baslik);
        return () => gozlemci.disconnect();
    }, [screen]);

    // Baglanti seridindeki geri sayim. Sifira inince beklemeye devam eder; oyunu
    // bitirme karari SUNUCUNUN (alarm), istemci yalnizca gosteriyor.
    useEffect(() => {
        if (connectionNotice !== 'OPPONENT_GONE' && connectionNotice !== 'SELF_GONE') return;
        const i = setInterval(() => setConnectionSec(p => (p === null || p <= 0 ? p : p - 1)), 1000);
        return () => clearInterval(i);
    }, [connectionNotice]);

    // "Geri dondu" bildirimi kalici olmamali.
    useEffect(() => {
        if (connectionNotice !== 'OPPONENT_BACK' && connectionNotice !== 'SELF_BACK') return;
        const t = setTimeout(() => setConnectionNotice(null), 4000);
        return () => clearTimeout(t);
    }, [connectionNotice]);

    // Dizilim geri sayimi. Sifirda DURUYOR ve beklemeye devam ediyor: kalan taslari
    // rastgele dizip oyunu baslatma karari SUNUCUNUN (alarm), istemci yalnizca
    // gosteriyor — tur saatiyle ve baglanti seridiyle ayni is bolumu.
    useEffect(() => {
        if (setupTimeRemaining === null || !gamePhase.startsWith('SETUP')) return;
        const i = setInterval(() => setSetupTimeRemaining(p => (p === null || p <= 0 ? p : p - 1)), 1000);
        return () => clearInterval(i);
    }, [setupTimeRemaining === null, gamePhase]);

    const calculateValidMoves = useCallback((piece: PlacedPiece, currentBoard: BoardState): Coords[] => {
        const moves: Coords[] = []; const { row, col } = piece.position; if (!piece.movable) return [];
        // Yon SERBEST: ileri, geri, saga, sola tek kare. Eskiden takima gore geri
        // yon (kirmizida c:+1, mavide c:-1) listeye hic girmiyordu; kural kalkti,
        // sunucudaki dogrulama da ayni sekilde dort yonu kabul ediyor.
        const dirs = [{ r: 0, c: 1 }, { r: 0, c: -1 }, { r: -1, c: 0 }, { r: 1, c: 0 }];
        for (const d of dirs) { const nr = row + d.r, nc = col + d.c; if (nr >= 0 && nr < BOARD_ROWS && nc >= 0 && nc < BOARD_COLS) { const t = currentBoard[nr][nc]; if (t !== 'LAKE' && (t === null || t === 'FOREST' || (typeof t === 'object' && t.owner !== piece.owner))) moves.push({ row: nr, col: nc }); } }
        return moves;
    }, []);

    const handleAutoSetup = () => {
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const isRed = ap === PLAYERS.RED; const cols = isRed ? [7, 8, 9, 10] : [0, 1, 2, 3];
        const empty: Coords[] = []; for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) if (board[r][c] === null || board[r][c] === 'FOREST') empty.push({ row: r, col: c });
        const pool: PieceDefinition[] = []; piecesToPlace.forEach(p => { for (let i = 0; i < p.count; i++) pool.push({ ...p, count: 1 }); });
        pool.sort(() => Math.random() - 0.5); empty.sort(() => Math.random() - 0.5);
        const nb = board.map(r => [...r]);
        for (let i = 0; i < Math.min(pool.length, empty.length); i++) { const d = pool[i], c = empty[i]; nb[c.row][c.col] = { id: `${ap}-${d.name}-${Date.now()}-${Math.random()}`, ...d, owner: ap, position: c, revealed: false, hasMoved: false }; }
        soundManager.playSelect(); setBoard(nb); gonderKismiDizilim(nb); setPiecesToPlace([]); setSelectedPieceToPlace(null);
    };

    const handleClearSetup = () => {
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const isRed = ap === PLAYERS.RED; const cols = isRed ? [7, 8, 9, 10] : [0, 1, 2, 3];
        const nb = board.map(r => [...r]); for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) { const s = nb[r][c]; if (s && typeof s === 'object' && s.owner === ap) nb[r][c] = null; }
        soundManager.playMove(); setBoard(nb); gonderKismiDizilim(nb); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null);
    };

    const handlePiecePlacement = (coords: Coords, targetPiece?: PieceDefinition | null) => {
        if (isWaitingOpponentSetup) return;
        const pu = targetPiece || selectedPieceToPlace; if (!pu) return;
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const { row, col } = coords; const isRed = ap === PLAYERS.RED;
        // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3. (Tahta 10 satir x 11 sutun.)
        const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
        // Alan disina birakma sessizce yok sayilir — engelleyici alert() kullanilmaz.
        if (col < zone.start || col > zone.end) return;
        const cs = board[row][col]; if (cs === null || cs === 'FOREST') {
            soundManager.playSelect(); const np: PlacedPiece = { id: `${ap}-${pu.name}-${Date.now()}-${Math.random()}`, ...pu, owner: ap, position: coords, revealed: false, hasMoved: false };
            const nb = board.map(r => [...r]); nb[row][col] = np; setBoard(nb); gonderKismiDizilim(nb);
            const pi = piecesToPlace.findIndex(p => p.name === pu.name); if (pi === -1) return;
            const up = { ...piecesToPlace[pi], count: piecesToPlace[pi].count - 1 };
            if (up.count > 0) { const np2 = [...piecesToPlace]; np2[pi] = up; setPiecesToPlace(np2); setSelectedPieceToPlace(up); }
            else { setPiecesToPlace(piecesToPlace.filter(p => p.name !== pu.name)); setSelectedPieceToPlace(null); }
        }
    };

    const resolveCombat = (attacker: PlacedPiece, defender: PlacedPiece): CombatResult => {
        if (defender.name === 'Sancak') { soundManager.playVictory(); return { outcome: 'GAME_OVER', attacker, defender }; }
        if (defender.name === 'Mayın') { if (attacker.special === SpecialAbility.MINER) { soundManager.playCombat(); return { outcome: 'ATTACKER_WINS', attacker, defender }; } soundManager.playExplosion(); return { outcome: 'BOTH_LOSE', attacker, defender }; }
        if (attacker.special === SpecialAbility.SPY && defender.rank === 10) { soundManager.playCombat(); return { outcome: 'ATTACKER_WINS', attacker, defender }; }
        // Savunmadaki Casus da Mareşal'i yener (kural iki yonlu). Bu dal olmasa
        // Mareşal Casus'a saldirinca rutbe karsilastirmasi (10>1) kazandi derdi.
        if (defender.special === SpecialAbility.SPY && attacker.rank === 10) { soundManager.playCombat(); return { outcome: 'DEFENDER_WINS', attacker, defender }; }
        soundManager.playCombat(); if (attacker.rank > defender.rank) return { outcome: 'ATTACKER_WINS', attacker, defender }; if (attacker.rank < defender.rank) return { outcome: 'DEFENDER_WINS', attacker, defender }; return { outcome: 'EQUAL_RANK', attacker, defender };
    };

    const handleMoveOrAttack = (coords: Coords) => {
        if (!selectedPiece) return;
        if (isOnlineMode) {
            if (myOnlineTeam && currentPlayer !== myOnlineTeam) return;
            const move = validMoves.find(m => m.row === coords.row && m.col === coords.col);
            if (!move) return;
            sendWsMessage({ type: 'move', from: selectedPiece.position, to: coords }); return;
        }
        const move = validMoves.find(m => m.row === coords.row && m.col === coords.col);
        if (!move) return;
        const nb = board.map(r => [...r]); const { row: fr, col: fc } = selectedPiece.position; const { row: tr, col: tc } = coords;
        const ts = nb[tr][tc]; const isForest = terrain.forests.some(f => f.row === tr && f.col === tc);
        let attacker = { ...selectedPiece, position: coords, hasMoved: true };
        let ch = [...combatHistory], rc = [...redCaptured], bc = [...blueCaptured], nw = winner;
        let np: GamePhase = gamePhase === 'PLAY_RED' ? 'PLAY_BLUE' : 'PLAY_RED';
        if (ts && typeof ts === 'object') {
            const defender = ts; const cr = resolveCombat(attacker, defender);
            const ce: CombatResult = { ...cr, attacker: { ...attacker, revealed: true }, defender: { ...defender, revealed: true }, timestamp: Date.now() };
            ch = [ce, ...ch]; setCombatHistory(ch); setLastCombatCoords({ row: tr, col: tc }); setStats(s => ({ ...s, totalBattles: s.totalBattles + 1 }));
            switch (cr.outcome) {
                case 'ATTACKER_WINS': nb[fr][fc] = null; nb[tr][tc] = { ...attacker, revealed: isForest ? false : true }; if (defender.owner === PLAYERS.RED) { rc.push(defender); setRedCaptured(rc); } else { bc.push(defender); setBlueCaptured(bc); } break;
                case 'DEFENDER_WINS': nb[fr][fc] = null; nb[tr][tc] = { ...defender, revealed: isForest ? false : true }; if (attacker.owner === PLAYERS.RED) { rc.push(attacker); setRedCaptured(rc); } else { bc.push(attacker); setBlueCaptured(bc); } break;
                case 'EQUAL_RANK': nb[fr][fc] = null; nb[tr][tc] = null; if (attacker.owner === PLAYERS.RED) { rc.push(attacker); setRedCaptured(rc); } else { bc.push(attacker); setBlueCaptured(bc); } if (defender.owner === PLAYERS.RED) { rc.push(defender); setRedCaptured(rc); } else { bc.push(defender); setBlueCaptured(bc); } break;
                case 'BOTH_LOSE': nb[fr][fc] = null; nb[tr][tc] = null; if (attacker.owner === PLAYERS.RED) { rc.push(attacker); setRedCaptured(rc); } else { bc.push(attacker); setBlueCaptured(bc); } if (defender.owner === PLAYERS.RED) { rc.push(defender); setRedCaptured(rc); } else { bc.push(defender); setBlueCaptured(bc); } break;
                case 'GAME_OVER': nb[fr][fc] = null; nb[tr][tc] = { ...attacker, revealed: true }; nw = attacker.owner; setWinner(nw); np = 'GAME_OVER'; setGamePhase('GAME_OVER'); confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); setStats(s => ({ ...s, gamesPlayed: s.gamesPlayed + 1, redWins: attacker.owner === PLAYERS.RED ? s.redWins + 1 : s.redWins, blueWins: attacker.owner === PLAYERS.BLUE ? s.blueWins + 1 : s.blueWins })); break;
            }
        } else { soundManager.playMove(); nb[fr][fc] = null; nb[tr][tc] = attacker; }
        setBoard(nb); setSelectedPiece(null); setValidMoves([]); setStats(s => ({ ...s, totalTurns: s.totalTurns + 1 }));
        if (np !== 'GAME_OVER') setGamePhase(np);
    };

    const handleSquareClick = (coords: Coords) => {
        // Sira rakipteyken tiklama YOK SAYILIYORDU — sessizce. Oyuncu tahtaya
        // basiyor, hicbir sey olmuyor, sebebini de goremiyordu. Artik ayni serit
        // "Sira rakibinizde." diyor (metin sunucudaki kodla ayni anahtardan geliyor).
        if (isOnlineMode && myOnlineTeam && gamePhase.startsWith('PLAY') && currentPlayer !== myOnlineTeam) {
            setMoveError(prev => ({ metin: TR_CODE('NOT_YOUR_TURN'), no: (prev?.no ?? 0) + 1 }));
            return;
        }
        if (gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE') {
            // "Hazir"a basildi, dizilim kilitlendi — tahta uzerinde tas kaldirma
            // ya da koyma artik yok sayilir (sunucu da setup_update'i reddediyor).
            if (isWaitingOpponentSetup) return;
            const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
            const isRed = ap === PLAYERS.RED;
            // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3.
            const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
            const { row, col } = coords; if (col >= zone.start && col <= zone.end) {
                const sq = board[row][col]; if (sq && typeof sq === 'object' && sq.owner === ap) {
                    const nb = board.map(r => [...r]); nb[row][col] = null; setBoard(nb); gonderKismiDizilim(nb);
                    // Havuzu SIFIRDAN kurmak yanlis olur: daha once koyulmus diger
                    // taslarin sayilari geri gelir, havuz "resetlenir". Kaldirilan
                    // tasi mevcut sayiya geri ekle (koymanin tersi).
                    const pi = piecesToPlace.findIndex(p => p.name === sq.name);
                    const kaldirilan: PieceDefinition = { name: sq.name, rank: sq.rank, special: sq.special, movable: sq.movable, count: 1 };
                    setPiecesToPlace(pi === -1
                        ? [...piecesToPlace, kaldirilan]
                        : piecesToPlace.map(p => p.name === sq.name ? { ...p, count: p.count + 1 } : p));
                    setSelectedPieceToPlace(kaldirilan); return;
                }
                handlePiecePlacement(coords);
            } return;
        }
        // Izci gorevi hamleden ONCE bakiliyor: hedefler dusman bolgesinde, gecerli
        // hamle kareleriyle cakismiyor, yani sira onemli degil ama niyet net olsun.
        if (selectedPiece && scoutTargets.some(t => t.row === coords.row && t.col === coords.col)) {
            sendWsMessage({ type: 'scout', from: selectedPiece.position, to: coords, target: coords });
            setSelectedPiece(null); setValidMoves([]);
            return;
        }
        if (selectedPiece && validMoves.length > 0) { const tm = validMoves.find(m => m.row === coords.row && m.col === coords.col); if (tm) { handleMoveOrAttack(coords); return; } }
        const cs = board[coords.row][coords.col]; if (cs && typeof cs === 'object' && cs.owner === currentPlayer) { setSelectedPiece(cs); setValidMoves(calculateValidMoves(cs, board)); } else { setSelectedPiece(null); setValidMoves([]); }
    };

    const handleDragDrop = (source: any, target: Coords) => {
        if (isWaitingOpponentSetup) return;
        if (!source || source.type !== 'BOARD_PIECE' || !(gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE')) return;
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const sq = board[source.coords.row][source.coords.col]; if (!sq || typeof sq !== 'object' || sq.owner !== ap) return;
        // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3. (Tahta 10 satir x 11 sutun.)
        const isRed = ap === PLAYERS.RED; const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
        if (target.col < zone.start || target.col > zone.end) return;
        const ts = board[target.row][target.col]; if (ts === null || ts === 'FOREST') { const nb = board.map(r => [...r]); nb[target.row][target.col] = sq; nb[source.coords.row][source.coords.col] = null; setBoard(nb); gonderKismiDizilim(nb); }
    };

    const handleReady = () => {
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        if (isOnlineMode && wsRef.current?.readyState === WebSocket.OPEN && roomCode && myOnlineTeam) {
            const placedPieces: PlacedPiece[] = []; const isRed = myOnlineTeam === PLAYERS.RED; const cols = isRed ? [7, 8, 9, 10] : [0, 1, 2, 3];
            for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) { const s = board[r][c]; if (s && typeof s === 'object' && s.owner === myOnlineTeam) placedPieces.push(s); }
            // turnTime'i sunucu tur saatini kurarken kullanir; oda kurucusununki gecerli olur.
            sendWsMessage({ type: 'setup_complete', roomCode, team: myOnlineTeam, placedPieces, turnTime: timerConfig.turnTime }); setIsWaitingOpponentSetup(true); return;
        }
        if (gamePhase === 'SETUP_RED') { setGamePhase('SETUP_BLUE'); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null); }
        else if (gamePhase === 'SETUP_BLUE') { setGamePhase('PLAY_RED'); setGameStartedAt(Date.now()); soundManager.playVictory(); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
    };

    // Oyun sonu ekraninda bildirim metni modalin icinde basiliyor (ayri popup ust uste
    // binerdi). Metin render aninda cevriliyor, durumdan turetiliyor.
    const oyunSonuBildirimi = restartNotice === 'WAITING' ? t.waitingRestartApproval
                            : restartNotice === 'REQUESTED' ? t.errRestartRequested
                            : null;

    const handleRestartGame = () => {
        if (isOnlineMode && wsRef.current?.readyState === WebSocket.OPEN && roomCode) { sendWsMessage({ type: 'request_restart', roomCode }); return; }
        setBoard(createEmptyBoard(terrainRef.current.lakes)); setSelectedPiece(null); setValidMoves([]); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null); setWinner(null); setRedCaptured([]); setBlueCaptured([]); setCombatHistory([]); setGamePhase('SETUP_RED'); setIsWaitingOpponentSetup(false); setTurnTimeRemaining(timerConfig.turnTime); setMissedTurns({ red: 0, blue: 0 }); setIsDraw(false); setGameStartedAt(null); setGecenSure(0); setRestartNotice(null);
    };

    // Menude tahta ve panolar hic render edilmez; yalnizca OnlineModal erisilebilir kalir
    // cunku oda kurma/katilma akisi oradan yurutuluyor.
    // Gorseller hazir degilse de menuye takiliriz: oyun ekrani grafikler yuklenmeden
    // acilmaz, yoksa kareler bos gorunur. Yukleme gizli oldugu icin kullanici bir
    // "yukleniyor" gostergesi degil, menuyu gorur; hazir olunca oyun aninda acilir.
    if (screen === 'MENU' || !oyunGorselleriHazir) {
        return (<>
            <MenuScreen lang={lang} onLanguageChange={setLang} onOpenOnline={() => setIsOnlineModalOpen(true)} onOpenSettings={() => setIsMenuSettingsOpen(true)} volume={volume} onVolumeChange={handleVolumeChange} />
            <MenuSettingsModal isOpen={isMenuSettingsOpen} onClose={() => setIsMenuSettingsOpen(false)} timerPreset={timerPreset} onPresetChange={handlePresetChange} lang={lang} />
            <OnlineModal isOpen={isOnlineModalOpen} onClose={() => setIsOnlineModalOpen(false)} roomCode={roomCode} playerTeam={myOnlineTeam} roomState={roomState} onCreateRoom={handleCreateOnlineRoom} onJoinRoom={handleJoinOnlineRoom} onLeaveRoom={handleLeaveOnlineRoom} errorMessage={onlineErrorMessage} lang={lang} />
            {/* Oda kurulunca rakip beklenirken ekran MENU'de kaliyor (bkz. room_created),
                bu yuzden kod popup'i BURADA da basilmali. Yalnizca oyun ekrani dalinda
                dururken menude kalan kurucuda hic gorunmuyordu. Lobinin uzerinde durur:
                ikisi de fixed inset-0 z-[1000] ve bu, DOM'da OnlineModal'dan sonra. */}
            <RoomCodeModal isOpen={showRoomCode} roomCode={roomCode} lang={lang} />
        </>);
    }

    // Tahtanin genislik siniri. Tahta 11x10 oranli ve YUKSEKLIKTEN sinirlaniyor:
    // serbest birakilirsa bosalan genisligi alip dikeyde tasiyor.
    //
    //   64px = main dolgusu (16 ust + 16 alt) + koordinat seritleri (16 ust + 16 alt)
    //   1.1  = 11/10 en-boy orani
    //
    // Baslik yuksekligi SABIT YAZILMIYOR, olculuyor (--baslik-h). Once iki ayri sabit
    // vardi (172/136) ve baslik her degistiginde bayatladi — iki kez tahtanin alt
    // kenari pencereyi asti. Olculen deger o hata sinifini tamamen kapatiyor.
    // Yedek deger (129px) yalnizca ilk boyamada, olcum yetismezse gecerli.
    const tahtaGenislikSiniri = 'lg:max-w-[min(1100px,calc((100vh-var(--baslik-h,129px)-64px)*1.1+32px))]';

    return (<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <GameHeader
            lang={lang}
            isOnlineMode={isOnlineMode}
            isConnected={wsRef.current?.readyState === WebSocket.OPEN}
            roomCode={roomCode}
            myOnlineTeam={myOnlineTeam}
            roomState={roomState}
            gamePhase={gamePhase}
            onlineStatus={onlineStatus}
            currentPlayer={currentPlayer}
            turnTimeRemaining={turnTimeRemaining}
            gecenSure={gecenSure}
            onRestart={handleRestartGame}
            onLeaveRoom={handleLeaveOnlineRoom}
        />
        <main className="flex-1 flex items-start justify-center gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full">
            <div className={`relative flex-grow w-full flex items-center justify-center ${tahtaGenislikSiniri}`}>
                <Board board={board} onSquareClick={handleSquareClick} onDropAction={handleDragDrop} highlightedPiece={selectedPiece} validMoves={validMoves} currentPlayer={currentPlayer} perspectivePlayer={isOnlineMode ? myOnlineTeam : currentPlayer} lastCombatCoords={lastCombatCoords} lastMove={lastMove} scoutTargets={scoutTargets} forests={terrain.forests} lang={lang} />
                {secimSayaci && (
                    <PieceCountChip
                        pieceName={secimSayaci.ad}
                        kalanBende={secimSayaci.kalanBende}
                        rakipKaybi={secimSayaci.rakipKaybi}
                        lang={lang}
                    />
                )}
                {(gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE') && (
                    <div className={`absolute top-1/2 -translate-y-1/2 z-30 w-72 max-w-[85%] ${setupSide === 'left' ? 'left-3' : 'right-3'}`}>
                        <SetupUI piecesToPlace={piecesToPlace} selectedPieceName={selectedPieceToPlace?.name} onPieceSelect={setSelectedPieceToPlace} onAutoSetup={handleAutoSetup} onClearSetup={handleClearSetup} onFinishSetup={handleReady} isWaitingOpponent={isWaitingOpponentSetup} lang={lang} player={setupPlayer} playerName={setupPlayerName} remainingSec={isOnlineMode ? setupTimeRemaining : null} />
                    </div>
                )}
            </div>
            {/* Carpisma gecmisi cekmecesi: PENCERENIN sag kenarina yapisik (fixed),
                acildiginda 500px. Yer ayirmaz, tahtanin bosalan alani alir. */}
            <PlayerPanel combatHistory={combatHistory} missedTurns={missedTurns} isOnlineMode={isOnlineMode} volume={volume} onVolumeChange={handleVolumeChange} lang={lang} />
        </main>
        <OnlineModal isOpen={isOnlineModalOpen} onClose={() => setIsOnlineModalOpen(false)} roomCode={roomCode} playerTeam={myOnlineTeam} roomState={roomState} onCreateRoom={handleCreateOnlineRoom} onJoinRoom={handleJoinOnlineRoom} onLeaveRoom={handleLeaveOnlineRoom} errorMessage={onlineErrorMessage} lang={lang} />
        <RoomCodeModal isOpen={showRoomCode} roomCode={roomCode} lang={lang} />
        {/* Oyun bittiginde bildirim GameOverModal'in ICINDE gosteriliyor; ayri bir popup
            ayni z-index'te ust uste binerdi. Diger tum durumlarda popup cikiyor. */}
        {/* Serit oyun sonu ekraninin ALTINDA kalir (z-900 < z-1000): oyun bittiginde
            baglanti uyarisi degil sonuc onemli. */}
        <ConnectionBanner notice={gamePhase === 'GAME_OVER' ? null : connectionNotice} remainingSec={connectionSec} lang={lang} />
        {/* Reddedilen hamle seridi. Baglanti seridi aciksa onun altina iniyor. Oyun
            sonunda gizleniyor: sonuc ekrani acikken eski bir hamle reddi anlamsiz. */}
        <MoveErrorToast
            mesaj={gamePhase === 'GAME_OVER' ? null : (moveError?.metin ?? null)}
            kaydir={gamePhase !== 'GAME_OVER' && connectionNotice !== null}
        />
        <GameOverModal winner={winner} isDraw={isDraw} myTeam={isOnlineMode ? myOnlineTeam : null} reason={gameOverReason} notice={oyunSonuBildirimi} restartNotice={restartNotice} gamePhase={gamePhase} onRestart={handleRestartGame} onLeaveLobby={handleLeaveOnlineRoom} lang={lang} />
        {gamePhase !== 'GAME_OVER' && (
            <RestartNoticeModal notice={restartNotice} onConfirm={handleRestartGame} onClose={() => setRestartNotice(null)} lang={lang} />
        )}
    </div>);
};

export default App;