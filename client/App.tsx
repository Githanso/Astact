import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { BoardState, Coords, GamePhase, PlacedPiece, Player, PieceDefinition, SpecialAbility, CombatResult, Language, TimerPreset, TimerConfig, GameStats, OnlineStatus, RestartNotice, GameOverReason, ConnectionNotice, RoomState } from './types';
import { BOARD_ROWS, BOARD_COLS, LAKE_COORDS, FOREST_COORDS, PIECE_DEFINITIONS, createInitialPiecePool, PLAYERS, TIMER_PRESETS, TRANSLATIONS, MAX_MISSED_TURNS } from './constants';
import Board from './components/Board';
import SetupUI from './components/SetupUI';
import SettingsPanel from './components/SettingsPanel';
import PlayerPanel from './components/PlayerPanel';
import MenuScreen from './components/MenuScreen';
import RoomCodeModal from './components/RoomCodeModal';
import MenuSettingsModal from './components/MenuSettingsModal';
import RestartNoticeModal from './components/RestartNoticeModal';
import GameOverModal from './components/GameOverModal';
import OnlineModal from './components/OnlineModal';
import ConnectionBanner from './components/ConnectionBanner';
import { soundManager } from './lib/soundFX';

// Sunucudaki DISCONNECT_TIMEOUT_MS ile ayni: rakip donmezse oyun bu surenin
// sonunda hukmen bitiyor. Sunucu roomState.disconnectTimeoutMs ile de bildiriyor;
// bu sabit yalnizca o bilgi yokken (kendi baglantimiz koptugunda) kullaniliyor.
const KOPMA_PENCERESI_MS = 60_000;
const YENIDEN_BAGLANMA_ARALIGI_MS = 2_000;
const MAX_YENIDEN_BAGLANMA = Math.ceil(KOPMA_PENCERESI_MS / YENIDEN_BAGLANMA_ARALIGI_MS);

const createEmptyBoard =(): BoardState => {
    const board: BoardState = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    LAKE_COORDS.forEach(coord => { board[coord.row][coord.col] = 'LAKE'; });
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
    const [pieceToSwap, setPieceToSwap] = useState<PlacedPiece | null>(null);
    const [lastCombatCoords, setLastCombatCoords] = useState<Coords | null>(null);
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
    // Oyun sonu gerekcesi: ayni "kaybettin" ekrani bayrak dustugu icin mi yoksa
    // baglanti geri gelmedigi icin mi cikiyor, metin buna gore degisiyor.
    const [gameOverReason, setGameOverReason] = useState<GameOverReason>(null);
    // Baglanti seridi. Kopma anindan itibaren geri sayim gosterir.
    const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice>(null);
    const [connectionSec, setConnectionSec] = useState<number | null>(null);
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
    const [isTimeoutDraw, setIsTimeoutDraw] = useState<boolean>(false);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

    // Dil degisebildigi icin cevirici yardimcilar render disinda da guncel dili kullanir.
    const langRef = useRef<Language>(lang);
    useEffect(() => { langRef.current = lang; }, [lang]);
    // handleWsMessage bos bagimlilikla useCallback; guncel takimi buradan okur.
    const myOnlineTeamRef = useRef<Player | null>(null);
    useEffect(() => { myOnlineTeamRef.current = myOnlineTeam; }, [myOnlineTeam]);
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
        switch (msg.type) {
            // Oda kurucusu kendi preset'ini HEMEN bildirmeli. Yukarıdaki senkron satırı
            // bu mesajla gelen sunucu VARSAYILANINI (35sn) uygulayıp kurucunun menüden
            // seçtiği süreyi eziyordu; kurucu 15sn seçmişken oyun 35sn ile başlıyordu.
            case 'room_created': setRoomCode(msg.roomCode); setMyOnlineTeam(msg.playerTeam); setRoomState(msg.roomState); setIsOnlineMode(true); setOnlineErrorMessage(null); setScreen('GAME'); setShowRoomCode(true); sendWsMessage({ type: 'set_turn_time', turnTime: timerConfigRef.current.turnTime }); break;
            case 'room_joined': setRoomCode(msg.roomCode); setMyOnlineTeam(msg.playerTeam); setRoomState(msg.roomState); setIsOnlineMode(true); setOnlineErrorMessage(null); setScreen('GAME'); if (msg.roomState?.gamePhase === 'SETUP') { setIsOnlineModalOpen(false); setGamePhase(msg.playerTeam === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); } break;
            // Oda dolu / oyun devam ediyor gibi KALICI redler: yeniden baglanmayi
            // burada durduruyoruz, yoksa istemci 2sn'de bir bosuna deneyip durur.
            // Modal katilma denemesinde kapaniyor, hata metni ise onun icinde
            // basiliyor — geri acilmazsa kullanici reddedildigini hic gormuyordu.
            case 'room_error': setOnlineErrorMessage(TR_CODE(msg.code, msg.message)); kastenAyrildiRef.current = true; setIsOnlineModalOpen(true); break;
            // Rakip katildi — kod popup'ina artik gerek yok.
            case 'room_started_setup': setRoomState(msg.roomState); setIsOnlineModalOpen(false); setScreen('GAME'); setShowRoomCode(false); setMyOnlineTeam(prev => { setGamePhase(prev === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); return prev; }); break;
            case 'player_setup_status': setRoomState(prev => prev ? { ...prev, redReady: msg.redReady, blueReady: msg.blueReady } : prev); break;
            case 'both_setup_complete': { const mb = createEmptyBoard(); mergeBoards(mb, msg.myPieces); mergeBoards(mb, msg.opponentPieces); setBoard(mb); setGamePhase(msg.gamePhase || 'PLAY_RED'); setIsWaitingOpponentSetup(false); setIsOnlineModalOpen(false); soundManager.playVictory(); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); break; }
            case 'game_state_restored': { const mb = createEmptyBoard(); mergeBoards(mb, msg.myBoard); mergeBoards(mb, msg.opponentBoard); setBoard(mb); if (typeof msg.remainingMs === 'number') { const kalan = Math.max(0, Math.ceil(msg.remainingMs / 1000)); sunucuKalanRef.current = kalan; setTurnTimeRemaining(kalan); } if (msg.missedTurns) setMissedTurns(msg.missedTurns); setGamePhase(msg.gamePhase || 'PLAY_RED'); if (msg.gamePhase === 'GAME_OVER') { setWinner(msg.winner ?? null); setGameOverReason(msg.reason ?? null); setIsTimeoutDraw(msg.reason === 'TIMEOUT_DRAW'); setGamePhase('GAME_OVER'); } setOnlineErrorMessage(null); break; }
            // Tur suresini sunucu yurutuyor; sira degisimini o bildiriyor.
            case 'turn_timeout': { setSelectedPiece(null); setValidMoves([]); if (msg.missedTurns) setMissedTurns(msg.missedTurns); if (msg.nextPhase) setGamePhase(msg.nextPhase); break; }
            // Sunucudan gelen carpisma sonucu, panonun bekledigi CombatResult'a
            // cevriliyor. Burada eskiden YALNIZCA name+rank dolduruluyordu; owner ve
            // special bos kaldigi icin pano her iki tasi da "2. Oyuncu" diye
            // etiketliyor (owner === RED hicbir zaman tutmuyordu) ve Istihkamci/Casus
            // metinleri hic secilemiyordu — Istihkamci bombayi aldiginda ekranda
            // "Istihkamci (1) > Bomba (11) — rutbesi buyuk olan yendi" yaziyordu.
            //
            // Rutbe BILINCE null birakiliyor, 0'a cevrilmiyor: 0 gercek bir rutbe
            // (Bayrak) ve ormanda gizlenen tasi "Rutbe 0" diye gosteriyordu.
            case 'move_executed': { const mb = createEmptyBoard(); mergeBoards(mb, msg.myBoard); mergeBoards(mb, msg.opponentBoard); setBoard(mb); if (msg.nextPhase) setGamePhase(msg.nextPhase); if (msg.combatResult) { const c = msg.combatResult; const saldiranTakim: Player = msg.attackerTeam === PLAYERS.BLUE ? PLAYERS.BLUE : PLAYERS.RED; const savunanTakim: Player = saldiranTakim === PLAYERS.RED ? PLAYERS.BLUE : PLAYERS.RED; const cr: CombatResult = { outcome: c.outcome as any, attacker: { name: c.attackerName || '???', rank: c.attackerRank ?? null, special: c.attackerSpecial ?? null, owner: saldiranTakim } as any, defender: { name: c.defenderName || (c.outcome === 'GAME_OVER' ? 'Bayrak' : '???'), rank: c.defenderRank ?? null, owner: savunanTakim } as any, timestamp: Date.now() }; setCombatHistory(prev => [cr, ...prev]); setLastCombatCoords({ row: msg.to?.row ?? 0, col: msg.to?.col ?? 0 }); setStats(s => ({ ...s, totalBattles: s.totalBattles + 1 })); soundManager.playCombat(); } else { soundManager.playMove(); } if (msg.winner) { setWinner(msg.winner); setGamePhase('GAME_OVER'); soundManager.playVictory(); confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); } break; }
            case 'move_error': setOnlineErrorMessage(TR_CODE(msg.code, msg.message)); break;
            // Oyun sonu ARTIK uc kaynaktan gelebiliyor: bayrak dustu (FLAG), iki taraf
            // da tur kacirma sinirina ulasti (TIMEOUT_DRAW), rakip geri donmedi
            // (OPPONENT_LEFT). Konfeti yalnizca KAZANANA atiliyor — kaybedenin
            // ekranina konfeti yagdirmak alay gibi duruyordu.
            case 'game_over': {
                setWinner(msg.winner ?? null);
                setGameOverReason(msg.reason ?? null);
                setIsTimeoutDraw(msg.reason === 'TIMEOUT_DRAW');
                if (msg.missedTurns) setMissedTurns(msg.missedTurns);
                setGamePhase('GAME_OVER');
                setConnectionNotice(null);
                soundManager.playVictory();
                if (msg.winner && msg.winner === myOnlineTeamRef.current) {
                    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
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
                const oyunSuruyor = typeof msg.roomState?.gamePhase === 'string' && msg.roomState.gamePhase.startsWith('PLAY');
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
            case 'game_restarted': setBoard(createEmptyBoard()); setSelectedPiece(null); setValidMoves([]); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null); setWinner(null); setGameOverReason(null); setConnectionNotice(null); setConnectionSec(null); setRedCaptured([]); setBlueCaptured([]); setCombatHistory([]); setIsWaitingOpponentSetup(false); setMissedTurns({ red: 0, blue: 0 }); setIsTimeoutDraw(false); setRestartNotice(null); setRoomState(msg.roomState); setMyOnlineTeam(prev => { setGamePhase(prev === PLAYERS.RED ? 'SETUP_RED' : 'SETUP_BLUE'); return prev; }); break;
        }
    }, []);

    // Baglanti koptugunda OTOMATIK yeniden baglanilir. Sunucu ayni token'i gorunce
    // oyuncuyu eski slotuna oturtup game_state_restored yolluyor, yani oyun kaldigi
    // yerden devam ediyor. Denemeler DISCONNECT penceresi boyunca surer; o sure
    // dolunca sunucu zaten oyunu hukmen bitiriyor, daha fazla denemenin anlami yok.
    const connectWs = useCallback((room: string, name: string) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let token = localStorage.getItem('astact_player_token');
        if (!token) { token = crypto.randomUUID(); localStorage.setItem('astact_player_token', token); }
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
        kastenAyrildiRef.current = true;
        if (yenidenBaglanTimerRef.current !== null) { clearTimeout(yenidenBaglanTimerRef.current); yenidenBaglanTimerRef.current = null; }
        setConnectionNotice(null); setConnectionSec(null); setGameOverReason(null);
        if (wsRef.current) wsRef.current.close();
        setIsOnlineMode(false); setRoomCode(null); setMyOnlineTeam(null); setRoomState(null);
        setIsOnlineModalOpen(false); setIsWaitingOpponentSetup(false); setRestartNotice(null); setShowRoomCode(false);
        setMissedTurns({ red: 0, blue: 0 }); setIsTimeoutDraw(false);
        setBoard(createEmptyBoard()); setGamePhase('SETUP_RED');
        setPiecesToPlace(createInitialPiecePool());
        setScreen('MENU');
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


    const currentPlayer = useMemo(() => { if (gamePhase === 'SETUP_RED' || gamePhase === 'PLAY_RED') return PLAYERS.RED; if (gamePhase === 'SETUP_BLUE' || gamePhase === 'PLAY_BLUE') return PLAYERS.BLUE; return null; }, [gamePhase]);

    // Dizilim panelini gosterecegimiz oyuncu ve panelin tahta uzerindeki tarafi.
    // Kirmizi kendi taslarini SAG sutunlara (7-10) diziyor -> panel SOLDA.
    // Mavi kendi taslarini SOL sutunlara (0-3) diziyor    -> panel SAGDA.
    const setupPlayer: Player = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : (currentPlayer || PLAYERS.RED);
    const setupSide: 'left' | 'right' = setupPlayer === PLAYERS.RED ? 'left' : 'right';

    // Online modda oyun bilgisi panosunda KENDİ durumunu göstermenin bilgi değeri yok —
    // oyuncu kendi dizilim panelini zaten görüyor. Değerli olan rakibin durumu.
    // Online'da dizilim EŞZAMANLI (her istemci kendi SETUP_* fazında), o yüzden faz
    // yetmiyor; rakibin gerçek hâli roomState'in ready/connected alanlarından geliyor.
    // Yerel modda null döner ve pano eski davranışını aynen sürdürür.
    const onlineStatus: OnlineStatus = useMemo(() => {
        if (!isOnlineMode || !myOnlineTeam || !roomState) return null;
        if (gamePhase === 'GAME_OVER') return null;
        const rakipKirmizi = myOnlineTeam === PLAYERS.BLUE;
        const rakipOyuncu = rakipKirmizi ? roomState.redPlayer : roomState.bluePlayer;
        const rakipBagli = rakipKirmizi ? roomState.redConnected : roomState.blueConnected;
        const rakipHazir = rakipKirmizi ? roomState.redReady : roomState.blueReady;
        if (rakipOyuncu === null) return 'OPPONENT_WAITING';
        if (!rakipBagli) return 'OPPONENT_OFFLINE';
        if (gamePhase.startsWith('PLAY')) {
            return currentPlayer === myOnlineTeam ? 'YOUR_TURN' : 'OPPONENT_TURN';
        }
        return rakipHazir ? 'OPPONENT_READY' : 'OPPONENT_SETTING_UP';
    }, [isOnlineMode, myOnlineTeam, roomState, gamePhase, currentPlayer]);

    // Ses hem SettingsPanel'den hem StatsModal'dan değiştirilebiliyor; tek nokta.
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
            setIsTimeoutDraw(true);
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

    const calculateValidMoves = useCallback((piece: PlacedPiece, currentBoard: BoardState): Coords[] => {
        const moves: Coords[] = []; const { row, col } = piece.position; if (!piece.movable) return [];
        const isRed = piece.owner === PLAYERS.RED;
        const dirs = isRed ? [{ r: 0, c: -1 }, { r: -1, c: 0 }, { r: 1, c: 0 }] : [{ r: 0, c: 1 }, { r: -1, c: 0 }, { r: 1, c: 0 }];
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
        soundManager.playSelect(); setBoard(nb); setPiecesToPlace([]); setSelectedPieceToPlace(null);
    };

    const handleClearSetup = () => {
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const isRed = ap === PLAYERS.RED; const cols = isRed ? [7, 8, 9, 10] : [0, 1, 2, 3];
        const nb = board.map(r => [...r]); for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) { const s = nb[r][c]; if (s && typeof s === 'object' && s.owner === ap) nb[r][c] = null; }
        soundManager.playMove(); setBoard(nb); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null);
    };

    const handlePiecePlacement = (coords: Coords, targetPiece?: PieceDefinition | null) => {
        const pu = targetPiece || selectedPieceToPlace; if (!pu) return;
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const { row, col } = coords; const isRed = ap === PLAYERS.RED;
        // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3. (Tahta 10 satir x 11 sutun.)
        const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
        // Alan disina birakma sessizce yok sayilir — engelleyici alert() kullanilmaz.
        if (col < zone.start || col > zone.end) return;
        const cs = board[row][col]; if (cs === null || cs === 'FOREST') {
            soundManager.playSelect(); const np: PlacedPiece = { id: `${ap}-${pu.name}-${Date.now()}-${Math.random()}`, ...pu, owner: ap, position: coords, revealed: false, hasMoved: false };
            const nb = board.map(r => [...r]); nb[row][col] = np; setBoard(nb);
            const pi = piecesToPlace.findIndex(p => p.name === pu.name); if (pi === -1) return;
            const up = { ...piecesToPlace[pi], count: piecesToPlace[pi].count - 1 };
            if (up.count > 0) { const np2 = [...piecesToPlace]; np2[pi] = up; setPiecesToPlace(np2); setSelectedPieceToPlace(up); }
            else { setPiecesToPlace(piecesToPlace.filter(p => p.name !== pu.name)); setSelectedPieceToPlace(null); }
        }
    };

    const resolveCombat = (attacker: PlacedPiece, defender: PlacedPiece): CombatResult => {
        if (defender.name === 'Bayrak') { soundManager.playVictory(); return { outcome: 'GAME_OVER', attacker, defender }; }
        if (defender.name === 'Bomba') { if (attacker.special === SpecialAbility.MINER) { soundManager.playCombat(); return { outcome: 'ATTACKER_WINS', attacker, defender }; } soundManager.playExplosion(); return { outcome: 'DEFENDER_WINS', attacker, defender }; }
        if (attacker.special === SpecialAbility.SPY && defender.rank === 10) { soundManager.playCombat(); return { outcome: 'ATTACKER_WINS', attacker, defender }; }
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
        const ts = nb[tr][tc]; const isForest = FOREST_COORDS.some(f => f.row === tr && f.col === tc);
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
                case 'EQUAL_RANK': case 'BOTH_LOSE': nb[fr][fc] = { ...selectedPiece, revealed: true }; nb[tr][tc] = { ...defender, revealed: true }; break;
                case 'GAME_OVER': nb[fr][fc] = null; nb[tr][tc] = { ...attacker, revealed: true }; nw = attacker.owner; setWinner(nw); np = 'GAME_OVER'; setGamePhase('GAME_OVER'); confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); setStats(s => ({ ...s, gamesPlayed: s.gamesPlayed + 1, redWins: attacker.owner === PLAYERS.RED ? s.redWins + 1 : s.redWins, blueWins: attacker.owner === PLAYERS.BLUE ? s.blueWins + 1 : s.blueWins })); break;
            }
        } else { soundManager.playMove(); nb[fr][fc] = null; nb[tr][tc] = attacker; }
        setBoard(nb); setSelectedPiece(null); setValidMoves([]); setStats(s => ({ ...s, totalTurns: s.totalTurns + 1 }));
        if (np !== 'GAME_OVER') setGamePhase(np);
    };

    const handleSquareClick = (coords: Coords) => {
        if (isOnlineMode && myOnlineTeam && gamePhase.startsWith('PLAY') && currentPlayer !== myOnlineTeam) return;
        if (gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE') {
            const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
            const isRed = ap === PLAYERS.RED;
            // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3.
            const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
            const { row, col } = coords; if (col >= zone.start && col <= zone.end) {
                const sq = board[row][col]; if (sq && typeof sq === 'object' && sq.owner === ap) { setPieceToSwap(sq); const nb = board.map(r => [...r]); nb[row][col] = null; setBoard(nb); const pool = createInitialPiecePool(); const e = pool.find(p => p.name === sq.name); if (e) e.count = 1; setPiecesToPlace(pool); setSelectedPieceToPlace(e ?? null); return; }
                handlePiecePlacement(coords);
            } return;
        }
        if (selectedPiece && validMoves.length > 0) { const tm = validMoves.find(m => m.row === coords.row && m.col === coords.col); if (tm) { handleMoveOrAttack(coords); return; } }
        const cs = board[coords.row][coords.col]; if (cs && typeof cs === 'object' && cs.owner === currentPlayer) { setSelectedPiece(cs); setValidMoves(calculateValidMoves(cs, board)); } else { setSelectedPiece(null); setValidMoves([]); }
    };

    const handleDragDrop = (source: any, target: Coords) => {
        if (!source || source.type !== 'BOARD_PIECE' || !(gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE')) return;
        const ap = (isOnlineMode && myOnlineTeam) ? myOnlineTeam : currentPlayer; if (!ap) return;
        const sq = board[source.coords.row][source.coords.col]; if (!sq || typeof sq !== 'object' || sq.owner !== ap) return;
        // Dizilim alani SUTUN bazli: kirmizi 7-10, mavi 0-3. (Tahta 10 satir x 11 sutun.)
        const isRed = ap === PLAYERS.RED; const zone = isRed ? { start: 7, end: 10 } : { start: 0, end: 3 };
        if (target.col < zone.start || target.col > zone.end) return;
        const ts = board[target.row][target.col]; if (ts === null || ts === 'FOREST') { const nb = board.map(r => [...r]); nb[target.row][target.col] = sq; nb[source.coords.row][source.coords.col] = null; setBoard(nb); }
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
        else if (gamePhase === 'SETUP_BLUE') { setGamePhase('PLAY_RED'); soundManager.playVictory(); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
    };

    // Oyun sonu ekraninda bildirim metni modalin icinde basiliyor (ayri popup ust uste
    // binerdi). Metin render aninda cevriliyor, durumdan turetiliyor.
    const oyunSonuBildirimi = restartNotice === 'WAITING' ? t.waitingRestartApproval
                            : restartNotice === 'REQUESTED' ? t.errRestartRequested
                            : null;

    const handleRestartGame = () => {
        if (isOnlineMode && wsRef.current?.readyState === WebSocket.OPEN && roomCode) { sendWsMessage({ type: 'request_restart', roomCode }); return; }
        setBoard(createEmptyBoard()); setSelectedPiece(null); setValidMoves([]); setPiecesToPlace(createInitialPiecePool()); setSelectedPieceToPlace(null); setWinner(null); setRedCaptured([]); setBlueCaptured([]); setCombatHistory([]); setGamePhase('SETUP_RED'); setIsWaitingOpponentSetup(false); setPieceToSwap(null); setTurnTimeRemaining(timerConfig.turnTime); setMissedTurns({ red: 0, blue: 0 }); setIsTimeoutDraw(false); setRestartNotice(null);
    };

    // Menude tahta ve panolar hic render edilmez; yalnizca OnlineModal erisilebilir kalir
    // cunku oda kurma/katilma akisi oradan yurutuluyor.
    if (screen === 'MENU') {
        return (<>
            <MenuScreen lang={lang} onLanguageChange={setLang} onOpenOnline={() => setIsOnlineModalOpen(true)} onOpenSettings={() => setIsMenuSettingsOpen(true)} />
            <MenuSettingsModal isOpen={isMenuSettingsOpen} onClose={() => setIsMenuSettingsOpen(false)} timerPreset={timerPreset} onPresetChange={handlePresetChange} volume={volume} onVolumeChange={handleVolumeChange} lang={lang} />
            <OnlineModal isOpen={isOnlineModalOpen} onClose={() => setIsOnlineModalOpen(false)} roomCode={roomCode} playerTeam={myOnlineTeam} roomState={roomState} onCreateRoom={handleCreateOnlineRoom} onJoinRoom={handleJoinOnlineRoom} onLeaveRoom={handleLeaveOnlineRoom} errorMessage={onlineErrorMessage} lang={lang} />
        </>);
    }

    // Tahtanin genislik siniri. Tek yerde: hem main'deki tahta sarmalayicisi hem de
    // basliktaki hizalama bosluğu bunu kullaniyor, yoksa ikisi birbirinden sapardi.
    // Sabitler: baslik + main dolgusu (online modda baslik bir satir daha uzun),
    // +32px = ust/alt koordinat seritleri, 1.1 = 11/10 en-boy orani.
    // DIKKAT: Tailwind JIT sinif adlarini kaynakta ARAR — bu yuzden iki secenek de
    // tam metin olarak yazili, string birlestirmeyle uretilmiyor.
    const tahtaGenislikSiniri = isOnlineMode
        ? 'lg:max-w-[min(900px,calc((100vh-172px)*1.1+32px))]'
        : 'lg:max-w-[min(900px,calc((100vh-136px)*1.1+32px))]';

    return (<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Yatay dolgu ic kapsayicilarda: main ile AYNI icerik kutusu olsun diye
            (main: max-w-7xl + p-2 md:p-4). Baslikta p-3 kalsaydi sag kenarlar tutmazdi. */}
        <header className="bg-slate-900/90 border-b border-slate-800 py-3 sticky top-0 z-50 backdrop-blur-md">
            {/* Baslikta logonun KELIME MARKASI bandi kullaniliyor. Tam lockup kare
                (684x711); yatay baslik seridine sigdirilinca yazi okunmaz hale geliyor.
                viewBox ile 274-425 satirlari kirpiliyor — "astact" yazisinin tam yeri,
                olculerek bulundu. Ayri bir dosyaya gerek yok, ayni SVG kullaniliyor.
                Yazi logoda oldugu icin ayrica <h1>ASTACT</h1> basilmiyor.

                Marka blogu SAGA dayali. Sadece "saga yasla" demek yetmiyordu: main'deki
                satir justify-center ve tahta yukseklikten sinirli oldugu icin satir
                kapsayiciyi doldurmuyor, iki yanda bosluk kaliyor — logo panonun ~79px
                disina tasiyordu. Bu yuzden baslik main'in satir yapisini birebir
                yansitiyor: once tahta genisliginde gorunmez bir bosluk, sonra pano
                genisliginde (lg:w-72) marka blogu. Boylece sag kenarlar her pencere
                boyutunda tutuyor. */}
            <div className="max-w-7xl mx-auto w-full px-2 md:px-4 flex flex-col lg:flex-row justify-center gap-4">
                <div className={`flex-grow w-full ${tahtaGenislikSiniri}`} aria-hidden="true" />
                <div className="w-full lg:w-72 flex-shrink-0 flex flex-col items-end">
                    <svg viewBox="10 274 674 152" className="h-7 md:h-8 w-auto" role="img" aria-label={t.appTitle}>
                        <image href="/logo.svg" width="684" height="711" />
                    </svg>
                    <p className="mt-0.5 text-right text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{t.appSubtitle}</p>
                </div>
            </div>
            {isOnlineMode && roomState && (<div className="max-w-7xl mx-auto w-full px-2 md:px-4 mt-2 pt-2 border-t border-slate-800/60 flex flex-col lg:flex-row justify-center gap-4 text-[11px] font-mono text-slate-300"><div className={`flex-grow w-full ${tahtaGenislikSiniri}`} aria-hidden="true" /><div className="w-full lg:w-72 flex-shrink-0 flex items-center justify-end gap-3"><span className={`flex items-center gap-1 ${wsRef.current?.readyState === WebSocket.OPEN ? 'text-emerald-400' : 'text-rose-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${wsRef.current?.readyState === WebSocket.OPEN ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>{wsRef.current?.readyState === WebSocket.OPEN ? t.connectedShort : t.disconnectedShort}</span><span>{t.youAre}: <strong className={myOnlineTeam === PLAYERS.RED ? 'text-red-400' : 'text-blue-400'}>{myOnlineTeam === PLAYERS.RED ? t.playerRed : t.playerBlue}</strong></span><span>{t.roomLabel}: <strong className="text-amber-400">{roomCode}</strong></span></div></div>)}
        </header>
        <main className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full">
            {/* Tahta 11x10 oranli; genisligi YUKSEKLIKTEN turetilmis bir sinirla kisitliyoruz,
                yoksa iki pano saga gecince bosalan genisligi alip dikeyde tasiyor.
                Sabitler: baslik + main dolgusu (online modda baslik bir satir daha uzun),
                +32px = ust/alt koordinat seritleri, 1.1 = 11/10 en-boy orani. */}
            <div className={`relative flex-grow w-full flex items-center justify-center ${tahtaGenislikSiniri}`}>
                <Board board={board} onSquareClick={handleSquareClick} onDropAction={handleDragDrop} highlightedPiece={pieceToSwap || selectedPiece} validMoves={validMoves} currentPlayer={currentPlayer} perspectivePlayer={isOnlineMode ? myOnlineTeam : currentPlayer} lastCombatCoords={lastCombatCoords} lang={lang} />
                {(gamePhase === 'SETUP_RED' || gamePhase === 'SETUP_BLUE') && (
                    <div className={`absolute top-1/2 -translate-y-1/2 z-30 w-72 max-w-[85%] ${setupSide === 'left' ? 'left-3' : 'right-3'}`}>
                        <SetupUI piecesToPlace={piecesToPlace} selectedPieceName={selectedPieceToPlace?.name} onPieceSelect={setSelectedPieceToPlace} onAutoSetup={handleAutoSetup} onClearSetup={handleClearSetup} onFinishSetup={handleReady} isWaitingOpponent={isWaitingOpponentSetup} lang={lang} player={setupPlayer} />
                    </div>
                )}
            </div>
            {/* Iki pano da SAGDA, alt alta: ustte ayarlar, altinda oyuncu panosu. */}
            <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
                <SettingsPanel lang={lang} volume={volume} onVolumeChange={handleVolumeChange} isOnlineMode={isOnlineMode} roomCode={roomCode} onOpenOnline={() => setIsOnlineModalOpen(true)} onRestart={handleRestartGame} />
                <PlayerPanel panelPlayer={PLAYERS.RED} currentPlayer={currentPlayer} gamePhase={gamePhase} combatHistory={combatHistory} redCapturedCount={redCaptured.length} blueCapturedCount={blueCaptured.length} stats={stats} turnTimeRemaining={turnTimeRemaining} missedTurns={missedTurns} isOnlineMode={isOnlineMode} onlineStatus={onlineStatus} lang={lang} />
            </div>
        </main>
        <OnlineModal isOpen={isOnlineModalOpen} onClose={() => setIsOnlineModalOpen(false)} roomCode={roomCode} playerTeam={myOnlineTeam} roomState={roomState} onCreateRoom={handleCreateOnlineRoom} onJoinRoom={handleJoinOnlineRoom} onLeaveRoom={handleLeaveOnlineRoom} errorMessage={onlineErrorMessage} lang={lang} />
        <RoomCodeModal isOpen={showRoomCode} roomCode={roomCode} onClose={() => setShowRoomCode(false)} lang={lang} />
        {/* Oyun bittiginde bildirim GameOverModal'in ICINDE gosteriliyor; ayri bir popup
            ayni z-index'te ust uste binerdi. Diger tum durumlarda popup cikiyor. */}
        {/* Serit oyun sonu ekraninin ALTINDA kalir (z-900 < z-1000): oyun bittiginde
            baglanti uyarisi degil sonuc onemli. */}
        <ConnectionBanner notice={gamePhase === 'GAME_OVER' ? null : connectionNotice} remainingSec={connectionSec} lang={lang} />
        <GameOverModal winner={winner} isTimeoutDraw={isTimeoutDraw} myTeam={isOnlineMode ? myOnlineTeam : null} reason={gameOverReason} notice={gamePhase === 'GAME_OVER' ? oyunSonuBildirimi : null} gamePhase={gamePhase} onRestart={handleRestartGame} lang={lang} onClose={() => setGamePhase('SETUP_RED')} />
        {gamePhase !== 'GAME_OVER' && (
            <RestartNoticeModal notice={restartNotice} onConfirm={handleRestartGame} onClose={() => setRestartNotice(null)} lang={lang} />
        )}
    </div>);
};

export default App;