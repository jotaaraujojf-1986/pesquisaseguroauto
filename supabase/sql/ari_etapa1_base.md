# Ari – etapa 1 (base no banco, desligado)

Aplicado no Supabase em 25/11/2026 (migração `ari_etapa1_base`).

- `normalizar_whats()` + gatilhos em `crm` e `entrevistas`: WhatsApp sempre sem 55 e com o 9 nos celulares.
  `responder_link_srv` e `responder_parceiro_srv` usam a mesma regra.
- `config.ari_ligado` (falso), origem `ari` no `crm`, `crm.ari_resumo`.
- Tabelas só do administrador: `ari_contatos`, `ari_mensagens`, `ari_cotacao` (CPF criptografado com chave
  `ari_chave_cpf` no cofre), `ari_conhecimento` (busca em português).
- Funções: `ari_salvar_cotacao` (só servidor), `ari_ver_cpf` (só admin), `ari_buscar` (admin/servidor).
- Tarefa `limpar-ari-conversas`: apaga conversas sem lead após 90 dias sem mensagem.
- Áudio: transcrever e descartar (nada é guardado).
- Ajustes de desempenho: índices em `link_sessoes` e `push_subs`; regras de acesso com `(select auth.uid())`.
