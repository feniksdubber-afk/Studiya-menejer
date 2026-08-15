/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Telegram theme CSS variablariga mos — index.css'da o'rnatiladi
        tg: {
          bg: "var(--tg-theme-bg-color, #ffffff)",
          text: "var(--tg-theme-text-color, #111111)",
          hint: "var(--tg-theme-hint-color, #999999)",
          link: "var(--tg-theme-link-color, #2481cc)",
          button: "var(--tg-theme-button-color, #2481cc)",
          buttonText: "var(--tg-theme-button-text-color, #ffffff)",
          secondaryBg: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
        },
        // Studiya bo'limlari uchun rasmiy rang tizimi (rol/status badge'lar).
        // Har bir rol = studiyadagi bo'lim, tg-* dan mustaqil (Telegram
        // temasi bog'liq emas, chunki bular semantik ma'no tashiydi).
        role: {
          director: { 50: "#FAEEDA", 400: "#EF9F27", 600: "#BA7517", 800: "#854F0B", 900: "#412402" },
          translator: { 50: "#EEEDFE", 400: "#7F77DD", 600: "#534AB7", 800: "#3C3489", 900: "#26215C" },
          voice: { 50: "#FAECE7", 400: "#F0997B", 600: "#D85A30", 800: "#712B13", 900: "#4A1B0C" },
          sound: { 50: "#E1F5EE", 400: "#5DCAA5", 600: "#1D9E75", 800: "#085041", 900: "#04342C" },
        },
      },
      fontFamily: {
        // Deadline, versiya (v1/v2), timestamp kabi raqamlar uchun —
        // taymkod uslubidagi monospace, studiyaning vizual imzosi.
        mono: ["'JetBrains Mono'", "'SF Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
