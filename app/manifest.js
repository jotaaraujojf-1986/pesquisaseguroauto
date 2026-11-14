export default function manifest() {
  return {
    name: "Pesquisa Seguro Auto",
    short_name: "Pesquisa",
    description: "Pesquisa de campo e CRM para venda de seguro auto",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#0f766e",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
