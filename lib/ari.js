// Ari (assistente de WhatsApp): telas do administrador.
// Carregado só quando o administrador abre o menu "WhatsApp (Ari)".
// Etapa 2: teste com a IA de verdade, conhecimento, respostas aprovadas, veículos e ajustes.
// Nada aqui envia mensagem para o WhatsApp.

const MODELOS = { "claude-sonnet-5-5": "Sonnet (mais caprichado)", "claude-haiku-5-5": "Haiku (mais barato)" };
const TIPOS = { cliente: "Usado para responder", estilo: "Jeito de falar e vender", interno: "Interno (o Ari não usa)" };
const DOLAR = 5.5; // só para mostrar uma ideia em reais

export function criarAri(ctx) {
  const { sb, esc, toast, render, abrirSheet, fecharSheet, $ } = ctx;
  let sub = "teste";
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
    const t = [["teste", "Testar o Ari"], ["conhecimento", "Conhecimento"], ["respostas", "Respostas aprovadas"], ["veiculos", "Veículos"], ["ajustes", "Ajustes"]];
    return `<div class="filters ar-abas">${t.map(([k, n]) => `<button class="btn sm ${sub === k ? "pri" : ""}" data-ar="sub" data-k="${k}">${n}</button>`).join("")}</div>`;
  }
  function tela() {
    const corpo = sub === "teste" ? telaTeste() : sub === "conhecimento" ? telaConhecimento() : sub === "respostas" ? telaRespostas() : sub === "veiculos" ? telaVeiculos() : telaAjustes();
    return `<div class="notice" style="margin-bottom:12px"><b>Ari desligado.</b> Tudo aqui é preparação e teste: nenhuma mensagem vai para o WhatsApp até a conexão com a Meta (etapa 3).</div>${abas()}${corpo}`;
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

  async function clique(t, d) {
    const a = d.ar;
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
    if (ev.target.dataset && ev.target.dataset.ar === "veicBusca") {
      filtroVeic = ev.target.value; const pos = ev.target.selectionStart;
      clearTimeout(mudar._t); mudar._t = setTimeout(() => { render(); const el = $("#arVb"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 250);
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.id === "arTxt" && ev.key === "Enter" && !ev.shiftKey && window.matchMedia("(hover: hover)").matches) { ev.preventDefault(); enviarMensagem(ev.target.value); }
  });

  return { tela, clique, enviar, mudar, rolar };
}
