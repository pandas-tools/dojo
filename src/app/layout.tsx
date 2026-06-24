import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sharpGrotesk = localFont({
  variable: "--font-sharp-grotesk",
  display: "swap",
  src: [
    { path: "../../public/brand/fonts/SharpGrotesk-Book20.otf", weight: "400", style: "normal" },
    { path: "../../public/brand/fonts/SharpGrotesk-Medium20.otf", weight: "500", style: "normal" },
  ],
});

const silkaMono = localFont({
  variable: "--font-silka-mono",
  display: "swap",
  src: [
    { path: "../../public/brand/fonts/SilkaMono-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/brand/fonts/SilkaMono-Medium.otf", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Dojo",
  description: "Training portal for Pandas Vision AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sharpGrotesk.variable} ${silkaMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
