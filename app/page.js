"use client";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    import("../lib/app").then((m) => m.iniciar());
  }, []);
  return (
    <>
      <div className="wrap" id="wrap">
        <main id="app">
          <div className="loading">Carregando…</div>
        </main>
      </div>
      <div id="sheet" />
      <div id="modal" />
      <div className="toast" id="toast" />
      <div className="tip" id="tip" />
    </>
  );
}
