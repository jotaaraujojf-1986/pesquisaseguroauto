// Envia notificações push (Web Push) para administradores e entrevistadores.
// Chamado pelo banco (gatilhos e resumo diário, com x-segredo) e pelo app (teste, com o login da pessoa).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const PADRAO: Record<string, boolean> = { quente: true, outros: false, resumo: true, equipe: false, link: true, venda: true };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primeiro = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const horaSP = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

let cfg: Record<string, string> | null = null;
async function config() {
  if (!cfg) {
    const { data, error } = await sb.rpc("segredos_push");
    if (error) throw error;
    cfg = data;
    webpush.setVapidDetails("https://pesquisa-seguro-auto.vercel.app", cfg!.vapid_public, cfg!.vapid_private);
  }
  return cfg!;
}
const quer = (p: any, k: string) => { const v = p?.notif?.[k]; return typeof v === "boolean" ? v : PADRAO[k]; };

type Msg = { title: string; body: string; url: string; tag?: string };
async function enviar(perfis: any[], msg: Msg) {
  const ids = perfis.filter((p) => p.ativo && !p.excluido).map((p) => p.id);
  if (!ids.length) return 0;
  const { data: subs } = await sb.from("push_subs").select("*").in("user_id", ids);
  let ok = 0;
  await Promise.all((subs || []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: "high" });
      ok++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subs").delete().eq("id", s.id);
      else console.error("push falhou", e?.statusCode, e?.body || e?.message);
    }
  }));
  return ok;
}
const admins = async () => (await sb.from("profiles").select("id,nome,ativo,excluido,notif,papel").eq("papel", "admin")).data || [];
const perfil = async (id: string) => (await sb.from("profiles").select("id,nome,ativo,excluido,notif,papel").eq("id", id).maybeSingle()).data;

async function crmNovo(id: string) {
  const { data: c } = await sb.from("crm").select("*").eq("id", id).maybeSingle();
  if (!c || c.excluido) return 0;
  let nome = c.nome, carro = [c.modelo, c.ano].filter(Boolean).join(" "), classe = c.classe, quem: any = null, leadId = c.id, via = "";
  if (c.origem === "pesquisa") {
    const { data: e } = await sb.from("entrevistas").select("*").eq("id", c.entrevista_id).maybeSingle();
    if (!e || e.invalida || !e.consent || !e.whats) return 0;
    nome = e.nome; carro = [e.modelo, e.ano].filter(Boolean).join(" "); classe = e.classe; leadId = e.id;
    quem = await perfil(e.user_id); via = quem?.papel === "admin" ? "pela sua entrevista" : `pela rua (${primeiro(quem?.nome)})`;
  } else if (c.origem === "link") {
    quem = c.entrevistador_id ? await perfil(c.entrevistador_id) : null;
    via = quem?.papel === "admin" ? "pelo seu link" : `pelo link de ${primeiro(quem?.nome)}`;
  } else return 0;
  const quente = classe === "quente";
  let n = 0;
  const destino = (await admins()).filter((a) => quer(a, quente ? "quente" : "outros") && !(c.origem === "pesquisa" && quem?.id === a.id));
  n += await enviar(destino, {
    title: quente ? "Novo lead quente 🔥" : `Novo lead (${classe || "morno"})`,
    body: `${primeiro(nome)}${carro ? " · " + carro : ""} · ${via}`,
    url: "/?lead=" + leadId, tag: "lead-" + leadId,
  });
  if (c.origem === "link" && quem?.papel === "entrevistador" && quer(quem, "link")) {
    n += await enviar([quem], { title: "Seu link gerou um lead", body: `Alguém pediu cotação pelo seu link${quente ? " (lead quente 🔥)" : ""}. Se fechar, a comissão é sua.`, url: "/?aba=ganhos", tag: "link-" + c.id });
  }
  return n;
}

async function crmRepetido(id: string, por: string) {
  const { data: c } = await sb.from("crm").select("*").eq("id", id).maybeSingle();
  if (!c || c.excluido) return 0;
  let nome = c.nome, leadId = c.id;
  if (c.entrevista_id) {
    const { data: e } = await sb.from("entrevistas").select("id,nome").eq("id", c.entrevista_id).maybeSingle();
    if (e) { nome = e.nome; leadId = e.id; }
  }
  const quem = por ? await perfil(por) : null;
  const via = quem?.papel === "admin" ? "pelo seu link" : `pelo link de ${primeiro(quem?.nome)}`;
  return enviar((await admins()).filter((a) => quer(a, "quente")), {
    title: "Lead pediu cotação de novo",
    body: `${primeiro(nome)} já estava no funil e respondeu de novo ${via}.`,
    url: "/?lead=" + leadId, tag: "rep-" + leadId,
  });
}

async function venda(id: string) {
  const { data: c } = await sb.from("crm").select("*").eq("id", id).maybeSingle();
  if (!c || c.excluido || c.status !== "fechado") return 0;
  let uid = c.origem === "link" ? c.entrevistador_id : null, via = "de quem respondeu pelo seu link";
  if (c.origem === "pesquisa") {
    const { data: e } = await sb.from("entrevistas").select("user_id,dia").eq("id", c.entrevista_id).maybeSingle();
    uid = e?.user_id; via = "de uma entrevista sua";
  }
  if (!uid) return 0;
  const p = await perfil(uid);
  if (!p || p.papel !== "entrevistador" || !quer(p, "venda")) return 0;
  const { data: conf } = await sb.from("config").select("comissao").eq("id", 1).single();
  return enviar([p], { title: "Venda fechada! 🎉", body: `Fechou a venda ${via}. Você ganhou ${brl(+(conf?.comissao || 0))} de comissão.`, url: "/?aba=ganhos", tag: "venda-" + c.id });
}

async function dia(id: string, fim: boolean) {
  const { data: pr } = await sb.from("presencas").select("*").eq("id", id).maybeSingle();
  if (!pr) return 0;
  const p = await perfil(pr.user_id);
  if (!p || p.papel !== "entrevistador") return 0;
  let corpo = `${p.nome} iniciou o dia às ${horaSP(pr.inicio)}.`;
  if (fim) {
    const { data: es } = await sb.from("entrevistas").select("tipo,invalida,nome,whats,consent,modelo,ano").eq("user_id", pr.user_id).eq("dia", pr.dia);
    const v = (es || []).filter((e: any) => e.tipo !== "recusa" && !e.invalida && e.nome && (e.whats || "").length >= 10 && e.consent && e.modelo && e.ano).length;
    corpo = `${p.nome} encerrou o dia às ${horaSP(pr.fim)} com ${v} ${v === 1 ? "entrevista válida" : "entrevistas válidas"}.`;
  }
  return enviar((await admins()).filter((a) => quer(a, "equipe")), { title: fim ? "Dia encerrado" : "Dia iniciado", body: corpo, url: "/?aba=diario", tag: "dia-" + pr.id + (fim ? "-fim" : "") });
}

async function resumo() {
  const { data: r } = await sb.rpc("contagem_retornos");
  const hoje = r?.hoje || 0, atr = r?.atrasados || 0;
  if (!hoje && !atr) return 0;
  const partes = [hoje ? `${hoje} ${hoje === 1 ? "retorno" : "retornos"} para hoje` : "", atr ? `${atr} ${atr === 1 ? "atrasado" : "atrasados"}` : ""].filter(Boolean);
  return enviar((await admins()).filter((a) => quer(a, "resumo")), { title: "Bom dia! Seus retornos de hoje", body: partes.join(" · ") + ".", url: "/?aba=retornos", tag: "resumo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const c = await config();
    const corpo = await req.json().catch(() => ({}));
    const doBanco = req.headers.get("x-segredo") === c.notif_segredo;
    if (!doBanco) {
      // pedido do app: só o teste, para o próprio aparelho
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data } = await sb.auth.getUser(token);
      if (!data?.user || corpo.tipo !== "teste") return json({ erro: "sem permissão" }, 401);
      const p = await perfil(data.user.id);
      const n = p ? await enviar([p], { title: "Notificações ativadas ✅", body: "É assim que os avisos do app vão aparecer.", url: "/", tag: "teste" }) : 0;
      return json({ ok: true, enviados: n });
    }
    const d = corpo.dados || {};
    let n = 0;
    if (corpo.tipo === "crm_novo") n = await crmNovo(d.id);
    else if (corpo.tipo === "venda") n = await venda(d.id);
    else if (corpo.tipo === "crm_repetido") n = await crmRepetido(d.id, d.por);
    else if (corpo.tipo === "dia_inicio") n = await dia(d.id, false);
    else if (corpo.tipo === "dia_fim") n = await dia(d.id, true);
    else if (corpo.tipo === "resumo") n = await resumo();
    return json({ ok: true, enviados: n });
  } catch (e: any) {
    console.error(e);
    return json({ erro: String(e?.message || e) }, 500);
  }
});
