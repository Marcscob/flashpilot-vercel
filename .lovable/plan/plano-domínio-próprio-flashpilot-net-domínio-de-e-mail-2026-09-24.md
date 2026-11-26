# Plano: Domínio próprio flashpilot.net + domínio de e-mail

## Objetivo
Registrar `flashpilot.net`, conectá-lo ao projeto como domínio primário e configurar o envio de e-mails transacionais (confirmação de cadastro, recuperação de senha, notificações) a partir de `noreply@flashpilot.net`.

## Estado atual
- Nenhum domínio próprio conectado; o app atende pelo endereço `flashpilot.lovable.app`.
- Nenhum domínio de e-mail configurado; os e-mails de autenticação hoje saem pelo remetente padrão do Lovable.
- `flashpilot.net` está disponível: US$ 12,30 no primeiro ano e US$ 12,30/ano na renovação.

## Decisões do usuário
- Comprar pelo Lovable (compra em Configurações → Domínios → Comprar novo domínio).
- Remetente: `noreply@flashpilot.net`.
- `flashpilot.net` será o domínio primário; `flashpilot.lovable.app` passa a redirecionar para ele.

## Etapas

### 1. Comprar o domínio (você)
Em **Configurações → Projeto → Domínios → Comprar novo domínio**, busque `flashpilot.net` e conclua a compra no checkout seguro. Ao comprar pelo Lovable:
- O domínio é conectado automaticamente ao projeto.
- Os registros DNS são gerenciados dentro do app (sem mexer em painel externo).
- O SSL (https) é emitido automaticamente.

Também adicione o `www.flashpilot.net` como entrada separada na mesma tela, para que o `www` também responda.

### 2. Definir flashpilot.net como primário
Após o domínio ficar **Ativo**, marcar `flashpilot.net` como **Primário** em Configurações → Domínios. Com isso:
- `flashpilot.net` vira o endereço oficial do app.
- `flashpilot.lovable.app` e `www.flashpilot.net` redirecionam para `flashpilot.net`.

### 3. Configurar o domínio de e-mail
Abrir o fluxo de configuração de domínio de e-mail e usar `flashpilot.net` como domínio remetente. O Lovable delega um subdomínio (ex.: `notify.flashpilot.net`) para os nameservers do Lovable, que passam a gerenciar SPF, DKIM e MX automaticamente — sem precisar adicionar registros manualmente, pois o domínio foi comprado pelo Lovable.
- Remetente: `noreply@flashpilot.net`.
- Status acompanha em **Cloud → Emails**; o envio começa assim que o DNS for verificado.

### 4. Instalar a infraestrutura de e-mail
Preparar a infraestrutura de envio (filas, cron, rota de processamento `/lovable/email/queue/process`, tabela de log e lista de supressão). Tudo é criado automaticamente pela ferramenta de infraestrutura; nada é construído manualmente no banco.

### 5. Pacotes e rotas do app
Garantir que os pacotes de e-mail estejam instalados (`@lovable.dev/email-js`, `@lovable.dev/webhooks-js`, `@react-email/components`, `@react-email/render`) e que o middleware e o roteador deixem as rotas `/lovable/*` passarem intactas. Essas rotas sobem com o publish do app.

### 6. Modelos de e-mail de autenticação com a marca
Gerar os modelos visuais dos e-mails de autenticação (confirmação de cadastro, magic link, recuperação de senha, convite, troca de e-mail, reautenticação) com a identidade do Flash Pilot — logo, cores âmbar/azul e tipografia. Publicar a função de hook de autenticação para que esses e-mails usem a fila e os modelos personalizados.

### 7. E-mails transacionais do app (opcional, recomendação)
Após o domínio verificado, gerar também os modelos de e-mail transacional para os avisos do app (confirmação de inscrição no blog, notificação de novo post, etc.). Hoje esses avisos dependem dessa infraestrutura para sair pelo seu domínio.

### 8. Caixa de entrada de contato (opcional, você decide)
O domínio de e-mail do Lovable é só para **enviar** (noreply@flashpilot.net). Para **receber** respostas e ter um endereço de contato real (ex.: contato@flashpilot.net), contrate um provedor de hospedagem de e-mail no mesmo domínio (Google Workspace, Zoho Mail — gratuito até 5 caixas —, Microsoft 365). Os dois convivem sem conflito:
- Lovable gerencia envio (SPF/DKIM num subdomínio delegado).
- O provedor de hospedagem gerencia recepção (registros MX apontando para ele).
Ao configurar o MX no provedor, o Lovable continua enviando normalmente. Posso orientar os registros MX quando você escolher o provedor.

### 8. Ajustar referências no app
- Atualizar `og:url`/canonical e links internos do blog para `flashpilot.net` onde fizer sentido.
- Manter `contato.flashpilot@gmail.com` no rodapé (contato humano permanece no Gmail, conforme decisão anterior).

### 9. Verificação final
- Acessar `https://flashpilot.net` e confirmar que o app carrega com SSL.
- Confirmar que `flashpilot.lovable.app` redireciona para `flashpilot.net`.
- Disparar um e-mail de teste (ex.: recuperação de senha) e confirmar que chega de `noreply@flashpilot.net`.
- Conferir em **Cloud → Emails** que o status do domínio fica ativo e o envio está saudável.

## Fluxo resumido

```text
[Compra flashpilot.net no Lovable]
        |
        v  (auto-conecta + SSL)
[Domínio Ativo] -> [Definir como Primário]
        |
        v
[Configurar domínio de e-mail: flashpilot.net / noreply@]
        |
        v  (DNS delegado ao Lovable)
[Infraestrutura de e-mail: filas + cron + rota /lovable/*]
        |
        v
[Modelos de auth com a marca + hook publicado]
        |
        v
[Modelos transacionais do app]
        |
        v
[Verificação: https://flashpilot.net + e-mail de teste]
```

## Observações
- A compra e a configuração do domínio exigem plano pago do Lovable.
- A propagação/verificação de DNS pode levar até 72h; o SSL e o envio de e-mail ativam automaticamente após a verificação.
- O valor do domínio (US$ 12,30/ano) é cobrado no checkout do Lovable, separado dos créditos de uso do app.
- Nenhuma mudança de código que afete o comportamento do app para os usuários atuais; o app continua funcionando em `flashpilot.lovable.app` até o redirecionamento entrar em vigor.

## O que precisa de você (HITL) e o que eu executo
- **Você:** comprar `flashpilot.net` e `www.flashpilot.net` no Lovable; marcar como primário quando Ativo; confirmar a compra no cartão.
- **Eu:** configurar o domínio de e-mail, instalar a infraestrutura, pacotes e rotas, gerar os modelos de e-mail com a marca, ajustar referências e validar tudo no navegador e por e-mail de teste.
