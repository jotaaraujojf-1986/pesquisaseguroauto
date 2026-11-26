# Ari – painel completo (26/11/2026)

Migrações `ari_painel_completo` e `notif_tipos_ari`; função `ari-responder` v4.

- `ari_respostas.fonte` + 7 respostas oficiais (6 do Guia de respostas da Loovi e a de franquia de terceiro).
- `ari_perguntas`: fila do que o Ari não soube (ferramenta `registrar_pergunta`); aprovar vira resposta aprovada.
- `ari_contatos.temperatura`; `ari_cotacao` + veiculo, uso, seguro_atual, endereco (ferramenta `anotar_dados`, CPF criptografado).
- `ari_ajustes`: msg_fora, avisar_fora, espera_s, digitando_s, respostas_rapidas.
- `definir_notif`: aceita ari_lead, ari_quente, ari_resposta, ari_janela, ari_pergunta e silencio (só admin).
- Instruções do Ari ganharam as seções "PERGUNTAS QUE VOCÊ NÃO SABE" e "DADOS DO CLIENTE".
- Envio de PDF e Word no Conhecimento: texto extraído no navegador (unpdf e mammoth, carregados só ao enviar).
