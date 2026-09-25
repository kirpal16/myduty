import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Gujarati, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { OfflineScreen } from "@/components/ui/offline-screen";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The app carries a lot of Gujarati (ફરજ, જાહેર રજાઓ, ભથ્થાં) and no Latin
 * face covers that script, so without this those words fall back to whatever
 * each device happens to ship — different on every phone, and usually
 * mismatched against the Latin text beside it. Listed after Inter in the
 * stack, so it only ever picks up the characters Inter cannot draw.
 */
const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-gujarati",
  subsets: ["gujarati"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#071633",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "My Duty - Gujarat Police Portal",
    template: "%s | My Duty",
  },
  description:
    "Official Gujarat Police Duty Log Book & Officer Management Portal",
  applicationName: "My Duty",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My Duty",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/Gujarat-police.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      /* globals.css applies `scroll-smooth` to <html>. Next 16 warns unless it
         is told the smoothness is deliberate, so it knows to suppress it during
         route transitions — without this, changing page animates the scroll
         instead of jumping, which reads as lag. */
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${notoGujarati.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Capture beforeinstallprompt ASAP — before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwaInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
              });
              window.addEventListener('appinstalled', function() {
                window.__pwaInstallPrompt = null;
                window.dispatchEvent(new CustomEvent('pwa-installed'));
              });
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PwaRegister />
        <OfflineScreen />
        {/* Wraps everything so any client component can call useToast(). The
            toasts themselves render through a portal, so this adds no layout. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
