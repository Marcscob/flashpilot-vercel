# Idioma automático pelo país do usuário

## Resultado da verificação

Testei o app com navegadores configurados em cinco países. A adaptação automática **já funciona**:

| Navegador | Interface exibida |
|---|---|
| Estados Unidos (en-US) | Inglês |
| México (es-MX) | Espanhol |
| Portugal (pt-PT) | Português de Portugal |
| Alemanha (de-DE) | Alemão |
| Canadá francês (fr-CA) | Francês |

A escolha manual no menu continua valendo e fica guardada para as próximas visitas.

Encontrei três pontos a corrigir:

1. **Piscada em português.** A primeira tela é montada em português e só troca para o idioma do usuário uma fração de segundo depois. Um visitante estrangeiro vê um flash de português.
2. **Idiomas não oferecidos caem em português.** Quem entra com navegador em japonês, holandês, sueco etc. recebe português do Brasil. O esperado nesses casos é inglês.
3. **Outros países de língua portuguesa.** Angola, Moçambique e Portugal com etiqueta genérica "pt" recebem a versão do Brasil; deveriam receber a variante europeia.

## O que vou fazer

- Detectar o idioma antes da primeira pintura da tela, sem piscada em português, mantendo a escolha salva com prioridade.
- Usar inglês como idioma padrão quando o idioma do visitante não é um dos sete oferecidos; português continua padrão para visitantes de língua portuguesa.
- Reconhecer as variantes de português por região (Portugal, Angola, Moçambique e outras africanas → português europeu; Brasil → português do Brasil).
- Repetir o teste com navegadores de vários países e conferir que o texto já aparece correto no primeiro instante.

## Detalhes técnicos

- `src/lib/i18n.tsx`: `LanguageProvider` inicia em `"pt"` e só chama `detectLang()` num `useEffect`, causando o flash. Passar a resolver o idioma de forma síncrona no cliente (script inline no `__root` gravando o resultado, ou inicializador lido via `useHydrated`/pré-hidratação) e aplicar `document.documentElement.lang` no mesmo momento.
- `matchBrowserLang()`: adicionar mapa de região para `pt` (`pt-BR` → `pt`; `pt-PT/AO/MZ/CV/GW/ST/TL` → `pt-PT`) e trocar o fallback final de `"pt"` para `"en"` quando nenhuma etiqueta bater.
- Sem mudança de banco, de textos dos dicionários ou de conteúdo oficial.
