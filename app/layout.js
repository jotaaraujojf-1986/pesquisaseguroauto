import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://pesquisa-seguro-auto.vercel.app"),
  title: "Pesquisa Seguro Auto",
  description: "Pesquisa de campo e CRM para venda de seguro auto",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Pesquisa", statusBarStyle: "default" },
  icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3f5be0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('tema');if(t&&t!=='auto')document.documentElement.setAttribute('data-tema',t)}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
