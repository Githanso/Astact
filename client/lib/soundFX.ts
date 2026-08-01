// Sound Manager — arka plan muzigi public/game_music.mp3 dosyasindan calinir.
// (v5 kaynaginda bu dosya hic kullanilmiyor, muzik osilatorlerle sentezleniyordu.)
const MUSIC_URL = '/game_music.mp3';

// Efekt sesleri. Dosya public/ altinda duruyor, ILK KULLANIMDA cekiliyor (onden
// yukleme yok: acilista game_music.mp3 zaten 3.6 MB, ustune efekt bindirmiyoruz).
// gain = efektin kendi seviyesi; ustune bir de kullanicinin ses ayari (masterGain)
// binyor. Yeni efekt gelince buraya bir satir + asagida bir metot govdesi yeter.
const FX_MOVE = { url: '/sfx/sfx-move.mp3', gain: 0.7 };
const FX_DEFEAT = { url: '/sfx/defeat.mp3', gain: 0.7 };
const FX_WINNER = { url: '/sfx/winner.mp3', gain: 0.7 };

class SoundManager {
  private ctx: AudioContext | null = null;
  public volume: number = 0.5; // Default 50%
  private isMusicPlaying: boolean = false;
  // Sesli autoplay reddedilince muzik SESSIZ baslatilir; bu bayrak "caliyor ama
  // duyulmuyor, ilk kullanici jestinde sesi acilmali" demek.
  private isMusicMuted: boolean = false;
  // Muzik yalnizca MENU ekraninda calar. Odaya girilince kapaniyor ve KAPALI
  // KALMASI gerekiyor: aksi halde ses kaydiracina dokunmak (setVolume) ya da
  // sekmeye geri donmek (visibilitychange -> unmuteBackgroundMusic) muzigi oyunun
  // ortasinda geri baslatirdi. Bu yuzden karar tek bayrakta toplandi.
  private musicAllowed: boolean = true;
  private bgTimer: number | null = null;
  private masterGain: GainNode | null = null;
  private bgAudio: HTMLAudioElement | null = null;
  // url -> cozulmus ses. null = "cekilemedi, bir daha deneme".
  private fxBuffers = new Map<string, AudioBuffer | null>();
  // Ayni efekt yuklenirken ikinci kez cagrilirsa iki fetch atilmasin diye.
  private fxLoading = new Map<string, Promise<void>>();

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.bgAudio) {
      this.bgAudio.volume = this.volume;
    }
    if (this.volume > 0 && (!this.isMusicPlaying || this.isMusicMuted)) {
      this.unmuteBackgroundMusic();
    } else if (this.volume === 0 && this.isMusicPlaying) {
      this.stopBackgroundMusic();
    }
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.bgAudio) {
      this.bgAudio = new Audio(MUSIC_URL);
      this.bgAudio.loop = true;
      this.bgAudio.preload = 'auto';
    }
    return this.bgAudio;
  }

  // Muzige izin ver / kapat. Kapatinca calan muzik durur; acinca ses acik ise
  // kaldigi yerden degil, bastan degil — HTMLAudioElement duraklatildigi icin
  // kaldigi yerden devam eder.
  public setMusicAllowed(izin: boolean) {
    if (this.musicAllowed === izin) return;
    this.musicAllowed = izin;
    if (!izin) { this.stopBackgroundMusic(); return; }
    if (this.volume > 0) this.unmuteBackgroundMusic();
  }

  public startBackgroundMusic() {
    if (!this.musicAllowed) return;
    if (this.isMusicPlaying && !this.isMusicMuted) return;
    const audio = this.ensureAudio();
    audio.volume = this.volume;
    audio.muted = false;
    // Once SESLI dene: ziyaretci siteyle daha once etkilesmisse (Chrome'un Media
    // Engagement Index'i) veya tarayici site izni verilmisse muzik jest olmadan girer.
    const started = audio.play();
    if (started && typeof started.then === 'function') {
      started.then(() => { this.isMusicPlaying = true; this.isMusicMuted = false; })
             .catch(() => { this.startMutedFallback(); });
    } else {
      this.isMusicPlaying = true;
      this.isMusicMuted = false;
    }
  }

  // Sesli autoplay reddedildi. Tarayicilar SESSIZ medyanin autoplay'ine izin verdigi
  // icin muzigi sessiz baslatiyoruz: boylece ilk jest geldiginde play() izni beklemek
  // yerine sadece muted=false yetiyor ve ses aninda giriyor (bkz. unmuteBackgroundMusic).
  private startMutedFallback() {
    const audio = this.ensureAudio();
    audio.muted = true;
    const started = audio.play();
    if (started && typeof started.then === 'function') {
      started.then(() => { this.isMusicPlaying = true; this.isMusicMuted = true; })
             .catch(() => { this.isMusicPlaying = false; this.isMusicMuted = false; });
    } else {
      this.isMusicPlaying = true;
      this.isMusicMuted = true;
    }
  }

  // Kullanici jesti geldiginde cagrilir: sessiz calan muzigin sesini acar, hic
  // baslamadiysa bastan baslatir. Ses kapaliysa (kullanici sustur demisse) dokunmaz.
  public unmuteBackgroundMusic() {
    if (!this.musicAllowed) return;
    if (this.volume <= 0) return;
    if (this.isMusicPlaying && this.isMusicMuted && this.bgAudio) {
      this.bgAudio.muted = false;
      this.bgAudio.volume = this.volume;
      this.isMusicMuted = false;
      // Bazi tarayicilar sessiz->sesli gecisde elementi duraklatiyor.
      this.bgAudio.play().catch(() => {});
      return;
    }
    this.startBackgroundMusic();
  }

  public stopBackgroundMusic() {
    this.isMusicPlaying = false;
    this.isMusicMuted = false;
    if (this.bgAudio) {
      this.bgAudio.pause();
    }
    if (this.bgTimer !== null) {
      clearTimeout(this.bgTimer);
      this.bgTimer = null;
    }
  }

  // --- Efektler ---------------------------------------------------------

  private async loadFx(url: string): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      this.fxBuffers.set(url, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // Dosya yoksa veya cozulemezse SESSIZ dus: eksik efekt yuzunden oyun
      // bozulmasin. null yaziliyor, bir daha denenmiyor.
      this.fxBuffers.set(url, null);
    }
  }

  // Efektler masterGain'e baglaniyor: kullanicinin ses kaydiraci ve sustur dugmesi
  // muzikle birlikte efektleri de kisiyor. Her calmada yeni BufferSource kuruluyor
  // (kullan-at dugum), boylece ust uste binen sesler birbirini kesmiyor —
  // HTMLAudioElement ile ayni anda iki kez calmak mumkun olmazdi.
  private emitFx(url: string, gain: number) {
    const buf = this.fxBuffers.get(url);
    if (!buf || !this.ctx || !this.masterGain || this.volume <= 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  private playFx(url: string, gain: number) {
    if (this.volume <= 0) return;
    if (!this.getContext()) return;
    if (this.fxBuffers.has(url)) { this.emitFx(url, gain); return; }
    // Ilk cagri: once cek, sonra cal. Ayni origin'den 50 KB'lik dosya, gecikme
    // fark edilmiyor; alternatifi ilk hamlenin sessiz kalmasiydi.
    let p = this.fxLoading.get(url);
    if (!p) { p = this.loadFx(url); this.fxLoading.set(url, p); }
    p.then(() => this.emitFx(url, gain)).catch(() => {});
  }

  // Ses dosyasi bekleyen efektler. Dosya public/ altina dusunce govde tek satir:
  //   playSelect() { this.playFx(FX_SELECT.url, FX_SELECT.gain); }
  playSelect() {}
  playMove() { this.playFx(FX_MOVE.url, FX_MOVE.gain); }
  playCombat() {}
  playExplosion() {}
  playVictory() {}
  playDefeat() { this.playFx(FX_DEFEAT.url, FX_DEFEAT.gain); }
  playWinner() { this.playFx(FX_WINNER.url, FX_WINNER.gain); }
}

export const soundManager = new SoundManager();
