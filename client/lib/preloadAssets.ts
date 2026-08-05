// Oyun tahtasi grafiklerinin (avif dokular) on yuklemesi.
//
// Neden gerekli: oyun ekrani acilir acilmaz her kare floor.avif'i, gol ve orman
// kendi avif dokusunu cekiyor. Yavas agda bu istekler gec gelirse kareler once
// bos/ciplak gorunup sonra doluyor. Bunun onune gecmek icin bu dosyalar MENU
// ekraninda arka planda (gizli) yuklenir; tumu hazir olunca App oyun ekranina
// geciyor. Boylece oyun acildiginda grafikler zaten bellegin icindedir.

import { KARAKTER_GORSELLERI } from '../constants';

// Zemin/orman/gol dokulari + 14 karakter gorseli.
//
// Karakterler de BURADA: dizilim alani 40 tasla birden aciliyor, on yuklenmezse
// figurler kare kare doluyor. Toplam 230 KB oldugu icin maliyeti yok (dosyalar
// 384x384 webp; bkz. constants.ts -> PIECE_ART).
const OYUN_GORSELLERI = [
    '/assets/floor.avif',
    '/assets/forest.avif',
    '/assets/lake.avif',
    ...KARAKTER_GORSELLERI,
];

// decode() BEKLENIYOR, yalnizca onload degil: onload dosyanin INDIGINI soyler,
// COZULDUGUNU degil. Cozme ilk boyamaya birakilinca tahta acilirken bir kare
// takiliyor — indirme bitmis olsa bile. decode() bunu pesinen yaptiriyor.
// Eski tarayicida decode yoksa onload'a duselim diye catch ile yutuluyor.
function tekGorselYukle(url: string): Promise<void> {
    return new Promise<void>((cozuldu) => {
        const img = new Image();
        // Hata da BASARI sayiliyor: goruntulenemeyen bir doku oyunu acilmaz
        // birakmasin, yalnizca dokusuz kalsin.
        img.onerror = () => cozuldu();
        img.onload = () => {
            if (typeof img.decode !== 'function') { cozuldu(); return; }
            img.decode().then(() => cozuldu(), () => cozuldu());
        };
        img.src = url;
    });
}

/** Tum tahta dokularini indirir VE cozer. Hicbir kosulda reject etmez. */
export function oyunGorselleriniHazirla(): Promise<void> {
    return Promise.all(OYUN_GORSELLERI.map(tekGorselYukle)).then(() => undefined);
}

/**
 * onReady, tum dosyalar hazir olunca BIR KEZ cagrilir (yuklenemeyenler de
 * "hazir" sayilir). Promise.allSettled'in geri cagirmali karsiligi.
 */
export function oyunGorselleriYukle(onReady: () => void): void {
    void oyunGorselleriniHazirla().then(onReady);
}
