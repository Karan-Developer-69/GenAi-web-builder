import type { Metadata } from "next";
import "./globals.css";
import GlobalEffects from "./components/GlobalEffects";


export const metadata: Metadata = {
  title: "Lysis AI — Build Websites that feel Alive",
  description: "Describe what you want — Lysis AI designs, writes, and launches your full website in under 60 seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text)' }}>
        <GlobalEffects />
        {children}
      </body>
    </html>
  );
}

