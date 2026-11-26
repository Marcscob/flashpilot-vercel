# Blog multilíngue do FlashPilot

Um blog público, bonito e nos 7 idiomas do app (pt-BR, pt-PT, en, es, fr, it, de), com cadastro para receber novos posts, comentários, notas, vídeos, links e ícones das redes sociais. Tudo o que acontecer no blog chega com cópia para contato.flashpilot@gmail.com.

## O que o visitante vê
- **Página inicial do blog (/blog)**: no topo, a logo transparente da tela inicial do app. Logo abaixo, o post em destaque com imagem grande, depois uma grade de cards com capa, título, resumo, data, tempo de leitura e nota média. Tem busca, filtro por categoria e paginação.
- **Página do post (/blog/nome-do-post)**: capa grande, texto formatado, vídeos do YouTube/Vimeo embutidos, links, imagens, botões de compartilhar, estrelas de 1 a 5, comentários e posts relacionados.
- **Barra de redes sociais** no topo e no rodapé do blog, cada ícone abrindo em nova aba:
  - Instagram: instagram.com/flashpilotapp
  - TikTok: tiktok.com/@flashpilot_admin
  - Facebook: facebook.com/profile.php?id=61594455175086
  - Pinterest: pinterest.com/contatoflashpilot
  - X: x.com/flashpilot_admi
  - LinkedIn: linkedin.com/in/mark-benson-965303436/
- **Caixa "Receba novos posts"**: nome, e-mail e idioma preferido, com confirmação por e-mail (dupla confirmação, conforme a LGPD) e link para cancelar em todo e-mail.
- **Visual**: segue a identidade do FlashPilot (tons creme, títulos em serifa), tem modo claro e escuro, animações suaves ao rolar, capas com cantos arredondados e leitura confortável no celular e no computador. O blog também tem um link para "Conhecer o app".

## Idiomas
- Toda a interface do blog (menus, botões, avisos, formulários, datas, telas vazias e títulos da aba) segue o idioma escolhido, com a mesma detecção automática por país usada no app.
- Cada post tem uma versão para cada um dos 7 idiomas. Você escreve em português, e o botão "Traduzir com IA" preenche as outras 6 versões para você revisar antes de publicar. Se faltar alguma versão, o leitor vê o post no idioma original, com um aviso.
- O endereço do post muda conforme o idioma (ex.: /blog/en/...), o que ajuda o Google a encontrar cada versão.

## Comentários e avaliações
- Para comentar e dar nota, o leitor precisa ter conta no FlashPilot (é grátis). Isso diminui spam e aproxima o leitor do app.
- Cada pessoa dá uma nota por post e pode mudá-la depois. O post mostra a média e o total de avaliações.
- Os comentários aparecem na hora. Você pode ocultar ou apagar qualquer um pelo painel.

## Cópia para o seu e-mail
Você recebe um e-mail em contato.flashpilot@gmail.com sempre que houver:
- novo comentário (com o texto, autor e link do post);
- nova avaliação;
- novo inscrito ou cancelamento;
- post publicado, com o resumo do envio aos inscritos.

## Painel do blog (só você)
Fica dentro do Painel de administração. Você pode criar um post de duas formas:

1. **Manual**: escrever com o editor que o app já usa (títulos, negrito, listas, imagens, vídeos e links), abas por idioma, capa, categoria, destaque, rascunho, agendamento e publicação.
2. **Com IA**: você digita o assunto e a IA faz o resto — texto atraente e cativante em português, tradução automática para os outros 6 idiomas, e uma bela imagem de capa relacionada ao assunto. Depois você revisa, ajusta e publica. O botão "Gerar com IA" chama o modelo de texto `google/gemini-3.1-flash-lite` (o mais barato do Lovable AI para textos) e o modelo de imagem `lovable/image-fast` (o mais barato para imagens), ambos sem precisar de chave extra — o custo sai dos créditos do plano.

O painel também lista inscritos, comentários e notas. Ao publicar um post, os inscritos recebem o aviso no idioma que escolheram.

## Etapas
1. Banco de dados: posts, traduções, categorias, inscritos, comentários, avaliações e as regras de acesso.
2. Envio de e-mails pelo domínio do FlashPilot: confirmação de inscrição, aviso de novo post e cópias para você.
3. Páginas públicas do blog: lista, post, redes sociais, inscrição e visual.
4. Comentários e avaliações.
5. Painel do blog com tradução por IA.
6. Textos da interface nos 7 idiomas e preparo para o Google (sitemap e links entre idiomas).
7. Verificação em francês e alemão, no computador e no celular: inscrição, comentário, nota, vídeo embutido e chegada das cópias no seu e-mail.

## Orçamento e custos (você tem 13 créditos)
- **Construção (meu trabalho agora)**: o build do blog consome créditos de construção a cada interação. Com 13 créditos, dá para construir o blog se formos diretos e evitarmos muitas revisões. Se os créditos acabarem no meio, o trabalho para e você pode recarregar para continuar.
- **Custo por post gerado por IA (no app, depois de pronto)**: com `google/gemini-3.1-flash-lite` (texto) + `lovable/image-fast` (imagem), cada post sai por uma fração de crédito — bem barato. Você consegue dezenas de posts com 13 créditos.
- **Recomendação**: para economizar na construção, me peça para construir direto sem muitas voltas. Se preferir, posso fazer em etapas (banco + páginas primeiro, IA depois) para você controlar o gasto.

## Pendências suas
- Para enviar os e-mails, é preciso configurar um domínio de envio. Eu abro essa configuração quando chegar nessa etapa.

## Detalhes técnicos
- Tabelas: `blog_posts` (slug, capa, categoria, status, published_at, featured, author_id), `blog_post_translations` (post_id, lang, title, excerpt, body_html, seo), `blog_categories` e as traduções delas, `blog_subscribers` (email, lang, confirmed_at, token), `blog_comments` (user_id, post_id, body, hidden) e `blog_ratings` (user_id, post_id, stars 1–5, único por usuário/post). Cada tabela recebe GRANTs + RLS: leitura pública (anon) só de posts publicados e comentários visíveis; escrita de comentário/nota só pelo próprio `auth.uid()`; administração via `has_role(auth.uid(),'admin')`.
- As rotas `/blog`, `/blog/$slug` e `/blog/$lang/$slug` são públicas com SSR e loaders para SEO. Cada uma tem `head()` com og:image da capa (URL absoluta do storage) e hreflang. O painel fica em `/_authenticated/admin/blog`.
- Os HTMLs são sanitizados com `sanitize-html.ts`. Os vídeos passam por uma lista de hosts permitidos (YouTube e Vimeo).
- E-mails transacionais pela infraestrutura de e-mail do Lovable Cloud, com fila, descadastro e cópias para `CONTACT_EMAIL`.
- A tradução e a geração de texto por IA usam o Lovable AI Gateway por server fn protegida por admin, no modelo `google/gemini-3.1-flash-lite` (menor custo). A imagem de capa gerada por IA usa `lovable/image-fast` via rota de servidor. Ambos rodam só no painel, só para admin.
- Os textos da interface ficam no catálogo i18n existente (`i18n-ui.ts`), nas 7 colunas.
- Os ícones das redes ficam num arquivo de configuração (`social-links.ts`) com os 6 links completos.
- A trava anticópia do app não se aplica ao blog público, onde compartilhar é desejável.
