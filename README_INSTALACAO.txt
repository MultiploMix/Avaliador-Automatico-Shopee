SHOPEE AVALIAÇÕES — REVISÃO LOCAL V1.0
====================================

OBJETIVO
--------
Extensão Chrome Manifest V3 para preparar respostas a avaliações de 5 estrelas, com
painel, mensagens editáveis, registro local de duplicatas e histórico. NÃO PUBLICA,
NÃO CLICA EM BOTÕES DA SHOPEE E NÃO FAZ REQUISIÇÕES DE REDE À SHOPEE.
Não usa IA, API ou servidor externo; nada é pago para rodar o software.

INSTALAÇÃO NO GOOGLE CHROME (WINDOWS)
-------------------------------------
1. Extraia o ZIP em uma pasta permanente do seu computador, por exemplo:
   C:\\ShopeeAvaliacoes\\
2. Abra o Chrome, digite chrome://extensions e pressione Enter.
3. Ative "Modo do desenvolvedor" (canto superior direito).
4. Clique em "Carregar sem compactação".
5. Selecione a pasta EXTENSION (a que contém manifest.json).
6. Fixe o ícone da extensão (menu de extensões / ícone de peça de quebra-cabeça).
7. Clique no ícone e em "Abrir painel completo".

TESTE INICIAL SEGURO
--------------------
1. Abra "Importar / Testar" no painel.
2. Clique em "Carregar demonstração".
3. Na "Fila de revisão", veja 3 avaliações de 5 estrelas (a de 4 estrelas
   é excluída; um ID duplicado também não entra).
4. Edite uma resposta, clique em "Salvar texto" e depois "Copiar resposta".
5. Confirme o texto copiado em um editor comum. NADA FOI ENVIADO À SHOPEE.
6. Use "Marcar feita manualmente" apenas após ter respondido à avaliação
   de verdade na Shopee por conta própria.
7. Em "Histórico", confira os eventos e em "Importar / Testar" remova a demo.

IMPORTAÇÃO MANUAL
-----------------
Use uma avaliação por linha, no formato:
ID_DA_AVALIACAO | 5 | Nome do produto | Comentário do comprador
AV-2026-001 | 5 | Exemplo de produto | Excelente!
AV-2026-002 | 4 | Exemplo de produto | Gostei (essa é excluída)

Cada ID precisa ser único e estável dentro da loja; repetições são bloqueadas,
mesmo que você tenha marcado a avaliação como concluída ou ignorada.
O limite de 100 é de AVALIAÇÕES NOVAS adicionadas por operação, não é limite
máximo de histórico acumulado.

LEITURA PONTUAL DA CENTRAL DO VENDEDOR (EXPERIMENTAL)
-----------------------------------------------------
1. Acesse manualmente a Central do Vendedor:
   https://seller.shopee.com.br/
2. Navegue por conta própria até a página de avaliações.
3. Deixe na tela os cartões que deseja analisar.
4. Clique no ícone da extensão > "Analisar avaliações desta página".
5. Leia o diagnóstico (cartões reconhecidos, nota incerta, ID ausente).
6. Abra o painel para analisar tudo ANTES de copiar respostas.

A leitura só tenta extrair cartões VÍSIVEIS da aba ativa e depende do HTML da
Shopee. NÃO foi validada em uma conta real. Se o layout não for reconhecido,
nada é importado; use importação manual até adaptar os seletores com base
em capturas de tela/estrutura disponibilizada voluntariamente pelo usuário.
Nenhum botão da Shopee é clicado, nenhuma avaliação é aberta automaticamente,
não há rolagem ou paginação automática.

PADRÕES ATIVOS
--------------
- Loja: Múltiplo Mix (ajustável)
- Preparação: ligada
- Apenas 5 estrelas: fixo
- Limite de 100 novos registros por operação
- Modo revisão: fixo
- Respostas editáveis e selecionadas em rotação estável com base no ID
- Histórico: últimos 500 eventos
- Sem integração/validacão de publicação, agendamento ou envio automático
- Armazenamento no próprio perfil de navegador (chrome.storage.local)
- Backup JSON por botão "Exportar backup"; esta versão não tem importação de backup.

PRIVACIDADE E LIMITAÇÕES
-----------------------
Sem comunicação com nossos servidores ou APIs de terceiros. Comentários,
produtos, IDs e textos importados são armazenados localmente no perfil Chrome;
proteja o perfil, os backups e o PC conforme suas práticas de privacidade.
Não salva credenciais. Não afirma que uma resposta foi enviada: a marcação de
conclusão depende da confirmação do operador.
Se o Chrome for removido ou os dados da extensão apagados, registros podem ser
perdidos. Use o backup para arquivo, observando que NÃO existe restauração
pelo painel nesta V1.

ATENÇÃO: Termos da Shopee restringem bots e softwares não autorizados.
Consulte https://help.shopee.com.br/portal/4/article/77113 antes de utilizar
qualquer automação na conta. A coleta pontual também deve respeitar as regras
aplicáveis. Solicite autorização/validação junto à Shopee antes de operar
integrações automatizadas.

ARQUIVOS
--------
extension/manifest.json    Manifest V3 sem permissão permanente de site
extension/popup.*         Janela do botão do Chrome
extension/dashboard.*     Painel local
extension/shared.js       Regras, armazenamento e deduplicação
extension/scanner.js      Leitura pontual DOM (somente execução por clique)
extension/styles.css      Estilos
extension/assets/         Ícones

tests/                    Testes locais do motor de dados

Para atualizar: substitua os arquivos na pasta fixa e clique em "Recarregar"
em chrome://extensions. O Chrome preserva os dados se o ID da extensão continuar
igual, mas como "Carregar sem compactação" pode gerar ID diferente se a pasta
mudar, evite mover ou recriar a pasta após começar a usar.
