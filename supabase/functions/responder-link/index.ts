// Recebe as respostas do link público: confere o anti-robô (Cloudflare Turnstile)
// e grava pelo banco, informando o endereço de internet para o limite por conexão.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...CORS, "Content-Type": "application/json" } });
const MSG_USUARIO = /ativo|autorizar|Informe|Muitas|grande/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "método não permitido" });
  let corpo: any = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, erro: "Envio inválido." }); }
  const ip = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  const segredo = Deno.env.get("TURNSTILE_SECRET");
  if (segredo) {
    const token = String(corpo.token || "");
    if (!token) return json({ ok: false, robo: true, erro: "Confirme que você não é um robô e tente de novo." });
    const f = new FormData();
    f.append("secret", segredo); f.append("response", token); if (ip) f.append("remoteip", ip);
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: f });
      const v = await r.json();
      if (!v.success) return json({ ok: false, robo: true, erro: "Não foi possível confirmar que você não é um robô. Tente de novo." });
    } catch (_) {
      return json({ ok: false, erro: "Não foi possível enviar agora. Tente de novo em instantes." });
    }
  }

  const fn = corpo.parceiro ? "responder_parceiro_srv" : "responder_link_srv";
  const { error } = await sb.rpc(fn, { p_slug: String(corpo.slug || ""), p: corpo.p || {}, p_ip: ip });
  if (error) return json({ ok: false, erro: MSG_USUARIO.test(error.message) ? error.message : "Não foi possível enviar agora. Tente de novo em instantes." });
  return json({ ok: true });
});
