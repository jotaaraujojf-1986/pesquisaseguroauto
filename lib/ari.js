// Ari (assistente de WhatsApp): telas do administrador.
// Carregado só quando o administrador abre o menu "WhatsApp (Ari)".
// Etapa 2: teste com a IA de verdade, conhecimento, respostas aprovadas, veículos e ajustes.
// Nada aqui envia mensagem para o WhatsApp.

const MODELOS = { "claude-sonnet-5-5": "Sonnet (mais caprichado)", "claude-haiku-5-5": "Haiku (mais barato)" };
const TIPOS = { cliente: "Usado para responder", estilo: "Jeito de falar e vender", interno: "Interno (o Ari não usa)" };
const DOLAR = 5.5; // só para mostrar uma ideia em reais

export function criarAri(ctx) {
  const { sb, esc, toast, render, abrirSheet, fecharSheet, $ } = ctx;
  let sub = "conversas";
  // conversas gravadas
  let contatos = null, previas = {}, selId = null, msgsSel = null, pensando = {}, rascCli = "", rascJota = "", filtroConv = "abertas";
  // teste
  let conversa = [];      // [{role, content}] enviado para a IA
  let bolhas = [];        // o que aparece na tela
  let ocupado = false, rascunho = "", modeloTeste = null, semChave = false;
  // dados carregados sob demanda
  let docs = null, respostas = null, veiculos = null, ajustes = null, gasto = null, buscaTeste = null, filtroVeic = "";
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
        const { data, error } = await sb.from("ari_contatos").select("id, wa_id, whats, nome, estado, resumo, simulado, lida_em, ultima_msg_em, criado_em, crm_id").order("ultima_msg_em", { ascending: false, nullsFirst: false }).limit(300);
        if (error) throw error; contatos = data;
        const { data: ms } = await sb.from("ari_mensagens").select("contato_id, autor, texto, criado_em, extra").order("criado_em", { ascending: false }).limit(1500);
        previas = {};
        (ms || []).forEach((m) => {
          const p = previas[m.contato_id] || (previas[m.contato_id] = { ult: null, naoLidas: 0 });
          if (!p.ult && m.autor !== "sistema") p.ult = m;
          const c = contatos.find((x) => x.id === m.contato_id);
          if (m.autor === "cliente" && c && (!c.lida_em || m.criado_em > c.lida_em)) p.naoLidas++;
        });
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
        const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
        const { data: u } = await sb.from("ari_uso").select("origem, custo_usd").gte("criado_em", ini.toISOString()).limit(10000);
        gasto = { teste: 0, whatsapp: 0, n: (u || []).length };
        (u || []).forEach((x) => { gasto[x.origem] += +x.custo_usd; });
      }
    } catch (e) { falhou[qual] = true; toast("Não foi possível carregar: " + (e.message || e)); }
    carregando[qual] = false; render();
  }

  /* ---------- telas ---------- */
  function abas() {
    const t = [["conversas", "Conversas"], ["teste", "Testar o Ari"], ["conhecimento", "Conhecimento"], ["respostas", "Respostas aprovadas"], ["veiculos", "Veículos"], ["ajustes", "Ajustes"]];
    return `<div class="filters ar-abas">${t.map(([k, n]) => `<button class="btn sm ${sub === k ? "pri" : ""}" data-ar="sub" data-k="${k}">${n}</button>`).join("")}</div>`;
  }
  function tela() {
    const corpo = sub === "conversas" ? telaConversas() : sub === "teste" ? telaTeste() : sub === "conhecimento" ? telaConhecimento() : sub === "respostas" ? telaRespostas() : sub === "veiculos" ? telaVeiculos() : telaAjustes();
    return `<div class="notice" style="margin-bottom:12px"><b>Ari desligado.</b> Tudo aqui é preparação e teste: nenhuma mensagem vai para o WhatsApp até a conexão com a Meta (etapa 3).</div>${abas()}${corpo}`;
  }

  const horaCurta = (iso) => { if (!iso) return ""; const d = new Date(iso), h = new Date();
    return d.toDateString() === h.toDateString() ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
  const ESTADOS = { ativo: ["Ari atendendo", "b-neutro"], passado: ["Com você", "b-warn"], encerrado: ["Encerrada", "b-off"] };
  const foneTxt = (c) => c.simulado ? "cliente simulado" : (c.whats || "").replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");

  function telaConversas() {
    if (!contatos) { carregar("contatos"); return esperando("contatos"); }
    const lista = contatos.filter((c) => filtroConv === "todas" || (filtroConv === "abertas" ? c.estado !== "encerrado" : c.estado === filtroConv));
    const sel = contatos.find((c) => c.id === selId);
    if (sel && !msgsSel) carregar("msgs");
    const itens = lista.map((c) => { const p = previas[c.id] || {}; const u = p.ult; const [en, ec] = ESTADOS[c.estado] || ["", ""];
      return `<button class="ar-ci ${c.id === selId ? "on" : ""}" data-ar="abrirConv" data-id="${c.id}">
        <div class="row" style="justify-content:space-between;gap:6px"><b>${esc(c.nome || foneTxt(c))}</b><span class="meta" style="flex:none">${horaCurta(c.ultima_msg_em || c.criado_em)}</span></div>
        <div class="ar-ci-pv">${u ? (u.autor === "cliente" ? "" : u.autor === "jota" ? "Você: " : "Ari: ") + esc((u.extra && u.extra.link ? "Link de cotação" : u.texto || "").slice(0, 70)) : "&nbsp;"}</div>
        <div class="row" style="gap:6px;margin-top:4px"><span class="badge ${ec}" style="flex:none">${en}</span>${c.simulado ? `<span class="badge b-neutro" style="flex:none">teste</span>` : ""}${p.naoLidas ? `<span class="ar-nl">${p.naoLidas}</span>` : ""}</div></button>`; }).join("");
    const listaHtml = `<div class="card ar-lista ${sel ? "ar-esconde-m" : ""}">
      <div class="row" style="justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">Conversas</h2><button class="btn sm pri" data-ar="simular">Simular cliente novo</button></div>
      <div class="filters" style="margin:10px 0 6px">${[["abertas", "Abertas"], ["passado", "Com você"], ["ativo", "Com o Ari"], ["encerrado", "Encerradas"], ["todas", "Todas"]].map(([k, n]) => `<button class="btn sm ${filtroConv === k ? "pri" : ""}" data-ar="filtroConv" data-k="${k}">${n}</button>`).join("")}</div>
      <div class="ar-cis">${itens || `<div class="empty">${contatos.length ? "Nenhuma conversa neste filtro." : "Nenhuma conversa ainda. Quando o WhatsApp estiver conectado, os clientes aparecem aqui. Para ver como funciona, toque em <b>Simular cliente novo</b>."}</div>`}</div></div>`;
    return `<div class="ar-conv">${listaHtml}${sel ? telaConversa(sel) : `<div class="card ar-vazia ar-esconde-m"><div class="empty">Escolha uma conversa.</div></div>`}</div>`;
  }

  function telaConversa(c) {
    const [en, ec] = ESTADOS[c.estado] || ["", ""];
    const ms = msgsSel || [];
    const ultimaAri = [...ms].reverse().find((m) => m.autor !== "sistema");
    const corpo = ms.map((m) => {
      if (m.autor === "sistema") return `<div class="ar-sys">${esc(m.texto)}</div>`;
      const ev = (m.extra && m.extra.eventos || []).filter((e) => e.tipo === "busca" || e.tipo === "veiculo");
      const cls = m.autor === "cliente" ? "c" : m.autor === "jota" ? "j" : "a";
      const tg = m.autor === "cliente" ? (c.nome || "Cliente") : m.autor === "jota" ? "Você" : "Ari · assistente";
      const txt = m.extra && m.extra.link ? `<a href="${esc(m.texto)}" target="_blank" rel="noopener">Cotação Loovi · link</a>` : fmtWa(m.texto || "");
      const bts = m.extra && m.extra.botoes && m.extra.botoes.length ? `<div class="ar-bts">${m.extra.botoes.map((x) => `<button class="ar-bt" data-ar="botaoConv" data-t="${esc(x)}" ${c.simulado && m === ultimaAri && c.estado === "ativo" && !pensando[c.id] ? "" : "disabled"}>${esc(x)}</button>`).join("")}</div>` : "";
      return `${ev.length ? `<div class="ar-evs">${ev.map((e) => `<div class="ar-ev ar-ev-${e.tipo}">${esc(e.texto)}${e.detalhe ? `<details><summary>ver</summary><pre>${esc(e.detalhe)}</pre></details>` : ""}</div>`).join("")}</div>` : ""}
        <div class="ar-m ${cls}"><span class="ar-tg">${esc(tg)} · ${horaCurta(m.criado_em)}</span>${txt}${bts}</div>`;
    }).join("");
    return `<div class="card ar-aberta">
      <div class="ar-cab"><button class="btn sm ar-voltar" data-ar="fecharConv" aria-label="Voltar">‹</button>
        <div style="flex:1;min-width:0"><b>${esc(c.nome || "Sem nome")}</b><div class="meta">${esc(foneTxt(c))}</div></div><span class="badge ${ec}" style="flex:none">${en}</span></div>
      <div class="row ar-acoes">
        ${c.estado === "ativo" ? `<button class="btn sm" data-ar="estado" data-k="passado">Assumir conversa</button>` : ""}
        ${c.estado !== "ativo" ? `<button class="btn sm" data-ar="estado" data-k="ativo">Devolver para o Ari</button>` : ""}
        ${c.estado !== "encerrado" ? `<button class="btn sm" data-ar="estado" data-k="encerrado">Encerrar</button>` : ""}
        ${c.simulado ? `<button class="btn sm bad" data-ar="excluirConv">Excluir teste</button>` : ""}
      </div>
      ${c.resumo ? `<div class="notice gold ar-resumo"><b>Resumo do Ari:</b> ${esc(c.resumo)}</div>` : ""}
      <div class="ar-msgs" id="arMsgs">${msgsSel ? corpo || `<div class="empty">Sem mensagens.</div>` : `<div class="empty">Carregando…</div>`}
        ${pensando[c.id] ? `<div class="ar-m a ar-dig"><span class="ar-tg">Ari · assistente</span>digitando…</div>` : ""}</div>
      ${c.simulado && c.estado !== "encerrado" ? `<form data-ar="comoCliente" class="ar-form ar-form-c"><textarea id="arCli" name="t" rows="1" maxlength="2000" placeholder="Como cliente (teste)">${esc(rascCli)}</textarea><button class="btn" type="submit" ${pensando[c.id] ? "disabled" : ""}>Enviar</button></form>` : ""}
      ${c.estado !== "encerrado" ? `<form data-ar="comoJota" class="ar-form"><textarea id="arJota" name="t" rows="2" maxlength="2000" placeholder="Responder como você${c.estado === "ativo" ? " (o Ari para de responder este cliente)" : ""}">${esc(rascJota)}</textarea><button class="btn pri" type="submit">Enviar</button></form>` : ""}
      <div class="meta" style="margin-top:6px">${c.simulado ? "Conversa de teste: nada vai para o WhatsApp. O que o Ari responde aqui é a IA de verdade." : "Suas respostas serão enviadas pelo WhatsApp quando a conexão estiver ativa (etapa 3)."}</div>
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
    return `<div class="card"><h2>Documentos (${docs.length} · ${total} trechos)</h2>
      <div class="meta" style="margin-bottom:8px">O Ari busca nestes documentos antes de responder dúvidas de produto. Desligue um documento para ele parar de usar sem apagar.</div>
      <div class="list">${docs.map((d, i) => `<div class="item ar-doc"><div style="flex:1;min-width:0"><b>${esc(d.nome)}</b><div class="meta">${d.n} trecho${d.n === 1 ? "" : "s"}${d.origem ? " · " + esc(d.origem) : ""}</div></div>
        <select data-ar="docTipo" data-i="${i}" aria-label="Como o Ari usa">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}" ${d.tipo === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="btn sm ${d.ativo ? "" : "pri"}" data-ar="docAtivo" data-i="${i}">${d.ativo ? "Desligar" : "Ligar"}</button>
        <button class="btn sm bad" data-ar="docExcluir" data-i="${i}">Excluir</button></div>`).join("")}</div></div>
      <form class="card" data-ar="docNovo" novalidate><h2>Adicionar documento</h2>
        <div class="grid2" style="gap:0 12px"><div><label class="f" for="arDn">Nome do documento</label><input type="text" id="arDn" name="nome" maxlength="120" placeholder="Ex.: Tabela de coberturas 2026"></div>
        <div><label class="f" for="arDt">Como o Ari usa</label><select id="arDt" name="tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></div></div>
        <label class="f" for="arDx">Texto do documento</label><textarea id="arDx" name="texto" rows="8" placeholder="Cole aqui o texto. Para PDF ou Word: abra o arquivo, selecione tudo, copie e cole."></textarea>
        <div class="row" style="margin-top:8px;align-items:center;gap:10px"><label class="btn sm" style="cursor:pointer">Abrir arquivo .txt<input type="file" accept=".txt,text/plain" data-ar="docArquivo" hidden></label><span class="meta">O texto é dividido em trechos automaticamente.</span></div>
        <div id="arDocAviso"></div>
        <button class="btn pri full" type="submit" style="margin-top:12px">Adicionar ao conhecimento</button></form>
      <form class="card" data-ar="busca" novalidate><h2>Testar a busca</h2><div class="meta">Veja quais trechos o Ari encontra para uma pergunta, sem gastar IA.</div>
        <div class="row" style="margin-top:8px;gap:8px"><input type="text" name="q" placeholder="Ex.: carro reserva quantos dias" style="flex:1" value="${esc(buscaTeste ? buscaTeste.q : "")}"><button class="btn" type="submit">Buscar</button></div>
        ${buscaTeste ? (buscaTeste.r.length ? `<div class="list" style="margin-top:10px">${buscaTeste.r.map((x) => `<div class="item" style="display:block"><b style="font-size:13px">${esc(x.documento)}${x.secao ? " · " + esc(x.secao) : ""}</b><div class="meta" style="margin-top:4px">${esc(x.trecho.slice(0, 420))}${x.trecho.length > 420 ? "…" : ""}</div></div>`).join("")}</div>` : `<div class="empty">Nenhum trecho encontrado. O Ari diria que vai confirmar com o Jota.</div>`) : ""}
      </form>`;
  }

  function telaRespostas() {
    if (!respostas) { carregar("respostas"); return esperando("respostas"); }
    return `<div class="card"><h2>Respostas aprovadas (${respostas.length})</h2>
      <div class="meta" style="margin-bottom:8px">Valem mais que os documentos. Quando o cliente perguntar algo parecido, o Ari responde com este conteúdo, só ajustando o tom.</div>
      ${respostas.length ? `<div class="list">${respostas.map((r) => `<div class="item" style="display:block"><div class="row" style="justify-content:space-between;gap:8px"><b style="flex:1">${esc(r.pergunta)}</b>${r.ativo ? "" : `<span class="badge b-off" style="flex:none">desligada</span>`}</div>
        <div class="meta" style="margin:4px 0 8px;white-space:pre-wrap">${esc(r.resposta)}</div>
        <div class="row" style="gap:6px"><button class="btn sm" data-ar="respEditar" data-id="${r.id}">Editar</button><button class="btn sm" data-ar="respAtivo" data-id="${r.id}">${r.ativo ? "Desligar" : "Ligar"}</button><button class="btn sm bad" data-ar="respExcluir" data-id="${r.id}">Excluir</button></div></div>`).join("")}</div>`
      : `<div class="empty">Nenhuma ainda. Crie aqui ou toque em “Corrigir esta resposta” no teste.</div>`}
      <button class="btn pri full" data-ar="respNova" style="margin-top:12px">Nova resposta aprovada</button></div>`;
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
    return `<div class="card"><h2>Ari no WhatsApp</h2>
        <div class="row" style="align-items:center;gap:12px"><span class="badge b-off" style="flex:none">desligado</span><div class="meta" style="flex:1">Só dá para ligar depois de conectar o número do WhatsApp à Meta (etapa 3) e com a aprovação da Loovi.</div></div></div>
      <div class="card"><h2>Gasto da IA neste mês</h2>
        <div class="stats"><div class="stat"><b>US$ ${(gasto.teste + gasto.whatsapp).toFixed(2)}</b><span>total (≈ ${reais(gasto.teste + gasto.whatsapp)})</span></div><div class="stat"><b>US$ ${gasto.teste.toFixed(2)}</b><span>testes</span></div><div class="stat"><b>${gasto.n}</b><span>respostas</span></div></div>
        <div class="meta" style="margin-top:6px">Estimativa pelo preço de tabela. A cobrança real fica no painel da Anthropic, em dólar.</div></div>
      <form class="card" data-ar="ajustesSalvar" novalidate><h2>Ajustes</h2>
        <label class="f" for="arMod">Modelo da IA</label><select id="arMod" name="modelo">${Object.entries(MODELOS).map(([k, n]) => `<option value="${k}" ${ajustes.modelo === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <div class="meta" style="margin-top:4px">Sonnet entende melhor as dúvidas difíceis de contrato. Haiku custa cerca de 20 vezes menos. Compare os dois no teste.</div>
        <div class="grid2" style="gap:0 12px"><div><label class="f" for="arHi">Seu atendimento começa às</label><input id="arHi" name="ini" type="number" min="0" max="23" inputmode="numeric" value="${ajustes.hora_ini}"></div>
        <div><label class="f" for="arHf">e termina às</label><input id="arHf" name="fim" type="number" min="1" max="24" inputmode="numeric" value="${ajustes.hora_fim}"></div></div>
        <div class="meta" style="margin-top:4px">O Ari usa esse horário para dizer quando você retorna (“o Jota te chama em instantes” ou “amanhã a partir das 8h”).</div>
        <label class="f" for="arIns">Instruções do Ari</label><textarea id="arIns" name="instrucoes" rows="18" class="ar-ins">${esc(ajustes.instrucoes || "")}</textarea>
        <div class="meta" style="margin-top:4px">São as regras que ele segue em toda conversa: apresentação, regras da marca, como conduzir a cotação e o estilo. Mude com cuidado e teste depois.</div>
        <div id="arAjAviso"></div>
        <button class="btn pri full" type="submit" style="margin-top:12px">Salvar ajustes</button></form>`;
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
    try {
      const { data, error } = await sb.functions.invoke("ari-responder", { body: { contato_id: cid } });
      let r = data; if (error) { try { r = await error.context.json(); } catch (_) { r = { erro: error.message }; } }
      if (r && r.erro) toast(r.erro);
      if (r && r.uso && gasto) gasto.teste += r.uso.custo_usd || 0;
    } catch (_) { toast("Falha de conexão com o Ari."); }
    pensando[cid] = false; msgsSel = null; await recarregarConversas(); rolar();
  }
  async function recarregarConversas() { const ant = contatos; contatos = ant; await carregar("contatos"); if (selId) await carregar("msgs"); }
  async function mensagemCliente(texto) {
    const c = contatos.find((x) => x.id === selId); texto = String(texto || "").trim(); if (!c || !texto || pensando[c.id]) return;
    const agora = new Date().toISOString();
    const { error } = await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "in", autor: "cliente", tipo: "texto", texto, status: "recebida", criado_em: agora });
    if (error) return toast("Não foi possível enviar: " + error.message);
    await sb.from("ari_contatos").update({ ultima_msg_em: agora, lida_em: agora }).eq("id", c.id);
    rascCli = ""; msgsSel = null;
    if (c.estado === "ativo") respostaAri(c.id); else { await recarregarConversas(); rolar(); }
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
    if (a === "abrirConv") {
      selId = d.id; msgsSel = null; rascCli = ""; rascJota = "";
      const c = contatos.find((x) => x.id === selId), agora = new Date().toISOString();
      if (c) { c.lida_em = agora; if (previas[c.id]) previas[c.id].naoLidas = 0; sb.from("ari_contatos").update({ lida_em: agora }).eq("id", c.id).then(() => {}); }
      await carregar("msgs"); rolar(); return;
    }
    if (a === "fecharConv") { selId = null; msgsSel = null; render(); return; }
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
    if (a === "estado") { const c = contatos.find((x) => x.id === selId); if (c) mudarEstado(c, d.k); return; }
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
    if (a === "comoJota") {
      const c = contatos.find((x) => x.id === selId), texto = f.t.value.trim(); if (!c || !texto) return;
      const agora = new Date().toISOString();
      const { error } = await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "out", autor: "jota", tipo: "texto", texto, status: c.simulado ? "simulada" : "enviada", criado_em: agora });
      if (error) return toast("Não foi possível enviar: " + error.message);
      const muda = { ultima_msg_em: agora, lida_em: agora, atualizado_em: agora }; if (c.estado === "ativo") muda.estado = "passado";
      await sb.from("ari_contatos").update(muda).eq("id", c.id);
      if (c.estado === "ativo") await sb.from("ari_mensagens").insert({ contato_id: c.id, direcao: "int", autor: "sistema", tipo: "outro", texto: "Você respondeu: o Ari parou de responder este cliente.", status: "interna", criado_em: new Date(Date.now() + 5).toISOString() });
      rascJota = ""; msgsSel = null; await recarregarConversas(); rolar(); return;
    }
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
        : await sb.from("ari_respostas").insert({ pergunta, resposta }).select().single();
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
      const ini = +f.ini.value, fim = +f.fim.value, instrucoes = f.instrucoes.value.trim();
      const aviso = (m) => { $("#arAjAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
      if (!(ini >= 0 && ini <= 23 && fim >= 1 && fim <= 24 && fim > ini)) return aviso("Confira o horário: o fim precisa ser depois do início.");
      if (instrucoes.length < 200) return aviso("As instruções parecem incompletas. O Ari precisa delas para responder.");
      const { error } = await sb.from("ari_ajustes").update({ modelo: f.modelo.value, hora_ini: ini, hora_fim: fim, instrucoes, atualizado_em: new Date().toISOString() }).eq("id", 1);
      if (error) return aviso("Não foi possível salvar: " + error.message);
      Object.assign(ajustes, { modelo: f.modelo.value, hora_ini: ini, hora_fim: fim, instrucoes }); modeloTeste = null;
      toast("Ajustes salvos"); render(); return;
    }
  }

  async function mudar(t) {
    const a = t.dataset.ar;
    if (a === "modeloTeste") { modeloTeste = t.value; return; }
    if (a === "docTipo") {
      const doc = docs[+t.dataset.i];
      const { error } = await sb.from("ari_conhecimento").update({ tipo: t.value }).eq("documento", doc.nome);
      if (error) { toast("Não foi possível salvar: " + error.message); t.value = doc.tipo; return; }
      doc.tipo = t.value; toast("Salvo"); return;
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
    if (ev.target.id === "arCli") rascCli = ev.target.value;
    if (ev.target.id === "arJota") rascJota = ev.target.value;
    if (ev.target.dataset && ev.target.dataset.ar === "veicBusca") {
      filtroVeic = ev.target.value; const pos = ev.target.selectionStart;
      clearTimeout(mudar._t); mudar._t = setTimeout(() => { render(); const el = $("#arVb"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 250);
    }
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
      .subscribe();
  } catch (_) {}
  function agendar() {
    if (sub !== "conversas" || Object.values(pensando).some(Boolean)) return;
    clearTimeout(rtTimer); rtTimer = setTimeout(async () => { if (contatos) { msgsSel = null; await recarregarConversas(); rolar(); } }, 400);
  }

  return { tela, clique, enviar, mudar, rolar };
}
