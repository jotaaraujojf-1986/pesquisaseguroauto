"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function PainelParceiro() {
  const { token } = useParams();
  useEffect(() => {
    import("../../../lib/parceiro").then((m) => m.iniciarParceiro(String(token || "")));
  }, [token]);
  return (
    <div className="wrap lk">
      <main id="pc"><div className="loading">Carregando…</div></main>
    </div>
  );
}
