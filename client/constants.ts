import { PieceDefinition, SpecialAbility, Player, TimerPreset, TimerConfig, Language } from './types';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 11;

export const PLAYERS: { [key: string]: Player } = {
  RED: '1. Oyuncu',
  BLUE: '2. Oyuncu',
};

// DIKKAT: bu iki liste src/server.ts'teki kopyalariyla BIREBIR ayni olmali.
// Sunucu hamleyi bunlara gore dogruluyor; ayrisirlarsa istemci gecerli gosterdigi
// bir hamleyi sunucu reddeder (ve hata mesaji ekranda gorunmez).
// Tarafsiz bant 4-6. sutunlar. Desen 180 DERECE DONME simetrik: (r,c) -> (9-r, 10-c).
// Ust ucta agac koridoru 4. sutunda (MAVI'nin yaninda), alt ucta 6. sutunda
// (KIRMIZI'nin yaninda); goller her ucta koridorun karsi tarafinda. Boylece iki
// oyuncu da kendi koridoruna yandan girebiliyor — ayna simetri olsaydi biri
// koridora yandan girerken digeri golleri dolasmak zorunda kalirdi.
export const LAKE_COORDS: { row: number, col: number }[] = [
  { row: 1, col: 5 }, { row: 8, col: 5 },
  { row: 3, col: 6 }, { row: 6, col: 4 },
  { row: 4, col: 4 }, { row: 5, col: 6 },
];

// density yalnizca kac agac cizilecegini belirler; oyun kuralini etkilemez.
export const FOREST_COORDS: { row: number, col: number, density: number }[] = [
  { row: 0, col: 4, density: 3 }, { row: 1, col: 4, density: 2 }, { row: 2, col: 4, density: 3 },
  { row: 3, col: 4, density: 2 }, { row: 3, col: 6, density: 1 },
  { row: 4, col: 5, density: 3 },
  { row: 5, col: 5, density: 2 },
  { row: 6, col: 6, density: 2 },
  { row: 7, col: 6, density: 3 }, { row: 8, col: 6, density: 2 }, { row: 9, col: 6, density: 3 },
];

export const PIECE_DEFINITIONS: { [key: string]: Omit<PieceDefinition, 'count'> } = {
  'Mareşal': { name: 'Mareşal', rank: 10, special: null, movable: true },
  'General': { name: 'General', rank: 9, special: null, movable: true },
  'Albay': { name: 'Albay', rank: 8, special: null, movable: true },
  'Binbaşı': { name: 'Binbaşı', rank: 7, special: null, movable: true },
  'Yüzbaşı': { name: 'Yüzbaşı', rank: 6, special: null, movable: true },
  // Teğmen SUBAY, Çavuş erbastir: TSK hiyerarsisinde Tegmen ustundur.
  // Eskiden ters girilmisti (Çavuş 5 / Teğmen 4).
  'Teğmen': { name: 'Teğmen', rank: 5, special: null, movable: true },
  'Çavuş': { name: 'Çavuş', rank: 4, special: null, movable: true },
  'Onbaşı': { name: 'Onbaşı', rank: 3, special: null, movable: true },
  // Alt rutbeler BENZERSIZ: eskiden Er=Keşifçi=2 ve İstihkamcı=Casus=1 idi, bu yuzden
  // Istihkamci Casus'a saldirinca "esit rutbe" cikip IKISI birden dusuyordu. Artik
  // her tasin kendi seviyesi var; esit rutbe yalnizca AYNI TUR carpisinca oluyor.
  // Casus -1: en zayif tas. Mareşal'i yenmesi rutbeden bagimsiz OZEL kural
  // (resolveCombat'ta SPY dali), o yuzden negatif deger o kurali etkilemiyor.
  'Er': { name: 'Er', rank: 2, special: null, movable: true },
  'Keşifçi': { name: 'Keşifçi', rank: 1, special: SpecialAbility.SCOUT, movable: true },
  'İstihkamcı': { name: 'İstihkamcı', rank: 0, special: SpecialAbility.MINER, movable: true },
  'Casus': { name: 'Casus', rank: -1, special: SpecialAbility.SPY, movable: true },
  'Mayın': { name: 'Mayın', rank: 11, special: null, movable: false },
  'Sancak': { name: 'Sancak', rank: 0, special: null, movable: false },
};

// Tas adlarinin GORUNEN karsiliklari.
// DIKKAT: PIECE_DEFINITIONS icindeki Turkce 'name' degeri islevsel bir kimliktir —
// hem istemci (Piece.tsx ikon secimi) hem SUNUCU (resolveCombat: name === "Sancak" /
// "Mayın") ona gore karar verir. Bu yuzden saklanan ad ASLA cevrilmez; yalnizca
// ekranda gosterilen etiket bu tablodan gecirilir.
export const PIECE_LABELS: Record<Language, Record<string, string>> = {
  TR: {
    'Mareşal': 'Mareşal', 'General': 'General', 'Albay': 'Albay', 'Binbaşı': 'Binbaşı',
    'Yüzbaşı': 'Yüzbaşı', 'Çavuş': 'Çavuş', 'Teğmen': 'Teğmen', 'Onbaşı': 'Onbaşı',
    'Er': 'Er', 'Keşifçi': 'Keşifçi', 'İstihkamcı': 'İstihkamcı', 'Casus': 'Casus',
    'Mayın': 'Mayın', 'Sancak': 'Sancak',
  },
  EN: {
    'Mareşal': 'Marshal', 'General': 'General', 'Albay': 'Colonel', 'Binbaşı': 'Major',
    'Yüzbaşı': 'Captain', 'Çavuş': 'Sergeant', 'Teğmen': 'Lieutenant', 'Onbaşı': 'Corporal',
    'Er': 'Private', 'Keşifçi': 'Scout', 'İstihkamcı': 'Miner', 'Casus': 'Spy',
    'Mayın': 'Mine', 'Sancak': 'Banner',
  },
  JA: {
    'Mareşal': '元帥', 'General': '大将', 'Albay': '大佐', 'Binbaşı': '少佐',
    'Yüzbaşı': '大尉', 'Çavuş': '軍曹', 'Teğmen': '中尉', 'Onbaşı': '伍長',
    'Er': '兵卒', 'Keşifçi': '斥候', 'İstihkamcı': '工兵', 'Casus': 'スパイ',
    'Mayın': '地雷', 'Sancak': '軍旗',
  },
  KO: {
    'Mareşal': '원수', 'General': '대장', 'Albay': '대령', 'Binbaşı': '소령',
    'Yüzbaşı': '대위', 'Çavuş': '중사', 'Teğmen': '중위', 'Onbaşı': '상병',
    'Er': '이등병', 'Keşifçi': '정찰병', 'İstihkamcı': '공병', 'Casus': '스파이',
    'Mayın': '지뢰', 'Sancak': '군기',
  },
};

/** Tasin ekranda gosterilecek adi. Bilinmeyen ad gelirse kanonik adi dondurur. */
export const getPieceLabel = (name: string, lang: Language): string =>
  PIECE_LABELS[lang]?.[name] ?? PIECE_LABELS.TR[name] ?? name;

// Karakter gorselleri: public/assets/characters/*.webp. Dosya adlari ASCII, tas
// adlari Turkce — bu yuzden ACIK bir tablo tutuluyor. Ad uretmeye calismak
// (toLowerCase + aksan atma) 'İstihkamcı' -> 'i̇stihkamci' gibi tuzaklara dusuyor.
//
// BICIM NEDEN WEBP: ayni klasordeki .svg dosyalari KAYNAK, servis edilen bicim
// degil. Onlar gercek vektor degil — 1024x1536 PNG'lerin base64 olarak SVG'ye
// gomulmus hali (Illustrator export), 14 dosya toplam ~39 MB. base64 kodlama
// PNG'yi ayrica ~%33 sisiriyor, yani duz PNG'den bile buyukler.
//
// .webp dosyalari o SVG'lerin 512x512 viewBox kompozisyonu birebir korunarak
// 384x384'e indirilmis hali: toplam 230 KB (176 kat kucuk). 384 secildi cunku
// tas 79 px cizilyor, uzerine gelince (scale-200) 158 px oluyor; 2x ekranda
// 316 px ediyor, 384 rahat karsiliyor.
//
// Gorseller BUNDLE'A GOMULMUYOR: public/ altindan servis ediliyorlar
// (wrangler.toml -> directory = "./public"), tarayici bir kez indirip 80 tasin
// tamaminda yeniden kullaniyor. Ayrica menude on yukleniyorlar
// (lib/preloadAssets.ts): dizilim alani 40 tasla birden aciliyor.
export const PIECE_ART: Record<string, string> = {
  'Mareşal': 'maresal', 'General': 'general', 'Albay': 'albay', 'Binbaşı': 'binbasi',
  'Yüzbaşı': 'yuzbasi', 'Teğmen': 'tegmen', 'Çavuş': 'cavus', 'Onbaşı': 'onbasi',
  'Er': 'er', 'Keşifçi': 'kesifci', 'İstihkamcı': 'istihkamci', 'Casus': 'casus',
  'Mayın': 'mayin', 'Sancak': 'sancak',
};

/** Tasin karakter gorselinin yolu. Bilinmeyen ad gelirse null. */
export const getPieceArt = (name: string): string | null =>
  PIECE_ART[name] ? `/assets/characters/${PIECE_ART[name]}.webp` : null;

/** On yukleyicinin kullandigi tam liste (14 karakter gorseli). */
export const KARAKTER_GORSELLERI: string[] =
  Object.values(PIECE_ART).map(ad => `/assets/characters/${ad}.webp`);

// GECICI — tas stili denemesi. Varsayilan 'sade': taraf arka plani hic yok, figur
// kareyi maksimum dolduruyor, taraf rengi yalnizca alttaki rutbe rozetinde.
// ?stil=disk ile onceki taban diski varyanti karsilastirma icin duruyor.
// ('gradyan' elendi: saydamlastigi bolge tasin zaten bos kismiydi, zemini acmadi.)
// Karar verilince bu sabit ve kaybeden varyant Piece.tsx'ten birlikte silinecek.
export const TAS_STILI: 'sade' | 'disk' =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('stil') === 'disk'
    ? 'disk'
    : 'sade';

// Canli tahta: gol dalgalanir, orman savrulur, zeminde yavas bir isik gezer.
// VARSAYILAN ACIK; ?canli=0 ile kapanip bugunku durgun tahtaya donuluyor —
// ayni sekmede yan yana karsilastirma icin. TAS_STILI ile ayni kalip.
export const CANLI: boolean =
  typeof location === 'undefined' || new URLSearchParams(location.search).get('canli') !== '0';

// Sistem ayari hareketi azaltmaya alinmis mi. CSS animasyonlarini medya sorgusu
// zaten durduruyor (index.css); bu sabit CSS'in ULASAMADIGI yer icin var:
// goldeki SVG bozunum filtresi SMIL ile suruluyor ve medya sorgusuyla
// durdurulamiyor, JS tarafinda hic baglanmiyor.
export const HAREKET_AZALT: boolean =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Orman savrulmasinin faz dagitimi. 30 orman karesi AYNI ANDA sallanirsa tahta
// nefes alan tek kutleye donuyor ve goz bunu aninda sahte olarak okuyor; kareler
// birbirinden bagimsiz kaymali.
//
// Rastgelelik KULLANILAMAZ: iki oyuncu ayni tahtayi goruyor, Math.random() iki
// istemcide iki farkli orman uretirdi. Bunun yerine kare koordinati ve sunucudan
// gelen yogunluk (server.ts:173) bir tam sayiya karistirilip oradan turetiliyor —
// dagilim duzensiz ama deterministik.
//
// Yogunluk 1-3 arasi. Sik orman DAHA AGIR savruluyor: genlik dusuk, sure uzun.
export const ormanSavrulmasi = (row: number, col: number, density: number) => {
  const karisim = (row * 7 + col * 13 + density * 29) % 20;   // 0..19
  const yogunluk = Math.min(3, Math.max(1, density));
  return {
    // Sure 5.2s - 8.8s. Yogunluk arttikca uzuyor (agir kutle yavas savrulur).
    sure: 5.2 + karisim * 0.18 + yogunluk * 0.4,
    // Gecikme 0 - 4.75s: komsu kareler ayni fazda baslamiyor.
    gecikme: (karisim % 20) * 0.25,
    // Genlik carpani 0.55 - 1.0. Seyrek orman daha serbest savruluyor.
    genlik: (1.05 - yogunluk * 0.15).toFixed(2),
  };
};


// Oyuncu basina TAM 40 tas — dizilim alani 4 sutun x 10 satir = 40 kare, bosluk
// birakmiyor. Bu tablonun toplami DEGISMEMELI; bir tasi artirirken digerini
// azaltmak sart.
export const PIECE_COUNTS: { [key: string]: number } = {
  'Mareşal': 1,
  'General': 1,
  'Albay': 2,
  'Binbaşı': 3,
  'Yüzbaşı': 4,
  'Teğmen': 4,
  'Çavuş': 4,
  'Onbaşı': 4,
  // Er 3: tablo bir ara 41'e cikmis, dizilim alani ise 40 kare. Fazla tas her
  // oyunda sessizce dusuyordu (rastgele dizilim 40 kareyi doldurup kalani atiyor,
  // hangi tasin dustugu karistirma sirasina bagli) — "bir tasim eksik" hatasi
  // buradan geliyordu. Ozel yetenekli taslarin dengesine dokunmamak icin fazlalik
  // en jenerik piyadeden alindi.
  'Er': 3,
  // Izci sayisi 2: artik siradan bir tas degil, ISTIHBARAT kaynagi. Ilk kullanim
  // bedava, sonrasi SCOUT_COOLDOWN turluk bekleme (bkz. server.ts "scout").
  'Keşifçi': 2,
  'İstihkamcı': 5,
  'Casus': 1,
  'Mayın': 5, // 5 Mayın
  'Sancak': 1,
};

// Oyuncu başına toplam taş. PIECE_COUNTS'tan türetiliyor, elle yazılmıyor:
// tablo değiştiğinde (ki değişti) buradaki sayı kendiliğinden doğru kalıyor.
export const TOPLAM_TAS = Object.values(PIECE_COUNTS).reduce((a, b) => a + b, 0);

// Bir oyuncu süresi dolduğu için tur kaçırdığında sayacı artar. İKİ oyuncu da bu
// sınıra ulaşınca oyun berabere biter — kimse oynamıyorsa masayı boş bırakmamak için.
export const MAX_MISSED_TURNS = 3;

// Izci gorevini kullandiktan sonra hakkin yenilenmesi icin sahibinin oynamasi
// gereken tur sayisi. Ilk kullanim bedava. src/server.ts SCOUT_COOLDOWN ile
// AYNI olmali — sunucu karari veriyor, buradaki yalnizca arayuz metni icin.
export const SCOUT_COOLDOWN = 10;

// Dizilim süresi HERKES İÇİN SABİT, presete bağlı değil: saat ikinci oyuncu
// katıldığı an başlamak zorunda ve o ana kadar oda kurucusunun seçimi karşı
// tarafa ulaşmış olmuyordu — iki oyuncu farklı süre görüyordu. Sunucudaki
// SETUP_SURESI_MS ile AYNI olmalı; karar sunucunun, buradaki yalnızca geri
// sayım sunucudan gelmeden önceki ilk değer.
export const DIZILIM_SURESI_SN = 180;

export const TIMER_PRESETS: Record<TimerPreset, TimerConfig> = {
  FAST: { turnTime: 15, disconnectTime: 30 },
  NORMAL: { turnTime: 35, disconnectTime: 60 },
  LONG: { turnTime: 60, disconnectTime: 90 },
};

export const createInitialPiecePool = (): PieceDefinition[] => {
    const pool: PieceDefinition[] = [];
    for (const name in PIECE_COUNTS) {
        pool.push({
            ...PIECE_DEFINITIONS[name],
            count: PIECE_COUNTS[name],
        });
    }
    return pool;
};

export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'TR', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'JA', name: '日本語', flag: '🇯🇵' },
  { code: 'KO', name: '한국어', flag: '🇰🇷' },
];

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  TR: {
    appTitle: 'ASTACT',
    appSubtitle: 'Strateji ve Taktik Savaşı',
    gameInfoTitle: 'Oyun Bilgisi',
    capturedPieces: 'Ele Geçirilenler',
    gameTime: 'Geçen Süre',
    randomSetup: 'Rastgele Diz',
    clearSetup: 'Temizle',
    readyButton: 'Dizilimi Onayla & Hazırım',
    waitingOpponent: 'Rakip dizilimi tamamlaması bekleniyor...',
    bothReady: 'İki taraf da hazır! Oyun Başlıyor...',
    timerPresetFast: 'Hızlı',
    timerPresetNormal: 'Normal',
    timerPresetLong: 'Uzun',
    turnTimer: 'Hamle Süresi',
    setupTimer: 'Dizilim Süresi',
    disconnectTimer: 'Kopma Süresi',
    seconds: 'sn',
    statsTitle: 'İstatistikler & Ayarlar',
    soundVolume: 'Müzik ve Ses Seviyesi',
    totalGames: 'Oynanan Oyun',
    redWins: '1. Oyuncu Galibiyet',
    blueWins: '2. Oyuncu Galibiyet',
    totalBattles: 'Çarpışma Sayısı',
    close: 'Kapat',
    onlineTitle: 'Çevrimiçi Oda',
    createRoom: 'Oda Oluştur',
    joinRoom: 'Odaya Katıl',
    roomCode: 'Oda Kodu',
    copyCode: 'Kodu Kopyala', codeCopied: 'Kod Kopyalandı!',
    enterCode: 'Oda kodunu girin',
    statusConnected: 'Bağlandı',
    statusWaiting: 'Oyuncu Bekleniyor...',
    playerRed: '1. Oyuncu', playerBlue: '2. Oyuncu', colorRed: 'Kırmızı', colorBlue: 'Mavi',
    playerRedColor: 'Kırmızı Oyuncu', playerBlueColor: 'Mavi Oyuncu',
    setupRedStatus: '1. Oyuncu Taşlarını Diziyor', setupBlueStatus: '2. Oyuncu Taşlarını Diziyor',
    turnRedStatus: 'Sıra: 1. Oyuncu (Kırmızı)', turnBlueStatus: 'Sıra: 2. Oyuncu (Mavi)',
    opponentWaiting: 'Rakip bekleniyor', opponentOffline: 'Rakibin bağlantısı koptu',
    opponentSettingUp: 'Rakip taşlarını diziyor', opponentReady: 'Rakip hazır — seni bekliyor',
    yourTurnStatus: 'Sıra sende', opponentTurnStatus: 'Sıra rakipte',
    gameOverStatus: 'Oyun Bitti!',
    onlineButton: 'Online Oyun', roomLabel: 'Oda', youAre: 'Siz', opponentShort: 'Rakip',
    countYoursLabel: 'Sende', countOpponentLostLabel: 'Rakip kaybı',
    capturedTitle: 'Ele Geçirildi',
    connectedShort: 'Bağlı', disconnectedShort: 'Bağlantı Kesik',
    restartButton: 'Yeniden Başlat', playAgain: 'Tekrar Oyna', statsButton: 'İstatistikler', timerPresetsLabel: 'Süre Ön Ayarları',
    settingsPanelTitle: 'Ayarlar', gameInfoPanelTitle: 'Oyun Bilgisi',
    timerLockedHint: 'Oyun başladı — süre ayarı kilitli.',
    timerHostOnlyHint: 'Online oyunda hamle süresini oda kurucusu belirler.',
    drawHeading: 'BERABERE',
    drawTimeoutReason: 'İki oyuncu da {n} tur kaçırdı, oyun otomatik bitti.',
    allPlaced: 'Tüm taşlar dizildi!',
    allPlacedHint: 'Dizilimi tamamlayıp maça başlayabilirsiniz.',
    setupLocked: 'Diziliminiz Kilitlendi!', waitingOpponentSetup: 'Rakibinizin dizilimi tamamlaması bekleniyor...',
    statsHeading: 'ASKERİ TAKTİK İSTATİSTİKLERİ', statsSubtitle: 'Analitik & Müzik Ses Ayarları',
    bgMusicVolume: 'Arka Plan Müzik Sesi',
    onlineHeading: 'ONLINE ÇOK OYUNCULU MOD', onlineSubtitle: 'Oda Oluştur veya Oda Kodu ile Katıl',
    shareCodeHint: 'Bu kodu rakibinizle paylaşarak oyuna davet edin.',
    playerStatuses: 'Oyuncu Durumları', liveLabel: 'Canlı',
    onlineLabel: 'Çevrimiçi', offlineLabel: 'Çevrimdışı',
    teamRedUnit: '1. Birlik (Ev Sahibi)', teamBlueUnit: '2. Birlik (Misafir)',
    waitingOpponentJoin: '⏳ Rakibiniz odaya katıldığı an dizilime başlanacaktır.',
    bothReadyGoSetup: '⚔️ İki oyuncu hazır! Dizilim ekranına geçiliyor...',
    leaveRoom: 'Odayı Terk Et', returnToLobby: 'Lobiye Dön', playerName: 'Oyuncu Adınız', goBack: 'Geri git',
    phNameRed: 'Örn. Komutan Kırmızı', phRoomCode: 'Örn. TAK-8492',
    joinRoomButton: 'ODAYA KATIL',
    errRestartRequested: 'Rakip tekrar oynama isteği gönderdi.',
    waitingRestartApproval: 'Yeniden başlatma isteğin gönderildi — rakibin onayı bekleniyor.',
    errConnectionLost: 'Bağlantı koptu.', errWsError: 'WebSocket bağlantı hatası.',
    errRoomCreateFailed: 'Oda oluşturulamadı.',
    errNOT_YOUR_TURN: 'Sıra rakibinizde.', errINVALID_MOVE: 'Geçersiz hamle.',
    errPIECE_NOT_FOUND: 'Taş bulunamadı.', errPIECE_IMMOBILE: 'Bu taş hareket edemez.',
    errONE_SQUARE: 'Sadece bir kare hareket edilebilir.',
    errSTRAIGHT_ONLY: 'Sadece düz hareket edilebilir.', errOUT_OF_BOUNDS: 'Tahta dışına çıkılamaz.',
    errLAKE: 'Göl üzerine gidilemez.', errOWN_PIECE: 'Orada kendi taşınız var.',
    errSERVER_ERROR: 'Sunucu hatası.', errROOM_FULL: 'Oda dolu veya oyun çoktan başladı.',
    errROOM_CLOSED: 'Bu oda kodu bir kez kullanıldı. Yeni oda kodu oluşturun.',
    errSCOUT_NOT_SCOUT: 'Bu görevi yalnızca Keşifçi yapabilir.',
    errSCOUT_COOLDOWN: 'Bu Keşifçi {n} hamle sonra tekrar kullanılabilir.',
    turnTimedOut: 'Süren doldu — sıra rakibe geçti.',
    errSCOUT_RANGE: 'Keşifçi yalnızca kendi satırındaki düşman taşını görebilir.',
    errSCOUT_LAKE: 'Önünde göl var — görüş kapalı.',
    errSCOUT_FOREST: 'Ormandaki taşın kimliği görülemez.',
    winnerLabel: 'Kazanan', youBadge: '(Siz)',
    victoryHeading: 'ZAFER!', defeatHeading: 'YENİLDİN',
    victoryFlag: 'Rakibin sancağını ele geçirdin. Cephe senin!',
    defeatFlag: 'Sancağın düştü. Rakip cepheyi ele geçirdi.',
    victoryOpponentLeft: 'Rakip oyuna geri dönmedi — hükmen kazandın.',
    defeatYouLeft: 'Bağlantın çok uzun süre koptuğu için oyunu kaybettin.',
    victoryOpponentQuit: 'Rakip odadan ayrıldı — hükmen kazandın.',
    defeatOpponentQuit: 'Odadan ayrıldığın için oyunu kaybettin.',
    victoryNoMoves: 'Rakibin oynayabileceği taşı kalmadı. Cephe senin!',
    defeatNoMoves: 'Oynayabileceğin taşın kalmadı. Cephe rakibin.',
    drawNoMoves: 'İki tarafın da oynayabileceği taşı kalmadı, oyun berabere bitti.',
    setupTimedOut: 'Dizilim süresi doldu — kalan taşların rastgele dizildi.',
    drawTitleShort: 'Berabere bitti.',
    opponentDisconnectedTitle: 'Rakibin bağlantısı koptu',
    opponentDisconnectedWait: 'Geri dönmesi bekleniyor — {n} sn içinde dönmezse oyunu sen kazanırsın.',
    opponentReconnected: 'Rakip yeniden bağlandı, oyun kaldığı yerden sürüyor.',
    youDisconnectedTitle: 'Bağlantın koptu',
    youDisconnectedWait: 'Yeniden bağlanılıyor — {n} sn içinde dönmezsen oyunu kaybedersin.',
    youReconnected: 'Yeniden bağlandın.',
    // Kurallar bolumu. Metinler koddaki gercek davranistan turetildi:
    // resolveCombat (server.ts:556), carpisma sonucunun uygulanmasi
    // (server.ts:821-830), hamle dogrulamasi (server.ts:800-811),
    // SCOUT_COOLDOWN ve MAX_MISSED_TURNS. Kural degisirse burasi da degismeli.
    rulesTitle: 'Rütbe Hiyerarşisi & Özel Kurallar',
    rulesRanksTitle: 'Rütbeler',
    rulesColRank: 'Rütbe', rulesColPiece: 'Taş', rulesColCount: 'Adet',
    rulesSpecialPieces: 'Özel Taşlar',
    rulesImmobileNote: 'Hareket edemez',
    rulesSpecialTitle: 'Özel Kurallar',
    ruleSpy: 'Casus, Mareşal\'i her koşulda yener — saldırsın ya da savunsun.',
    ruleMiner: 'İstihkamcı, Mayın\'ı imha edip kareye geçer. Diğer taşlar Mayın\'a çarpınca ölür.',
    ruleScout: 'Keşifçi, aynı satırdaki bir düşman taşının kimliğini açar. Görev tur harcar; ilk kullanım bedava, sonrası {n} tur bekleme.',
    ruleEqual: 'Eşit rütbede kimse kazanmaz: iki taş da oyundan çıkar ve ikisinin de kimliği açığa çıkar.',
    ruleMove: 'Taşlar tek kare, düz hareket eder; ileri, geri ve yana serbesttir.',
    ruleLake: 'Göl geçilemez ve Keşifçi\'nin görüşünü keser.',
    ruleForest: 'Ormanda çarpışmayı kazanan taş gizli kalır; ormandaki taşın kimliği Keşifçi ile görülemez.',
    ruleFlag: 'Sancağı ele geçiren oyunu kazanır.',
    ruleNoMoves: 'Oynayabileceği taşı kalmayan oyuncu kaybeder: elinde yalnızca Mayın ve Sancak kalmışsa ya da hiçbir taşı hareket edemiyorsa oyun biter.',
    ruleTimeout: 'Süresi dolan oyuncu turunu kaçırır. İki taraf da {n} kez kaçırırsa oyun berabere biter.',
    ruleSetupTime: 'Dizilim için {n} saniye vardır. Süre dolduğunda yerleştirmediğin taşlar rastgele dizilir.',
  },
  EN: {
    appTitle: 'ASTACT',
    appSubtitle: 'A Battle of Strategy and Tactics',
    gameInfoTitle: 'Game Info',
    capturedPieces: 'Captured Pieces',
    gameTime: 'Elapsed Time',
    randomSetup: 'Random Placement',
    clearSetup: 'Clear',
    readyButton: 'Confirm Setup & Ready',
    waitingOpponent: 'Waiting for opponent to finish setup...',
    bothReady: 'Both ready! Battle Begins...',
    timerPresetFast: 'Fast',
    timerPresetNormal: 'Normal',
    timerPresetLong: 'Long',
    turnTimer: 'Turn Time',
    setupTimer: 'Setup Time',
    disconnectTimer: 'Disconnect Time',
    seconds: 's',
    statsTitle: 'Stats & Settings',
    soundVolume: 'Audio & Music Volume',
    totalGames: 'Games Played',
    redWins: 'Player 1 Wins',
    blueWins: 'Player 2 Wins',
    totalBattles: 'Total Battles',
    close: 'Close',
    onlineTitle: 'Online Room',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    roomCode: 'Room Code',
    copyCode: 'Copy Code', codeCopied: 'Code Copied!',
    enterCode: 'Enter room code',
    statusConnected: 'Connected',
    statusWaiting: 'Waiting for player...',
    playerRed: 'Player 1', playerBlue: 'Player 2', colorRed: 'Red', colorBlue: 'Blue',
    playerRedColor: 'Red Player', playerBlueColor: 'Blue Player',
    setupRedStatus: 'Player 1 is placing pieces', setupBlueStatus: 'Player 2 is placing pieces',
    turnRedStatus: 'Turn: Player 1 (Red)', turnBlueStatus: 'Turn: Player 2 (Blue)',
    opponentWaiting: 'Waiting for an opponent', opponentOffline: 'Your opponent disconnected',
    opponentSettingUp: 'Opponent is placing pieces', opponentReady: 'Opponent ready — waiting for you',
    yourTurnStatus: 'Your turn', opponentTurnStatus: 'Opponent’s turn',
    gameOverStatus: 'Game Over!',
    onlineButton: 'Online Game', roomLabel: 'Room', youAre: 'You', opponentShort: 'Opponent',
    countYoursLabel: 'Yours', countOpponentLostLabel: 'Opponent lost',
    capturedTitle: 'Captured',
    connectedShort: 'Connected', disconnectedShort: 'Disconnected',
    restartButton: 'Restart', playAgain: 'Play Again', statsButton: 'Statistics', timerPresetsLabel: 'Timer Presets',
    settingsPanelTitle: 'Settings', gameInfoPanelTitle: 'Game Info',
    timerLockedHint: 'Game started — timer settings locked.',
    timerHostOnlyHint: 'In online games the room host sets the turn time.',
    drawHeading: 'DRAW',
    drawTimeoutReason: 'Both players missed {n} turns — the game ended automatically.',
    allPlaced: 'All pieces placed!',
    allPlacedHint: 'Confirm your setup to start the match.',
    setupLocked: 'Your setup is locked!', waitingOpponentSetup: 'Waiting for your opponent to finish their setup...',
    statsHeading: 'MILITARY TACTICS STATISTICS', statsSubtitle: 'Analytics & Music Volume',
    bgMusicVolume: 'Background Music Volume',
    onlineHeading: 'ONLINE MULTIPLAYER', onlineSubtitle: 'Create a room or join with a code',
    shareCodeHint: 'Share this code with your opponent to invite them.',
    playerStatuses: 'Player Status', liveLabel: 'Live',
    onlineLabel: 'Online', offlineLabel: 'Offline',
    teamRedUnit: '1st Unit (Host)', teamBlueUnit: '2nd Unit (Guest)',
    waitingOpponentJoin: '⏳ Setup begins the moment your opponent joins the room.',
    bothReadyGoSetup: '⚔️ Both players ready! Moving to the setup screen...',
    leaveRoom: 'Leave Room', returnToLobby: 'Return to Lobby', playerName: 'Your Name', goBack: 'Go Back',
    phNameRed: 'e.g. Red Commander', phRoomCode: 'e.g. TAK-8492',
    joinRoomButton: 'JOIN ROOM',
    errRestartRequested: 'Your opponent requested to play again.',
    waitingRestartApproval: 'Restart requested — waiting for your opponent to confirm.',
    errConnectionLost: 'Connection lost.', errWsError: 'WebSocket connection error.',
    errRoomCreateFailed: 'Could not create the room.',
    errNOT_YOUR_TURN: 'It is your opponent’s turn.', errINVALID_MOVE: 'Invalid move.',
    errPIECE_NOT_FOUND: 'Piece not found.', errPIECE_IMMOBILE: 'This piece cannot move.',
    errONE_SQUARE: 'Only one square at a time.',
    errSTRAIGHT_ONLY: 'Only straight moves are allowed.', errOUT_OF_BOUNDS: 'Cannot move off the board.',
    errLAKE: 'Cannot move onto a lake.', errOWN_PIECE: 'Your own piece is there.',
    errSERVER_ERROR: 'Server error.', errROOM_FULL: 'The room is full or the game already started.',
    errROOM_CLOSED: 'This room code was already used once. Create a new room code.',
    errSCOUT_NOT_SCOUT: 'Only the Scout can do this.',
    errSCOUT_COOLDOWN: 'This Scout can be used again in {n} moves.',
    turnTimedOut: 'Your time ran out — the turn passed to your opponent.',
    errSCOUT_RANGE: 'The Scout can only see an enemy piece on its own row.',
    errSCOUT_LAKE: 'A lake blocks the line of sight.',
    errSCOUT_FOREST: 'A piece in the forest cannot be identified.',
    winnerLabel: 'Winner', youBadge: '(You)',
    victoryHeading: 'VICTORY!', defeatHeading: 'DEFEATED',
    victoryFlag: 'You captured the enemy banner. The field is yours!',
    defeatFlag: 'Your banner has fallen. The enemy took the field.',
    victoryOpponentLeft: 'Your opponent never came back — you win by forfeit.',
    defeatYouLeft: 'You lost the game because your connection stayed down too long.',
    victoryOpponentQuit: 'Your opponent left the room — you win by forfeit.',
    defeatOpponentQuit: 'You lost the game because you left the room.',
    victoryNoMoves: 'Your opponent has no piece left that can move. The field is yours!',
    defeatNoMoves: 'You have no piece left that can move. The field is your opponent’s.',
    drawNoMoves: 'Neither side has a piece left that can move — the game ended in a draw.',
    setupTimedOut: 'Setup time ran out — your remaining pieces were placed at random.',
    drawTitleShort: 'The game ended in a draw.',
    opponentDisconnectedTitle: 'Your opponent lost connection',
    opponentDisconnectedWait: 'Waiting for them to return — if they do not within {n}s, you win.',
    opponentReconnected: 'Your opponent reconnected, the game continues.',
    youDisconnectedTitle: 'You lost connection',
    youDisconnectedWait: 'Reconnecting — if you do not return within {n}s, you lose the game.',
    youReconnected: 'You are back online.',
    rulesTitle: 'Rank Hierarchy & Special Rules',
    rulesRanksTitle: 'Ranks',
    rulesColRank: 'Rank', rulesColPiece: 'Piece', rulesColCount: 'Count',
    rulesSpecialPieces: 'Special Pieces',
    rulesImmobileNote: 'Cannot move',
    rulesSpecialTitle: 'Special Rules',
    ruleSpy: 'The Spy beats the Marshal under all circumstances — whether attacking or defending.',
    ruleMiner: 'The Miner defuses the Mine and takes its square. Any other piece that hits a Mine dies.',
    ruleScout: 'The Scout reveals the identity of an enemy piece on its own row. The mission costs a turn; the first use is free, then a {n}-turn cooldown.',
    ruleEqual: 'On equal rank nobody wins: both pieces are removed from the board and both identities are revealed.',
    ruleMove: 'Pieces move one square in a straight line — forward, backward and sideways are all allowed.',
    ruleLake: 'Lakes cannot be crossed and block the Scout\'s line of sight.',
    ruleForest: 'A piece that wins a fight in the forest stays hidden; a piece standing in the forest cannot be identified by the Scout.',
    ruleFlag: 'Capturing the banner wins the game.',
    ruleNoMoves: 'A player who cannot move loses: the game ends if only Mines and the Banner remain, or if no piece has a legal move.',
    ruleTimeout: 'A player who runs out of time misses that turn. If both sides miss {n} times, the game ends in a draw.',
    ruleSetupTime: 'You have {n} seconds to set up. When the time runs out, any pieces you have not placed are placed at random.',
  },
  JA: {
    appTitle: 'ASTACT',
    appSubtitle: '戦略と戦術の戦い',
    gameInfoTitle: '対局情報',
    capturedPieces: '撃破した駒',
    gameTime: '経過時間',
    randomSetup: 'ランダム配置',
    clearSetup: 'クリア',
    readyButton: '配置完了・準備完了',
    waitingOpponent: '相手の配置完了を待っています...',
    bothReady: '両者準備完了！戦闘開始...',
    timerPresetFast: '高速',
    timerPresetNormal: '通常',
    timerPresetLong: 'じっくり',
    turnTimer: '持ち時間',
    setupTimer: '配置時間',
    disconnectTimer: '切断猶予',
    seconds: '秒',
    statsTitle: '戦績と設定',
    soundVolume: '音量とBGM',
    totalGames: '対局数',
    redWins: 'プレイヤー1勝利',
    blueWins: 'プレイヤー2勝利',
    totalBattles: '総戦闘回数',
    close: '閉じる',
    onlineTitle: 'オンライン対戦',
    createRoom: 'ルーム作成',
    joinRoom: 'ルーム参加',
    roomCode: 'ルームコード',
    copyCode: 'コードをコピー', codeCopied: 'コピーしました！',
    enterCode: 'コードを入力',
    statusConnected: '接続完了',
    statusWaiting: '対戦相手を待っています...',
    playerRed: 'プレイヤー1', playerBlue: 'プレイヤー2', colorRed: '赤', colorBlue: '青',
    playerRedColor: '赤プレイヤー', playerBlueColor: '青プレイヤー',
    setupRedStatus: 'プレイヤー1が配置中', setupBlueStatus: 'プレイヤー2が配置中',
    turnRedStatus: '手番: プレイヤー1（赤）', turnBlueStatus: '手番: プレイヤー2（青）',
    opponentWaiting: '相手を待っています', opponentOffline: '相手の接続が切れました',
    opponentSettingUp: '相手が配置中', opponentReady: '相手は準備完了 — あなた待ちです',
    yourTurnStatus: 'あなたの手番', opponentTurnStatus: '相手の手番',
    gameOverStatus: '対局終了！',
    onlineButton: 'オンライン対戦', roomLabel: 'ルーム', youAre: 'あなた', opponentShort: '相手',
    countYoursLabel: '自軍', countOpponentLostLabel: '相手の損失',
    capturedTitle: '鹵獲',
    connectedShort: '接続中', disconnectedShort: '切断',
    restartButton: '再開', playAgain: 'もう一度遊ぶ', statsButton: '統計', timerPresetsLabel: '持ち時間設定',
    settingsPanelTitle: '設定', gameInfoPanelTitle: 'ゲーム情報',
    timerLockedHint: '対局中は持ち時間を変更できません。',
    timerHostOnlyHint: 'オンライン対局では持ち時間を部屋の作成者が決めます。',
    drawHeading: '引き分け',
    drawTimeoutReason: '両者が{n}回時間切れになったため、対局を自動終了しました。',
    allPlaced: 'すべての駒を配置しました！',
    allPlacedHint: '配置を確定して対局を開始できます。',
    setupLocked: '配置を確定しました！', waitingOpponentSetup: '相手の配置完了を待っています…',
    statsHeading: '戦術統計', statsSubtitle: '分析と音量設定',
    bgMusicVolume: 'BGM音量',
    onlineHeading: 'オンライン対戦モード', onlineSubtitle: 'ルームを作成、またはコードで参加',
    shareCodeHint: 'このコードを相手に共有して招待してください。',
    playerStatuses: 'プレイヤー状況', liveLabel: 'ライブ',
    onlineLabel: 'オンライン', offlineLabel: 'オフライン',
    teamRedUnit: '第1部隊（ホスト）', teamBlueUnit: '第2部隊（ゲスト）',
    waitingOpponentJoin: '⏳ 相手がルームに参加した時点で配置が始まります。',
    bothReadyGoSetup: '⚔️ 両者準備完了！配置画面へ移動します…',
    leaveRoom: 'ルームを退出', returnToLobby: 'ロビーに戻る', playerName: 'プレイヤー名', goBack: '戻る',
    phNameRed: '例: 赤の指揮官', phRoomCode: '例: TAK-8492',
    joinRoomButton: 'ルームに参加',
    errRestartRequested: '相手がもう一度遊ぶことをリクエストしました。',
    waitingRestartApproval: '再開をリクエストしました。相手の承認を待っています。',
    errConnectionLost: '接続が切れました。', errWsError: 'WebSocket接続エラー。',
    errRoomCreateFailed: 'ルームを作成できませんでした。',
    errNOT_YOUR_TURN: '相手の手番です。', errINVALID_MOVE: '無効な手です。',
    errPIECE_NOT_FOUND: '駒が見つかりません。', errPIECE_IMMOBILE: 'この駒は動けません。',
    errONE_SQUARE: '一マスずつしか動けません。',
    errSTRAIGHT_ONLY: '直線移動のみ可能です。', errOUT_OF_BOUNDS: '盤外には出られません。',
    errLAKE: '湖には入れません。', errOWN_PIECE: 'そこには自分の駒があります。',
    errSERVER_ERROR: 'サーバーエラー。', errROOM_FULL: '部屋が満員か、ゲームがすでに開始しています。',
    errROOM_CLOSED: 'この部屋コードはすでに使用済みです。新しい部屋コードを作成してください。',
    errSCOUT_NOT_SCOUT: 'これができるのは斥候だけです。',
    errSCOUT_COOLDOWN: 'この斥候はあと{n}手で再び使えます。',
    turnTimedOut: '持ち時間が切れました — 相手の手番になりました。',
    errSCOUT_RANGE: '斥候は同じ行の敵の駒しか見られません。',
    errSCOUT_LAKE: '湖に遮られて視界がありません。',
    errSCOUT_FOREST: '森の中の駒は識別できません。',
    winnerLabel: '勝者', youBadge: '（あなた）',
    victoryHeading: '勝利！', defeatHeading: '敗北',
    victoryFlag: '敵の旗を奪取した。戦場は君のものだ！',
    defeatFlag: '自軍の旗が落ちた。戦場は敵の手に。',
    victoryOpponentLeft: '相手が戻らなかったため、不戦勝です。',
    defeatYouLeft: '接続が長時間切れていたため、敗北となりました。',
    victoryOpponentQuit: '相手がルームを退出したため、不戦勝です。',
    defeatOpponentQuit: 'ルームを退出したため、敗北となりました。',
    victoryNoMoves: '相手に動かせる駒が残っていません。戦場は君のものだ！',
    defeatNoMoves: '動かせる駒が残っていません。戦場は敵の手に。',
    drawNoMoves: '双方とも動かせる駒がなくなったため、引き分けで終了しました。',
    setupTimedOut: '配置時間が切れました — 残りの駒はランダムに配置されました。',
    drawTitleShort: '引き分けで終了しました。',
    opponentDisconnectedTitle: '相手の接続が切れました',
    opponentDisconnectedWait: '復帰を待っています — {n}秒以内に戻らなければあなたの勝ちです。',
    opponentReconnected: '相手が再接続しました。ゲームを続行します。',
    youDisconnectedTitle: '接続が切れました',
    youDisconnectedWait: '再接続中 — {n}秒以内に戻らなければ敗北となります。',
    youReconnected: '再接続しました。',
    rulesTitle: '階級と特殊ルール',
    rulesRanksTitle: '階級',
    rulesColRank: '階級', rulesColPiece: '駒', rulesColCount: '数',
    rulesSpecialPieces: '特殊な駒',
    rulesImmobileNote: '移動不可',
    rulesSpecialTitle: '特殊ルール',
    ruleSpy: 'スパイは元帥に攻撃・防御どちらでも勝ちます。',
    ruleMiner: '工兵は地雷を除去してそのマスに進みます。他の駒は地雷に当たると倒されます。',
    ruleScout: '斥候は同じ行にいる敵の駒の正体を明かします。任務は1手を消費し、初回は無料、その後は{n}手の待機が必要です。',
    ruleEqual: '同じ階級では勝敗がつきません。両方の駒が盤上から取り除かれ、双方の正体が明らかになります。',
    ruleMove: '駒は縦か横に1マスずつ動きます。前後左右いずれも自由です。',
    ruleLake: '湖は通れず、斥候の視界も遮ります。',
    ruleForest: '森で戦闘に勝った駒は正体を隠したままです。森にいる駒は斥候でも識別できません。',
    ruleFlag: '軍旗を奪った側が勝利します。',
    ruleNoMoves: '動かせる駒がなくなった側の負けです。地雷と軍旗しか残っていない場合、または合法手が一つもない場合に対局が終わります。',
    ruleTimeout: '時間切れになった側はその手番を失います。両者が{n}回ずつ失うと引き分けになります。',
    ruleSetupTime: '配置時間は{n}秒です。時間切れになると、置いていない駒はランダムに配置されます。',
  },
  KO: {
    appTitle: 'ASTACT',
    appSubtitle: '전략과 전술의 전쟁',
    gameInfoTitle: '게임 정보',
    capturedPieces: '포획한 기물',
    gameTime: '경과 시간',
    randomSetup: '무작위 배치',
    clearSetup: '초기화',
    readyButton: '배치 완료 및 준비',
    waitingOpponent: '상대방의 배치를 기다리는 중...',
    bothReady: '양측 준비 완료! 전투 시작...',
    timerPresetFast: '빠름',
    timerPresetNormal: '보통',
    timerPresetLong: '긴 시간',
    turnTimer: '턴 시간',
    setupTimer: '배치 시간',
    disconnectTimer: '연결 끊김 시간',
    seconds: '초',
    statsTitle: '통계 및 설정',
    soundVolume: '음량 및 배경음악',
    totalGames: '총 게임 수',
    redWins: '1플레이어 승리',
    blueWins: '2플레이어 승리',
    totalBattles: '전투 횟수',
    close: '닫기',
    onlineTitle: '온라인 방',
    createRoom: '방 만들기',
    joinRoom: '방 참가',
    roomCode: '방 코드',
    copyCode: '코드 복사', codeCopied: '코드가 복사되었습니다!',
    enterCode: '방 코드 입력',
    statusConnected: '연결됨',
    statusWaiting: '플레이어 대기 중...',
    playerRed: '플레이어 1', playerBlue: '플레이어 2', colorRed: '적군', colorBlue: '청군',
    playerRedColor: '적군 플레이어', playerBlueColor: '청군 플레이어',
    setupRedStatus: '플레이어 1이 기물을 배치 중', setupBlueStatus: '플레이어 2가 기물을 배치 중',
    turnRedStatus: '차례: 플레이어 1 (적군)', turnBlueStatus: '차례: 플레이어 2 (청군)',
    opponentWaiting: '상대를 기다리는 중', opponentOffline: '상대의 연결이 끊겼습니다',
    opponentSettingUp: '상대가 기물을 배치 중', opponentReady: '상대 준비 완료 — 당신을 기다리는 중',
    yourTurnStatus: '내 차례', opponentTurnStatus: '상대 차례',
    gameOverStatus: '게임 종료!',
    onlineButton: '온라인 대전', roomLabel: '방', youAre: '나', opponentShort: '상대',
    countYoursLabel: '내 기물', countOpponentLostLabel: '상대 손실',
    capturedTitle: '노획',
    connectedShort: '연결됨', disconnectedShort: '연결 끊김',
    restartButton: '다시 시작', playAgain: '다시 플레이', statsButton: '통계', timerPresetsLabel: '시간 설정',
    settingsPanelTitle: '설정', gameInfoPanelTitle: '게임 정보',
    timerLockedHint: '대국 중에는 시간 설정을 변경할 수 없습니다.',
    timerHostOnlyHint: '온라인 대국에서는 방장이 제한 시간을 정합니다.',
    drawHeading: '무승부',
    drawTimeoutReason: '양쪽 모두 {n}회 시간 초과하여 대국이 자동 종료되었습니다.',
    allPlaced: '모든 기물을 배치했습니다!',
    allPlacedHint: '배치를 확정하고 대국을 시작할 수 있습니다.',
    setupLocked: '배치가 확정되었습니다!', waitingOpponentSetup: '상대의 배치 완료를 기다리고 있습니다…',
    statsHeading: '전술 통계', statsSubtitle: '분석 및 음량 설정',
    bgMusicVolume: '배경음악 음량',
    onlineHeading: '온라인 멀티플레이', onlineSubtitle: '방 만들기 또는 코드로 참가',
    shareCodeHint: '이 코드를 상대에게 공유해 초대하세요.',
    playerStatuses: '플레이어 상태', liveLabel: '실시간',
    onlineLabel: '온라인', offlineLabel: '오프라인',
    teamRedUnit: '1부대 (방장)', teamBlueUnit: '2부대 (게스트)',
    waitingOpponentJoin: '⏳ 상대가 방에 참가하면 배치가 시작됩니다.',
    bothReadyGoSetup: '⚔️ 두 플레이어 준비 완료! 배치 화면으로 이동합니다…',
    leaveRoom: '방 나가기', returnToLobby: '로비로 돌아가기', playerName: '플레이어 이름', goBack: '뒤로 가기',
    phNameRed: '예: 적군 지휘관', phRoomCode: '예: TAK-8492',
    joinRoomButton: '방 참가',
    errRestartRequested: '상대가 다시 플레이를 요청했습니다.',
    waitingRestartApproval: '재시작을 요청했습니다. 상대의 승인을 기다리는 중입니다.',
    errConnectionLost: '연결이 끊어졌습니다.', errWsError: 'WebSocket 연결 오류.',
    errRoomCreateFailed: '방을 만들 수 없습니다.',
    errNOT_YOUR_TURN: '상대의 차례입니다.', errINVALID_MOVE: '잘못된 이동입니다.',
    errPIECE_NOT_FOUND: '기물을 찾을 수 없습니다.', errPIECE_IMMOBILE: '이 기물은 움직일 수 없습니다.',
    errONE_SQUARE: '한 칸씩만 이동할 수 있습니다.',
    errSTRAIGHT_ONLY: '직선 이동만 가능합니다.', errOUT_OF_BOUNDS: '판 밖으로 나갈 수 없습니다.',
    errLAKE: '호수로는 갈 수 없습니다.', errOWN_PIECE: '거기에는 아군 기물이 있습니다.',
    errSERVER_ERROR: '서버 오류.', errROOM_FULL: '방이 가득 찼거나 게임이 이미 시작되었습니다.',
    errROOM_CLOSED: '이 방 코드는 이미 한 번 사용되었습니다. 새 방 코드를 만드세요.',
    errSCOUT_NOT_SCOUT: '이 임무는 정찰병만 수행할 수 있습니다.',
    errSCOUT_COOLDOWN: '이 정찰병은 {n}수 후에 다시 사용할 수 있습니다.',
    turnTimedOut: '시간이 다 되었습니다 — 상대의 차례로 넘어갔습니다.',
    errSCOUT_RANGE: '정찰병은 같은 행의 적 기물만 볼 수 있습니다.',
    errSCOUT_LAKE: '호수에 가로막혀 시야가 없습니다.',
    errSCOUT_FOREST: '숲에 있는 기물은 식별할 수 없습니다.',
    winnerLabel: '승자', youBadge: '(나)',
    victoryHeading: '승리!', defeatHeading: '패배',
    victoryFlag: '적의 깃발을 빼앗았습니다. 전장은 당신의 것입니다!',
    defeatFlag: '아군의 깃발이 함락되었습니다. 전장을 적에게 내주었습니다.',
    victoryOpponentLeft: '상대가 돌아오지 않아 부전승으로 이겼습니다.',
    defeatYouLeft: '연결이 너무 오래 끊겨 패배했습니다.',
    victoryOpponentQuit: '상대가 방을 나가 부전승으로 이겼습니다.',
    defeatOpponentQuit: '방을 나갔기 때문에 패배했습니다.',
    victoryNoMoves: '상대에게 움직일 수 있는 기물이 남지 않았습니다. 전장은 당신의 것입니다!',
    defeatNoMoves: '움직일 수 있는 기물이 남지 않았습니다. 전장을 적에게 내주었습니다.',
    drawNoMoves: '양쪽 모두 움직일 수 있는 기물이 없어 무승부로 끝났습니다.',
    setupTimedOut: '배치 시간이 다 되었습니다 — 남은 기물이 무작위로 배치되었습니다.',
    drawTitleShort: '무승부로 끝났습니다.',
    opponentDisconnectedTitle: '상대의 연결이 끊겼습니다',
    opponentDisconnectedWait: '복귀를 기다리는 중 — {n}초 안에 돌아오지 않으면 당신이 승리합니다.',
    opponentReconnected: '상대가 다시 연결되어 게임이 계속됩니다.',
    youDisconnectedTitle: '연결이 끊겼습니다',
    youDisconnectedWait: '재연결 중 — {n}초 안에 돌아오지 않으면 패배합니다.',
    youReconnected: '다시 연결되었습니다.',
    rulesTitle: '계급 체계 & 특수 규칙',
    rulesRanksTitle: '계급',
    rulesColRank: '계급', rulesColPiece: '기물', rulesColCount: '수량',
    rulesSpecialPieces: '특수 기물',
    rulesImmobileNote: '이동 불가',
    rulesSpecialTitle: '특수 규칙',
    ruleSpy: '스파이는 공격하든 수비하든 어떤 경우에도 원수를 이깁니다.',
    ruleMiner: '공병은 지뢰를 제거하고 그 칸으로 이동합니다. 다른 기물은 지뢰에 부딪히면 죽습니다.',
    ruleScout: '정찰병은 같은 행에 있는 적 기물의 정체를 밝힙니다. 임무는 한 수를 소모하며, 첫 사용은 무료이고 이후 {n}수를 기다려야 합니다.',
    ruleEqual: '계급이 같으면 승자가 없습니다. 두 기물 모두 판에서 제거되며 양쪽 모두 정체가 드러납니다.',
    ruleMove: '기물은 가로 또는 세로로 한 칸씩 움직입니다. 앞뒤와 좌우 모두 자유롭습니다.',
    ruleLake: '호수는 지날 수 없고 정찰병의 시야도 막습니다.',
    ruleForest: '숲에서 전투에 이긴 기물은 정체를 숨긴 채 남습니다. 숲에 있는 기물은 정찰병으로도 식별할 수 없습니다.',
    ruleFlag: '군기를 빼앗으면 승리합니다.',
    ruleNoMoves: '움직일 수 있는 기물이 없는 쪽이 패배합니다. 지뢰와 군기만 남았거나 어떤 기물도 둘 수 없으면 대국이 끝납니다.',
    ruleTimeout: '시간이 다 된 쪽은 그 차례를 놓칩니다. 양쪽 모두 {n}번씩 놓치면 무승부가 됩니다.',
    ruleSetupTime: '배치 시간은 {n}초입니다. 시간이 끝나면 배치하지 않은 기물은 무작위로 배치됩니다.',
  }
};

