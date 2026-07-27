// Sound Manager — arka plan muzigi public/game_music.mp3 dosyasindan calinir.
// (v5 kaynaginda bu dosya hic kullanilmiyor, muzik osilatorlerle sentezleniyordu.)
const MUSIC_URL = '/game_music.mp3';

class SoundManager {
  private ctx: AudioContext | null = null;
  public volume: number = 0.5; // Default 50%
  private isMusicPlaying: boolean = false;
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
    if (this.volume > 0 && !this.isMusicPlaying) {
      this.startBackgroundMusic();
    } else if (this.volume === 0 && this.isMusicPlaying) {
      this.stopBackgroundMusic();
    }
  }

  public startBackgroundMusic() {
    if (this.isMusicPlaying) return;
    if (!this.bgAudio) {
      this.bgAudio = new Audio(MUSIC_URL);
      this.bgAudio.loop = true;
      this.bgAudio.preload = 'auto';
    }
    this.bgAudio.volume = this.volume;
    // Tarayicilar kullanici etkilesimi olmadan autoplay'i engeller; play()
    // reddedilen bir promise dondurur. Sessizce yakalayip bayragi geri aliyoruz,
    // ses acildiginda (kullanici jesti) tekrar denenir.
    const started = this.bgAudio.play();
    if (started && typeof started.then === 'function') {
      started.then(() => { this.isMusicPlaying = true; })
             .catch(() => { this.isMusicPlaying = false; });
    } else {
      this.isMusicPlaying = true;
    }
  }

  public stopBackgroundMusic() {
    this.isMusicPlaying = false;
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
