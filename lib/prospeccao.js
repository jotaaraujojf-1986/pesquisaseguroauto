// Prospecção de parceiros: lista de empresas a visitar antes de virarem parceiras.
// Carregado só quando o administrador abre o menu "Prospecção".
// Quando o prospecto aceita, "Cadastrar como parceiro" abre o formulário normal de parceiros já preenchido.

const STATUS = {
  a_visitar: "A visitar",
  visitado: "Visitado",
  interessado: "Interessado",
  parceiro: "Parceiro",
  recusou: "Recusou",
  inexistente: "Não existe mais",
};
const ORDEM = ["a_visitar", "visitado", "interessado", "parceiro", "recusou", "inexistente"];
const ONDAS = { 1: "Onda 1 · perto de casa", 2: "Onda 2 · bairros vizinhos", 3: "Onda 3 · mais longe" };

export function criarProspeccao(ctx) {
  const { sb, esc, toast, render, abrirSheet, fecharSheet, $, msgErro, abrirFormParceiro } = ctx;
  let lista = null, carregando = false, falhou = false;
  let fStatus = "todos", fPri = "todas", busca = "";

  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const digitos = (s) => String(s || "").replace(/\D/g, "");
  const fmtTel = (t) => {
    const d = digitos(t);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return t || "";
  };
  const fmtData = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const km = (n) => (n == null ? "" : String(n).replace(".", ",") + " km");
  const endereco = (p) => [[p.logradouro, p.numero].filter(Boolean).join(", "), p.complemento, p.bairro].filter(Boolean).join(" · ");
  const enderecoMapa = (p) => [p.nome, p.logradouro, p.numero, p.bairro, p.cidade || "Juiz de Fora", p.uf || "MG"].filter(Boolean).join(", ");

  async function carregar() {
    if (carregando || falhou) return;
    carregando = true;
    const { data, error } = await sb.from("parceiro_prospectos").select("*").order("onda").order("km", { nullsFirst: false });
    carregando = false;
    if (error) { falhou = true; toast("Não foi possível carregar a prospecção: " + msgErro(error)); }
    else lista = data;
    render();
  }

  function filtrada() {
    const q = norm(busca);
    return lista.filter((p) =>
      (fStatus === "todos" || p.status === fStatus) &&
      (fPri === "todas" || p.prioridade === fPri) &&
      (!q || norm([p.nome, p.categoria, p.bairro, p.contato].join(" ")).includes(q)));
  }

  function itemHTML(p) {
    const sub = [p.categoria, p.bairro, km(p.km)].filter(Boolean).join(" · ");
    const prox = p.proxima_acao ? `<div class="meta" style="margin-top:3px">Próximo passo: ${esc(p.proxima_acao)}</div>` : "";
    return `<button class="card pr-item" data-pr="abrir" data-id="${p.id}" style="width:100%;text-align:left;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0"><b>${esc(p.nome)}</b><div class="meta" style="margin-top:3px">${esc(sub)}</div>${prox}</div>
        <div style="text-align:right;flex:none"><span class="pr-st pr-${p.status}">${STATUS[p.status]}</span><div class="meta" style="margin-top:4px">Prioridade ${p.prioridade}</div></div>
      </div></button>`;
  }

  function listaHTML() {
    const itens = filtrada();
    if (!itens.length) return `<div class="empty">Nenhuma empresa com esses filtros.</div>`;
    const ondas = [...new Set(itens.map((p) => p.onda))].sort((a, b) => a - b);
    return ondas.map((o) => {
      const g = itens.filter((p) => p.onda === o);
      return `<h3 style="margin:16px 0 8px;font-size:15px">${esc(ONDAS[o] || "Onda " + o)} <span class="meta">(${g.length})</span></h3>${g.map(itemHTML).join("")}`;
    }).join("");
  }

  function tela() {
    if (!lista) {
      if (!carregando && !falhou) carregar();
      return `<div class="card empty">${falhou ? "Não foi possível carregar. Atualize a página." : "Carregando…"}</div>`;
    }
    const cont = Object.fromEntries(ORDEM.map((s) => [s, lista.filter((p) => p.status === s).length]));
    const funil = ["todos", ...ORDEM].map((s) => {
      const n = s === "todos" ? lista.length : cont[s];
      const on = fStatus === s;
      return `<button class="btn sm${on ? " pri" : ""}" data-pr="fstatus" data-v="${s}" style="margin:0 6px 6px 0">${s === "todos" ? "Todos" : STATUS[s]} · ${n}</button>`;
    }).join("");
    const pri = ["todas", "A", "B", "C"].map((x) =>
      `<button class="btn sm${fPri === x ? " pri" : ""}" data-pr="fpri" data-v="${x}" style="margin:0 6px 6px 0">${x === "todas" ? "Todas prioridades" : "Prioridade " + x}</button>`).join("");
    return `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px">
        <div><b>${lista.length} empresas</b><div class="meta">${cont.parceiro} já são parceiras · ${cont.interessado} interessadas</div></div>
        <button class="btn pri sm" data-pr="novo">+ Adicionar</button></div>
      <div>${funil}</div><div>${pri}</div>
      <input type="search" id="prBusca" placeholder="Buscar por nome, tipo ou bairro" value="${esc(busca)}" autocomplete="off" style="margin-top:4px"></div>
      <div id="prLista">${listaHTML()}</div>`;
  }

  function detalheHTML(p) {
    const wa = digitos(p.tel);
    const links = [
      wa ? `<a class="btn sm" href="https://wa.me/55${wa}" target="_blank" rel="noopener">WhatsApp</a>` : "",
      wa ? `<a class="btn sm" href="tel:+55${wa}">Ligar</a>` : "",
      `<a class="btn sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoMapa(p))}" target="_blank" rel="noopener">Mapa</a>`,
    ].join(" ");
    const ja = !!p.parceiro_id;
    return `<form class="card" id="formPros" data-pr="salvar" data-id="${p.id}" novalidate>
      <h2 style="margin-bottom:2px">${esc(p.nome)}</h2>
      <div class="meta">${esc(p.categoria)} · Prioridade ${p.prioridade}${p.km != null ? " · " + km(p.km) : ""}</div>
      <div class="meta" style="margin-top:4px">${esc(endereco(p))}${p.tel ? " · " + esc(fmtTel(p.tel)) : ""}</div>
      ${p.horario ? `<div class="meta" style="margin-top:2px">Horário: ${esc(p.horario)}</div>` : ""}
      <div style="margin:10px 0 4px;display:flex;gap:8px;flex-wrap:wrap">${links}</div>
      <label class="f" for="prSt">Situação</label>
      <select id="prSt" name="status">${ORDEM.map((s) => `<option value="${s}"${p.status === s ? " selected" : ""}>${STATUS[s]}</option>`).join("")}</select>
      <label class="f" for="prCt">Com quem falei</label><input type="text" id="prCt" name="contato" maxlength="80" value="${esc(p.contato || "")}">
      <label class="f" for="prUv">Última visita</label><input type="date" id="prUv" name="ultima_visita" value="${esc(p.ultima_visita || "")}">
      <label class="f" for="prPa">Próximo passo</label><input type="text" id="prPa" name="proxima_acao" maxlength="200" value="${esc(p.proxima_acao || "")}" placeholder="Ex.: voltar sexta com a plaquinha">
      <label class="f" for="prOb">Anotações</label><textarea id="prOb" name="obs" maxlength="1000">${esc(p.obs || "")}</textarea>
      <div id="prAviso"></div>
      <button class="btn pri full" type="submit">Salvar</button>
      ${ja ? `<div class="meta" style="margin-top:10px">Já cadastrada em Parceiros.</div>` : `<button class="btn full" type="button" data-pr="virar" data-id="${p.id}">Cadastrar como parceiro</button>`}
      <button class="btn full bad" type="button" data-pr="excluir" data-id="${p.id}">Excluir da lista</button>
    </form>`;
  }

  function novoHTML() {
    return `<form class="card" id="formProsNovo" data-pr="criar" novalidate><h2>Adicionar empresa</h2>
      <label class="f" for="pnN">Nome *</label><input type="text" id="pnN" name="nome" maxlength="120">
      <label class="f" for="pnC">Tipo de negócio *</label><input type="text" id="pnC" name="categoria" maxlength="60" placeholder="Ex.: Mecânica, Despachante">
      <label class="f" for="pnP">Prioridade</label><select id="pnP" name="prioridade"><option value="A">A</option><option value="B" selected>B</option><option value="C">C</option></select>
      <label class="f" for="pnT">WhatsApp / telefone</label><input type="tel" id="pnT" name="tel" maxlength="20" inputmode="tel">
      <label class="f" for="pnR">Rua e número</label><input type="text" id="pnR" name="rua" maxlength="140">
      <label class="f" for="pnB">Bairro</label><input type="text" id="pnB" name="bairro" maxlength="80">
      <div id="prAviso"></div>
      <button class="btn pri full" type="submit">Adicionar</button></form>`;
  }

  const achar = (id) => lista.find((x) => x.id === id);

  async function salvar(f) {
    const p = achar(f.dataset.id); if (!p) return;
    const g = (n) => String(f[n].value || "").trim();
    const dados = { status: g("status"), contato: g("contato") || null, ultima_visita: g("ultima_visita") || null, proxima_acao: g("proxima_acao") || null, obs: g("obs") || null, atualizado_em: new Date().toISOString() };
    const { data, error } = await sb.from("parceiro_prospectos").update(dados).eq("id", p.id).select().single();
    if (error) { $("#prAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(msgErro(error))}</div>`; return; }
    lista = lista.map((x) => (x.id === p.id ? data : x));
    $("#sheet").innerHTML = ""; render(); toast("Salvo");
  }

  async function criar(f) {
    const g = (n) => String(f[n].value || "").trim();
    const aviso = (m) => { $("#prAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
    if (g("nome").length < 2) return aviso("Informe o nome da empresa.");
    if (g("categoria").length < 2) return aviso("Informe o tipo de negócio.");
    const dados = { nome: g("nome"), categoria: g("categoria"), prioridade: g("prioridade"), tel: digitos(g("tel")) || null, logradouro: g("rua") || null, bairro: g("bairro") || null, cidade: "Juiz de Fora", uf: "MG", onda: 3 };
    const { data, error } = await sb.from("parceiro_prospectos").insert(dados).select().single();
    if (error) return aviso(msgErro(error));
    lista = [...lista, data]; $("#sheet").innerHTML = ""; render(); toast("Empresa adicionada");
  }

  async function excluir(id) {
    const p = achar(id); if (!p) return;
    if (!window.confirm(`Excluir "${p.nome}" da lista? Isso não pode ser desfeito.`)) return;
    const { error } = await sb.from("parceiro_prospectos").delete().eq("id", id);
    if (error) { toast("Não foi possível excluir: " + msgErro(error)); return; }
    lista = lista.filter((x) => x.id !== id); $("#sheet").innerHTML = ""; render(); toast("Excluída");
  }

  // Depois que o parceiro é cadastrado de verdade, o app chama isto para ligar os dois registros.
  async function vincular(prospId, parceiroId) {
    const { data, error } = await sb.from("parceiro_prospectos").update({ parceiro_id: parceiroId, status: "parceiro", atualizado_em: new Date().toISOString() }).eq("id", prospId).select().single();
    if (!error && lista) { lista = lista.map((x) => (x.id === prospId ? data : x)); render(); }
  }

  function clique(t, d) {
    if (d.pr === "fstatus") { fStatus = d.v; render(); return; }
    if (d.pr === "fpri") { fPri = d.v; render(); return; }
    if (d.pr === "abrir") { const p = achar(d.id); if (p) abrirSheet(detalheHTML(p)); return; }
    if (d.pr === "novo") { abrirSheet(novoHTML()); return; }
    if (d.pr === "excluir") { excluir(d.id); return; }
    if (d.pr === "virar") {
      const p = achar(d.id); if (!p) return;
      abrirFormParceiro({ prospId: p.id, nome: p.nome, contato: p.contato, tel: p.tel, logradouro: p.logradouro, numero: p.numero, complemento: p.complemento, bairro: p.bairro, cidade: p.cidade || "Juiz de Fora", uf: p.uf || "MG" });
    }
  }
  function enviar(f) {
    if (f.dataset.pr === "salvar") salvar(f);
    else if (f.dataset.pr === "criar") criar(f);
  }
  function mudar() {}

  document.addEventListener("input", (ev) => {
    if (ev.target.id !== "prBusca") return;
    busca = ev.target.value;
    const el = $("#prLista"); if (el && lista) el.innerHTML = listaHTML();
  });

  return { tela, clique, enviar, mudar, vincular };
}
