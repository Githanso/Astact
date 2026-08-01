// Oyun tahtasi grafiklerinin (avif dokular) on yuklemesi.
//
// Neden gerekli: oyun ekrani acilir acilmaz her kare floor.avif'i, gol ve orman
// kendi avif dokusunu cekiyor. Yavas agda bu istekler gec gelirse kareler once
// bos/ciplak gorunup sonra doluyor. Bunun onune gecmek icin bu dosyalar MENU
// ekraninda arka planda (gizli) yuklenir; tumu hazir olunca App oyun ekranina
// geciyor. Boylece oyun acildiginda grafikler zaten bellegin icindedir.

const OYUN_GORSELLERI = [
    '/assets/floor.avif',
    '/assets/forest.avif',
    '/assets/lake.avif',
];

// onReady, her dosya yuklense de (onload) yuklenemese de (onerror) BIR KEZ
// cagrilir: goruntulenemeyen bir doku oyunu acilmaz birakmasin, yalnizca dokusuz
// kalir. Promise.allSettled'in senkron karsiligi.
export function oyunGorselleriYukle(onReady: () => void): void {
    let kalan = OYUN_GORSELLERI.length;
    const bitti = () => {
        kalan -= 1;
        if (kalan <= 0) onReady();
    };
    for (const url of OYUN_GORSELLERI) {
        const img = new Image();
        img.onload = bitti;
        img.onerror = bitti;
        img.src = url;
    }
}
