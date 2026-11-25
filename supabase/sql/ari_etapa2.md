# Ari – etapa 2 (teste no painel, sem WhatsApp)

Aplicado no Supabase em 25/11/2026 (migrações `ari_etapa2_conhecimento`, `ari_busca_qualquer_palavra`, `ari_ajustes_tabela_propria`).

- `ari_ajustes` (só admin): ligado, instruções, modelo (Sonnet/Haiku), horário de atendimento.
- `ari_conhecimento`: + secao, tipo (cliente/estilo/interno), ativo. Base inicial importada do protótipo
  (426 trechos de 8 documentos; "agenda e funil" como interno e desligado). Não fica no repositório (é público).
- `ari_respostas` (respostas aprovadas, valem mais que os documentos), `ari_veiculos` (1013 restritos, 42 diferenciados),
  `ari_uso` (tokens e custo estimado por resposta).
- `ari_buscar`: busca em português por qualquer palavra, ordenada por relevância.
- Função `ari-responder` (supabase/functions/ari-responder): só administrador com código de verificação;
  usa o segredo `ANTHROPIC_API_KEY`; passar/avisar o Jota e apagar dados são simulados.
