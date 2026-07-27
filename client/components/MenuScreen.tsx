import React from 'react';
import { Language } from '../types';
import { LANGUAGES, TRANSLATIONS } from '../constants';
import { Users, Settings } from 'lucide-react';

// Giris (menu) ekrani: logo, online oyun, ayarlar, dil.
interface MenuScreenProps {
    lang: Language;
    onLanguageChange: (lang: Language) => void;
    onOpenOnline: () => void;
    onOpenSettings: () => void;
}

const MenuScreen: React.FC<MenuScreenProps> = ({ lang, onLanguageChange, onOpenOnline, onOpenSettings }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-6 relative overflow-hidden">
            {/* Logonun arkasindaki isima. Logo saydam oldugu icin cerceveye gerek yok;
                renk logonun kendi kirmizisindan (#ad3f43) turetildi. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,760px)] h-[min(90vw,760px)]"
                style={{ background: 'radial-gradient(circle, rgba(173,63,67,0.20) 0%, rgba(173,63,67,0.07) 38%, transparent 68%)' }}
            />

            <div className="relative z-10 w-full max-w-sm flex flex-col items-center animate-fade-in-up">
                {/* Alt yazi gorselden cikarildi; burada metin olarak geri geliyor ve dort
                    dilde dogru cikiyor. Yeri rastgele degil: SVG'de "astact" ile alt kalkan
                    arasinda 426-499 satirlari (yuksekligin %59.9-%70.2'si) tamamen bos —
                    yazinin orijinal yeri orasi. Metni tam o banda oturtuyoruz.
                    Punto cqw ile kabin genisligine bagli, boylece her boyutta orantili kalir. */}
                <div className="relative w-full max-w-[300px] mb-9" style={{ containerType: 'inline-size' }}>
                    <img
                        src="/logo.svg"
                        alt={t.appTitle}
                        className="w-full h-auto select-none block"
                        draggable={false}
                    />
                    <p
                        className="absolute inset-x-0 flex items-center justify-center whitespace-nowrap font-bold uppercase text-slate-300"
                        style={{ top: '59.9%', height: '10.3%', fontSize: '3.2cqw', letterSpacing: '0.16em' }}
                    >
                        {t.appSubtitle}
                    </p>
                </div>

                {/* Online BIRINCIL eylem: oyun karsilikli iki kisi icin. Ayni ekranda
                    sirayla oynama secenegi kaldirildi — dizilim sirasinda rakibin ekrana
                    bakmamasi gerektigi icin bu oyunda anlamli degil. */}
                <div className="w-full space-y-3">
                    <button
                        onClick={onOpenOnline}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                    >
                        <Users className="w-4 h-4" />
                        <span>{t.onlineButton}</span>
                    </button>

                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95"
                    >
                        <Settings className="w-4 h-4" />
                        <span>{t.settingsPanelTitle}</span>
                    </button>
                </div>

                <div className="mt-9 flex items-center gap-1.5">
                    {LANGUAGES.map(l => (
                        <button
                            key={l.code}
                            onClick={() => onLanguageChange(l.code as Language)}
                            aria-pressed={lang === l.code}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                lang === l.code
                                    ? 'bg-slate-800 border-amber-500/50 text-amber-300'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                        >
                            {l.flag} {l.code}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MenuScreen;
