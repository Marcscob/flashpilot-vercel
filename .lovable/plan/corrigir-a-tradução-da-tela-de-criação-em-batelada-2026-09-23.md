# Corrigir a tradução da tela de criação em Batelada

## Diagnóstico confirmado

- A tela de Batelada ainda contém muitos textos fixos em português: títulos, descrições, opções dos seletores, avisos, botões, placeholders e mensagens de sucesso/erro.
- A tradução atual depende parcialmente de uma varredura automática da tela. Ela só traduz frases cadastradas por correspondência exata; textos dinâmicos, frases compostas e várias opções de seleção não estão cobertos.
- Os elementos auxiliares usados nessa tela — vínculo de anotações, links de vídeos e corte de imagens — também mantêm textos fixos.

## Implementação

1. Criar um conjunto próprio e completo de traduções para Batelada nos sete idiomas: pt-BR, pt-PT, inglês, espanhol, italiano, francês e alemão.
2. Substituir todos os textos fixos da tela por traduções reativas ao idioma atual, incluindo:
   - matéria, assunto e tópico, com todas as opções e estados dos seletores;
   - anexos, categorias, anotações, imagens e vídeos;
   - geração por texto, fotos e importação CSV;
   - linhas de pergunta e resposta, contadores e avisos de itens não salvos;
   - botões, carregamentos, limites do plano, mensagens de sucesso, erro e alternativas da IA.
3. Traduzir integralmente os três elementos auxiliares exibidos pela Batelada: seletor/criação de anotação, links de vídeo e janela de corte da imagem.
4. Garantir que textos com números e variáveis sejam montados pelo dicionário, sem depender da varredura automática ou de correspondência literal.
5. Fazer a troca de idioma atualizar imediatamente a tela aberta e também conteúdos condicionais, menus suspensos e janelas abertas, sem recarregar a página.

## Validação

- Abrir a Batelada autenticada e alternar sucessivamente entre os sete idiomas.
- Abrir cada seletor e cada área opcional, incluindo criação de matéria/assunto/tópico, anexos, nova anotação, nova categoria, vídeos e corte de imagem.
- Exercitar mensagens dinâmicas: adicionar linhas, importar CSV, anexar fotos, gerar por IA e criar flashcards.
- Verificar em celular e computador que não restou texto da interface no idioma anterior e que textos maiores não se sobrepõem.
- Confirmar que o aplicativo continua compilando sem erros.
