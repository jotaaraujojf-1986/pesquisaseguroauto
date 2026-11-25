// Ari: gera a próxima resposta do assistente com o Claude (API da Anthropic).
// Modos (só administrador com código de verificação):
//  - teste: conversa que vive só na tela de teste (nada é gravado além do custo);
//  - conversa: conversa gravada em ari_contatos/ari_mensagens. Por enquanto só para
//    clientes SIMULADOS; a conversa real chega pelo WhatsApp na etapa 3.
// Nada é enviado ao WhatsApp nesta versão.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const srv = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELOS: Record<string, { entrada: number; saida: number; cacheLe: number; cacheGrava: number }> = {
  // US$ por milhão de tokens (estimativa usada só para mostrar o custo no painel)
  "claude-sonnet-5-5": { entrada: 2, saida: 10, cacheLe: 0.1, cacheGrava: 2.5 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5, cacheLe: 0.005, cacheGrava: 0.125 },
};

const FERRAMENTAS = [
  { name: "buscar_documentos", description: "Busca trechos nos documentos oficiais em uso (contrato Loovi, regras de utilização, condições gerais LTI e outros que o Jota enviou). Use palavras-chave em português.", input_schema: { type: "object", properties: { consulta: { type: "string" } }, required: ["consulta"] } },
  { name: "consultar_veiculo", description: "Verifica se a marca/modelo aparece na lista de Veículos Restritos ou na Tabela de Veículos Diferenciados.", input_schema: { type: "object", properties: { marca: { type: "string" }, modelo: { type: "string" } }, required: ["marca", "modelo"] } },
  { name: "enviar_link_cotacao", description: "Devolve o link oficial de cotação do Jota.", input_schema: { type: "object", properties: {} } },
  { name: "passar_para_jota", description: "Passa o lead para o Jota. Preencha resumo com a intenção, a dúvida exata e o que já foi respondido.", input_schema: { type: "object", properties: { nome: { type: "string" }, resumo: { type: "string" }, observacoes: { type: "string" } }, required: ["resumo"] } },
  { name: "avisar_jota", description: "Avisa o Jota (notificação) sem passar a conversa, quando um lead quente tirou uma dúvida que você respondeu.", input_schema: { type: "object", properties: { motivo: { type: "string" }, resumo: { type: "string" } }, required: ["resumo"] } },
  { name: "apagar_dados", description: "Apaga os dados do cliente após ele confirmar com APAGAR.", input_schema: { type: "object", properties: {} } },
];

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
const toks = (s: string) => norm(s).split(" ").filter((w) => w.length > 1);

let veiculosCache: { quando: number; r: string[]; f: string[] } | null = null;
async function veiculos() {
  if (veiculosCache && Date.now() - veiculosCache.quando < 5 * 60e3) return veiculosCache;
  const { data } = await srv.from("ari_veiculos").select("tipo, descricao").limit(5000);
  const r = (data || []).filter((x) => x.tipo === "restrito").map((x) => x.descricao);
  const f = (data || []).filter((x) => x.tipo === "diferenciado").map((x) => x.descricao);
  veiculosCache = { quando: Date.now(), r, f };
  return veiculosCache;
}
async function consultarVeiculo(marca: string, modelo: string) {
  const { r, f } = await veiculos();
  const mb = norm(marca).split(" ")[0] || "", mt = toks(modelo);
  const rest = r.filter((x) => { const n = norm(x); return (!mb || n.includes(mb)) && mt.length > 0 && mt.every((w) => n.includes(w)); }).slice(0, 8);
  const dif = f.filter((x) => { const n = norm(x); if (mb && !n.startsWith(mb)) return false; return /todos os modelos/.test(n) || mt.some((w) => w.length > 2 && n.includes(w)); });
  return { restrito: rest.length > 0, modelos_restritos_parecidos: rest, diferenciado: dif.length > 0, linha_tabela_diferenciados: dif };
}

// junta mensagens seguidas do mesmo lado (a API exige alternância)
function alternar(lista: { role: string; content: string }[]) {
  const out: { role: string; content: string }[] = [];
  for (const m of lista) {
    if (!m.content.trim()) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n" + m.content;
    else out.push({ ...m });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function gerar(chave: string, conversa: { role: string; content: string }[], modelo: string, cfg: any, extraSistema = "") {
  const preco = MODELOS[modelo];
  const { data: resp } = await srv.from("ari_respostas").select("pergunta, resposta").eq("ativo", true).order("criado_em", { ascending: false }).limit(80);
  const aprovadas = (resp || []).length
    ? "\n\nRESPOSTAS APROVADAS PELO JOTA (valem mais que os documentos; quando a pergunta do cliente for parecida, responda com o conteúdo destas, adaptando só o tom):\n" + resp!.map((x) => `- Pergunta: ${x.pergunta}\n  Resposta: ${x.resposta}`).join("\n")
    : "";
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const system = [
    { type: "text", text: (cfg.instrucoes || "") + aprovadas, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Horário de atendimento do Jota: ${cfg.hora_ini ?? 8}h às ${cfg.hora_fim ?? 19}h.\nHORA ATUAL (Brasília): ${agora}.` + extraSistema },
  ];
  const msgs: any[] = conversa.map((m) => ({ role: m.role, content: m.content }));
  const eventos: any[] = [], efeitos: any[] = [];
  const uso = { entrada: 0, cache: 0, cacheGrava: 0, saida: 0 };
  let linkEnviado = false, final = "";

  for (let rodada = 0; rodada < 6; rodada++) {
    let r: Response;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: modelo, max_tokens: 1024, system, tools: FERRAMENTAS, messages: msgs }),
      });
    } catch (_) { return { erro: "Não foi possível falar com a IA agora." }; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { erro: "A IA recusou o pedido: " + (d?.error?.message || r.status) };
    uso.entrada += d.usage?.input_tokens || 0; uso.cache += d.usage?.cache_read_input_tokens || 0;
    uso.cacheGrava += d.usage?.cache_creation_input_tokens || 0; uso.saida += d.usage?.output_tokens || 0;

    const texto = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (texto) final = texto;
    const usos = (d.content || []).filter((b: any) => b.type === "tool_use");
    if (d.stop_reason !== "tool_use" || !usos.length) break;

    msgs.push({ role: "assistant", content: d.content });
    const resultados: any[] = [];
    for (const u of usos) {
      let saida: unknown = "ok";
      const e = u.input || {};
      if (u.name === "buscar_documentos") {
        const { data: t } = await srv.rpc("ari_buscar", { q: String(e.consulta || ""), n: 5 });
        saida = (t || []).length ? t!.map((x: any) => ({ documento: x.documento, secao: x.secao || "", trecho: x.trecho })) : "Nenhum trecho encontrado nos documentos em uso.";
        eventos.push({ tipo: "busca", texto: `“${e.consulta}” · ${(t || []).length} trechos`, detalhe: (t || []).map((x: any) => `[${x.documento}${x.secao ? " · " + x.secao : ""}]\n${String(x.trecho).slice(0, 400)}…`).join("\n\n") });
      } else if (u.name === "consultar_veiculo") {
        saida = await consultarVeiculo(String(e.marca || ""), String(e.modelo || ""));
        const v: any = saida;
        eventos.push({ tipo: "veiculo", texto: `${e.marca} ${e.modelo} · ${v.restrito ? "aparece nos restritos" : "não aparece nos restritos"} · ${v.diferenciado ? "diferenciado" : "não diferenciado"}` });
      } else if (u.name === "enviar_link_cotacao") {
        if (cfg.loovi_link) { saida = { link: cfg.loovi_link }; linkEnviado = true; eventos.push({ tipo: "link", texto: "Link de cotação enviado" }); }
        else { saida = "O link de cotação não está configurado. Ofereça que o Jota faça a cotação."; eventos.push({ tipo: "link", texto: "Link de cotação não configurado" }); }
      } else if (u.name === "passar_para_jota") {
        efeitos.push({ tipo: "passar", ...e });
        eventos.push({ tipo: "passar", texto: "Passou o lead para o Jota" + (e.nome ? ": " + e.nome : ""), detalhe: [e.resumo, e.observacoes].filter(Boolean).join("\n") });
      } else if (u.name === "avisar_jota") {
        efeitos.push({ tipo: "avisar", ...e });
        eventos.push({ tipo: "avisar", texto: "Avisou o Jota: " + (e.motivo || "lead quente"), detalhe: e.resumo || "" });
      } else if (u.name === "apagar_dados") {
        efeitos.push({ tipo: "apagar" });
        eventos.push({ tipo: "apagar", texto: "Cliente confirmou que quer apagar os dados" });
      } else saida = "Ferramenta desconhecida.";
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: typeof saida === "string" ? saida : JSON.stringify(saida) });
    }
    msgs.push({ role: "user", content: resultados });
  }

  // botões e link saem do texto, como vão sair no WhatsApp
  const mb = final.match(/^\s*BOT(?:Õ|O)ES:\s*(.+)$/mi);
  const botoes = mb ? mb[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3) : [];
  let corpoTxt = final.replace(/^\s*BOT(?:Õ|O)ES:.*$/mi, "");
  if (cfg.loovi_link) corpoTxt = corpoTxt.split(cfg.loovi_link).join("");
  corpoTxt = corpoTxt.trim();
  const custo = (uso.entrada * preco.entrada + uso.cache * preco.cacheLe + uso.cacheGrava * preco.cacheGrava + uso.saida * preco.saida) / 1e6;
  return { texto: corpoTxt, bruto: final, botoes, link: linkEnviado ? cfg.loovi_link : null, eventos, efeitos, modelo, uso: { ...uso, custo_usd: custo } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "método não permitido" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const usr = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  const { data: admin } = await usr.rpc("is_admin");
  if (admin !== true) return json({ erro: "Sem permissão." }, 403);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return json({ erro: "A chave da IA (ANTHROPIC_API_KEY) ainda não foi cadastrada no Supabase.", semChave: true }, 503);

  let corpo: any = {};
  try { corpo = await req.json(); } catch { return json({ erro: "Envio inválido." }, 400); }

  const [{ data: aj }, { data: cf }] = await Promise.all([
    srv.from("ari_ajustes").select("instrucoes, modelo, hora_ini, hora_fim").eq("id", 1).single(),
    srv.from("config").select("loovi_link").eq("id", 1).single(),
  ]);
  const cfg = { instrucoes: aj?.instrucoes, hora_ini: aj?.hora_ini, hora_fim: aj?.hora_fim, loovi_link: cf?.loovi_link };
  if (!cfg.instrucoes) return json({ erro: "As instruções do Ari estão vazias. Preencha em Ajustes." }, 400);
  const modelo = MODELOS[corpo.modelo] ? corpo.modelo : (aj?.modelo || "claude-sonnet-5-5");

  /* ---------- conversa de teste (só na tela) ---------- */
  if (!corpo.contato_id) {
    const conversa = Array.isArray(corpo.mensagens) ? corpo.mensagens.slice(-40) : [];
    if (!conversa.length || conversa.some((m: any) => !["user", "assistant"].includes(m?.role) || typeof m?.content !== "string" || m.content.length > 4000) || conversa[conversa.length - 1].role !== "user")
      return json({ erro: "Conversa inválida." }, 400);
    const r: any = await gerar(chave, conversa, modelo, cfg);
    if (r.erro) return json(r, 502);
    await srv.from("ari_uso").insert({ origem: "teste", modelo, tokens_entrada: r.uso.entrada + r.uso.cacheGrava, tokens_cache: r.uso.cache, tokens_saida: r.uso.saida, custo_usd: r.uso.custo_usd.toFixed(5) });
    delete r.efeitos;
    return json(r);
  }

  /* ---------- conversa gravada ---------- */
  const { data: ct } = await srv.from("ari_contatos").select("*").eq("id", String(corpo.contato_id)).maybeSingle();
  if (!ct) return json({ erro: "Conversa não encontrada." }, 404);
  if (!ct.simulado) return json({ erro: "Conversas reais são respondidas pelo WhatsApp (etapa 3)." }, 400);
  if (ct.estado !== "ativo") return json({ ok: true, pulou: ct.estado });

  const { data: hist } = await srv.from("ari_mensagens").select("autor, texto, extra, criado_em").eq("contato_id", ct.id).order("criado_em", { ascending: false }).limit(60);
  const lista = (hist || []).reverse().filter((m) => m.autor !== "sistema").map((m) => {
    if (m.autor === "cliente") return { role: "user", content: m.texto || "" };
    if (m.autor === "jota") return { role: "assistant", content: "[Mensagem do Jota, escrita por ele] " + (m.texto || "") };
    const bt = m.extra?.botoes?.length ? "\nBOTOES: " + m.extra.botoes.join(" | ") : "";
    return { role: "assistant", content: (m.texto || "") + bt };
  });
  const conversa = alternar(lista);
  if (!conversa.length || conversa[conversa.length - 1].role !== "user") return json({ ok: true, nada: true });

  const r: any = await gerar(chave, conversa, modelo, cfg, ct.nome ? `\nNome do contato no WhatsApp: ${ct.nome}.` : "");
  if (r.erro) return json(r, 502);

  // grava as respostas na ordem em que o cliente veria
  const base = Date.now();
  const linhas: any[] = [];
  const add = (o: any) => linhas.push({ contato_id: ct.id, criado_em: new Date(base + linhas.length * 10).toISOString(), ...o });
  if (r.texto) add({ direcao: "out", autor: "ari", tipo: "texto", texto: r.texto, status: "simulada", extra: { botoes: r.botoes, eventos: r.eventos, modelo: r.modelo, custo_usd: r.uso.custo_usd } });
  else if (r.eventos.length) add({ direcao: "int", autor: "sistema", tipo: "outro", texto: "O Ari consultou: " + r.eventos.map((e: any) => e.texto).join(" · "), status: "interna", extra: { eventos: r.eventos } });
  if (r.link) add({ direcao: "out", autor: "ari", tipo: "texto", texto: r.link, status: "simulada", extra: { link: true } });

  const muda: any = { ultima_msg_em: new Date(base + linhas.length * 10).toISOString(), atualizado_em: new Date().toISOString() };
  for (const ef of r.efeitos) {
    if (ef.tipo === "passar") {
      muda.estado = "passado"; if (ef.resumo) muda.resumo = String(ef.resumo).slice(0, 1000); if (ef.nome && !ct.nome) muda.nome = String(ef.nome).slice(0, 80);
      add({ direcao: "int", autor: "sistema", tipo: "outro", texto: "O Ari passou a conversa para você" + (ef.observacoes ? " (" + ef.observacoes + ")" : "") + ". Na conexão real, o lead entraria no Funil e você receberia uma notificação.", status: "interna" });
    } else if (ef.tipo === "avisar") {
      if (ef.resumo) muda.resumo = String(ef.resumo).slice(0, 1000);
      add({ direcao: "int", autor: "sistema", tipo: "outro", texto: "O Ari te avisou: " + (ef.motivo || "lead quente") + ". Na conexão real, chegaria uma notificação no seu celular.", status: "interna" });
    } else if (ef.tipo === "apagar") {
      muda.estado = "encerrado";
      add({ direcao: "int", autor: "sistema", tipo: "outro", texto: "O cliente pediu para apagar os dados. Na conexão real, o contato e as mensagens seriam apagados e a Loovi avisada.", status: "interna" });
    }
  }
  if (linhas.length) await srv.from("ari_mensagens").insert(linhas);
  await srv.from("ari_contatos").update(muda).eq("id", ct.id);
  await srv.from("ari_uso").insert({ origem: "teste", contato_id: ct.id, modelo, tokens_entrada: r.uso.entrada + r.uso.cacheGrava, tokens_cache: r.uso.cache, tokens_saida: r.uso.saida, custo_usd: r.uso.custo_usd.toFixed(5) });
  return json({ ok: true, estado: muda.estado || ct.estado, uso: r.uso });
});
