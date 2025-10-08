import type { Config } from "tailwindcss";
import daisyui from "daisyui";

/**
 * Tailwind 4 base configuration limited to DaisyUI defaults.
 * Wir beschränken uns auf DaisyUI-Komponenten für das neue Frontend.
 */
export default {
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  plugins: [daisyui],
} satisfies Config;
