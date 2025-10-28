/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: ["class", '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                // Common colors - her iki theme'de de kullanılır
                common: {
                    white: "#ffffff",
                    black: "#000000",
                    success: "#6cc788",
                    error: "#f44455",
                    warning: "#fbbf24",
                    info: "#3b82f6",
                },
                
                // Light Theme colors
                light: {
                    background: {
                        primary: "#ffffff",
                        secondary: "#f3f4f6",
                        tertiary: "#e5e7eb",
                    },
                    text: {
                        primary: "#111827",
                        secondary: "#4b5563",
                        tertiary: "#9ca3af",
                    },
                    border: {
                        primary: "#d1d5db",
                        secondary: "#e5e7eb",
                    },
                    accent: {
                        primary: "#3b82f6",
                        secondary: "#60a5fa",
                        hover: "#2563eb",
                    },
                },
                
                // Dark Theme colors
                dark: {
                    background: {
                        primary: "#1a1a1a",
                        secondary: "#242424",
                        tertiary: "#2e2e2e",
                    },
                    text: {
                        primary: "#eeeeee",
                        secondary: "#b6b6b6",
                        tertiary: "#969696",
                    },
                    border: {
                        primary: "#3f3f3f",
                        secondary: "#525252",
                    },
                    accent: {
                        primary: "#6887ff",
                        secondary: "#8ca3ff",
                        hover: "#4d6ee6",
                    },
                },
                
                // Semantic colors - CSS variables'a bağlı
                brand: "var(--color-brand)",
                primary: "var(--color-primary)",
                background: "var(--color-background)",
            },
            spacing: {
                128: "32rem",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
            },
        },
    },
    plugins: [],
};
