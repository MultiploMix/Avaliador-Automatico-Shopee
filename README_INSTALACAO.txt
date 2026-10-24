SHOPEE AVALIAÇÕES — REVISÃO ASSISTIDA V2.0
=======================================
Extensão Google Chrome para Windows. NÃO USA AGENTES DE IA.

O QUE FOI IMPLEMENTADO
---------------------
- Painel próprio com fila, edição de mensagens, modelos, configurações e logs.
- Leitura sob comando do usuário dos cartões da página Gerenciar Avaliações.
- Apenas avaliações comprovadamente de 5 estrelas entram na fila.
- Limite de 100 novos cartões da Shopee por execução, entre várias páginas.
- Bloqueio de duplicatas por loja + identificador estável da avaliação.
- Identificação tentativa do nome da loja na página. Configuração inicial: Múltiplo Mix.
- Avaliações com possíveis reclamações são sinalizadas e NÃO recebem resposta genérica.
- Botão 'Abrir e preencher': localiza a avaliação na página, abre a janela
  'Responder' e insere a mensagem SEM CLICAR 'ENVIAR'.
- Botão 'Próxima página + nova leitura', acionado manualmente e conservador.
- Registro da conclusão apenas quando o operador confirma ter enviado manualmente.
- Registro local de logs e opção de exportar backup JSON.
- Importação manual e demonstração para treinamento sem Shopee.

COMO INSTALAR NO GOOGLE CHROME
-----------------------------
1. Extraia todo o ZIP para uma pasta que NÃO será movida, por exemplo:
   C:\ShopeeAvaliacoesV2\
2. Abra o Chrome e acesse chrome://extensions
3. Ative 'Modo do desenvolvedor'.
4. Clique em 'Carregar sem compactação'.
5. Selecione a pasta 'extension' DENTRO de shopee_avaliacoes_v2.
6. Fixe o ícone 'Shopee Avaliações — Revisão Assistida' na barra do Chrome.
7. Caso já tenha V1 instalada, remova/desative a V1 DEPOIS de fazer backup
   do histórico, para não confundir as duas extensões. Ao instalar V2 em
   outro diretório o Chrome pode usar outro ID, sem migrar registros da V1.

PRIMEIRO TESTE NA SHOPEE
-----------------------
1. Faça login normalmente na Central do Vendedor, em seller.shopee.com.br.
2. Entre em Atendimento ao Cliente > Gerenciamento de Revisões/Avaliações.
3. No filtro Status, clique em 'Para Responder'.
4. Em Avaliações por Estrela, deixe marcada SOMENTE '5 estrela'.
5. Clique em 'Aplicar' e espere os cartões aparecerem.
6. Clique no ícone da extensão e em '1. Ler avaliações desta página'.
7. Confira o diagnóstico: cartões encontrados, avaliações adicionadas,
   repetidas, notas incertas, loja detectada e textos a revisar.
8. Na 'Fila de revisão', revise o comentário e a mensagem proposta.
9. Clique em 'Abrir e preencher rascunho': a extensão deverá abrir o modal
   da avaliação que está na página e preencher o texto. NÃO PUBLICA.
10. Confira a resposta. Se desejar, clique em 'Enviar' MANUALMENTE na Shopee.
11. Somente depois do envio real, retorne ao painel da extensão e marque
    'Marcar feita manualmente'. A extensão NÃO verifica automaticamente envio.
12. Feche o modal, clique em 'Próxima página + nova leitura' e repita.

CONFIGURAÇÕES DE ENTREGA
-----------------------
  automação de PREPARAÇÃO: habilitada
  notas: SOMENTE 5 estrelas
  notas de 1 a 4 estrelas: excluídas
  limite: 100 AVALIAÇÕES NOVAS por execução de leitura em páginas
  modo: revisão humana
  envio da Shopee: desativado, sem qualquer caminho de publicação automática
  respostas: até 500 caracteres
  armazenamento: chrome.storage.local no seu computador

AVISOS E LIMITAÇÕES
------------------
- A Shopee altera o HTML da Central do Vendedor. Como não há acesso real à sua
  conta durante a construção, os seletores são heurísticos e precisam de
  validação ao vivo. Se a extensão informar nota/ID incerto ou não identificar
  cartão/modal/paginação, ela BLOQUEIA a ação e informa o problema.
- A tela da Shopee enviada como referência mostra aconchegoimportados,
  enquanto a configuração inicial da extensão vem de Múltiplo Mix. Confira
  a loja detectada após cada coleta. Registros são separados pelo nome da loja.
- Não há serviço em segundo plano, agendamento semanal nem envio em lote.
  A leitura, a abertura do modal e a paginação dependem de ações do usuário.
- Chrome e sessão Shopee devem permanecer ativos. Não armazenamos senha.
- Cuidado com dados pessoais em backups: comentários e IDs ficam salvos
  somente no armazenamento local deste perfil do Chrome.
- Os termos da Shopee podem restringir automações de interface não autorizadas;
  utilize somente mediante observância das regras da plataforma.
- No primeiro teste, use UMA avaliação real, confira a loja e a mensagem,
  e NÃO clique em Enviar enquanto a automação não estiver validada.

ARQUIVOS IMPORTANTES
--------------------
extension/manifest.json     configuração Chrome Manifest V3
extension/content.js       integração com os cartões/modal/paginação
extension/popup.html/js    controles na barra do Chrome
extension/dashboard.html/js  painel de revisão, mensagens, logs
extension/shared.js        deduplicação, regras e armazenamento
extension/styles.css/v2.css  interface
tests/test_shared_v2.js teste de regras offline
tests/test_interface.py teste de interface em página fictícia via Playwright

Para atualizar: edite os arquivos na MESMA pasta e clique em Recarregar
em chrome://extensions; o histórico será mantido no perfil dessa extensão.
