SHOPEE AVALIAÇÕES — V7.0
==========================
Extensão Chrome para auxiliar no tratamento de avaliações na Central do Vendedor.
A automação prepara e percorre avaliações de 5 estrelas, com meta de 50, 100,
200, 500 ou 1000 respostas confirmadas por execução,
filtra críticas, registra ações e pode publicar SOMENTE com autorização expressa.

NOVIDADES V7: META DE RESPOSTAS E CONTROLE
------------------------------------
1. Escolha 50, 100, 200, 500 ou 1.000 respostas no popup ou no painel.
2. A contagem refere-se a envios confirmados, não avaliações apenas analisadas.
3. Ao abrir a janela Responder, o rascunho é preenchido assim que o modal aparece
   (não existe mais espera fixa de 350 ms).
4. Após clicar em Enviar, a extensão observa a confirmação assim que ela é exibida;
   não precisa aguardar a próxima checagem periódica de 250 ms.
5. Passagem de página reage à atualização real da tela, com checagem de estabilidade.
6. Avisos antigos de 'enviado com sucesso' NÃO validam uma nova publicação.
7. Sem publicações em paralelo, sem tentativas repetidas em caso de resultado incerto.
8. Mantém reconhecimento de reclamações com 5 estrelas (V5), histórico e proteção por loja.

ATUALIZAÇÃO SEM PERDER O HISTÓRICO (RECOMENDADA)
----------------------------------------------
1. Abra o painel da extensão V6 e clique em 'Exportar backup'. Guarde o JSON.
2. Encerre qualquer execução ativa na V6 antes de atualizar.
3. Extraia este arquivo ZIP para uma pasta no Windows.
4. Copie TODOS os arquivos DENTRO de shopee_avaliacoes_v7/extension
   para DENTRO da pasta 'extension' que já era utilizada pela V6.
   Substitua os arquivos antigos. NÃO apague o diretório da extensão instalada.
5. Abra chrome://extensions e clique em 'Recarregar' na extensão existente.
6. Volte à aba da Shopee e pressione F5.
7. Abra o painel e confirme V7.0 e, em Configurações, '2 s · equilibrado'.
8. Execute 'TESTAR automaticamente (SEM ENVIAR)' antes de autorizar publicação real.

INSTALAÇÃO NOVA (SEM EXTENSÃO ANTERIOR)
--------------------------------------
1. Extraia o ZIP em uma pasta fixa no computador.
2. No Chrome, acesse chrome://extensions e ligue o Modo do desenvolvedor.
3. Clique em 'Carregar sem compactação' e escolha a pasta
   shopee_avaliacoes_v7/extension, que contém manifest.json.
4. Abra a Central do Vendedor Shopee > Gerenciar Avaliações.
5. Selecione 'Para Responder', marque apenas '5 estrelas' e clique 'Aplicar'.
6. Abra o ícone da extensão, selecione a loja detectada e inicie o modo TESTE SEM ENVIAR.

ATENÇÃO: nova instalação em pasta/ID diferente pode ter armazenamento local separado;
importe um backup da V6 por meio do painel em Relatórios > Restaurar backup.

CONFIGURAÇÕES DE VELOCIDADE
--------------------------
Painel > Configurações > Intervalo entre envios:
  1,5 s = mais rápido, requer teste cauteloso
  2,0 s = equilibrado (NOVO padrão)
  2,5 s = padrão anterior
  3,5 s = conservador
  5 / 10 / 15 s = mais pausado

O padrão de 2,0 s e as configurações personalizadas de intervalo são preservados.
Outros valores personalizados são preservados.

SEGURANÇA E LIMITAÇÕES
----------------------
- Publicação real desativada por padrão e requer confirmação explícita.
- Use publicação automatizada somente caso esteja autorizado pela plataforma.
- Comentários críticos/ambíguos continuam bloqueados mesmo com 5 estrelas.
- Comentários positivos podem exigir aprovação individual conforme ajustes.
- Se o envio não apresentar uma NOVA confirmação positiva, a extensão bloqueia
  outras tentativas e exige verificação humana para não criar respostas duplicadas.
- Este projeto foi testado em uma interface Shopee SIMULADA, não na conta real.
- O Chrome e a Shopee podem mudar comportamento. Mantenha a aba aberta e supervisionada.
- Não há tentativa de contornar CAPTCHA, autenticação ou limites da plataforma.
- O armazenamento de avaliações, mensagens e logs é local ao perfil do Chrome.
- Não desinstale a versão anterior antes de exportar o backup.

TESTES TÉCNICOS (OPCIONAIS)
-------------------------
Requer Node.js, Python Playwright e Chromium.
   node tests/test_shared_v2.js
   node tests/test_sentimento_v5.js
   python tests/test_interface.py
   python tests/test_automation.py
   python tests/test_dashboard_v4.py
   python tests/test_speed_v6.py

Teste de velocidade realizado em DOM simulado: não garante o mesmo tempo no site real.

V7 - META DE RESPOSTAS
- No popup da extensão escolha 50, 100, 200, 500 ou 1.000 respostas.
- A publicação só para por meta ao atingir esse número de envios confirmados.
- Não contam na meta: notas diferentes de 5, reclamações, comentários não aprovados, já respondidas e envios não confirmados.
- Para evitar coleta sem fim, há limites independentes de até 6 vezes a meta (no máximo 6.000 avaliações novas) e até 800 páginas. Se a Shopee acabar as páginas antes da meta, a operação encerra com quantidade inferior.
- O teste sem envio contabiliza respostas consideradas aptas, NÃO publicações.
- A meta é salva nas configurações do Chrome; alterar meta exige execução parada.
- Se houver envio incerto, a execução é interrompida como antes.
- Esta versão NÃO foi validada em conta real da Shopee. O uso de publicação automática requer autorização da plataforma.
