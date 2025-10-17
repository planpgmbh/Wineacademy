import localFont from "next/font/local";

export const serifBabe = localFont({
  src: [
    {
      path: "../public/fonts/SerifbabeAlpha-Regular.woff2",
      weight: "300",
      style: "normal"
    }
  ],
  display: "swap",
  variable: "--font-serifbabe"
});
