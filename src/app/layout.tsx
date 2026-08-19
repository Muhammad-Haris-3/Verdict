import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap",
});

export const metadata: Metadata = {
  title: "Verdict — why most A/B tests are read wrong",
  description:
    "Checking an A/B test as it runs turns a 5% false-positive rate into roughly 29%. Simulated live in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <header className="site">
            <div className="in">
              <b>Verdict</b>
              <i>why most A/B tests are read wrong</i>
            </div>
          </header>
          <main>{children}</main>
          <footer className="site">
            <div className="in">
              <span style={{ maxWidth: "56ch" }}>
                A short piece, not a platform. Every figure is simulated in your browser from a
                fixed seed — nothing is hardcoded, nothing is stored.{" "}
                <a href="https://github.com/Muhammad-Haris-3">Source</a>
              </span>
              <span className="mono" style={{ fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase" }}>
                Muhammad Haris
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
