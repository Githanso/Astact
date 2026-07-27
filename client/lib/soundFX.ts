// Sound Manager — arka plan muzigi public/game_music.mp3 dosyasindan calinir.
// (v5 kaynaginda bu dosya hic kullanilmiyor, muzik osilatorlerle sentezleniyordu.)
const MUSIC_URL = '/game_music.mp3';

class SoundManager {
  private ctx: AudioContext | null = null;
  public volume: number = 0.5; // Default 50%
  private isMusicPlaying: boolean = false;
  // Sesli autoplay reddedilince muzik SESSIZ baslatilir; bu bayrak "caliyor ama
  // duyulmuyor, ilk kullanici jestinde sesi acilmali" demek.
  private isMusicMuted: boolean = false;
  private bgTimer: number | null = null;
  private masterGain: GainNode | null = null;
  private bgAudio: HTMLAudioElement | null = null;

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

  public startBackgroundMusic() {
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

  playSelect() {}
  playMove() {}
  playCombat() {}
  playExplosion() {}
  playVictory() {}
}

export const soundManager = new SoundManager();
