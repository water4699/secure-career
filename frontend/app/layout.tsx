import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const metadata: Metadata = {
  title: "Secure Career - Private Resume Encryption Storage",
  description: "Privacy-preserving resume storage system using FHEVM. Protect your sensitive career data while enabling encrypted skill matching.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`zama-bg text-foreground antialiased`}>
        <div className="fixed inset-0 w-full h-full zama-bg z-[-20] min-w-[850px]"></div>
        <Providers>
          <main className="flex flex-col max-w-screen-xl mx-auto pb-20 min-w-[850px] px-4">
            <nav className="flex w-full px-3 md:px-0 h-fit py-8 justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-16 h-16 bg-white/90 rounded-3xl shadow-lg backdrop-blur-sm">
                  <span className="text-3xl">💼</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Secure Career
                  </h1>
                  <p className="text-sm text-white/80 font-medium">🔒 Privacy-Preserving Resume Storage</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="hidden md:flex items-center space-x-2 bg-white/20 backdrop-blur-md rounded-full px-4 py-2 text-white text-sm font-medium">
                  <span>🛡️</span>
                  <span>FHEVM Protected</span>
                </div>
                <ConnectButton />
              </div>
            </nav>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
