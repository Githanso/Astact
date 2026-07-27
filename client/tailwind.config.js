/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./App.tsx", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tailwind'in varsayilan grid-rows degerleri 1-6 ile sinirli;
      // 10 satirlik tahta icin acikca tanimlanmasi gerekiyor.
      gridTemplateRows: {
        10: 'repeat(10, minmax(0, 1fr))',
      },
      // Keyframe'ler index.css'te; utility'nin uretilmesi icin burada da tanimli olmali.
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'fade-in-up': 'fadeInUp 0.45s ease-out both',
      },
    },
  },
  plugins: [],
};