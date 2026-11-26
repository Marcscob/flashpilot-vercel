# Cadastro completo, Minha conta editável e idioma ligado à conta

Três ajustes pedidos: o idioma não seguiu o país do usuário brasileiro, a tela Minha conta não permite editar dados, e o cadastro pede apenas e-mail e senha.

## 1. Idioma da conta

Hoje o idioma é decidido assim: se existir uma escolha guardada no aparelho (navegador), ela vence; só depois vem o idioma do navegador. Como o navegador de teste já tinha uma escolha em inglês guardada de testes anteriores, o usuário brasileiro entrou e viu a interface em inglês. Isso é a explicação mais provável — confirmo no navegador antes de mexer.

O que passa a valer:

- O idioma escolhido fica guardado no perfil do usuário e acompanha a conta em qualquer aparelho.
- Ao entrar, o app aplica o idioma do perfil. Se o perfil ainda não tem idioma, usa o país do navegador (pt-BR → português do Brasil) e grava essa escolha no perfil.
- Só considero "escolha guardada no aparelho" quando a pessoa realmente trocou o idioma no menu; detecções automáticas antigas deixam de travar o idioma.
- Trocar o idioma no menu salva no perfil na hora.

## 2. Minha conta editável

Nova seção "Meus dados" no topo da tela, com:

- Nome (obrigatório)
- Telefone com seletor de país e prefixo (+55, +1, +351, …), opcional; país sugerido pelo idioma/região detectada
- E-mail: alterar dispara e-mail de confirmação no endereço novo; a troca só vale depois de confirmado
- Senha: senha atual + nova senha + repetir
- Botão Salvar com avisos de sucesso/erro, tudo nos sete idiomas

As seções atuais (assinatura, FlashCoins, consumo, pacotes, extrato) continuam como estão.

## 3. Cadastro de novo usuário

Na tela de entrada, modo "Criar conta" passa a pedir:

- Nome (obrigatório)
- E-mail (obrigatório)
- Senha (obrigatório)
- Telefone (opcional) com seletor de país e prefixo já preenchido pelo país detectado
- Aceite de termos (como já é hoje)

Os dados vão para o perfil no momento do cadastro. Quem entra pelo Google e ainda não tem nome preenchido é levado a completar em Minha conta.

## 4. Filtros por país na Loja (Pacotes de matérias)

Acima da grade de "Pacotes de matérias", dois seletores:

1. "Escolha o seu país" — lista de países traduzida nos 7 idiomas, com bandeira; começa no país detectado.
2. Matéria — mostra apenas as matérias no idioma daquele país (ex.: Brasil → matérias em português do Brasil; Estados Unidos → "Biology EN", "Inglês - Gramática"; Espanha/México → "Biología ES", "Espanhol").

A grade abaixo passa a mostrar só os pacotes que combinam com os filtros; com "Todas" no segundo seletor, aparecem todas as matérias daquele país. Matérias sem idioma definido (as jurídicas em português) entram como português do Brasil.

## Detalhes técnicos

- Migração em `public.profiles`: `full_name text`, `phone text`, `phone_country text`, `ui_lang text` (aceita apenas os 7 idiomas). Grants e RLS já existentes cobrem o dono; policies de UPDATE já permitem `auth.uid() = user_id`.
- Novo `src/lib/countries.ts`: lista ISO2 + dial code + bandeira; `defaultCountryForLang()`.
- Novo `src/components/PhoneField.tsx`: Select de país + Input do número; valor persistido como E.164 (`+55...`) mais `phone_country`.
- `src/lib/profile.functions.ts`: `getMyProfile` / `updateMyProfile` (zod: nome 2–120, telefone só dígitos, país ISO2, idioma em `ALL_LANGS`) com `requireSupabaseAuth`.
- `src/lib/i18n.tsx`: `detectLang()` passa a distinguir escolha manual (`fp_lang_manual`) de detecção; `LanguageProvider` recebe `profileLang` e aplica quando existir; `setLang` grava no perfil (best-effort) além de localStorage/cookie. `lang.functions.ts`/`__root.tsx` seguem resolvendo o SSR por cookie/Accept-Language.
- `src/routes/auth.tsx`: campos novos no signup; `signUp` com `options.data = { full_name, phone }` e upsert em `profiles` (nome, telefone, país, idioma atual) junto ao aceite de termos.
- `src/routes/_authenticated/account.tsx`: formulário "Meus dados"; e-mail via `supabase.auth.updateUser({ email })`; senha via `updateUser({ password, current_password })`.
- Textos novos em `src/lib/i18n-commerce.ts` (grupos `account`/`authExtra`) nos 7 idiomas; `npx tsgo --noEmit` limpo.
- Validação no navegador: navegador com locale `pt-BR` entrando com usuário de teste deve abrir em português; salvar nome/telefone e ler de volta; cadastro novo com telefone opcional.
- Loja: `storeOverview` passa a devolver `subjectLanguage` de cada pacote (join em `subjects.language`, `null` → `pt-BR`); `store.tsx` ganha estado de país + matéria e filtra `packs`; rótulos dos países e dos seletores em `src/lib/i18n-commerce.ts` (7 idiomas), reutilizando `src/lib/countries.ts` com o mapa país → idioma.
