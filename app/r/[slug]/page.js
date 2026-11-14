"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function LinkPesquisa() {
  const { slug } = useParams();
  useEffect(() => {
    import("../../../lib/link").then((m) => m.iniciarLink(String(slug || "")));
  }, [slug]);
  return (
    <div className="wrap lk">
      <main id="lk"><div className="loading">Carregando…</div></main>
    </div>
  );
}
