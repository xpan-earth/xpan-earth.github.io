import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "deriva — actualidad y archivo",
  description: "Instrumento editorial y documental para usar el teléfono como acceso al mundo.",
  applicationName: "deriva",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "deriva" },
  formatDetection: { telephone: false },
  other: { "codex-preview": "development", "mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0b0b0a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><head><script dangerouslySetInnerHTML={{ __html: `if(location.hostname==="terminal.local"&&"serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(r=>Promise.all(r.map(x=>x.unregister()))).then(()=>caches.keys()).then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>{if(!sessionStorage.getItem("deriva-preview-reset")){sessionStorage.setItem("deriva-preview-reset","1");location.reload()}})}` }} /></head><body>{children}</body></html>;
}
