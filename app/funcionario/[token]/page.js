"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function PainelFuncionario() {
  const { token } = useParams();
  useEffect(() => {
    import("../../../lib/funcionario").then((m) => m.iniciarFuncionario(String(token || "")));
  }, [token]);
  return (
    <div className="wrap lk">
      <main id="pc"><div className="loading">Carregando…</div></main>
    </div>
  );
}
