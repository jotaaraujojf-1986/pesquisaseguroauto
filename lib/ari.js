// Ari (assistente de WhatsApp): telas do administrador.
// Carregado só quando o administrador abre o menu "WhatsApp (Ari)".
// Etapa 2: teste com a IA de verdade, conhecimento, respostas aprovadas, veículos e ajustes.
// Nada aqui envia mensagem para o WhatsApp.

const MODELOS = { "claude-sonnet-5-5": "Sonnet (mais caprichado)", "claude-haiku-5-5": "Haiku (mais barato)" };
const TIPOS = { cliente: "Usado para responder", estilo: "Jeito de falar e vender", interno: "Interno (o Ari não usa)" };
const DOLAR = 5.5; // só para mostrar uma ideia em reais

export function criarAri(ctx) {
  const { sb, esc, toast, render, abrirSheet, fecharSheet, $, abrirNotificacoes, ativacaoDoLink, config } = ctx;
  let sub = "conversas";
  // conversas gravadas
  let contatos = null, previas = {}, selId = null, msgsSel = null, pensando = {}, rascCli = "", rascJota = "", filtroConv = "abertas", buscaConv = "", modoEnvio = "jota";
  // teste
  let conversa = [];      // [{role, content}] enviado para a IA
  let bolhas = [];        // o que aparece na tela
  let ocupado = false, rascunho = "", modeloTeste = null, semChave = false;
  // dados carregados sob demanda
  let docs = null, respostas = null, veiculos = null, ajustes = null, gasto = null, buscaTeste = null, filtroVeic = "";
  let colarAberto = false, enviandoArq = false;
  let perguntas = null, cotacoes = {}, crmLig = {}, cotSel = null, painelLead = false, filtroTemp = "", timersCli = {};
  let carregando = {}, falhou = {};

  const reais = (usd) => "R$ " + (usd * DOLAR).toFixed(usd * DOLAR < 0.1 ? 3 : 2).replace(".", ",");
  const fmtWa = (t) => esc(t)
    .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.length > 48 ? u.slice(0, 45) + "…" : u}</a>`)
    .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,!?:;)]|$)/gm, "$1<b>$2</b>")
    .replace(/^- (.+)$/gm, '<span class="ar-li">$1</span>')
    .replace(/<\/span>\n/g, "</span>").replace(/\n/g, "<br>");

  async function carregar(qual) {
    if (carregando[qual] || falhou[qual]) return; carregando[qual] = true;
    try {
      if (qual === "docs") {
        const linhas = [];
        for (let de = 0; ; de += 1000) {
          const { data, error } = await sb.from("ari_conhecimento").select("documento, tipo, ativo, origem").range(de, de + 999);
          if (error) throw error; linhas.push(...data); if (data.length < 1000) break;
        }
        const m = new Map();
        linhas.forEach((l) => { const x = m.get(l.documento) || { nome: l.documento, tipo: l.tipo, ativo: l.ativo, origem: l.origem, n: 0 }; x.n++; m.set(l.documento, x); });
        docs = [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
      } else if (qual === "contatos") {
        const { data, error } = await sb.from("ari_contatos").select("id, wa_id, whats, nome, estado, resumo, simulado, lida_em, ultima_msg_em, criado_em, crm_id, temperatura").order("ultima_msg_em", { ascending: false, nullsFirst: false }).limit(300);
        if (error) throw error; contatos = data;
        const { data: ms } = await sb.from("ari_mensagens").select("contato_id, autor, texto, criado_em, extra").order("criado_em", { ascending: false }).limit(1500);
        previas = {};
        (ms || []).forEach((m) => {
          const p = previas[m.contato_id] || (previas[m.contato_id] = { ult: null, naoLidas: 0 });
          if (!p.ult && m.autor !== "sistema") p.ult = m;
          const c = contatos.find((x) => x.id === m.contato_id);
          if (m.autor === "cliente" && c && (!c.lida_em || m.criado_em > c.lida_em)) p.naoLidas++;
        });
        const ids = contatos.map((c) => c.id), crms = contatos.map((c) => c.crm_id).filter(Boolean);
        cotacoes = {}; crmLig = {};
        if (ids.length) { const { data: ct } = await sb.from("ari_cotacao").select("contato_id, placa, veiculo").in("contato_id", ids); (ct || []).forEach((x) => { cotacoes[x.contato_id] = x; }); }
        if (crms.length) { const { data: cr } = await sb.from("crm").select("id, status, classe").in("id", crms); (cr || []).forEach((x) => { crmLig[x.id] = x; }); }
      } else if (qual === "perguntas") {
        const { data, error } = await sb.from("ari_perguntas").select("*").eq("status", "pendente").order("criado_em", { ascending: false }).limit(200);
        if (error) throw error; perguntas = data;
      } else if (qual === "cotSel") {
        if (!selId) return;
        const { data } = await sb.from("ari_cotacao").select("*").eq("contato_id", selId).maybeSingle();
        cotSel = data || {};
      } else if (qual === "msgs") {
        if (!selId) return;
        const { data, error } = await sb.from("ari_mensagens").select("*").eq("contato_id", selId).order("criado_em").limit(1000);
        if (error) throw error; msgsSel = data;
      } else if (qual === "respostas") {
        const { data, error } = await sb.from("ari_respostas").select("*").order("criado_em", { ascending: false });
        if (error) throw error; respostas = data;
      } else if (qual === "veiculos") {
        const { data, error } = await sb.from("ari_veiculos").select("id, tipo, descricao").order("descricao").limit(5000);
        if (error) throw error; veiculos = data;
      } else if (qual === "ajustes") {
        const { data, error } = await sb.from("ari_ajustes").select("*").eq("id", 1).single();
        if (error) throw error; ajustes = data;
        const { data: cf } = await sb.from("config").select("loovi_link, loovi_ativacao, loovi_ativacao_cheia").eq("id", 1).single();
        ajustes.loovi_link = cf ? cf.loovi_link : null; ajustes.loovi_ativacao = cf ? cf.loovi_ativacao : null; ajustes.loovi_cheia = cf ? cf.loovi_ativacao_cheia : null;
        const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
        const { data: u } = await sb.from("ari_uso").select("origem, custo_usd").gte("criado_em", ini.toISOString()).limit(10000);
        gasto = { teste: 0, whatsapp: 0, n: (u || []).length };
        (u || []).forEach((x) => { gasto[x.origem] += +x.custo_usd; });
      }
    } catch (e) { falhou[qual] = true; toast("Não foi possível carregar: " + (e.message || e)); }
    carregando[qual] = false; render();
  }

  /* ---------- telas ---------- */
  const ICO = {
    conversas: '<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 3.5z"/>',
    perguntas: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    conhecimento: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6"/>',
    teste: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' };
  const ABAS = [["conversas", "Conversas"], ["perguntas", "Perguntas"], ["conhecimento", "Conhecimento"], ["teste", "Testar"], ["ajustes", "Ajustes"]];
  function contadores() {
    const naoLidas = contatos ? contatos.reduce((a, c) => a + ((previas[c.id] || {}).naoLidas || 0), 0) : 0;
    return { conversas: naoLidas, perguntas: perguntas ? perguntas.length : 0 };
  }
  function abas() {
    if (!perguntas) carregar("perguntas");
    const n = contadores(), atual = sub === "veiculos" ? "conhecimento" : sub;
    return `<div class="filters ar-abas">${ABAS.map(([k, nm]) => `<button class="btn sm ${atual === k ? "pri" : ""}" data-ar="sub" data-k="${k}">${nm}${n[k] ? ` <span class="ar-ab-n">${n[k]}</span>` : ""}</button>`).join("")}</div>
      <nav class="ar-bnav" aria-label="Seções do Ari">${ABAS.map(([k, nm]) => `<button class="${atual === k ? "on" : ""}" data-ar="sub" data-k="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>${n[k] ? `<span class="ar-bb">${n[k]}</span>` : ""}${nm}</button>`).join("")}</nav>`;
  }
  function tela() {
    const corpo = sub === "conversas" ? telaConversas() : sub === "teste" ? telaTeste() : sub === "conhecimento" ? telaConhecimento() : sub === "perguntas" ? telaPerguntas() : sub === "veiculos" ? telaVeiculos() : telaAjustes();
    if (sub !== "conversas") document.body.classList.remove("ar-chat-aberto");
    document.body.classList.add("ar-com-bnav");
    document.body.classList.toggle("ar-fit", sub === "conversas");
    return `<div class="notice ar-aviso-off" style="margin-bottom:12px"><b>Ari desligado.</b> Tudo aqui é preparação e teste: nenhuma mensagem vai para o WhatsApp até a conexão com a Meta (etapa 3).</div>${abas()}${corpo}`;
  }

  const horaCurta = (iso) => { if (!iso) return ""; const d = new Date(iso), h = new Date();
    return d.toDateString() === h.toDateString() ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
  const ESTADOS = { ativo: ["Ari atendendo", "b-neutro"], passado: ["Com você", "b-warn"], encerrado: ["Encerrada", "b-off"] };
  const foneTxt = (c) => c.simulado ? "cliente simulado" : (c.whats || "").replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");

  const iniciaisDe = (n) => { const p = String(n || "").trim().split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); };
  const ehCel = () => window.matchMedia("(max-width: 760px)").matches;

  const tempDe = (c) => { const l = c.crm_id && crmLig[c.crm_id]; return (l && l.classe) || c.temperatura || ""; };
  const ultimaVisivel = (c) => (previas[c.id] || {}).ult;
  const aguardando = (c) => c.estado === "passado" && ultimaVisivel(c) && ultimaVisivel(c).autor === "cliente";
  const TEMPS = [["quente", "Quentes"], ["morno", "Mornos"], ["frio", "Frios"]];

  function telaConversas() {
    if (!contatos) { carregar("contatos"); return esperando("contatos"); }
    if (!ajustes) carregar("ajustes");
    const q = buscaConv.trim().toLowerCase(), qd = q.replace(/[^a-z0-9]/g, "");
    const porEstado = (k) => contatos.filter((c) => k === "todas" || (k === "abertas" ? c.estado !== "encerrado" : k === "aguardando" ? aguardando(c) : c.estado === k));
    const lista = porEstado(filtroConv).filter((c) => (!filtroTemp || tempDe(c) === filtroTemp) && (!q || (c.nome || "").toLowerCase().includes(q)
      || (qd.length >= 3 && ((!c.simulado && (c.whats || "").includes(qd.replace(/\D/g, "") || "§")) || ((cotacoes[c.id] || {}).placa || "").toLowerCase().includes(qd)))));
    const sel = contatos.find((c) => c.id === selId);
    if (sel && !msgsSel) carregar("msgs");
    if (sel && !cotSel) carregar("cotSel");
    document.body.classList.toggle("ar-chat-aberto", !!sel);
    const itens = lista.map((c) => { const p = previas[c.id] || {}; const u = p.ult; const [en, ec] = ESTADOS[c.estado] || ["", ""]; const t = tempDe(c);
      const est = aguardando(c) ? ["Aguardando você", "b-warn"] : [en, ec];
      return `<button class="ar-ci ${c.id === selId ? "on" : ""}" data-ar="abrirConv" data-id="${c.id}">
        <span class="ar-av">${esc(iniciaisDe(c.nome || "Cliente"))}</span>
        <span class="ar-ci-mid">
          <span class="ar-ci-l1"><b>${esc(c.nome || foneTxt(c))}</b><span class="ar-ci-hr ${p.naoLidas ? "nl" : ""}">${horaCurta(c.ultima_msg_em || c.criado_em)}</span></span>
          <span class="ar-ci-l2"><span class="ar-ci-pv">${u ? (u.autor === "cliente" ? "" : u.autor === "jota" ? "Você: " : "Ari: ") + esc((u.extra && u.extra.link ? "Link de cotação" : u.texto || "").slice(0, 80)) : "&nbsp;"}</span>${p.naoLidas ? `<span class="ar-nl">${p.naoLidas}</span>` : ""}</span>
          <span class="ar-ci-l3"><span class="badge ${est[1]}">${est[0]}</span>${t ? `<span class="badge b-${t}">${t}</span>` : ""}${c.simulado ? `<span class="badge b-neutro">teste</span>` : ""}</span>
        </span></button>`; }).join("");
    const ESTS = [["abertas", "Abertas"], ["aguardando", "Aguardando você"], ["ativo", "Com o Ari"], ["passado", "Com você"], ["encerrado", "Encerradas"], ["todas", "Todas"]];
    const chips = `<select class="ar-estado" data-ar="filtroConv" aria-label="Filtrar conversas">${ESTS.map(([k, n]) => { const qt = porEstado(k).length; return `<option value="${k}" ${filtroConv === k ? "selected" : ""}>${n}${qt ? ` · ${qt}` : ""}</option>`; }).join("")}</select>`;
    const tchips = TEMPS.map(([k, n]) => { const qt = porEstado(filtroConv).filter((c) => tempDe(c) === k).length;
      return `<button class="btn sm ar-tchip ${filtroTemp === k ? "pri" : ""}" data-ar="filtroTemp" data-k="${k}"><i class="ar-dot ar-dot-${k}"></i>${n} ${qt}</button>`; }).join("");
    const listaHtml = `<div class="card ar-lista ${sel ? "ar-esconde-m" : ""}">
      <div class="ar-lista-cab"><h2>Conversas</h2><button class="btn sm pri ar-novo" data-ar="simular" aria-label="Simular cliente novo"><span class="ar-dsk-i">Simular cliente novo</span><span class="ar-mob-i">+</span></button></div>
      <input type="text" inputmode="search" enterkeyhint="search" class="ar-busca" data-ar="buscaConv" placeholder="Buscar nome, placa ou telefone" value="${esc(buscaConv)}" aria-label="Buscar conversa">
      <div class="ar-filtros">${chips}</div>
      <div class="ar-temps">${tchips}</div>
      <div class="ar-cis">${itens || `<div class="empty">${contatos.length ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Quando o WhatsApp estiver conectado, os clientes aparecem aqui. Para ver como funciona, toque em <b>Simular cliente novo</b>."}</div>`}</div></div>`;
    return `<div class="ar-conv ${sel ? "com-sel" : ""}">${listaHtml}${sel ? telaConversa(sel) + telaLead(sel) : `<div class="card ar-vazia ar-esconde-m"><div class="empty">Escolha uma conversa.</div></div>`}</div>`;
  }

  function acoesConv(c) {
    return `${c.estado === "ativo" ? `<button class="btn sm" data-ar="estado" data-k="passado">Assumir conversa</button>` : ""}
      ${c.estado !== "ativo" ? `<button class="btn sm" data-ar="estado" data-k="ativo">${c.estado === "encerrado" ? "Reabrir com o Ari" : "Devolver para o Ari"}</button>` : ""}
      ${c.estado !== "encerrado" ? `<button class="btn sm" data-ar="estado" data-k="encerrado">Encerrar</button>` : ""}
      ${c.simulado ? `<button class="btn sm bad" data-ar="excluirConv">Excluir teste</button>` : ""}`;
  }

  const ETAPAS = [["novo", "Novo"], ["contatado", "Contatado"], ["cotado", "Cotado"], ["fechado", "Fechado"], ["perdido", "Perdido"]];
  function telaLead(c) {
    const k = cotSel || {}, lig = c.crm_id && crmLig[c.crm_id], t = tempDe(c);
    const kv = [["Telefone", c.simulado ? "cliente simulado" : foneTxt(c)], ["Veículo", k.veiculo], ["Placa", k.placa], ["Uso", k.uso], ["Seguro atual", k.seguro_atual],
      ["Cidade", [k.cidade, k.uf].filter(Boolean).join("/")], ["Nome completo", k.nome_completo], ["E-mail", k.email], ["CPF", k.cpf_final ? "•••.•••.•••-" + k.cpf_final : ""],
      ["Endereço", [k.endereco || [k.logradouro, k.numero, k.complemento, k.bairro].filter(Boolean).join(", "), k.cep ? "CEP " + k.cep : ""].filter(Boolean).join(" · ")]];
    const linkEnviado = (msgsSel || []).some((m) => m.extra && m.extra.link);
    return `<div class="ar-lead ${painelLead ? "aberto" : ""}">
      <div class="card"><div class="ar-lead-cab"><button class="ar-voltar ar-mob" data-ar="fecharLead" aria-label="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button>
        <b style="flex:1;min-width:0">${esc(c.nome || "Sem nome")}</b>${t ? `<span class="badge b-${t}" style="flex:none">${t}</span>` : ""}</div>
        <dl class="ar-kv">${kv.map(([n, v]) => `<div><dt>${n}</dt><dd>${v ? esc(v) : `<span class="meta">—</span>`}</dd></div>`).join("")}</dl>
        <label class="f" for="arEtapa">Etapa no Funil</label>
        ${lig ? `<select id="arEtapa" data-ar="leadEtapa">${ETAPAS.map(([v, n]) => `<option value="${v}" ${lig.status === v ? "selected" : ""}>${n}</option>`).join("")}</select>`
          : `<div class="meta ar-sem-lead">${c.simulado ? "Conversa de teste: não entra no Funil." : "Entra no Funil quando o Ari passar o cliente para você."}</div>`}
        <label class="f" for="arTemp">Temperatura</label>
        <select id="arTemp" data-ar="leadTemp"><option value="">—</option>${["quente", "morno", "frio"].map((v) => `<option value="${v}" ${t === v ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select>
        <button class="btn full ar-escuro" data-ar="copiarDados" style="margin-top:12px">Copiar dados para a cotação</button>
        <button class="btn full" data-ar="enviarLink" style="margin-top:8px" ${c.estado === "encerrado" ? "disabled" : ""}>Enviar link de cotação</button>
      </div>
      ${c.resumo ? `<div class="card ar-lead-res"><h3>Resumo do Ari</h3><div>${esc(c.resumo)}</div></div>` : ""}
      <div class="card"><h3>Histórico</h3><div class="meta" style="font-size:14px">Primeiro contato em ${new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${c.simulado ? " (simulação)" : " pelo WhatsApp"}. ${linkEnviado ? "Link de cotação enviado." : "Link de cotação ainda não enviado."}</div></div>
    </div>`;
  }

  function telaConversa(c) {
    const [en, ec] = ESTADOS[c.estado] || ["", ""];
    const ms = msgsSel || [];
    const ultimaAri = [...ms].reverse().find((m) => m.autor !== "sistema");
    const hm = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    let diaAnt = "";
    const corpo = ms.map((m) => {
      const dia = new Date(m.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const sep = dia !== diaAnt ? `<div class="ar-dia">${dia === new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) ? "Hoje" : dia.slice(0, 5)}</div>` : "";
      diaAnt = dia;
      if (m.autor === "sistema") return `${sep}<div class="ar-sys">${esc(m.texto)}</div>`;
      const ev = (m.extra && m.extra.eventos || []).filter((e) => ["busca", "veiculo", "dados", "pergunta"].includes(e.tipo));
      const cls = m.autor === "cliente" ? "c" : m.autor === "jota" ? "j" : "a";
      const tg = m.autor === "cliente" ? (c.nome || "Cliente") : m.autor === "jota" ? "Você" : "Ari";
      const txt = m.extra && m.extra.link ? `<a class="ar-card-l" href="${esc(m.texto)}" target="_blank" rel="noopener"><b>Cotação de seguro Loovi</b><span>loovi.com.br · faça sua cotação</span></a>` : fmtWa(m.texto || "");
      const bts = m.extra && m.extra.botoes && m.extra.botoes.length ? `<div class="ar-bts">${m.extra.botoes.map((x) => `<button class="ar-bt" data-ar="botaoConv" data-t="${esc(x)}" ${c.simulado && m === ultimaAri && c.estado === "ativo" && !pensando[c.id] ? "" : "disabled"}>${esc(x)}</button>`).join("")}</div>` : "";
      return `${sep}${ev.length ? `<div class="ar-evs ar-dsk">${ev.map((e) => `<div class="ar-ev ar-ev-${e.tipo}">${esc(e.texto)}${e.detalhe ? `<details><summary>ver</summary><pre>${esc(e.detalhe)}</pre></details>` : ""}</div>`).join("")}</div>` : ""}
        <div class="ar-m ${cls}"><span class="ar-tg">${esc(tg)}<span class="ar-dsk"> · ${horaCurta(m.criado_em)}</span></span>${txt}${bts}<span class="ar-hr">${hm(m.criado_em)}</span></div>`;
    }).join("");
    const podeCli = c.simulado && c.estado !== "encerrado", podeJota = c.estado !== "encerrado";
    const modo = podeCli && modoEnvio === "cliente" ? "cliente" : "jota";
    const rapidas = (ajustes && Array.isArray(ajustes.respostas_rapidas) ? ajustes.respostas_rapidas : []).filter(Boolean);
    const chipsR = podeJota && rapidas.length ? `<div class="ar-rap">${rapidas.map((t) => `<button class="ar-rap-b" data-ar="rapida" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : "";
    const faixa = c.estado === "passado" ? [aguardando(c) ? "O cliente está aguardando você." : "Conversa com você.", "ativo", "Devolver ao Ari"]
      : c.estado === "ativo" ? ["O Ari está atendendo.", "passado", "Assumir"] : ["Conversa encerrada.", "ativo", "Reabrir com o Ari"];
    return `<div class="card ar-aberta">
      <div class="ar-cab"><button class="ar-voltar" data-ar="fecharConv" aria-label="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button>
        <span class="ar-av mini">${esc(iniciaisDe(c.nome || "Cliente"))}</span>
        <div style="flex:1;min-width:0"><b class="ar-cab-nome">${esc(c.nome || "Sem nome")}</b><div class="meta ar-cab-sub">${pensando[c.id] ? "Ari digitando…" : esc(aguardando(c) ? "Aguardando você" : en)} · ${esc(foneTxt(c))}</div></div>
        <button class="ar-mais ar-i-lead" data-ar="abrirLead" aria-label="Dados do lead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></button>
        <button class="ar-mais" data-ar="menuConv" aria-label="Ações da conversa"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></button></div>
      <div class="ar-faixa ar-faixa-${c.estado}"><span>${faixa[0]}</span><button class="btn sm" data-ar="estado" data-k="${faixa[1]}">${faixa[2]}</button></div>
      <div class="ar-msgs" id="arMsgs">${msgsSel ? corpo || `<div class="empty">Sem mensagens.</div>` : `<div class="empty">Carregando…</div>`}
        ${pensando[c.id] ? `<div class="ar-m a ar-dig"><span class="ar-tg">Ari</span><span class="ar-digita"><i></i><i></i><i></i></span></div>` : ""}</div>
      ${podeJota ? `<div class="ar-compor">${chipsR}
        ${podeCli ? `<div class="ar-modo"><span class="meta ar-dsk-i">Escrever como:</span><button class="${modo === "jota" ? "on" : ""}" data-ar="modoEnvio" data-k="jota">Você</button><button class="${modo === "cliente" ? "on" : ""}" data-ar="modoEnvio" data-k="cliente">Cliente (teste)</button></div>` : ""}
        <form data-ar="${modo === "cliente" ? "comoCliente" : "comoJota"}" class="ar-barra"><textarea id="${modo === "cliente" ? "arCliM" : "arJotaM"}" name="t" rows="1" maxlength="2000" placeholder="${modo === "cliente" ? "Mensagem do cliente (teste)" : c.estado === "ativo" ? "Responder como Jota (o Ari pausa)" : "Responder como Jota"}">${esc(modo === "cliente" ? rascCli : rascJota)}</textarea>
        <button class="ar-enviar" type="submit" aria-label="Enviar" ${modo === "cliente" && pensando[c.id] ? "disabled" : ""}><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></form>
        <div class="meta ar-dsk" style="margin-top:6px">${c.simulado ? "Conversa de teste: nada vai para o WhatsApp. O que o Ari responde aqui é a IA de verdade." : "Suas respostas serão enviadas pelo WhatsApp quando a conexão estiver ativa (etapa 3)."}</div>
      </div>` : `<div class="ar-compor ar-fim">Conversa encerrada.</div>`}
    </div>`;
  }

  function telaTeste() {
    if (!ajustes) carregar("ajustes");
    const mod = modeloTeste || (ajustes && ajustes.modelo) || "claude-sonnet-5-5";
    const msgs = bolhas.map((b, i) => {
      if (b.tipo === "cliente") return `<div class="ar-m c"><span class="ar-tg">Você (como cliente)</span>${fmtWa(b.texto)}</div>`;
      if (b.tipo === "erro") return `<div class="ar-sys bad">${esc(b.texto)}</div>`;
      const ev = (b.eventos || []).map((e) => `<div class="ar-ev ar-ev-${e.tipo}">${esc(e.texto)}${e.detalhe ? `<details><summary>ver</summary><pre>${esc(e.detalhe)}</pre></details>` : ""}</div>`).join("");
      return `${ev ? `<div class="ar-evs">${ev}</div>` : ""}
        ${b.texto ? `<div class="ar-m a"><span class="ar-tg">Ari · assistente</span>${fmtWa(b.texto)}
          ${b.botoes && b.botoes.length ? `<div class="ar-bts">${b.botoes.map((x) => `<button class="ar-bt" data-ar="botao" data-t="${esc(x)}" ${ocupado || i !== bolhas.length - 1 ? "disabled" : ""}>${esc(x)}</button>`).join("")}</div>` : ""}</div>` : ""}
        ${b.link ? `<div class="ar-m a ar-link"><span class="ar-tg">Ari · link (mensagem separada)</span><a href="${esc(b.link)}" target="_blank" rel="noopener">Cotação Loovi · ${esc(b.link.replace(/^https?:\/\//, "").slice(0, 32))}…</a></div>` : ""}
        <div class="ar-pe">${esc(MODELOS[b.modelo] ? MODELOS[b.modelo].split(" ")[0] : b.modelo)} · ${reais(b.uso.custo_usd)} <button class="link" data-ar="corrigir" data-i="${i}">Corrigir esta resposta</button></div>`;
    }).join("");
    return `<div class="ar-grid">
      <div class="card ar-chat">
        <div class="row" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <h2 style="margin:0">Conversa de teste</h2>
          <div class="row" style="gap:6px;align-items:center"><select data-ar="modeloTeste" aria-label="Modelo do teste" class="ar-sel">${Object.entries(MODELOS).map(([k, n]) => `<option value="${k}" ${mod === k ? "selected" : ""}>${n.split(" ")[0]}</option>`).join("")}</select>
          <button class="btn sm" data-ar="nova" ${ocupado ? "disabled" : ""}>Nova conversa</button></div>
        </div>
        ${semChave ? `<div class="notice warn" style="margin-top:10px"><b>Falta a chave da IA.</b> No Supabase, abra Edge Functions → Secrets e cadastre <code>ANTHROPIC_API_KEY</code> com a chave da sua conta na Anthropic (console.anthropic.com). Depois é só mandar a mensagem de novo.</div>` : ""}
        <div class="ar-msgs" id="arMsgs">${msgs || `<div class="empty" style="padding:24px 8px">Escreva como se fosse um cliente no WhatsApp. Ex.: “Oi, quanto fica o seguro do meu Onix 2020?” ou “O carro reserva vale para pane?”</div>`}
          ${ocupado ? `<div class="ar-m a ar-dig"><span class="ar-tg">Ari · assistente</span>digitando…</div>` : ""}</div>
        <form data-ar="enviar" class="ar-form"><textarea id="arTxt" name="t" rows="2" maxlength="2000" placeholder="Mensagem do cliente" ${ocupado ? "disabled" : ""}>${esc(rascunho)}</textarea><button class="btn pri" type="submit" ${ocupado ? "disabled" : ""}>Enviar</button></form>
        <div class="meta" style="margin-top:6px">Passar o lead, avisar o Jota e apagar dados aparecem como aviso, mas são só simulados. O custo de cada resposta é uma estimativa.</div>
      </div>
      <div class="card"><h2>Como testar</h2><div class="meta" style="font-size:14px">
        • Pergunte coisas que clientes reais perguntam: preço, carro reserva, franquia, “é golpe?”, “vou pensar”.<br>
        • Teste o caminho do link: diga o nome e o carro e peça cotação.<br>
        • Mande um carro importado ou de luxo para ver a consulta de veículos restritos.<br>
        • Se ele errar, toque em <b>Corrigir esta resposta</b>. A correção vira uma resposta aprovada e vale na hora.<br>
        • Compare o Sonnet e o Haiku com a mesma pergunta antes de escolher o modelo em Ajustes.</div></div>
    </div>`;
  }

  const esperando = (qual) => falhou[qual]
    ? `<div class="card empty">Não foi possível carregar.<br><button class="btn sm" data-ar="recarregar" data-k="${qual}" style="margin-top:8px">Tentar de novo</button></div>`
    : `<div class="card empty">Carregando…</div>`;
  function telaConhecimento() {
    if (!docs) { carregar("docs"); return esperando("docs"); }
    const total = docs.reduce((a, d) => a + d.n, 0);
    if (!veiculos) carregar("veiculos");
    const nr = veiculos ? veiculos.filter((v) => v.tipo === "restrito").length : "…", nd = veiculos ? veiculos.length - nr : "…";
    return `<h2 class="ar-tit">Conhecimento do Ari</h2><p class="meta ar-sub">Os documentos que o Ari consulta para responder. Envie materiais novos, desligue os desatualizados e teste antes de liberar.</p>
      <div class="card ar-drop"><b>Enviar documento</b><div class="meta">PDF, Word ou texto. Contratos, condições gerais, tabelas, treinamentos.</div>
        <label class="btn pri" style="cursor:pointer;margin-top:10px">Escolher arquivo<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" data-ar="docArquivoNovo" hidden></label>
        <div id="arUpAviso" class="meta" style="margin-top:8px"></div></div>
      <div class="ar-q-grid">
        <div class="card"><h3>Regras fixas</h3><div class="meta" style="margin-bottom:6px">Não mudam com documentos novos, para proteger você e a marca.</div>
          <ul class="ar-regras"><li>Se apresenta como Ari, assistente virtual do Executivo</li><li>Nunca chama a Loovi de seguradora</li><li>Não informa preço, adesão nem desconto</li><li>Na dúvida, passa para você em vez de inventar</li><li>Apaga os dados quando o cliente pede</li></ul></div>
        <div class="card"><h3>Como ele aprende</h3><ul class="ar-regras"><li>Documentos em uso nesta página</li><li>Respostas que você aprova em <button class="link" data-ar="sub" data-k="perguntas">Perguntas</button></li><li>Correções que você faz em <button class="link" data-ar="sub" data-k="teste">Testar</button></li></ul>
          <div class="meta">Tudo vale na hora: corrija, pergunte de novo e veja a diferença.</div></div>
      </div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:8px"><div><h3 style="margin:0">Veículos restritos e diferenciados</h3><div class="meta">${nr} restritos · ${nd} diferenciados</div></div><button class="btn sm" data-ar="sub" data-k="veiculos" style="flex:none">Abrir lista</button></div></div>
      <div class="card"><h2>Documentos (${docs.length} · ${total} trechos)</h2>
      <div class="meta" style="margin-bottom:8px">O Ari busca nestes documentos antes de responder dúvidas de produto. Desligue um documento para ele parar de usar sem apagar.</div>
      <div class="list">${docs.map((d, i) => `<div class="item ar-doc"><div style="flex:1;min-width:0"><b>${esc(d.nome)}</b><div class="meta">${d.n} trecho${d.n === 1 ? "" : "s"}${d.origem ? " · " + esc(d.origem) : ""}</div></div>
        <select data-ar="docTipo" data-i="${i}" aria-label="Como o Ari usa">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}" ${d.tipo === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="btn sm ${d.ativo ? "" : "pri"}" data-ar="docAtivo" data-i="${i}">${d.ativo ? "Desligar" : "Ligar"}</button>
        <button class="btn sm bad" data-ar="docExcluir" data-i="${i}">Excluir</button></div>`).join("")}</div></div>
      <details class="card ar-colar" ${colarAberto ? "open" : ""}><summary><b>Colar texto ou transcrição de vídeo</b></summary>
      <form data-ar="docNovo" novalidate style="margin-top:8px">
        <div class="grid2" style="gap:0 12px"><div><label class="f" for="arDn">Nome do documento</label><input type="text" id="arDn" name="nome" maxlength="120" placeholder="Ex.: Tabela de coberturas 2026"></div>
        <div><label class="f" for="arDt">Como o Ari usa</label><select id="arDt" name="tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></div></div>
        <label class="f" for="arDx">Texto do documento</label><textarea id="arDx" name="texto" rows="8" placeholder="Cole aqui o texto. Para PDF ou Word: abra o arquivo, selecione tudo, copie e cole."></textarea>
        <div class="row" style="margin-top:8px;align-items:center;gap:10px"><label class="btn sm" style="cursor:pointer">Abrir arquivo .txt<input type="file" accept=".txt,text/plain" data-ar="docArquivo" hidden></label><span class="meta">O texto é dividido em trechos automaticamente.</span></div>
        <div id="arDocAviso"></div>
        <button class="btn pri full" type="submit" style="margin-top:12px">Adicionar ao conhecimento</button></form></details>
      <form class="card" data-ar="busca" novalidate><h2>Testar a busca</h2><div class="meta">Veja quais trechos o Ari encontra para uma pergunta, sem gastar IA.</div>
        <div class="row" style="margin-top:8px;gap:8px"><input type="text" name="q" placeholder="Ex.: carro reserva quantos dias" style="flex:1" value="${esc(buscaTeste ? buscaTeste.q : "")}"><button class="btn" type="submit">Buscar</button></div>
        ${buscaTeste ? (buscaTeste.r.length ? `<div class="list" style="margin-top:10px">${buscaTeste.r.map((x) => `<div class="item" style="display:block"><b style="font-size:13px">${esc(x.documento)}${x.secao ? " · " + esc(x.secao) : ""}</b><div class="meta" style="margin-top:4px">${esc(x.trecho.slice(0, 420))}${x.trecho.length > 420 ? "…" : ""}</div></div>`).join("")}</div>` : `<div class="empty">Nenhum trecho encontrado. O Ari diria que vai confirmar com o Jota.</div>`) : ""}
      </form>`;
  }

  function telaPerguntas() {
    if (!respostas) carregar("respostas");
    if (!perguntas) { carregar("perguntas"); return esperando("perguntas"); }
    const pend = perguntas.map((q) => `<div class="card ar-q"><div class="meta">${esc(q.quem || "Cliente")} · ${horaCurta(q.criado_em)}${q.origem === "teste" ? ` <span class="badge b-neutro" style="flex:none">teste</span>` : ""}</div>
        <b class="ar-q-p">“${esc(q.pergunta)}”</b>
        <form data-ar="aprovarPergunta" data-id="${q.id}" novalidate><label class="f" for="arQ${q.id}">Sua resposta</label><textarea id="arQ${q.id}" name="resposta" rows="3" maxlength="2000" placeholder="Escreva como o Ari deve responder"></textarea>
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm pri" type="submit">Aprovar e ensinar o Ari</button><button class="btn sm" type="button" data-ar="ignorarPergunta" data-id="${q.id}">Ignorar</button></div></form></div>`).join("");
    const aprov = !respostas ? `<div class="card empty">Carregando…</div>` : respostas.length ? respostas.map((r) => `<div class="card ar-q">${r.fonte ? `<div class="meta">${esc(r.fonte)}</div>` : ""}
        <div class="row" style="justify-content:space-between;gap:8px"><b style="flex:1">${esc(r.pergunta)}</b>${r.ativo ? "" : `<span class="badge b-off" style="flex:none">desligada</span>`}</div>
        <div class="ar-q-r">${esc(r.resposta)}</div>
        <div class="row" style="gap:6px"><button class="btn sm" data-ar="respEditar" data-id="${r.id}">Editar</button><button class="btn sm" data-ar="respAtivo" data-id="${r.id}">${r.ativo ? "Desligar" : "Ligar"}</button><button class="btn sm bad" data-ar="respExcluir" data-id="${r.id}">Remover</button></div></div>`).join("")
      : `<div class="card empty">Nenhuma ainda.</div>`;
    return `<h2 class="ar-tit">Perguntas que o Ari não soube</h2><p class="meta ar-sub">Responda e aprove. A resposta entra na base e o Ari passa a usá-la com os próximos clientes. Respostas aprovadas valem mais que os documentos.</p>
      <div class="ar-q-grid"><div><h3 class="ar-q-h">Aguardando sua resposta</h3>${pend || `<div class="card empty">Nada pendente. Quando o Ari não souber algo, a pergunta aparece aqui.</div>`}</div>
      <div><div class="row" style="justify-content:space-between;align-items:center"><h3 class="ar-q-h">Respostas aprovadas${respostas ? ` (${respostas.length})` : ""}</h3><button class="btn sm" data-ar="respNova" style="flex:none">Nova resposta</button></div>${aprov}</div></div>`;
  }
  function formResposta(r, pergunta) {
    abrirSheet(`<form data-ar="respSalvar" data-id="${r ? r.id : ""}" novalidate><h2>${r ? "Editar resposta aprovada" : "Nova resposta aprovada"}</h2>
      <label class="f" for="arRp">Pergunta do cliente</label><textarea id="arRp" name="pergunta" rows="2" maxlength="500">${esc(r ? r.pergunta : pergunta || "")}</textarea>
      <label class="f" for="arRr">Como o Ari deve responder</label><textarea id="arRr" name="resposta" rows="6" maxlength="2000" placeholder="Escreva a resposta certa, do jeito que você responderia">${esc(r ? r.resposta : "")}</textarea>
      <div id="arRAviso"></div>
      <button class="btn pri full" type="submit" style="margin-top:12px">Salvar</button></form>`);
  }

  function telaVeiculos() {
    if (!veiculos) { carregar("veiculos"); return esperando("veiculos"); }
    const r = veiculos.filter((v) => v.tipo === "restrito").length, d = veiculos.length - r;
    const f = filtroVeic.trim().toLowerCase();
    const lista = f ? veiculos.filter((v) => v.descricao.toLowerCase().includes(f)).slice(0, 60) : [];
    return `<div class="card"><h2>Veículos</h2>
      <div class="stats"><div class="stat"><b>${r}</b><span>restritos</span></div><div class="stat"><b>${d}</b><span>diferenciados</span></div></div>
      <div class="meta" style="margin-top:8px">Restrito: o Ari não diz que é recusado, só avisa que você vai verificar a aceitação. Diferenciado: ele só comenta se o cliente perguntar de franquia.</div>
      <label class="f" for="arVb">Procurar</label><input type="text" id="arVb" data-ar="veicBusca" placeholder="Ex.: Jeep, Audi A6, Hilux" value="${esc(filtroVeic)}">
      ${f ? (lista.length ? `<div class="list" style="margin-top:8px">${lista.map((v) => `<div class="item"><span class="badge ${v.tipo === "restrito" ? "b-bad" : "b-neutro"}" style="flex:none">${v.tipo}</span><div style="flex:1;font-size:14px">${esc(v.descricao)}</div><button class="btn sm bad" data-ar="veicExcluir" data-id="${v.id}">Remover</button></div>`).join("")}</div>` : `<div class="empty">Nada encontrado com “${esc(filtroVeic)}”.</div>`) : ""}
    </div>
    <form class="card" data-ar="veicNovo" novalidate><h2>Adicionar veículo</h2>
      <div class="grid2" style="gap:0 12px"><div><label class="f" for="arVt">Lista</label><select id="arVt" name="tipo"><option value="restrito">Restrito</option><option value="diferenciado">Diferenciado</option></select></div>
      <div><label class="f" for="arVd">Marca e modelo (como na lista da Loovi)</label><input type="text" id="arVd" name="descricao" maxlength="200" placeholder="Ex.: BMW M3 3.0 ou Jeep Todos os modelos"></div></div>
      <button class="btn pri full" type="submit" style="margin-top:12px">Adicionar</button></form>`;
  }

  function telaAjustes() {
    if (!ajustes) { carregar("ajustes"); return esperando("ajustes"); }
    const aj = ajustes, rap = (Array.isArray(aj.respostas_rapidas) ? aj.respostas_rapidas : []).join("\n");
    return `<h2 class="ar-tit">Ajustes do Ari</h2><p class="meta ar-sub">O que o Ari usa para atender. As mudanças valem para as próximas mensagens.</p>
      <div class="card"><h3>Ari no WhatsApp</h3>
        <div class="row" style="align-items:center;gap:12px"><span class="badge b-off" style="flex:none">desligado</span><div class="meta" style="flex:1">Só dá para ligar depois de conectar o número do WhatsApp à Meta (etapa 3) e com a aprovação da Loovi.</div></div></div>
      <form class="card" data-ar="ajustesSalvar" novalidate>
        <div class="grid2" style="gap:0 12px"><div><label class="f" for="arHi">Atende a partir de</label><input id="arHi" name="ini" type="number" min="0" max="23" inputmode="numeric" value="${aj.hora_ini}"></div>
        <div><label class="f" for="arHf">Até</label><input id="arHf" name="fim" type="number" min="1" max="24" inputmode="numeric" value="${aj.hora_fim}"></div></div>
        <label class="f" for="arLk">Link de cotação (Escritório Virtual)</label><input type="url" id="arLk" name="link" maxlength="500" placeholder="https://loovi.com.br/..." value="${esc(aj.loovi_link || "")}">
        <div class="meta" style="margin-top:4px">É o mesmo link do seu cartão na pesquisa. O valor da ativação é lido do próprio link.</div>
        <label class="f" for="arFora">Mensagem fora do horário</label><textarea id="arFora" name="fora" rows="2" maxlength="400">${esc(aj.msg_fora || "")}</textarea>
        <label class="chk" style="margin-top:8px"><input type="checkbox" name="avisarFora" ${aj.avisar_fora ? "checked" : ""}> <span>Avisar o cliente quando a conversa já está com você e você está fora do horário</span></label>
        <h3 style="margin-top:18px">Ritmo das respostas</h3>
        <label class="f" for="arEsp">Esperar o cliente terminar de escrever: <b id="arEspV">${aj.espera_s} s</b></label>
        <input type="range" id="arEsp" name="espera" min="0" max="15" step="1" value="${aj.espera_s}" data-ar="ritmo" data-alvo="arEspV">
        <div class="meta">O Ari espera esse tempo sem mensagem nova antes de responder, e junta as mensagens picadas numa resposta só. Recomendado: 5 a 8 s.</div>
        <label class="f" for="arDig">Tempo mínimo de “digitando…”: <b id="arDigV">${aj.digitando_s} s</b></label>
        <input type="range" id="arDig" name="digitando" min="0" max="8" step="1" value="${aj.digitando_s}" data-ar="ritmo" data-alvo="arDigV">
        <div class="meta">Mesmo quando a resposta fica pronta antes, o cliente vê “digitando…” por pelo menos esse tempo. Recomendado: 2 a 3 s. Use “Simular cliente novo” para sentir o ritmo.</div>
        <h3 style="margin-top:18px">Respostas rápidas</h3>
        <label class="f" for="arRap">Uma por linha. Aparecem acima do campo de mensagem, para você mandar com um toque.</label>
        <textarea id="arRap" name="rapidas" rows="4" maxlength="1500">${esc(rap)}</textarea>
        <h3 style="margin-top:18px">Inteligência</h3>
        <label class="f" for="arMod">Modelo da IA</label><select id="arMod" name="modelo">${Object.entries(MODELOS).map(([k, n]) => `<option value="${k}" ${aj.modelo === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <div class="meta" style="margin-top:4px">Sonnet entende melhor as dúvidas difíceis de contrato. Haiku custa cerca de 20 vezes menos. Compare os dois em Testar.</div>
        <details style="margin-top:12px"><summary class="link" style="cursor:pointer">Instruções do Ari (avançado)</summary>
          <textarea id="arIns" name="instrucoes" rows="18" class="ar-ins" style="margin-top:8px">${esc(aj.instrucoes || "")}</textarea>
          <div class="meta" style="margin-top:4px">São as regras que ele segue em toda conversa. Mude com cuidado e teste depois.</div></details>
        <div id="arAjAviso"></div>
        <button class="btn pri full" type="submit" style="margin-top:14px">Salvar ajustes</button></form>
      <div class="card"><h3>Notificações no celular</h3><div class="meta">Lead pronto para você, lead quente, cliente respondeu, janela de 24h fechando e pergunta que o Ari não soube, com “não perturbe das 22h às 7h”. Ficam junto com as outras notificações do app e começam a chegar quando o WhatsApp for conectado.</div>
        <button class="btn" data-ar="abrirNotif" style="margin-top:10px">Configurar notificações</button></div>
      <div class="card"><h3>Gasto da IA neste mês</h3>
        <div class="stats"><div class="stat"><b>US$ ${(gasto.teste + gasto.whatsapp).toFixed(2)}</b><span>total (≈ ${reais(gasto.teste + gasto.whatsapp)})</span></div><div class="stat"><b>US$ ${gasto.teste.toFixed(2)}</b><span>testes</span></div><div class="stat"><b>${gasto.n}</b><span>respostas</span></div></div>
        <div class="meta" style="margin-top:6px">Estimativa pelo preço de tabela. A cobrança real fica no painel da Anthropic, em dólar.</div></div>`;
  }


  /* ---------- ações ---------- */
  async function enviarMensagem(texto) {
    texto = String(texto || "").trim();
    if (!texto || ocupado) return;
    if (conversa.length && conversa[conversa.length - 1].role === "user") conversa[conversa.length - 1].content += "\n" + texto;
    else conversa.push({ role: "user", content: texto });
    bolhas.push({ tipo: "cliente", texto });
    rascunho = ""; ocupado = true; semChave = false; render(); rolar();
    try {
      const { data, error } = await sb.functions.invoke("ari-responder", { body: { mensagens: conversa, modelo: modeloTeste || undefined } });
      let r = data;
      if (error) { try { r = await error.context.json(); } catch (_) { r = { erro: error.message }; } }
      if (!r || r.erro) {
        if (r && r.semChave) semChave = true;
        bolhas.push({ tipo: "erro", texto: (r && r.erro) || "Não foi possível responder." });
        conversa.pop(); // permite reenviar a mesma mensagem
      } else {
        conversa.push({ role: "assistant", content: r.bruto || r.texto || "" });
        bolhas.push({ tipo: "ari", texto: r.texto, botoes: r.botoes, link: r.link, eventos: r.eventos, modelo: r.modelo, uso: r.uso, pergunta: texto });
        if (gasto) gasto.teste += r.uso.custo_usd || 0;
      }
    } catch (e) {
      bolhas.push({ tipo: "erro", texto: "Falha de conexão. Tente de novo." }); conversa.pop();
    }
    ocupado = false; render(); rolar();
    const t = $("#arTxt"); if (t && window.matchMedia("(min-width: 760px)").matches) t.focus();
  }
  function rolar() { const m = $("#arMsgs"); if (m) m.scrollTop = m.scrollHeight; }

  function dividir(texto) {
    const paras = texto.replace(/\r/g, "").split(/\n\s*\n|\n(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][^\n]{0,80}\n)/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    const out = []; let cur = "";
    for (const p of paras) {
      if (cur && cur.length + p.length > 1300) { out.push(cur); cur = ""; }
      if (p.length > 1600) { for (let i = 0; i < p.length; i += 1300) out.push(p.slice(i, i + 1400)); continue; }
      cur = cur ? cur + " " + p : p;
    }
    if (cur) out.push(cur);
    return out;
  }

  async function respostaAri(cid) {
    pensando[cid] = true; render(); rolar();
    const ini = Date.now(), minimo = ((ajustes && ajustes.digitando_s) ?? 3) * 1000;
    try {
      const { data, error } = await sb.functions.invoke("ari-responder", { body: { contato_id: cid } });
      let r = data; if (error) { try { r = await error.context.json(); } catch (_) { r = { erro: error.message }; } }
      if (r && r.erro) toast(r.erro);
      if (r && r.uso && gasto) gasto.teste += r.uso.custo_usd || 0;
    } catch (_) { toast("Falha de conexão com o Ari."); }
    const falta = minimo - (Date.now() - ini); if (falta > 0) await new Promise((r) => setTimeout(r, falta));
    pensando[cid] = false; msgsSel = null; cotSel = null; await recarregarConversas(); rolar();
  }
  async function recarregarConversas() { await carregar("contatos"); if (selId) { await carregar("msgs"); if (!cotSel) await carregar("cotSel"); } }
  async function mensagemCliente(texto) {
    const c = contatos.find((x) => x.id === selId); texto = String(texto || "").trim(); if (!c || !texto || pensando[c.id]) return;
    const agora = new Date().toISOString();
    const { error } = await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "in", autor: "cliente", tipo: "texto", texto, status: "recebida", criado_em: agora });
    if (error) return toast("Não foi possível enviar: " + error.message);
    await sb.from("ari_contatos").update({ ultima_msg_em: agora, lida_em: agora }).eq("id", c.id);
    rascCli = ""; msgsSel = null;
    await recarregarConversas(); rolar();
    if (c.estado === "ativo") {
      clearTimeout(timersCli[c.id]);
      timersCli[c.id] = setTimeout(() => { delete timersCli[c.id]; respostaAri(c.id); }, ((ajustes && ajustes.espera_s) ?? 6) * 1000);
    }
  }
  async function mudarEstado(c, estado) {
    const { error } = await sb.from("ari_contatos").update({ estado, atualizado_em: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast("Não foi possível salvar: " + error.message);
    const txt = estado === "passado" ? "Você assumiu a conversa. O Ari parou de responder este cliente." : estado === "ativo" ? "Conversa devolvida para o Ari." : "Conversa encerrada.";
    await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "int", autor: "sistema", tipo: "outro", texto: txt, status: "interna" });
    c.estado = estado; msgsSel = null; toast(txt); await recarregarConversas(); rolar();
  }

  async function clique(t, d) {
    const a = d.ar;
    if (a === "filtroTemp") { filtroTemp = filtroTemp === d.k ? "" : d.k; render(); return; }
    if (a === "abrirLead") { painelLead = true; render(); return; }
    if (a === "fecharLead") { painelLead = false; render(); rolar(); return; }
    if (a === "rapida") { enviarComoJota(d.t); return; }
    if (a === "enviarLink") {
      const link = (ajustes && ajustes.loovi_link) || (config && config().looviLink);
      if (!link) return toast("Cadastre o link de cotação em Ajustes.");
      painelLead = false; await enviarComoJota(link, { link: true }); toast("Link de cotação enviado"); return;
    }
    if (a === "copiarDados") {
      const c = contatos.find((x) => x.id === selId); if (!c) return;
      const k = cotSel || {}; let cpf = "";
      if (k.cpf_final) { const { data, error } = await sb.rpc("ari_ver_cpf", { p_contato: c.id }); if (error) return toast("Não foi possível ler o CPF: " + error.message); cpf = String(data || "").replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); }
      const linhas = [["Nome", k.nome_completo || c.nome], ["CPF", cpf], ["E-mail", k.email], ["Telefone", c.simulado ? "" : foneTxt(c)], ["Placa", k.placa], ["Veículo", k.veiculo], ["Uso", k.uso], ["Seguro atual", k.seguro_atual],
        ["Endereço", k.endereco || [k.logradouro, k.numero, k.complemento, k.bairro].filter(Boolean).join(", ")], ["CEP", k.cep], ["Cidade", [k.cidade, k.uf].filter(Boolean).join("/")]].filter(([, v]) => v);
      if (linhas.length < 2) return toast("Ainda não há dados suficientes. O Ari anota conforme o cliente informa.");
      const txt = linhas.map(([n, v]) => `${n}: ${v}`).join("\n");
      try { await navigator.clipboard.writeText(txt); toast("Dados copiados: cole no Escritório Virtual"); }
      catch (_) { abrirSheet(`<h2>Dados para a cotação</h2><textarea rows="10" style="width:100%" readonly>${esc(txt)}</textarea>`); }
      return;
    }
    if (a === "abrirConv") {
      selId = d.id; msgsSel = null; cotSel = null; painelLead = false; rascCli = ""; rascJota = "";
      const c = contatos.find((x) => x.id === selId), agora = new Date().toISOString();
      if (c) { c.lida_em = agora; if (previas[c.id]) previas[c.id].naoLidas = 0; sb.from("ari_contatos").update({ lida_em: agora }).eq("id", c.id).then(() => {}); }
      await carregar("msgs"); rolar(); return;
    }
    if (a === "fecharConv") { selId = null; msgsSel = null; cotSel = null; painelLead = false; document.body.classList.remove("ar-chat-aberto"); render(); return; }
    if (a === "modoEnvio") { modoEnvio = d.k; render(); rolar(); const el = $(modoEnvio === "cliente" ? "#arCliM" : "#arJotaM"); if (el) el.focus(); return; }
    if (a === "menuConv") { const c = contatos.find((x) => x.id === selId); if (c) abrirSheet(`<h2 style="margin-bottom:10px">${esc(c.nome || "Conversa")}</h2>${c.resumo ? `<div class="notice gold" style="margin-bottom:10px"><b>Resumo do Ari:</b> ${esc(c.resumo)}</div>` : ""}<div class="ar-menu-acoes">${acoesConv(c)}</div>`); return; }
    if (a === "filtroConv") { filtroConv = d.k; render(); return; }
    if (a === "simular") {
      abrirSheet(`<form data-ar="simularOk" novalidate><h2>Simular cliente novo</h2>
        <div class="meta" style="margin:4px 0 8px">Cria uma conversa de teste, como se um cliente tivesse chamado no WhatsApp. O Ari responde com a IA de verdade, mas nada vai para o WhatsApp e nenhum lead entra no Funil.</div>
        <label class="f" for="arSn">Nome no WhatsApp (opcional)</label><input type="text" id="arSn" name="nome" maxlength="60" placeholder="Ex.: Carla">
        <label class="f" for="arSm">Primeira mensagem do cliente</label><textarea id="arSm" name="msg" rows="3" maxlength="2000">Oi, vi o anúncio. Quanto fica o seguro do meu carro?</textarea>
        <button class="btn pri full" type="submit" style="margin-top:12px">Criar e enviar</button></form>`);
      return;
    }
    if (a === "botaoConv") { mensagemCliente(d.t); return; }
    if (a === "estado") { const c = contatos.find((x) => x.id === selId); if ($("#sheet").innerHTML) $("#sheet").innerHTML = ""; if (c) mudarEstado(c, d.k); return; }
    if (a === "excluirConv") {
      abrirSheet(`<h2>Excluir conversa de teste?</h2><div class="meta" style="margin:6px 0 12px">A conversa e as mensagens simuladas são apagadas.</div><button class="btn bad full" data-ar="excluirConvOk">Excluir</button>`); return;
    }
    if (a === "excluirConvOk") {
      const c = contatos.find((x) => x.id === selId);
      if (!c || !c.simulado) { fecharSheet(); return; }
      const { error } = await sb.from("ari_contatos").delete().eq("id", c.id).eq("simulado", true);
      if (error) return toast("Não foi possível excluir: " + error.message);
      contatos = contatos.filter((x) => x.id !== c.id); selId = null; msgsSel = null; fecharSheet(); toast("Conversa de teste excluída"); return;
    }
    if (a === "abrirNotif") { if (abrirNotificacoes) abrirNotificacoes(); return; }
    if (a === "recarregar") { falhou[d.k] = false; render(); return; }
    if (a === "sub") { sub = d.k; render(); if (sub === "teste") rolar(); return; }
    if (a === "nova") { conversa = []; bolhas = []; rascunho = ""; render(); return; }
    if (a === "botao") { enviarMensagem(d.t); return; }
    if (a === "corrigir") { const b = bolhas[+d.i]; formResposta(null, b && b.pergunta); return; }
    if (a === "docAtivo" || a === "docExcluir") {
      const doc = docs[+d.i]; if (!doc) return;
      if (a === "docExcluir") {
        abrirSheet(`<h2>Excluir documento?</h2><div class="meta" style="margin:6px 0 12px">“${esc(doc.nome)}” e os ${doc.n} trechos saem do conhecimento do Ari. Não dá para desfazer; para parar de usar sem apagar, use “Desligar”.</div>
          <button class="btn bad full" data-ar="docExcluirOk" data-i="${d.i}">Excluir</button>`);
        return;
      }
      const { error } = await sb.from("ari_conhecimento").update({ ativo: !doc.ativo }).eq("documento", doc.nome);
      if (error) return toast("Não foi possível salvar: " + error.message);
      doc.ativo = !doc.ativo; toast(doc.ativo ? "Documento ligado" : "Documento desligado"); render(); return;
    }
    if (a === "docExcluirOk") {
      const doc = docs[+d.i]; const { error } = await sb.from("ari_conhecimento").delete().eq("documento", doc.nome);
      if (error) return toast("Não foi possível excluir: " + error.message);
      docs.splice(+d.i, 1); fecharSheet(); toast("Documento excluído"); return;
    }
    if (a === "respNova") { formResposta(null, ""); return; }
    if (a === "ignorarPergunta") {
      const { error } = await sb.from("ari_perguntas").update({ status: "ignorada", resolvida_em: new Date().toISOString() }).eq("id", d.id);
      if (error) return toast("Não foi possível salvar: " + error.message);
      perguntas = perguntas.filter((q) => q.id !== d.id); toast("Pergunta ignorada"); render(); return;
    }
    if (a === "respEditar") { formResposta(respostas.find((r) => r.id === d.id)); return; }
    if (a === "respAtivo") {
      const r = respostas.find((x) => x.id === d.id);
      const { error } = await sb.from("ari_respostas").update({ ativo: !r.ativo, atualizado_em: new Date().toISOString() }).eq("id", r.id);
      if (error) return toast("Não foi possível salvar: " + error.message);
      r.ativo = !r.ativo; render(); return;
    }
    if (a === "respExcluir") {
      const { error } = await sb.from("ari_respostas").delete().eq("id", d.id);
      if (error) return toast("Não foi possível excluir: " + error.message);
      respostas = respostas.filter((x) => x.id !== d.id); toast("Resposta excluída"); render(); return;
    }
    if (a === "veicExcluir") {
      const { error } = await sb.from("ari_veiculos").delete().eq("id", +d.id);
      if (error) return toast("Não foi possível remover: " + error.message);
      veiculos = veiculos.filter((v) => v.id !== +d.id); toast("Veículo removido"); render(); return;
    }
  }

  async function enviar(f) {
    const a = f.dataset.ar;
    if (a === "simularOk") {
      const nome = f.nome.value.trim(), msg = f.msg.value.trim();
      if (!msg) return toast("Escreva a primeira mensagem do cliente.");
      const agora = new Date().toISOString();
      const fake = "00" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"); // DDD 00 não existe: nunca colide com cliente real
      const { data: c, error } = await sb.from("ari_contatos").insert({ wa_id: "sim-" + crypto.randomUUID(), whats: fake, nome: nome || null, simulado: true, estado: "ativo", consentimento_em: agora, ultima_msg_em: agora, lida_em: agora }).select().single();
      if (error) return toast("Não foi possível criar: " + error.message);
      await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "in", autor: "cliente", tipo: "texto", texto: msg, status: "recebida", criado_em: agora });
      fecharSheet(); selId = c.id; msgsSel = null; filtroConv = "abertas";
      await recarregarConversas(); respostaAri(c.id); return;
    }
    if (a === "comoCliente") { mensagemCliente(f.t.value); return; }
    if (a === "aprovarPergunta") {
      const q = perguntas.find((x) => x.id === f.dataset.id), resposta = f.resposta.value.trim();
      if (!q) return; if (resposta.length < 2) return toast("Escreva a resposta antes de aprovar.");
      const { data: r, error } = await sb.from("ari_respostas").insert({ pergunta: q.pergunta, resposta, fonte: "Respondida por você" }).select().single();
      if (error) return toast("Não foi possível salvar: " + error.message);
      await sb.from("ari_perguntas").update({ status: "respondida", resposta_id: r.id, resolvida_em: new Date().toISOString() }).eq("id", q.id);
      perguntas = perguntas.filter((x) => x.id !== q.id); if (respostas) respostas.unshift(r);
      toast("Aprovada: o Ari já usa essa resposta"); render(); return;
    }
    if (a === "comoJota") { enviarComoJota(f.t.value); return; }
    return enviarResto(f, a);
  }
  async function enviarComoJota(texto, extra) {
    {
      const c = contatos.find((x) => x.id === selId); texto = String(texto || "").trim(); if (!c || !texto) return;
      const agora = new Date().toISOString();
      if (timersCli[c.id]) { clearTimeout(timersCli[c.id]); delete timersCli[c.id]; }
      const { error } = await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "out", autor: "jota", tipo: "texto", texto, status: c.simulado ? "simulada" : "enviada", criado_em: agora, extra: extra || null });
      if (error) return toast("Não foi possível enviar: " + error.message);
      const muda = { ultima_msg_em: agora, lida_em: agora, atualizado_em: agora }; if (c.estado === "ativo") muda.estado = "passado";
      await sb.from("ari_contatos").update(muda).eq("id", c.id);
      if (c.estado === "ativo") await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "int", autor: "sistema", tipo: "outro", texto: "Você respondeu: o Ari parou de responder este cliente.", status: "interna", criado_em: new Date(Date.now() + 5).toISOString() });
      if (!extra) rascJota = ""; msgsSel = null; await recarregarConversas(); rolar();
    }
  }
  async function enviarResto(f, a) {
    if (a === "enviar") { enviarMensagem(f.t.value); return; }
    if (a === "busca") {
      const q = f.q.value.trim(); if (!q) return;
      const { data, error } = await sb.rpc("ari_buscar", { q, n: 5 });
      if (error) return toast("Não foi possível buscar: " + error.message);
      buscaTeste = { q, r: data || [] }; render(); return;
    }
    if (a === "docNovo") {
      const nome = f.nome.value.trim(), texto = f.texto.value.trim(), tipo = f.tipo.value;
      const aviso = (m) => { $("#arDocAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
      if (nome.length < 3) return aviso("Dê um nome ao documento.");
      if (docs && docs.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) return aviso("Já existe um documento com esse nome.");
      if (texto.length < 50) return aviso("Cole o texto do documento (pelo menos algumas linhas).");
      const partes = dividir(texto);
      const b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Adicionando…";
      const linhas = partes.map((t, i) => ({ documento: nome, ordem: i, trecho: t, tipo, ativo: true, origem: "Adicionado pelo app" }));
      for (let i = 0; i < linhas.length; i += 200) {
        const { error } = await sb.from("ari_conhecimento").insert(linhas.slice(i, i + 200));
        if (error) { b.disabled = false; b.textContent = "Adicionar ao conhecimento"; return aviso("Não foi possível salvar: " + error.message); }
      }
      docs = null; toast(`Documento adicionado em ${partes.length} trecho${partes.length === 1 ? "" : "s"}`); render(); return;
    }
    if (a === "respSalvar") {
      const pergunta = f.pergunta.value.trim(), resposta = f.resposta.value.trim();
      const aviso = (m) => { $("#arRAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
      if (pergunta.length < 3) return aviso("Escreva a pergunta do cliente.");
      if (resposta.length < 2) return aviso("Escreva como o Ari deve responder.");
      const id = f.dataset.id;
      const { data, error } = id
        ? await sb.from("ari_respostas").update({ pergunta, resposta, atualizado_em: new Date().toISOString() }).eq("id", id).select().single()
        : await sb.from("ari_respostas").insert({ pergunta, resposta, fonte: "Correção no teste" }).select().single();
      if (error) return aviso("Não foi possível salvar: " + error.message);
      if (respostas) { if (id) respostas = respostas.map((x) => x.id === id ? data : x); else respostas.unshift(data); }
      fecharSheet(); toast(id ? "Resposta atualizada" : "Resposta aprovada salva: o Ari já usa na próxima mensagem"); return;
    }
    if (a === "veicNovo") {
      const descricao = f.descricao.value.trim(), tipo = f.tipo.value;
      if (descricao.length < 2) return toast("Escreva a marca e o modelo.");
      const { data, error } = await sb.from("ari_veiculos").insert({ tipo, descricao }).select("id, tipo, descricao").single();
      if (error) return toast(/duplicate|unique/i.test(error.message) ? "Esse veículo já está na lista." : "Não foi possível salvar: " + error.message);
      veiculos.push(data); filtroVeic = descricao; toast("Veículo adicionado"); render(); return;
    }
    if (a === "ajustesSalvar") {
      const ini = +f.ini.value, fim = +f.fim.value, instrucoes = f.instrucoes.value.trim(), link = f.link.value.trim();
      const aviso = (m) => { $("#arAjAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
      if (!(ini >= 0 && ini <= 23 && fim >= 1 && fim <= 24 && fim > ini)) return aviso("Confira o horário: o fim precisa ser depois do início.");
      if (instrucoes.length < 200) return aviso("As instruções parecem incompletas. O Ari precisa delas para responder.");
      if (link && !/^https:\/\/\S+$/.test(link)) return aviso("O link de cotação precisa começar com https://");
      const rapidas = f.rapidas.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 120));
      const campos = { modelo: f.modelo.value, hora_ini: ini, hora_fim: fim, instrucoes, msg_fora: f.fora.value.trim().slice(0, 400) || ajustes.msg_fora, avisar_fora: f.avisarFora.checked,
        espera_s: +f.espera.value, digitando_s: +f.digitando.value, respostas_rapidas: rapidas, atualizado_em: new Date().toISOString() };
      const { error } = await sb.from("ari_ajustes").update(campos).eq("id", 1);
      if (error) return aviso("Não foi possível salvar: " + error.message);
      if (link !== (ajustes.loovi_link || "")) {
        const atv = link ? (ativacaoDoLink ? ativacaoDoLink(link) : null) : null;
        const { error: e2 } = await sb.from("config").update({ loovi_link: link || null, loovi_ativacao: link && atv != null ? atv : null }).eq("id", 1);
        if (e2) return aviso("Ajustes salvos, mas o link não: " + e2.message);
        const cg = config && config(); if (cg) { cg.looviLink = link; cg.looviAtivacao = link && atv != null ? atv : null; }
        ajustes.loovi_link = link || null;
      }
      Object.assign(ajustes, campos); modeloTeste = null;
      toast("Ajustes salvos"); render(); return;
    }
  }

  async function mudar(t) {
    const a = t.dataset.ar;
    if (a === "leadEtapa" || a === "leadTemp") {
      const c = contatos.find((x) => x.id === selId); if (!c) return;
      const lig = c.crm_id && crmLig[c.crm_id];
      if (a === "leadEtapa" && lig) {
        const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
        const { error } = await sb.from("crm").update({ status: t.value, fechado_em: t.value === "fechado" ? hoje : null, atualizado_em: new Date().toISOString() }).eq("id", lig.id);
        if (error) { toast("Não foi possível mudar a etapa: " + error.message); t.value = lig.status; return; }
        lig.status = t.value; toast("Etapa atualizada no Funil"); return;
      }
      if (a === "leadTemp") {
        const v = t.value || null;
        const { error } = lig ? await sb.from("crm").update({ classe: v || lig.classe, atualizado_em: new Date().toISOString() }).eq("id", lig.id)
          : await sb.from("ari_contatos").update({ temperatura: v }).eq("id", c.id);
        if (error) { toast("Não foi possível salvar: " + error.message); return; }
        if (lig) { if (v) lig.classe = v; } else c.temperatura = v;
        toast(lig ? "Temperatura atualizada no Funil" : "Temperatura salva"); render(); return;
      }
    }
    if (a === "filtroConv") { filtroConv = t.value; render(); return; }
    if (a === "modeloTeste") { modeloTeste = t.value; return; }
    if (a === "docTipo") {
      const doc = docs[+t.dataset.i];
      const { error } = await sb.from("ari_conhecimento").update({ tipo: t.value }).eq("documento", doc.nome);
      if (error) { toast("Não foi possível salvar: " + error.message); t.value = doc.tipo; return; }
      doc.tipo = t.value; toast("Salvo"); return;
    }
    if (a === "docArquivoNovo") {
      const arq = t.files && t.files[0]; t.value = ""; if (!arq || enviandoArq) return;
      const aviso = (m) => { const el = $("#arUpAviso"); if (el) el.innerHTML = m; };
      if (arq.size > 15e6) return aviso(`<span class="flag">Arquivo grande demais (máximo 15 MB).</span>`);
      const nome = arq.name.replace(/\.(pdf|docx|txt)$/i, "").trim().slice(0, 120) || "Documento";
      if (docs && docs.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) return aviso(`<span class="flag">Já existe um documento chamado “${esc(nome)}”. Renomeie o arquivo ou exclua o antigo.</span>`);
      enviandoArq = true; aviso("Lendo o arquivo…");
      try {
        let texto = "", info = "";
        if (/\.pdf$/i.test(arq.name) || arq.type === "application/pdf") {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const pdf = await getDocumentProxy(new Uint8Array(await arq.arrayBuffer()));
          const r = await extractText(pdf, { mergePages: false });
          texto = (r.text || []).join("\n\n"); info = `${r.totalPages} página${r.totalPages === 1 ? "" : "s"}`;
        } else if (/\.docx$/i.test(arq.name)) {
          const mammoth = (await import("mammoth/mammoth.browser.js")).default;
          const r = await mammoth.extractRawText({ arrayBuffer: await arq.arrayBuffer() });
          texto = r.value || "";
        } else if (/\.txt$/i.test(arq.name) || arq.type.startsWith("text/")) {
          texto = await arq.text();
        } else throw new Error("Formato não aceito. Envie PDF, Word (.docx) ou texto (.txt).");
        texto = texto.replace(/[ \t]+\n/g, "\n").trim();
        if (texto.length < 50) throw new Error("Não encontrei texto no arquivo. Se for um PDF escaneado (imagem), cole o texto em “Colar texto”.");
        const partes = dividir(texto);
        aviso(`Adicionando ${partes.length} trechos…`);
        const linhas = partes.map((x, i) => ({ documento: nome, ordem: i, trecho: x, tipo: "cliente", ativo: true, origem: `Arquivo enviado${info ? " · " + info : ""} · ${new Date().toLocaleDateString("pt-BR")}` }));
        for (let i = 0; i < linhas.length; i += 200) { const { error } = await sb.from("ari_conhecimento").insert(linhas.slice(i, i + 200)); if (error) throw error; }
        enviandoArq = false; docs = null; toast(`“${nome}” adicionado em ${partes.length} trechos. O Ari já pode consultar.`); render();
      } catch (e) { enviandoArq = false; aviso(`<span class="flag">${esc(e.message || "Não foi possível ler o arquivo.")}</span>`); }
      return;
    }
    if (a === "docArquivo") {
      const arq = t.files && t.files[0]; if (!arq) return;
      if (arq.size > 2e6) return toast("Arquivo grande demais (máx. 2 MB de texto).");
      const txt = await arq.text(); const area = $("#arDx"), nome = $("#arDn");
      if (area) area.value = txt; if (nome && !nome.value) nome.value = arq.name.replace(/\.txt$/i, "");
      return;
    }
  }

  // rascunho e filtro sobrevivem às atualizações de tela; Enter envia no computador
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "arTxt") rascunho = ev.target.value;
    if (ev.target.id === "arCli" || ev.target.id === "arCliM") rascCli = ev.target.value;
    if (ev.target.dataset && ev.target.dataset.ar === "ritmo") { const el = document.getElementById(ev.target.dataset.alvo); if (el) el.textContent = ev.target.value + " s"; }
    if (ev.target.dataset && ev.target.dataset.ar === "buscaConv") {
      buscaConv = ev.target.value; const pos = ev.target.selectionStart;
      clearTimeout(mudar._b); mudar._b = setTimeout(() => { render(); const el = document.querySelector(".ar-busca"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 200);
    }
    if (ev.target.id === "arJota" || ev.target.id === "arJotaM") rascJota = ev.target.value;
    if (ev.target.dataset && ev.target.dataset.ar === "veicBusca") {
      filtroVeic = ev.target.value; const pos = ev.target.selectionStart;
      clearTimeout(mudar._t); mudar._t = setTimeout(() => { render(); const el = $("#arVb"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 250);
    }
  });
  document.addEventListener("input", (ev) => {
    const t = ev.target; if (t.closest && t.closest(".ar-barra") && t.tagName === "TEXTAREA") { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.id === "arCli" && ev.key === "Enter" && !ev.shiftKey && window.matchMedia("(hover: hover)").matches) { ev.preventDefault(); mensagemCliente(ev.target.value); return; }
    if (ev.target.id === "arTxt" && ev.key === "Enter" && !ev.shiftKey && window.matchMedia("(hover: hover)").matches) { ev.preventDefault(); enviarMensagem(ev.target.value); }
  });

  let rtTimer = null;
  try {
    sb.channel("ari-conversas")
      .on("postgres_changes", { event: "*", schema: "public", table: "ari_mensagens" }, () => agendar())
      .on("postgres_changes", { event: "*", schema: "public", table: "ari_contatos" }, () => agendar())
      .on("postgres_changes", { event: "*", schema: "public", table: "ari_perguntas" }, () => { clearTimeout(agendar._p); agendar._p = setTimeout(async () => { perguntas = null; await carregar("perguntas"); }, 500); })
      .subscribe();
  } catch (_) {}
  function agendar() {
    if (sub !== "conversas" || Object.values(pensando).some(Boolean)) return;
    clearTimeout(rtTimer); rtTimer = setTimeout(async () => { if (contatos) { msgsSel = null; await recarregarConversas(); rolar(); } }, 400);
  }

  return { tela, clique, enviar, mudar, rolar };
}
