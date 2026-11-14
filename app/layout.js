import "./globals.css";

export const metadata = {
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
  themeColor: "#0f766e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
