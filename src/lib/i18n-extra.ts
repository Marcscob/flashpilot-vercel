/**
 * Textos adicionais da interface (menu, rodapé, cookies, selos e páginas legais),
 * traduzidos nos 7 idiomas suportados. Mesclados aos dicionários principais em i18n.tsx.
 */

export type LegalSection = { h: string; p?: string; ul?: string[] };
export type LegalContact = { email: string; whatsapp: string };

export type ExtraDict = {
  shell: {
    mindmaps: string;
    chat: string;
    store: string;
    account: string;
    admin: string;
    flashSession: string;
    menu: string;
    settingsMenu: string;
    resetReviews: string;
    resetTitle: string;
    resetDesc: string;
    resetDone: string;
    resetDoneDesc: string;
    resetFail: string;
    resetFailHint: string;
    contact: string;
    terms: string;
    privacy: string;
    brandAria: string;
    blog: string;
  };
  trust: { secureConnection: string; securePurchase: string; dataProtected: string };
  cookies: { text: string; accept: string; privacyLink: string };
  legal: {
    back: string;
    updatedAt: string;
    terms: {
      title: string;
      metaTitle: string;
      metaDesc: string;
      seeAlso: string;
      sections: (c: LegalContact) => LegalSection[];
    };
    privacy: {
      title: string;
      metaTitle: string;
      metaDesc: string;
      seeAlso: string;
      sections: (c: LegalContact) => LegalSection[];
    };
  };
};

/* ─────────────────────────── Português (Brasil) ─────────────────────────── */
export const extraPt: ExtraDict = {
  shell: {
    mindmaps: "Mapas mentais",
    chat: "Conversação",
    store: "Loja",
    account: "Minha conta",
    admin: "Painel",
    flashSession: "Flash Session",
    menu: "Menu",
    settingsMenu: "Configurações",
    resetReviews: "Zerar revisões",
    resetTitle: "Zerar todas as revisões?",
    resetDesc:
      "Todos os seus flashcards voltam a vencer hoje, com o histórico de revisões apagado. Os cards e as anotações não são excluídos. Esta ação não pode ser desfeita.",
    resetDone: "Revisões zeradas",
    resetDoneDesc: "Todos os cards voltaram para o início.",
    resetFail: "Não foi possível zerar",
    blog: "Blog",
    resetFailHint: "Tente novamente.",
    contact: "Fale conosco",
    terms: "Termos de Uso",
    privacy: "Política de Privacidade",
    brandAria: "FlashPilot — início",
  },
  trust: { secureConnection: "Conexão segura", securePurchase: "Compra Segura", dataProtected: "Dados protegidos (LGPD)" },
  cookies: {
    text:
      "Usamos apenas cookies essenciais para manter você conectado e guardar suas preferências de estudo. Sem rastreamento e sem publicidade. Veja a",
    accept: "Entendi",
    privacyLink: "Política de Privacidade",
  },
  legal: {
    back: "Voltar",
    updatedAt: "Última atualização: setembro de 2026",
    terms: {
      title: "Termos de Uso",
      metaTitle: "Termos de Uso | FlashPilot",
      metaDesc: "Regras de uso do FlashPilot: conta, assinatura, FlashCoins, conteúdo, pagamentos e cancelamento.",
      seeAlso: "Veja também a Política de Privacidade.",
      sections: (c) => [
        {
          h: "1. O que é o FlashPilot",
          p: "O FlashPilot é um aplicativo de estudo com flashcards, revisão espaçada, anotações, mapas mentais, leitura em voz, ditado e recursos do PilotAI. Ao criar uma conta, você concorda com estes Termos.",
        },
        {
          h: "2. Recursos disponíveis",
          p: "O aplicativo oferece, conforme o plano e os limites da sua conta:",
          ul: [
            "Flashcards com revisão espaçada pelo algoritmo SM-2, em três formatos: pergunta e resposta, múltipla escolha com alternativas em coluna e completar lacunas. No verso, além da resposta, constam a explicação e a transcrição integral da fonte.",
            "Leitura em voz alta dos cards e treino de pronúncia com pontuação de precisão e histórico de evolução.",
            "Criação de flashcards com o PilotAI, a partir de texto digitado, arquivos em PDF, DOCX e TXT, fotos tiradas pela câmera ou webcam, imagens enviadas ou coladas (com recorte, ajuste da área útil e rotação) e ditado por voz.",
            "Caderno de anotações organizado por categorias, formatação avançada de anotações longas com o PilotAI e geração de mapas mentais.",
            "Tutor de conversação com o PilotAI, incluindo prática oral com entrada por voz e resposta falada, para dúvidas, exemplos e estudo de idiomas.",
            "Organização do conteúdo em matérias, assuntos e cadernos, além de acesso a matérias oficiais prontas adquiridas na Loja.",
            "Estatísticas de desempenho, retenção e sequência de estudo, exportação de dados e relatórios em PDF, CSV e Excel, e lembretes de revisão pelo Telegram.",
            "Aplicativo instalável no computador e no celular, com interface disponível em vários idiomas.",
          ],
        },
        {
          h: "3. Conta",
          ul: [
            "Você precisa ter 16 anos ou mais (ou autorização do responsável legal).",
            "Os dados de cadastro devem ser verdadeiros e a senha é pessoal e intransferível.",
            "Uma conta é de uso individual. Compartilhar acesso pode levar à suspensão.",
          ],
        },
        {
          h: "4. Conteúdo do usuário, responsabilidade exclusiva e remoção de material ilícito",
          p: "Os flashcards, anotações, imagens, documentos e áudios criados, digitados, ditados ou enviados pelo usuário permanecem sob a titularidade do próprio usuário. O FlashPilot recebe unicamente a licença técnica necessária para armazenar, exibir e processar esse conteúdo enquanto o serviço for utilizado. A responsabilidade pela veracidade, pela licitude e pelos direitos envolvidos em todo o conteúdo criado, enviado ou armazenado, incluindo direitos autorais, proteção de dados pessoais e demais normas aplicáveis, é integral e exclusiva do usuário, que declara possuir os direitos necessários sobre o material que envia. A veiculação ou o armazenamento, por meio do serviço, de conteúdo que viole normas internacionais ou a legislação de qualquer país ao qual pertençam os usuários poderá resultar na remoção imediata do conteúdo, sem prejuízo das demais medidas previstas nestes Termos e na lei aplicável.",
        },
        {
          h: "5. Conteúdo oficial, pacotes e proteção contra cópia",
          p: "O conteúdo oficial publicado pelo FlashPilot é somente leitura: pode ser estudado, mas não editado, copiado, exportado como base própria nem redistribuído. O acesso a pacotes e matérias adquiridos vale pelo prazo indicado na compra (em regra, 365 dias) e é pessoal. Para proteger direitos autorais, o aplicativo desativa a seleção de texto, a cópia, o recorte, o arraste e o menu de contexto em todas as telas; tentar remover ou burlar essa proteção é violação destes Termos.",
        },
        {
          h: "6. Teste gratuito",
          p: "Contas novas recebem, uma única vez e sem cartão de crédito, um kit de boas-vindas para conhecer os recursos do PilotAI:",
          ul: [
            "40 FlashCoins, suficientes para gerar até 40 flashcards com o PilotAI (1 FlashCoin por card salvo).",
            "2 mapas mentais, 3 formatações de anotações e 15 turnos de conversa com o tutor.",
            "Acervo de até 100 flashcards na conta gratuita, somando os criados manualmente, importados e gerados com o PilotAI.",
            "Limites por envio na conta gratuita: até 10 páginas de documento e até 8 fotos ou imagens.",
            "Os flashcards já gerados continuam acessíveis mesmo quando o saldo chega a zero.",
            "O kit é concedido uma vez por conta, exige e-mail confirmado e pode ser recusado quando identificamos criação de várias contas pela mesma pessoa ou dispositivo.",
          ],
        },
        {
          h: "7. Assinatura, FlashCoins e pagamentos",
          ul: [
            "A assinatura Pro é cobrada em dólar (US$), no plano mensal ou anual escolhido, com renovação automática até o cancelamento. O plano anual tem desconto em relação ao mensal.",
            "Sem assinatura, o uso segue limitado ao teste gratuito disponível na sua conta.",
            "As FlashCoins são créditos internos para ações do PilotAI e também podem ser compradas em pacotes avulsos. Cada ação consome uma quantidade informada no aplicativo.",
            "FlashCoins não são dinheiro, não rendem juros, não são resgatáveis em espécie nem transferíveis entre contas.",
            "FlashCoins compradas são válidas por 12 meses a partir da data da compra; o saldo não usado nesse prazo expira automaticamente, sem reembolso. As FlashCoins do Kit de Boas-Vindas seguem a mesma regra.",
            "Para garantir a estabilidade do serviço, os planos pagos têm limites de uso justo por ciclo de faturamento, informados no aplicativo.",
            "Os pagamentos são processados pelo Paddle, que atua como revendedor oficial (Merchant of Record) e responde pela cobrança, pelos impostos e pela segurança da transação, seguindo os padrões PCI DSS, SOC 2 e GDPR, com autenticação forte (SCA/PSD2). Os dados do cartão não passam por nós.",
          ],
        },
        {
          h: "8. Cancelamento e reembolso",
          p: `Você pode cancelar a assinatura quando quiser; o acesso segue até o fim do período já pago, sem novas cobranças. Conforme o Código de Defesa do Consumidor, compras feitas pela internet podem ser desistidas em até 7 dias corridos, desde que os créditos ou o pacote não tenham sido usados de forma relevante. Peça pelo ${c.email}.`,
        },
        {
          h: "9. Uso adequado",
          p: "É proibido:",
          ul: [
            "copiar, raspar, extrair em massa ou redistribuir conteúdo do aplicativo;",
            "tentar burlar limites, cobranças, saldos de FlashCoins ou controles de acesso;",
            "usar o serviço para conteúdo ilegal, ofensivo ou que viole direitos de terceiros;",
            "automatizar acessos, sobrecarregar o sistema ou testar a segurança sem autorização.",
          ],
        },
        {
          h: "10. PilotAI",
          p: "As respostas geradas pelo PilotAI são apoio ao estudo e podem conter erros. Elas não substituem orientação profissional, jurídica, médica ou acadêmica. Confira sempre o conteúdo crítico.",
        },
        {
          h: "11. Disponibilidade e mudanças",
          p: "Buscamos manter o serviço disponível, mas pode haver interrupções para manutenção ou por falhas de terceiros. Recursos podem ser melhorados, alterados ou descontinuados; mudanças que afetem o que você pagou serão avisadas com antecedência razoável.",
        },
        {
          h: "12. Encerramento",
          p: "Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes Termos, comunicando o motivo quando possível.",
        },
        {
          h: "13. Limite de responsabilidade",
          p: "O FlashPilot não responde por perdas indiretas nem por resultados de provas, concursos ou avaliações. Mantenha cópias do que for essencial para você.",
        },
        {
          h: "14. Lei aplicável e contato",
          p: `Estes Termos seguem a lei brasileira. Dúvidas e pedidos: ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Política de Privacidade",
      metaTitle: "Política de Privacidade | FlashPilot",
      metaDesc: "Como o FlashPilot coleta, usa, armazena e protege seus dados pessoais, conforme a LGPD.",
      seeAlso: "Veja também os Termos de Uso.",
      sections: (c) => [
        {
          h: "1. Quem é o responsável pelos seus dados",
          p: `O FlashPilot é operado por Marcelo Guimarães. Para qualquer assunto sobre privacidade, fale com o encarregado pelo tratamento de dados: ${c.email}.`,
        },
        {
          h: "2. Quais dados coletamos",
          ul: [
            "Cadastro: e-mail e senha (a senha é guardada de forma cifrada e nunca fica visível para nós).",
            "Conteúdo de estudo: matérias, assuntos, flashcards, anotações, mapas mentais, imagens e áudios que você cria ou envia.",
            "Uso do estudo: datas de revisão, notas de desempenho, histórico de sessões e estatísticas.",
            "Recursos do PilotAI: o texto enviado a cada ação (conversa, tradução, formatação, mapas, leitura em voz) e o consumo de FlashCoins.",
            "Compras: identificador da transação, produto, valor, moeda e validade do acesso. Os dados do cartão são tratados apenas pelo processador de pagamento.",
            "Voz: quando você usa o ditado, o áudio é enviado para transcrição e não é mantido depois da transcrição.",
          ],
        },
        {
          h: "3. Para que usamos os dados",
          ul: [
            "Criar sua conta, autenticar o acesso e manter seu conteúdo salvo (execução do contrato).",
            "Calcular as revisões, os relatórios e o progresso do estudo.",
            "Processar compras, assinaturas, saldo de FlashCoins e validade dos pacotes.",
            "Enviar lembretes de revisão, quando você ativar essa opção.",
            "Prevenir fraude, abuso e uso indevido do serviço (legítimo interesse).",
            "Cumprir obrigações legais, fiscais e regulatórias.",
          ],
        },
        {
          h: "4. Com quem compartilhamos",
          p: "Compartilhamos apenas o necessário para o serviço funcionar, com operadores contratados: infraestrutura de nuvem, provedores do PilotAI, processador de pagamento e, se você ativar, o serviço de mensagens para lembretes. Não vendemos seus dados e não usamos seu conteúdo para publicidade.",
        },
        {
          h: "5. Transferência internacional",
          p: "Alguns desses operadores mantêm servidores fora do Brasil. Nesses casos, a transferência ocorre com as garantias exigidas pela LGPD, limitada às finalidades desta política.",
        },
        {
          h: "6. Por quanto tempo guardamos",
          p: "Mantemos seus dados enquanto sua conta existir. Se você pedir a exclusão, apagamos o conteúdo e os dados de cadastro, preservando apenas os registros de compra e os dados exigidos por lei pelos prazos legais.",
        },
        {
          h: "7. Seus direitos",
          p: `A qualquer momento você pode pedir confirmação de tratamento, acesso, correção, portabilidade, anonimização, informação sobre compartilhamentos, revogação do consentimento e exclusão dos seus dados. Basta escrever para ${c.email}; respondemos em até 15 dias.`,
        },
        {
          h: "8. Segurança",
          p: "Usamos conexão cifrada, senhas com hash, isolamento de dados por usuário e controle de permissões no banco de dados. Nenhum sistema é infalível, mas comunicaremos você e a ANPD em caso de incidente relevante.",
        },
        {
          h: "9. Cookies e armazenamento local",
          p: "Usamos apenas cookies e armazenamento local essenciais: manter você conectado, guardar o idioma, o tema e preferências de estudo, além do registro do seu aceite deste aviso. Não usamos cookies de publicidade nem de rastreamento entre sites.",
        },
        {
          h: "10. Menores de idade",
          p: "O FlashPilot é destinado a maiores de 16 anos. Menores de 16 anos só podem usar o serviço com consentimento específico de um dos pais ou responsável legal.",
        },
        {
          h: "11. Mudanças nesta política",
          p: "Se esta política mudar, publicaremos a nova versão nesta página com a data de atualização. Mudanças relevantes serão avisadas dentro do aplicativo.",
        },
      ],
    },
  },
};

/* ─────────────────────────── Português (Portugal) ─────────────────────────── */
export const extraPtPT: ExtraDict = {
  ...extraPt,
  shell: {
    ...extraPt.shell,
    account: "A minha conta",
    settingsMenu: "Definições",
    resetReviews: "Reiniciar revisões",
    resetTitle: "Reiniciar todas as revisões?",
    resetDesc:
      "Todos os seus flashcards voltam a vencer hoje, com o histórico de revisões apagado. Os cards e as anotações não são eliminados. Esta ação não pode ser anulada.",
    resetDone: "Revisões reiniciadas",
    resetFail: "Não foi possível reiniciar",
    contact: "Fale connosco",
  },
  cookies: {
    ...extraPt.cookies,
    text:
      "Usamos apenas cookies essenciais para o manter ligado e guardar as suas preferências de estudo. Sem rastreio e sem publicidade. Veja a",
  },
  legal: { ...extraPt.legal, back: "Retroceder" },
};

/* ─────────────────────────── Español ─────────────────────────── */
export const extraEs: ExtraDict = {
  shell: {
    mindmaps: "Mapas mentales",
    chat: "Conversación",
    store: "Tienda",
    account: "Mi cuenta",
    admin: "Panel",
    flashSession: "Flash Session",
    blog: "Blog",
    menu: "Menú",
    settingsMenu: "Ajustes",
    resetReviews: "Reiniciar repasos",
    resetTitle: "¿Reiniciar todos los repasos?",
    resetDesc:
      "Todas tus tarjetas vuelven a vencer hoy y se borra el historial de repasos. Las tarjetas y las notas no se eliminan. Esta acción no se puede deshacer.",
    resetDone: "Repasos reiniciados",
    resetDoneDesc: "Todas las tarjetas volvieron al inicio.",
    resetFail: "No se pudo reiniciar",
    resetFailHint: "Inténtalo de nuevo.",
    contact: "Contáctanos",
    terms: "Términos de Uso",
    privacy: "Política de Privacidad",
    brandAria: "FlashPilot — inicio",
  },
  trust: { secureConnection: "Conexión segura", securePurchase: "Compra segura", dataProtected: "Datos protegidos" },
  cookies: {
    text:
      "Solo usamos cookies esenciales para mantener tu sesión y guardar tus preferencias de estudio. Sin rastreo ni publicidad. Consulta la",
    accept: "Entendido",
    privacyLink: "Política de Privacidad",
  },
  legal: {
    back: "Volver",
    updatedAt: "Última actualización: septiembre de 2026",
    terms: {
      title: "Términos de Uso",
      metaTitle: "Términos de Uso | FlashPilot",
      metaDesc: "Reglas de uso de FlashPilot: cuenta, suscripción, FlashCoins, contenido, pagos y cancelación.",
      seeAlso: "Consulta también la Política de Privacidad.",
      sections: (c) => [
        {
          h: "1. Qué es FlashPilot",
          p: "FlashPilot es una aplicación de estudio con tarjetas, repetición espaciada, notas, mapas mentales, lectura en voz, dictado y funciones de PilotAI. Al crear una cuenta aceptas estos Términos.",
        },
        {
          h: "2. Funciones disponibles",
          p: "La aplicación ofrece, según el plan y los límites de tu cuenta:",
          ul: [
            "Tarjetas con repetición espaciada mediante el algoritmo SM-2, en tres formatos: pregunta y respuesta, opción múltiple con alternativas en columna y completar huecos. En el reverso, además de la respuesta, aparecen la explicación y la transcripción íntegra de la fuente.",
            "Lectura en voz alta de las tarjetas y práctica de pronunciación con puntuación de precisión e historial de evolución.",
            "Creación de flashcards con PilotAI, a partir de texto escrito, archivos PDF, DOCX y TXT, fotos tomadas con la cámara o la webcam, imágenes subidas o pegadas (con recorte, ajuste del área útil y rotación) y dictado por voz.",
            "Cuaderno de notas organizado por categorías, formato avanzado de notas largas con PilotAI y generación de mapas mentales.",
            "Tutor de conversación con PilotAI, con práctica oral por voz y respuesta hablada, para dudas, ejemplos y estudio de idiomas.",
            "Organización del contenido en materias, temas y cuadernos, además del acceso a materias oficiales adquiridas en la Tienda.",
            "Estadísticas de rendimiento, retención y racha de estudio, exportación de datos e informes en PDF, CSV y Excel, y recordatorios de repaso por Telegram.",
            "Aplicación instalable en el ordenador y en el móvil, con interfaz disponible en varios idiomas.",
          ],
        },
        {
          h: "3. Cuenta",
          ul: [
            "Debes tener 16 años o más (o autorización de tu representante legal).",
            "Los datos de registro deben ser verdaderos y la contraseña es personal e intransferible.",
            "La cuenta es de uso individual. Compartir el acceso puede provocar la suspensión.",
          ],
        },
        {
          h: "4. Contenido del usuario, responsabilidad exclusiva y eliminación de material ilícito",
          p: "Las tarjetas, notas, imágenes, documentos y audios creados, escritos, dictados o enviados por el usuario permanecen bajo la titularidad del propio usuario. FlashPilot recibe únicamente la licencia técnica necesaria para almacenar, mostrar y procesar ese contenido mientras se utilice el servicio. La responsabilidad por la veracidad, la licitud y los derechos implicados en todo el contenido creado, enviado o almacenado, incluidos los derechos de autor, la protección de datos personales y demás normas aplicables, es íntegra y exclusiva del usuario, quien declara poseer los derechos necesarios sobre el material que envía. La publicación o el almacenamiento, a través del servicio, de contenido que infrinja normas internacionales o la legislación de cualquier país al que pertenezcan los usuarios podrá dar lugar a la eliminación inmediata del contenido, sin perjuicio de las demás medidas previstas en estos Términos y en la ley aplicable.",
        },
        {
          h: "5. Contenido oficial, paquetes y protección contra copia",
          p: "El contenido oficial publicado por FlashPilot es de solo lectura: se puede estudiar, pero no editar, copiar, exportar como base propia ni redistribuir. El acceso a paquetes y materias adquiridas vale por el plazo indicado en la compra (por norma, 365 días) y es personal. Para proteger los derechos de autor, la aplicación desactiva la selección de texto, la copia, el corte, el arrastre y el menú contextual en todas las pantallas; intentar eludir esa protección infringe estos Términos.",
        },
        {
          h: "6. Prueba gratuita",
          p: "Las cuentas nuevas reciben, una sola vez y sin tarjeta de crédito, un kit de bienvenida para conocer las funciones de PilotAI:",
          ul: [
            "40 FlashCoins, suficientes para generar hasta 40 tarjetas con PilotAI (1 FlashCoin por tarjeta guardada).",
            "2 mapas mentales, 3 formateos de notas y 15 turnos de conversación con el tutor.",
            "Hasta 100 tarjetas en la cuenta gratuita, sumando las creadas manualmente, importadas y generadas con PilotAI.",
            "Límites por envío en la cuenta gratuita: hasta 10 páginas de documento y hasta 8 fotos o imágenes.",
            "Las tarjetas ya generadas siguen accesibles aunque el saldo llegue a cero.",
            "El kit se concede una vez por cuenta, exige correo confirmado y puede denegarse cuando detectamos la creación de varias cuentas por la misma persona o dispositivo.",
          ],
        },
        {
          h: "7. Suscripción, FlashCoins y pagos",
          ul: [
            "La suscripción Pro se cobra en dólares (US$), en el plan mensual o anual elegido, con renovación automática hasta la cancelación. El plan anual tiene descuento frente al mensual.",
            "Sin suscripción, el uso queda limitado a la prueba gratuita disponible en tu cuenta.",
            "Las FlashCoins son créditos internos para acciones de PilotAI y también pueden comprarse en paquetes sueltos. Cada acción consume la cantidad indicada en la aplicación.",
            "Las FlashCoins no son dinero, no generan intereses ni son canjeables o transferibles entre cuentas.",
            "Las FlashCoins compradas son válidas por 12 meses desde la fecha de compra; el saldo no usado en ese plazo caduca automáticamente, sin reembolso. Las FlashCoins del Kit de Bienvenida siguen la misma regla.",
            "Para garantizar la estabilidad del servicio, los planes pagados tienen límites de uso razonable por ciclo de facturación, indicados en la aplicación.",
            "Los pagos los procesa Paddle, que actúa como revendedor oficial (Merchant of Record) y responde por el cobro, los impuestos y la seguridad de la transacción, siguiendo los estándares PCI DSS, SOC 2 y GDPR, con autenticación reforzada (SCA/PSD2). Los datos de la tarjeta no pasan por nosotros.",
          ],
        },
        {
          h: "8. Cancelación y reembolso",
          p: `Puedes cancelar la suscripción cuando quieras; el acceso continúa hasta el final del período ya pagado, sin nuevos cargos. Las compras por internet pueden desistirse en un plazo de 7 días corridos, siempre que los créditos o el paquete no se hayan usado de forma relevante. Solicítalo en ${c.email}.`,
        },
        {
          h: "9. Uso adecuado",
          p: "Está prohibido:",
          ul: [
            "copiar, extraer en masa o redistribuir contenido de la aplicación;",
            "intentar eludir límites, cobros, saldos de FlashCoins o controles de acceso;",
            "usar el servicio para contenido ilegal, ofensivo o que viole derechos de terceros;",
            "automatizar accesos, sobrecargar el sistema o probar la seguridad sin autorización.",
          ],
        },
        {
          h: "10. PilotAI",
          p: "Las respuestas generadas por PilotAI son un apoyo al estudio y pueden contener errores. No sustituyen la orientación profesional, jurídica, médica o académica. Verifica siempre el contenido crítico.",
        },
        {
          h: "11. Disponibilidad y cambios",
          p: "Procuramos mantener el servicio disponible, pero puede haber interrupciones por mantenimiento o fallos de terceros. Las funciones pueden mejorarse, cambiarse o descontinuarse; los cambios que afecten lo que pagaste se avisarán con antelación razonable.",
        },
        {
          h: "12. Finalización",
          p: "Puedes cerrar tu cuenta en cualquier momento. Podemos suspender o cerrar cuentas que incumplan estos Términos, indicando el motivo cuando sea posible.",
        },
        {
          h: "13. Límite de responsabilidad",
          p: "FlashPilot no responde por pérdidas indirectas ni por resultados de exámenes u oposiciones. Guarda copias de lo que sea esencial para ti.",
        },
        {
          h: "14. Ley aplicable y contacto",
          p: `Estos Términos se rigen por la ley brasileña. Dudas y solicitudes: ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Política de Privacidad",
      metaTitle: "Política de Privacidad | FlashPilot",
      metaDesc: "Cómo FlashPilot recoge, usa, almacena y protege tus datos personales.",
      seeAlso: "Consulta también los Términos de Uso.",
      sections: (c) => [
        {
          h: "1. Responsable de tus datos",
          p: `FlashPilot es operado por Marcelo Guimarães. Para cualquier asunto de privacidad, escribe al responsable del tratamiento de datos: ${c.email}.`,
        },
        {
          h: "2. Qué datos recogemos",
          ul: [
            "Registro: correo y contraseña (la contraseña se guarda cifrada y nunca es visible para nosotros).",
            "Contenido de estudio: materias, temas, tarjetas, notas, mapas mentales, imágenes y audios que creas o envías.",
            "Uso del estudio: fechas de repaso, calificaciones, historial de sesiones y estadísticas.",
            "Funciones de PilotAI: el texto enviado en cada acción y el consumo de FlashCoins.",
            "Compras: identificador de la transacción, producto, importe, moneda y validez del acceso. Los datos de la tarjeta los trata solo el procesador de pago.",
            "Voz: al usar el dictado, el audio se envía para transcripción y no se conserva después.",
          ],
        },
        {
          h: "3. Para qué usamos los datos",
          ul: [
            "Crear tu cuenta, autenticar el acceso y mantener tu contenido guardado.",
            "Calcular los repasos, los informes y el progreso del estudio.",
            "Procesar compras, suscripciones, saldo de FlashCoins y validez de los paquetes.",
            "Enviar recordatorios de repaso cuando actives esa opción.",
            "Prevenir fraude, abuso y uso indebido del servicio.",
            "Cumplir obligaciones legales, fiscales y regulatorias.",
          ],
        },
        {
          h: "4. Con quién compartimos",
          p: "Compartimos solo lo necesario para que el servicio funcione, con proveedores contratados: infraestructura en la nube, proveedores de PilotAI, procesador de pago y, si lo activas, el servicio de mensajería para recordatorios. No vendemos tus datos ni usamos tu contenido para publicidad.",
        },
        {
          h: "5. Transferencia internacional",
          p: "Algunos de esos proveedores mantienen servidores fuera de tu país. En esos casos la transferencia se realiza con las garantías exigidas por la ley, limitada a las finalidades de esta política.",
        },
        {
          h: "6. Cuánto tiempo conservamos los datos",
          p: "Conservamos tus datos mientras exista tu cuenta. Si pides la eliminación, borramos el contenido y los datos de registro, preservando solo los registros de compra y los datos exigidos por ley durante los plazos legales.",
        },
        {
          h: "7. Tus derechos",
          p: `En cualquier momento puedes pedir confirmación del tratamiento, acceso, corrección, portabilidad, anonimización, información sobre cesiones, revocación del consentimiento y eliminación de tus datos. Escribe a ${c.email}; respondemos en un plazo de 15 días.`,
        },
        {
          h: "8. Seguridad",
          p: "Usamos conexión cifrada, contraseñas con hash, aislamiento de datos por usuario y control de permisos en la base de datos. Ningún sistema es infalible, pero te informaremos en caso de incidente relevante.",
        },
        {
          h: "9. Cookies y almacenamiento local",
          p: "Solo usamos cookies y almacenamiento local esenciales: mantener tu sesión, guardar el idioma, el tema y las preferencias de estudio, además del registro de tu aceptación de este aviso. No usamos cookies de publicidad ni de seguimiento entre sitios.",
        },
        {
          h: "10. Menores de edad",
          p: "FlashPilot está destinado a mayores de 16 años. Los menores de 16 solo pueden usar el servicio con el consentimiento específico de un padre o tutor legal.",
        },
        {
          h: "11. Cambios en esta política",
          p: "Si esta política cambia, publicaremos la nueva versión en esta página con la fecha de actualización. Los cambios relevantes se avisarán dentro de la aplicación.",
        },
      ],
    },
  },
};

/* ─────────────────────────── English ─────────────────────────── */
export const extraEn: ExtraDict = {
  shell: {
    mindmaps: "Mind maps",
    chat: "Conversation",
    store: "Store",
    account: "My account",
    admin: "Dashboard",
    flashSession: "Flash Session",
    blog: "Blog",
    menu: "Menu",
    settingsMenu: "Settings",
    resetReviews: "Reset reviews",
    resetTitle: "Reset all reviews?",
    resetDesc:
      "All your flashcards become due today and the review history is cleared. Cards and notes are not deleted. This action cannot be undone.",
    resetDone: "Reviews reset",
    resetDoneDesc: "All cards went back to the beginning.",
    resetFail: "Could not reset",
    resetFailHint: "Please try again.",
    contact: "Contact us",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    brandAria: "FlashPilot — home",
  },
  trust: { secureConnection: "Secure connection", securePurchase: "Secure checkout", dataProtected: "Data protected" },
  cookies: {
    text:
      "We only use essential cookies to keep you signed in and store your study preferences. No tracking, no advertising. See the",
    accept: "Got it",
    privacyLink: "Privacy Policy",
  },
  legal: {
    back: "Back",
    updatedAt: "Last updated: September 2026",
    terms: {
      title: "Terms of Use",
      metaTitle: "Terms of Use | FlashPilot",
      metaDesc: "FlashPilot usage rules: account, subscription, FlashCoins, content, payments and cancellation.",
      seeAlso: "See also the Privacy Policy.",
      sections: (c) => [
        {
          h: "1. What FlashPilot is",
          p: "FlashPilot is a study app with flashcards, spaced repetition, notes, mind maps, text-to-speech, dictation and PilotAI features. By creating an account you agree to these Terms.",
        },
        {
          h: "2. Available features",
          p: "Depending on your plan and account limits, the app offers:",
          ul: [
            "Flashcards with spaced repetition through the SM-2 algorithm, in three formats: question and answer, multiple choice with options listed in a column, and fill in the blank. The back shows the answer plus an explanation and the full transcription of the source.",
            "Text-to-speech reading of cards and pronunciation practice with accuracy scoring and progress history.",
            "Flashcard creation with PilotAI, from typed text, PDF, DOCX and TXT files, photos taken with a phone camera or webcam, uploaded or pasted images (with cropping, usable-area adjustment and rotation) and voice dictation.",
            "A notebook organised by categories, advanced PilotAI formatting of long notes and mind map generation.",
            "An PilotAI conversation tutor, including spoken practice with voice input and spoken replies, for questions, examples and language learning.",
            "Content organised into subjects, topics and notebooks, plus access to official ready-made subjects purchased in the Store.",
            "Performance, retention and study-streak statistics, data and report exports in PDF, CSV and Excel, and review reminders via Telegram.",
            "An app installable on computer and phone, with the interface available in several languages.",
          ],
        },
        {
          h: "3. Account",
          ul: [
            "You must be 16 or older (or have your legal guardian's permission).",
            "Sign-up details must be accurate and your password is personal and non-transferable.",
            "An account is for individual use. Sharing access may lead to suspension.",
          ],
        },
        {
          h: "4. User content, exclusive responsibility and removal of unlawful material",
          p: "The flashcards, notes, images, documents and audio created, typed, dictated or uploaded by the user remain the property of the user. FlashPilot receives only the technical licence needed to store, display and process that content while the service is in use. Responsibility for the accuracy, lawfulness and rights involved in all content created, uploaded or stored by the user, including copyright, personal data protection and other applicable rules, is entirely and exclusively the user's, who declares holding the necessary rights over the uploaded material. Publishing or storing, through the service, content that violates international standards or the laws of any country to which users belong may result in the immediate removal of that content, without prejudice to the other measures set out in these Terms and in applicable law.",
        },
        {
          h: "5. Official content, packs and copy protection",
          p: "Official content published by FlashPilot is read-only: it may be studied, but not edited, copied, exported as your own base or redistributed. Access to purchased packs and subjects lasts for the period stated at checkout (as a rule, 365 days) and is personal. To protect copyright, the app disables text selection, copying, cutting, dragging and the context menu on every screen; attempting to remove or bypass that protection breaches these Terms.",
        },
        {
          h: "6. Free trial",
          p: "New accounts receive, once only and with no credit card, a welcome kit to try the PilotAI features:",
          ul: [
            "40 FlashCoins, enough to generate up to 40 flashcards with PilotAI (1 FlashCoin per saved card).",
            "2 mind maps, 3 note formatting runs and 15 conversation turns with the tutor.",
            "Up to 100 flashcards on the free account, counting cards created by hand, imported and PilotAI-generated.",
            "Per-upload limits on the free account: up to 10 document pages and up to 8 photos or images.",
            "Cards already generated stay accessible even when the balance reaches zero.",
            "The kit is granted once per account, requires a confirmed email address and may be refused when we detect several accounts created by the same person or device.",
          ],
        },
        {
          h: "7. Subscription, FlashCoins and payments",
          ul: [
            "The Pro subscription is charged in US dollars, on the monthly or yearly plan you choose, renewing automatically until cancelled. The yearly plan is discounted compared with the monthly one.",
            "Without a subscription, usage is limited to the free tier available in your account.",
            "FlashCoins are internal credits for PilotAI actions and can also be bought in separate packs. Each action consumes the amount shown in the app.",
            "FlashCoins are not money, earn no interest and are neither redeemable for cash nor transferable between accounts.",
            "Purchased FlashCoins are valid for 12 months from the purchase date; any balance not used within that period expires automatically, without refund. Welcome Kit FlashCoins follow the same rule.",
            "To keep the service stable, paid plans have fair-use limits per billing cycle, shown in the app.",
            "Payments are processed by Paddle, which acts as the official reseller (Merchant of Record) and is responsible for billing, taxes and transaction security, following PCI DSS, SOC 2 and GDPR standards with strong customer authentication (SCA/PSD2). Card details never reach us.",
          ],
        },
        {
          h: "8. Cancellation and refunds",
          p: `You may cancel the subscription at any time; access continues until the end of the period already paid, with no further charges. Online purchases may be withdrawn within 7 calendar days, provided the credits or pack have not been substantially used. Request it at ${c.email}.`,
        },
        {
          h: "9. Acceptable use",
          p: "The following is prohibited:",
          ul: [
            "copying, scraping, bulk-extracting or redistributing content from the app;",
            "attempting to bypass limits, charges, FlashCoin balances or access controls;",
            "using the service for illegal or offensive content, or content infringing third-party rights;",
            "automating access, overloading the system or testing security without permission.",
          ],
        },
        {
          h: "10. PilotAI",
          p: "PilotAI-generated answers support your study and may contain errors. They do not replace professional, legal, medical or academic advice. Always double-check critical content.",
        },
        {
          h: "11. Availability and changes",
          p: "We aim to keep the service available, but interruptions may occur for maintenance or third-party failures. Features may be improved, changed or discontinued; changes affecting what you paid for will be announced with reasonable notice.",
        },
        {
          h: "12. Termination",
          p: "You may close your account at any time. We may suspend or close accounts that breach these Terms, stating the reason where possible.",
        },
        {
          h: "13. Limitation of liability",
          p: "FlashPilot is not liable for indirect losses or for the results of exams or selection processes. Keep copies of anything essential to you.",
        },
        {
          h: "14. Governing law and contact",
          p: `These Terms are governed by Brazilian law. Questions and requests: ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      metaTitle: "Privacy Policy | FlashPilot",
      metaDesc: "How FlashPilot collects, uses, stores and protects your personal data.",
      seeAlso: "See also the Terms of Use.",
      sections: (c) => [
        {
          h: "1. Who is responsible for your data",
          p: `FlashPilot is operated by Marcelo Guimarães. For any privacy matter, contact the data protection officer: ${c.email}.`,
        },
        {
          h: "2. Data we collect",
          ul: [
            "Sign-up: email and password (the password is stored encrypted and is never visible to us).",
            "Study content: subjects, topics, flashcards, notes, mind maps, images and audio you create or upload.",
            "Study usage: review dates, performance grades, session history and statistics.",
            "PilotAI features: the text sent with each action and the FlashCoins consumed.",
            "Purchases: transaction ID, product, amount, currency and access validity. Card details are handled only by the payment processor.",
            "Voice: when you use dictation, the audio is sent for transcription and is not kept afterwards.",
          ],
        },
        {
          h: "3. Why we use the data",
          ul: [
            "Create your account, authenticate access and keep your content saved.",
            "Calculate reviews, reports and study progress.",
            "Process purchases, subscriptions, FlashCoin balance and pack validity.",
            "Send review reminders when you enable that option.",
            "Prevent fraud, abuse and misuse of the service.",
            "Comply with legal, tax and regulatory obligations.",
          ],
        },
        {
          h: "4. Who we share with",
          p: "We share only what is needed for the service to work, with contracted providers: cloud infrastructure, PilotAI providers, the payment processor and, if you enable it, the messaging service for reminders. We do not sell your data and do not use your content for advertising.",
        },
        {
          h: "5. International transfers",
          p: "Some of those providers keep servers outside your country. In those cases the transfer takes place with the safeguards required by law, limited to the purposes of this policy.",
        },
        {
          h: "6. How long we keep data",
          p: "We keep your data while your account exists. If you request deletion, we erase the content and sign-up data, keeping only purchase records and data required by law for the statutory periods.",
        },
        {
          h: "7. Your rights",
          p: `At any time you may request confirmation of processing, access, correction, portability, anonymisation, information about sharing, withdrawal of consent and deletion of your data. Write to ${c.email}; we reply within 15 days.`,
        },
        {
          h: "8. Security",
          p: "We use encrypted connections, hashed passwords, per-user data isolation and permission control in the database. No system is infallible, but we will notify you in the event of a relevant incident.",
        },
        {
          h: "9. Cookies and local storage",
          p: "We only use essential cookies and local storage: keeping you signed in, storing language, theme and study preferences, plus the record of your acceptance of this notice. We use no advertising or cross-site tracking cookies.",
        },
        {
          h: "10. Minors",
          p: "FlashPilot is intended for people aged 16 and over. Under-16s may only use the service with the specific consent of a parent or legal guardian.",
        },
        {
          h: "11. Changes to this policy",
          p: "If this policy changes, we will publish the new version on this page with the update date. Relevant changes will be announced inside the app.",
        },
      ],
    },
  },
};

/* ─────────────────────────── Français ─────────────────────────── */
export const extraFr: ExtraDict = {
  shell: {
    mindmaps: "Cartes mentales",
    chat: "Conversation",
    store: "Boutique",
    account: "Mon compte",
    admin: "Tableau de bord",
    flashSession: "Flash Session",
    blog: "Blog",
    menu: "Menu",
    settingsMenu: "Paramètres",
    resetReviews: "Réinitialiser les révisions",
    resetTitle: "Réinitialiser toutes les révisions ?",
    resetDesc:
      "Toutes vos cartes redeviennent dues aujourd'hui et l'historique des révisions est effacé. Les cartes et les notes ne sont pas supprimées. Cette action est irréversible.",
    resetDone: "Révisions réinitialisées",
    resetDoneDesc: "Toutes les cartes sont revenues au début.",
    resetFail: "Réinitialisation impossible",
    resetFailHint: "Réessayez.",
    contact: "Contactez-nous",
    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    brandAria: "FlashPilot — accueil",
  },
  trust: { secureConnection: "Connexion sécurisée", securePurchase: "Paiement sécurisé", dataProtected: "Données protégées" },
  cookies: {
    text:
      "Nous n'utilisons que des cookies essentiels pour vous garder connecté et conserver vos préférences d'étude. Sans suivi ni publicité. Consultez la",
    accept: "J'ai compris",
    privacyLink: "Politique de confidentialité",
  },
  legal: {
    back: "Retour",
    updatedAt: "Dernière mise à jour : septembre 2026",
    terms: {
      title: "Conditions d'utilisation",
      metaTitle: "Conditions d'utilisation | FlashPilot",
      metaDesc: "Règles d'utilisation de FlashPilot : compte, abonnement, FlashCoins, contenu, paiements et résiliation.",
      seeAlso: "Consultez aussi la Politique de confidentialité.",
      sections: (c) => [
        {
          h: "1. Qu'est-ce que FlashPilot",
          p: "FlashPilot est une application d'étude avec cartes mémoire, répétition espacée, notes, cartes mentales, lecture vocale, dictée et fonctions de PilotAI. En créant un compte, vous acceptez ces Conditions.",
        },
        {
          h: "2. Fonctionnalités disponibles",
          p: "Selon votre formule et les limites de votre compte, l'application propose :",
          ul: [
            "Cartes mémoire avec répétition espacée par l'algorithme SM-2, en trois formats : question-réponse, choix multiple avec options en colonne et texte à compléter. Au verso figurent la réponse, l'explication et la transcription intégrale de la source.",
            "Lecture vocale des cartes et entraînement à la prononciation avec score de précision et historique de progression.",
            "Création de flashcards avec PilotAI, à partir de texte saisi, de fichiers PDF, DOCX et TXT, de photos prises avec la caméra ou la webcam, d'images importées ou collées (avec recadrage, ajustement de la zone utile et rotation) et de la dictée vocale.",
            "Carnet de notes organisé par catégories, mise en forme avancée des notes longues par PilotAI et génération de cartes mentales.",
            "Tuteur de conversation avec PilotAI, y compris la pratique orale avec entrée vocale et réponse parlée, pour les questions, les exemples et l'apprentissage des langues.",
            "Organisation du contenu en matières, sujets et carnets, ainsi que l'accès aux matières officielles achetées dans la Boutique.",
            "Statistiques de performance, de rétention et de série d'étude, export de données et de rapports en PDF, CSV et Excel, et rappels de révision via Telegram.",
            "Application installable sur ordinateur et sur mobile, avec une interface disponible en plusieurs langues.",
          ],
        },
        {
          h: "3. Compte",
          ul: [
            "Vous devez avoir 16 ans ou plus (ou l'autorisation de votre représentant légal).",
            "Les informations d'inscription doivent être exactes et le mot de passe est personnel et incessible.",
            "Un compte est à usage individuel. Partager l'accès peut entraîner une suspension.",
          ],
        },
        {
          h: "4. Contenu de l'utilisateur, responsabilité exclusive et retrait des contenus illicites",
          p: "Les cartes, notes, images, documents et audios créés, saisis, dictés ou envoyés par l'utilisateur demeurent la propriété de l'utilisateur lui-même. FlashPilot reçoit uniquement la licence technique nécessaire pour stocker, afficher et traiter ce contenu pendant l'utilisation du service. La responsabilité de l'exactitude, de la licéité et des droits impliqués dans tout contenu créé, envoyé ou stocké, y compris les droits d'auteur, la protection des données personnelles et les autres règles applicables, est entière et exclusive à l'utilisateur, qui déclare détenir les droits nécessaires sur le matériel envoyé. La diffusion ou le stockage, via le service, d'un contenu enfreignant les normes internationales ou la législation de tout pays auquel appartiennent les utilisateurs peut entraîner le retrait immédiat de ce contenu, sans préjudice des autres mesures prévues par ces Conditions et par la loi applicable.",
        },
        {
          h: "5. Contenu officiel, packs et protection contre la copie",
          p: "Le contenu officiel publié par FlashPilot est en lecture seule : il peut être étudié, mais ni modifié, ni copié, ni exporté comme base personnelle, ni redistribué. L'accès aux packs et matières achetés vaut pour la durée indiquée à l'achat (en règle générale 365 jours) et est personnel. Pour protéger les droits d'auteur, l'application désactive la sélection de texte, la copie, le couper, le glisser et le menu contextuel sur tous les écrans ; tenter de contourner cette protection enfreint ces Conditions.",
        },
        {
          h: "6. Essai gratuit",
          p: "Les nouveaux comptes reçoivent, une seule fois et sans carte bancaire, un kit de bienvenue pour découvrir les fonctions de PilotAI :",
          ul: [
            "40 FlashCoins, de quoi générer jusqu'à 40 cartes avec l'PilotAI (1 FlashCoin par carte enregistrée).",
            "2 cartes mentales, 3 mises en forme de notes et 15 tours de conversation avec le tuteur.",
            "Jusqu'à 100 cartes sur le compte gratuit, en comptant celles créées à la main, importées et générées par PilotAI.",
            "Limites par envoi sur le compte gratuit : jusqu'à 10 pages de document et jusqu'à 8 photos ou images.",
            "Les cartes déjà générées restent accessibles même lorsque le solde atteint zéro.",
            "Le kit est accordé une fois par compte, exige une adresse e-mail confirmée et peut être refusé lorsque nous détectons plusieurs comptes créés par la même personne ou le même appareil.",
          ],
        },
        {
          h: "7. Abonnement, FlashCoins et paiements",
          ul: [
            "L'abonnement Pro est facturé en dollars US, selon la formule mensuelle ou annuelle choisie, avec renouvellement automatique jusqu'à résiliation. La formule annuelle est remisée par rapport à la mensuelle.",
            "Sans abonnement, l'utilisation reste limitée à l'offre gratuite disponible dans votre compte.",
            "Les FlashCoins sont des crédits internes pour les actions de PilotAI et peuvent aussi être achetés en packs séparés. Chaque action consomme la quantité indiquée dans l'application.",
            "Les FlashCoins ne sont pas de l'argent, ne produisent pas d'intérêts et ne sont ni remboursables en espèces ni transférables entre comptes.",
            "Les FlashCoins achetés sont valables 12 mois à compter de l'achat ; le solde non utilisé dans ce délai expire automatiquement, sans remboursement. Les FlashCoins du Kit de bienvenue suivent la même règle.",
            "Pour garantir la stabilité du service, les formules payantes comportent des limites d'usage raisonnable par cycle de facturation, indiquées dans l'application.",
            "Les paiements sont traités par Paddle, qui agit comme revendeur officiel (Merchant of Record) et assume la facturation, les taxes et la sécurité de la transaction, selon les normes PCI DSS, SOC 2 et RGPD, avec authentification forte (SCA/DSP2). Les données de carte ne passent pas par nous.",
          ],
        },
        {
          h: "8. Résiliation et remboursement",
          p: `Vous pouvez résilier l'abonnement à tout moment ; l'accès se poursuit jusqu'à la fin de la période déjà payée, sans nouveau prélèvement. Les achats en ligne peuvent faire l'objet d'une rétractation sous 7 jours calendaires, à condition que les crédits ou le pack n'aient pas été utilisés de façon significative. Demandez-le à ${c.email}.`,
        },
        {
          h: "9. Usage approprié",
          p: "Il est interdit :",
          ul: [
            "de copier, d'extraire en masse ou de redistribuer le contenu de l'application ;",
            "de tenter de contourner les limites, les facturations, les soldes de FlashCoins ou les contrôles d'accès ;",
            "d'utiliser le service pour des contenus illégaux, offensants ou violant les droits de tiers ;",
            "d'automatiser les accès, de surcharger le système ou de tester la sécurité sans autorisation.",
          ],
        },
        {
          h: "10. Intelligence artificielle",
          p: "Les réponses générées par PilotAI sont une aide à l'étude et peuvent contenir des erreurs. Elles ne remplacent pas un avis professionnel, juridique, médical ou universitaire. Vérifiez toujours le contenu critique.",
        },
        {
          h: "11. Disponibilité et évolutions",
          p: "Nous nous efforçons de maintenir le service disponible, mais des interruptions peuvent survenir pour maintenance ou défaillance de tiers. Les fonctions peuvent être améliorées, modifiées ou arrêtées ; les changements affectant ce que vous avez payé seront annoncés dans un délai raisonnable.",
        },
        {
          h: "12. Clôture",
          p: "Vous pouvez fermer votre compte à tout moment. Nous pouvons suspendre ou fermer les comptes qui enfreignent ces Conditions, en indiquant le motif si possible.",
        },
        {
          h: "13. Limitation de responsabilité",
          p: "FlashPilot n'est pas responsable des pertes indirectes ni des résultats d'examens ou de concours. Conservez des copies de ce qui vous est essentiel.",
        },
        {
          h: "14. Droit applicable et contact",
          p: `Ces Conditions relèvent du droit brésilien. Questions et demandes : ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Politique de confidentialité",
      metaTitle: "Politique de confidentialité | FlashPilot",
      metaDesc: "Comment FlashPilot collecte, utilise, conserve et protège vos données personnelles.",
      seeAlso: "Consultez aussi les Conditions d'utilisation.",
      sections: (c) => [
        {
          h: "1. Responsable de vos données",
          p: `FlashPilot est exploité par Marcelo Guimarães. Pour toute question de confidentialité, contactez le responsable du traitement : ${c.email}.`,
        },
        {
          h: "2. Données collectées",
          ul: [
            "Inscription : e-mail et mot de passe (le mot de passe est chiffré et ne nous est jamais visible).",
            "Contenu d'étude : matières, thèmes, cartes, notes, cartes mentales, images et audios que vous créez ou envoyez.",
            "Utilisation : dates de révision, notes de performance, historique des sessions et statistiques.",
            "Fonctions de PilotAI : le texte envoyé à chaque action et les FlashCoins consommés.",
            "Achats : identifiant de transaction, produit, montant, devise et validité de l'accès. Les données de carte sont traitées uniquement par le prestataire de paiement.",
            "Voix : lors de la dictée, l'audio est envoyé pour transcription et n'est pas conservé ensuite.",
          ],
        },
        {
          h: "3. Finalités",
          ul: [
            "Créer votre compte, authentifier l'accès et conserver votre contenu.",
            "Calculer les révisions, les rapports et la progression.",
            "Traiter les achats, abonnements, soldes de FlashCoins et validité des packs.",
            "Envoyer des rappels de révision lorsque vous activez cette option.",
            "Prévenir la fraude, les abus et les usages détournés du service.",
            "Respecter les obligations légales, fiscales et réglementaires.",
          ],
        },
        {
          h: "4. Destinataires",
          p: "Nous ne partageons que le nécessaire au fonctionnement du service, avec des prestataires : infrastructure cloud, fournisseurs de PilotAI, prestataire de paiement et, si vous l'activez, le service de messagerie pour les rappels. Nous ne vendons pas vos données et n'utilisons pas votre contenu à des fins publicitaires.",
        },
        {
          h: "5. Transferts internationaux",
          p: "Certains prestataires hébergent des serveurs hors de votre pays. Le transfert s'effectue alors avec les garanties exigées par la loi, limité aux finalités de cette politique.",
        },
        {
          h: "6. Durée de conservation",
          p: "Nous conservons vos données tant que votre compte existe. En cas de demande de suppression, nous effaçons le contenu et les données d'inscription, en conservant uniquement les enregistrements d'achat et les données exigées par la loi pendant les délais légaux.",
        },
        {
          h: "7. Vos droits",
          p: `Vous pouvez à tout moment demander la confirmation du traitement, l'accès, la rectification, la portabilité, l'anonymisation, des informations sur les partages, le retrait du consentement et la suppression de vos données. Écrivez à ${c.email} ; nous répondons sous 15 jours.`,
        },
        {
          h: "8. Sécurité",
          p: "Nous utilisons une connexion chiffrée, des mots de passe hachés, l'isolement des données par utilisateur et un contrôle des permissions dans la base de données. Aucun système n'est infaillible, mais nous vous informerons en cas d'incident important.",
        },
        {
          h: "9. Cookies et stockage local",
          p: "Nous n'utilisons que des cookies et un stockage local essentiels : maintien de la connexion, langue, thème et préférences d'étude, ainsi que l'enregistrement de votre acceptation de cet avis. Aucun cookie publicitaire ni de suivi inter-sites.",
        },
        {
          h: "10. Mineurs",
          p: "FlashPilot est destiné aux personnes de 16 ans et plus. Les moins de 16 ans ne peuvent utiliser le service qu'avec le consentement spécifique d'un parent ou tuteur légal.",
        },
        {
          h: "11. Modifications",
          p: "En cas de modification, nous publierons la nouvelle version sur cette page avec la date de mise à jour. Les changements importants seront annoncés dans l'application.",
        },
      ],
    },
  },
};

/* ─────────────────────────── Italiano ─────────────────────────── */
export const extraIt: ExtraDict = {
  shell: {
    mindmaps: "Mappe mentali",
    chat: "Conversazione",
    store: "Negozio",
    account: "Il mio account",
    admin: "Pannello",
    flashSession: "Flash Session",
    blog: "Blog",
    menu: "Menu",
    settingsMenu: "Impostazioni",
    resetReviews: "Azzera ripassi",
    resetTitle: "Azzerare tutti i ripassi?",
    resetDesc:
      "Tutte le flashcard tornano in scadenza oggi e lo storico dei ripassi viene cancellato. Le flashcard e le note non vengono eliminate. L'azione non è reversibile.",
    resetDone: "Ripassi azzerati",
    resetDoneDesc: "Tutte le flashcard sono tornate all'inizio.",
    resetFail: "Impossibile azzerare",
    resetFailHint: "Riprova.",
    contact: "Contattaci",
    terms: "Termini di utilizzo",
    privacy: "Informativa sulla privacy",
    brandAria: "FlashPilot — inizio",
  },
  trust: { secureConnection: "Connessione sicura", securePurchase: "Acquisto sicuro", dataProtected: "Dati protetti" },
  cookies: {
    text:
      "Usiamo solo cookie essenziali per mantenere l'accesso e conservare le tue preferenze di studio. Senza tracciamento e senza pubblicità. Consulta l'",
    accept: "Ho capito",
    privacyLink: "Informativa sulla privacy",
  },
  legal: {
    back: "Indietro",
    updatedAt: "Ultimo aggiornamento: settembre 2026",
    terms: {
      title: "Termini di utilizzo",
      metaTitle: "Termini di utilizzo | FlashPilot",
      metaDesc: "Regole d'uso di FlashPilot: account, abbonamento, FlashCoins, contenuti, pagamenti e disdetta.",
      seeAlso: "Consulta anche l'Informativa sulla privacy.",
      sections: (c) => [
        {
          h: "1. Che cos'è FlashPilot",
          p: "FlashPilot è un'app di studio con flashcard, ripetizione dilazionata, note, mappe mentali, lettura vocale, dettatura e funzioni di PilotAI. Creando un account accetti questi Termini.",
        },
        {
          h: "2. Funzioni disponibili",
          p: "In base al piano e ai limiti del tuo account, l'app offre:",
          ul: [
            "Flashcard con ripetizione dilazionata tramite l'algoritmo SM-2, in tre formati: domanda e risposta, scelta multipla con alternative in colonna e completamento degli spazi. Sul retro compaiono la risposta, la spiegazione e la trascrizione integrale della fonte.",
            "Lettura vocale delle card e pratica della pronuncia con punteggio di precisione e storico dei progressi.",
            "Creazione di flashcard con PilotAI, da testo digitato, file PDF, DOCX e TXT, foto scattate con la fotocamera o la webcam, immagini caricate o incollate (con ritaglio, regolazione dell'area utile e rotazione) e dettatura vocale.",
            "Quaderno di note organizzato per categorie, formattazione avanzata delle note lunghe con PilotAI e generazione di mappe mentali.",
            "Tutor di conversazione con PilotAI, con pratica orale tramite voce e risposta parlata, per dubbi, esempi e studio delle lingue.",
            "Organizzazione dei contenuti in materie, argomenti e quaderni, oltre all'accesso alle materie ufficiali acquistate nel Negozio.",
            "Statistiche di rendimento, ritenzione e serie di studio, esportazione di dati e report in PDF, CSV ed Excel e promemoria di ripasso via Telegram.",
            "App installabile su computer e telefono, con interfaccia disponibile in diverse lingue.",
          ],
        },
        {
          h: "3. Account",
          ul: [
            "Devi avere almeno 16 anni (o l'autorizzazione del tutore legale).",
            "I dati di registrazione devono essere veri e la password è personale e non cedibile.",
            "L'account è a uso individuale. Condividere l'accesso può portare alla sospensione.",
          ],
        },
        {
          h: "4. Contenuti dell'utente, responsabilità esclusiva e rimozione di materiale illecito",
          p: "Le flashcard, le note, le immagini, i documenti e gli audio creati, digitati, dettati o inviati dall'utente restano di proprietà dell'utente stesso. FlashPilot riceve unicamente la licenza tecnica necessaria per archiviare, mostrare ed elaborare tali contenuti durante l'utilizzo del servizio. La responsabilità della veridicità, della liceità e dei diritti coinvolti in qualsiasi contenuto creato, inviato o archiviato, inclusi il diritto d'autore, la protezione dei dati personali e le altre norme applicabili, è integrale ed esclusiva dell'utente, che dichiara di possedere i diritti necessari sul materiale inviato. La pubblicazione o l'archiviazione, tramite il servizio, di contenuti che violino norme internazionali o la legislazione di qualsiasi paese al quale appartengono gli utenti può comportare la rimozione immediata dei contenuti, senza pregiudizio per le altre misure previste dai presenti Termini e dalla legge applicabile.",
        },
        {
          h: "5. Contenuti ufficiali, pacchetti e protezione dalla copia",
          p: "I contenuti ufficiali pubblicati da FlashPilot sono in sola lettura: si possono studiare, ma non modificare, copiare, esportare come base propria né ridistribuire. L'accesso ai pacchetti e alle materie acquistate vale per il periodo indicato all'acquisto (di norma 365 giorni) ed è personale. Per tutelare il diritto d'autore, l'app disattiva la selezione del testo, la copia, il taglia, il trascinamento e il menu contestuale in tutte le schermate; tentare di aggirare questa protezione viola i presenti Termini.",
        },
        {
          h: "6. Prova gratuita",
          p: "I nuovi account ricevono, una sola volta e senza carta di credito, un kit di benvenuto per provare le funzioni di PilotAI:",
          ul: [
            "40 FlashCoins, sufficienti per generare fino a 40 flashcard con PilotAI (1 FlashCoin per card salvata).",
            "2 mappe mentali, 3 formattazioni di note e 15 turni di conversazione con il tutor.",
            "Fino a 100 flashcard nell'account gratuito, contando quelle create a mano, importate e generate dalPilotAI.",
            "Limiti per invio nell'account gratuito: fino a 10 pagine di documento e fino a 8 foto o immagini.",
            "Le card già generate restano accessibili anche quando il saldo arriva a zero.",
            "Il kit è concesso una volta per account, richiede un indirizzo e-mail confermato e può essere negato quando rileviamo più account creati dalla stessa persona o dallo stesso dispositivo.",
          ],
        },
        {
          h: "7. Abbonamento, FlashCoins e pagamenti",
          ul: [
            "L'abbonamento Pro è addebitato in dollari USA, nel piano mensile o annuale scelto, con rinnovo automatico fino alla disdetta. Il piano annuale è scontato rispetto al mensile.",
            "Senza abbonamento l'uso resta limitato al piano gratuito disponibile nel tuo account.",
            "Le FlashCoins sono crediti interni per le azioni di PilotAI e possono anche essere acquistate in pacchetti separati. Ogni azione consuma la quantità indicata nell'app.",
            "Le FlashCoins non sono denaro, non maturano interessi e non sono rimborsabili né trasferibili tra account.",
            "Le FlashCoins acquistate sono valide 12 mesi dalla data di acquisto; il saldo non usato entro tale periodo scade automaticamente, senza rimborso. Le FlashCoins del Kit di benvenuto seguono la stessa regola.",
            "Per garantire la stabilità del servizio, i piani a pagamento hanno limiti di uso corretto per ciclo di fatturazione, indicati nell'app.",
            "I pagamenti sono gestiti da Paddle, che agisce come rivenditore ufficiale (Merchant of Record) e risponde della fatturazione, delle imposte e della sicurezza della transazione, secondo gli standard PCI DSS, SOC 2 e GDPR, con autenticazione forte (SCA/PSD2). I dati della carta non passano da noi.",
          ],
        },
        {
          h: "8. Disdetta e rimborso",
          p: `Puoi disdire l'abbonamento quando vuoi; l'accesso continua fino al termine del periodo già pagato, senza nuovi addebiti. Gli acquisti online possono essere revocati entro 7 giorni, purché i crediti o il pacchetto non siano stati usati in misura rilevante. Richiedilo a ${c.email}.`,
        },
        {
          h: "9. Uso corretto",
          p: "È vietato:",
          ul: [
            "copiare, estrarre in massa o ridistribuire i contenuti dell'app;",
            "tentare di aggirare limiti, addebiti, saldi di FlashCoins o controlli di accesso;",
            "usare il servizio per contenuti illegali, offensivi o che violino diritti di terzi;",
            "automatizzare gli accessi, sovraccaricare il sistema o testare la sicurezza senza autorizzazione.",
          ],
        },
        {
          h: "10. Intelligenza artificiale",
          p: "Le risposte generate dall'PilotAI sono un supporto allo studio e possono contenere errori. Non sostituiscono una consulenza professionale, legale, medica o accademica. Verifica sempre i contenuti critici.",
        },
        {
          h: "11. Disponibilità e modifiche",
          p: "Cerchiamo di mantenere il servizio disponibile, ma possono verificarsi interruzioni per manutenzione o guasti di terzi. Le funzioni possono essere migliorate, modificate o dismesse; le modifiche che incidono su quanto hai pagato saranno comunicate con ragionevole preavviso.",
        },
        {
          h: "12. Chiusura",
          p: "Puoi chiudere il tuo account in qualsiasi momento. Possiamo sospendere o chiudere gli account che violano questi Termini, indicando il motivo quando possibile.",
        },
        {
          h: "13. Limite di responsabilità",
          p: "FlashPilot non risponde di perdite indirette né dei risultati di esami o concorsi. Conserva copie di ciò che è essenziale per te.",
        },
        {
          h: "14. Legge applicabile e contatti",
          p: `Questi Termini seguono la legge brasiliana. Domande e richieste: ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Informativa sulla privacy",
      metaTitle: "Informativa sulla privacy | FlashPilot",
      metaDesc: "Come FlashPilot raccoglie, usa, conserva e protegge i tuoi dati personali.",
      seeAlso: "Consulta anche i Termini di utilizzo.",
      sections: (c) => [
        {
          h: "1. Titolare dei tuoi dati",
          p: `FlashPilot è gestito da Marcelo Guimarães. Per qualsiasi questione di privacy, contatta il responsabile del trattamento: ${c.email}.`,
        },
        {
          h: "2. Dati raccolti",
          ul: [
            "Registrazione: e-mail e password (la password è cifrata e non è mai visibile a noi).",
            "Contenuti di studio: materie, argomenti, flashcard, note, mappe mentali, immagini e audio che crei o carichi.",
            "Uso: date di ripasso, valutazioni, storico delle sessioni e statistiche.",
            "Funzioni di PilotAI: il testo inviato a ogni azione e le FlashCoins consumate.",
            "Acquisti: identificativo della transazione, prodotto, importo, valuta e validità dell'accesso. I dati della carta sono trattati solo dal gestore dei pagamenti.",
            "Voce: quando usi la dettatura, l'audio è inviato per la trascrizione e non viene conservato dopo.",
          ],
        },
        {
          h: "3. Finalità",
          ul: [
            "Creare il tuo account, autenticare l'accesso e conservare i tuoi contenuti.",
            "Calcolare ripassi, report e progressi dello studio.",
            "Gestire acquisti, abbonamenti, saldo FlashCoins e validità dei pacchetti.",
            "Inviare promemoria di ripasso quando attivi l'opzione.",
            "Prevenire frodi, abusi e usi impropri del servizio.",
            "Adempiere a obblighi legali, fiscali e regolamentari.",
          ],
        },
        {
          h: "4. Con chi condividiamo",
          p: "Condividiamo solo quanto necessario al funzionamento del servizio, con fornitori incaricati: infrastruttura cloud, fornitori di PilotAI, gestore dei pagamenti e, se lo attivi, il servizio di messaggistica per i promemoria. Non vendiamo i tuoi dati e non usiamo i tuoi contenuti per la pubblicità.",
        },
        {
          h: "5. Trasferimenti internazionali",
          p: "Alcuni fornitori hanno server fuori dal tuo Paese. In tal caso il trasferimento avviene con le garanzie previste dalla legge, limitato alle finalità di questa informativa.",
        },
        {
          h: "6. Tempi di conservazione",
          p: "Conserviamo i dati finché esiste il tuo account. Se chiedi la cancellazione, eliminiamo contenuti e dati di registrazione, conservando solo i registri d'acquisto e i dati richiesti dalla legge per i termini previsti.",
        },
        {
          h: "7. I tuoi diritti",
          p: `In qualsiasi momento puoi chiedere conferma del trattamento, accesso, rettifica, portabilità, anonimizzazione, informazioni sulle comunicazioni, revoca del consenso e cancellazione dei dati. Scrivi a ${c.email}; rispondiamo entro 15 giorni.`,
        },
        {
          h: "8. Sicurezza",
          p: "Usiamo connessione cifrata, password con hash, isolamento dei dati per utente e controllo dei permessi nel database. Nessun sistema è infallibile, ma ti informeremo in caso di incidente rilevante.",
        },
        {
          h: "9. Cookie e memoria locale",
          p: "Usiamo solo cookie e memoria locale essenziali: mantenere l'accesso, conservare lingua, tema e preferenze di studio, oltre alla registrazione della tua accettazione di questo avviso. Nessun cookie pubblicitario o di tracciamento tra siti.",
        },
        {
          h: "10. Minori",
          p: "FlashPilot è destinato a chi ha almeno 16 anni. Gli under 16 possono usare il servizio solo con il consenso specifico di un genitore o tutore legale.",
        },
        {
          h: "11. Modifiche all'informativa",
          p: "Se questa informativa cambia, pubblicheremo la nuova versione in questa pagina con la data di aggiornamento. Le modifiche rilevanti saranno segnalate nell'app.",
        },
      ],
    },
  },
};

/* ─────────────────────────── Deutsch ─────────────────────────── */
export const extraDe: ExtraDict = {
  shell: {
    mindmaps: "Mindmaps",
    chat: "Konversation",
    store: "Shop",
    account: "Mein Konto",
    admin: "Verwaltung",
    flashSession: "Flash Session",
    blog: "Blog",
    menu: "Menü",
    settingsMenu: "Einstellungen",
    resetReviews: "Wiederholungen zurücksetzen",
    resetTitle: "Alle Wiederholungen zurücksetzen?",
    resetDesc:
      "Alle Lernkarten werden heute wieder fällig und die Historie wird gelöscht. Karten und Notizen werden nicht gelöscht. Diese Aktion ist nicht umkehrbar.",
    resetDone: "Wiederholungen zurückgesetzt",
    resetDoneDesc: "Alle Karten stehen wieder am Anfang.",
    resetFail: "Zurücksetzen nicht möglich",
    resetFailHint: "Bitte erneut versuchen.",
    contact: "Kontakt",
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
    brandAria: "FlashPilot — Start",
  },
  trust: { secureConnection: "Sichere Verbindung", securePurchase: "Sicherer Kauf", dataProtected: "Daten geschützt" },
  cookies: {
    text:
      "Wir verwenden nur essenzielle Cookies, um Sie angemeldet zu halten und Ihre Lerneinstellungen zu speichern. Kein Tracking, keine Werbung. Siehe die",
    accept: "Verstanden",
    privacyLink: "Datenschutzerklärung",
  },
  legal: {
    back: "Zurück",
    updatedAt: "Letzte Aktualisierung: September 2026",
    terms: {
      title: "Nutzungsbedingungen",
      metaTitle: "Nutzungsbedingungen | FlashPilot",
      metaDesc: "Nutzungsregeln von FlashPilot: Konto, Abo, FlashCoins, Inhalte, Zahlungen und Kündigung.",
      seeAlso: "Siehe auch die Datenschutzerklärung.",
      sections: (c) => [
        {
          h: "1. Was FlashPilot ist",
          p: "FlashPilot ist eine Lern-App mit Lernkarten, verteilter Wiederholung, Notizen, Mindmaps, Sprachausgabe, Diktat und Funktionen mit von PilotAI. Mit der Kontoerstellung akzeptieren Sie diese Bedingungen.",
        },
        {
          h: "2. Verfügbare Funktionen",
          p: "Je nach Tarif und Kontolimits bietet die App:",
          ul: [
            "Lernkarten mit verteilter Wiederholung über den SM-2-Algorithmus in drei Formaten: Frage und Antwort, Multiple Choice mit Optionen in einer Spalte und Lückentext. Auf der Rückseite stehen die Antwort, die Erklärung und die vollständige Abschrift der Quelle.",
            "Sprachausgabe der Karten sowie Aussprachetraining mit Genauigkeitsbewertung und Fortschrittsverlauf.",
            "Erstellung von Flashcards mit PilotAI: aus eingegebenem Text, PDF-, DOCX- und TXT-Dateien, Fotos von Kamera oder Webcam, hochgeladenen oder eingefügten Bildern (mit Zuschnitt, Anpassung des Nutzbereichs und Drehung) sowie Spracheingabe.",
            "Notizbuch mit Kategorien, erweiterte PilotAI-Formatierung langer Notizen und Erzeugung von Mindmaps.",
            "PilotAI-Gesprächstutor, auch mit mündlicher Übung über Spracheingabe und gesprochener Antwort, für Fragen, Beispiele und Sprachenlernen.",
            "Inhalte geordnet in Fächer, Themen und Notizbücher, dazu Zugang zu offiziellen Fächern aus dem Shop.",
            "Statistiken zu Leistung, Behaltensquote und Lernserie, Export von Daten und Berichten als PDF, CSV und Excel sowie Wiederholungserinnerungen per Telegram.",
            "Als App auf Computer und Smartphone installierbar, Oberfläche in mehreren Sprachen verfügbar.",
          ],
        },
        {
          h: "3. Konto",
          ul: [
            "Sie müssen 16 Jahre oder älter sein (oder die Erlaubnis Ihrer Erziehungsberechtigten haben).",
            "Die Anmeldedaten müssen richtig sein; das Passwort ist persönlich und nicht übertragbar.",
            "Ein Konto ist zur individuellen Nutzung. Das Teilen des Zugangs kann zur Sperrung führen.",
          ],
        },
        {
          h: "4. Inhalte des Nutzers, alleinige Verantwortung und Entfernung rechtswidriger Inhalte",
          p: "Die vom Nutzer erstellten, eingegebenen, diktierten oder hochgeladenen Lernkarten, Notizen, Bilder, Dokumente und Audios bleiben im Eigentum des Nutzers selbst. FlashPilot erhält ausschließlich die technisch erforderliche Lizenz, diese Inhalte während der Nutzung des Dienstes zu speichern, anzuzeigen und zu verarbeiten. Die Verantwortung für die Richtigkeit, Rechtmäßigkeit und die an allen vom Nutzer erstellten, hochgeladenen oder gespeicherten Inhalten beteiligten Rechte, einschließlich Urheberrecht, Schutz personenbezogener Daten und sonstiger anwendbarer Vorschriften, liegt vollständig und ausschließlich beim Nutzer, der erklärt, über die erforderlichen Rechte an dem hochgeladenen Material zu verfügen. Die Verbreitung oder Speicherung von Inhalten, die internationale Normen oder die Gesetze eines Landes verletzen, dem die Nutzer angehören, kann über den Dienst die sofortige Entfernung dieser Inhalte zur Folge haben, unbeschadet der in diesen Bedingungen und im anwendbaren Recht vorgesehenen Maßnahmen.",
        },
        {
          h: "5. Offizielle Inhalte, Pakete und Kopierschutz",
          p: "Von FlashPilot veröffentlichte offizielle Inhalte sind schreibgeschützt: Sie dürfen gelernt, aber nicht bearbeitet, kopiert, als eigene Basis exportiert oder weiterverbreitet werden. Der Zugang zu gekauften Paketen und Fächern gilt für den beim Kauf genannten Zeitraum (in der Regel 365 Tage) und ist persönlich. Zum Schutz des Urheberrechts deaktiviert die App auf allen Bildschirmen Textauswahl, Kopieren, Ausschneiden, Ziehen und das Kontextmenü; ein Umgehen dieses Schutzes verstößt gegen diese Bedingungen.",
        },
        {
          h: "6. Kostenlose Testphase",
          p: "Neue Konten erhalten einmalig und ohne Kreditkarte ein Willkommenspaket zum Ausprobieren der PilotAI-Funktionen:",
          ul: [
            "40 FlashCoins, genug für bis zu 40 mit von PilotAI erzeugte Lernkarten (1 FlashCoin pro gespeicherter Karte).",
            "2 Mindmaps, 3 Notizformatierungen und 15 Gesprächsrunden mit dem Tutor.",
            "Bis zu 100 Lernkarten im kostenlosen Konto, einschließlich selbst erstellter, importierter und PilotAI-erzeugter Karten.",
            "Grenzen pro Upload im kostenlosen Konto: bis zu 10 Dokumentseiten und bis zu 8 Fotos oder Bilder.",
            "Bereits erzeugte Karten bleiben zugänglich, auch wenn das Guthaben null erreicht.",
            "Das Paket wird einmal pro Konto gewährt, setzt eine bestätigte E-Mail-Adresse voraus und kann verweigert werden, wenn wir mehrere Konten derselben Person oder desselben Geräts erkennen.",
          ],
        },
        {
          h: "7. Abo, FlashCoins und Zahlungen",
          ul: [
            "Das Pro-Abo wird in US-Dollar im gewählten Monats- oder Jahresplan abgerechnet und verlängert sich automatisch bis zur Kündigung. Der Jahresplan ist gegenüber dem Monatsplan rabattiert.",
            "Ohne Abo bleibt die Nutzung auf das kostenlose Angebot in Ihrem Konto beschränkt.",
            "FlashCoins sind interne Guthaben für Aktionen mit von PilotAI und können auch in einzelnen Paketen gekauft werden. Jede Aktion verbraucht die in der App angegebene Menge.",
            "FlashCoins sind kein Geld, verzinsen sich nicht und sind weder auszahlbar noch zwischen Konten übertragbar.",
            "Gekaufte FlashCoins sind 12 Monate ab Kaufdatum gültig; nicht genutztes Guthaben verfällt danach automatisch und ohne Erstattung. FlashCoins aus dem Willkommenspaket unterliegen derselben Regel.",
            "Zur Stabilität des Dienstes gelten in bezahlten Tarifen Fair-Use-Grenzen pro Abrechnungszeitraum, die in der App angezeigt werden.",
            "Zahlungen werden von Paddle verarbeitet, das als offizieller Reseller (Merchant of Record) auftritt und für Abrechnung, Steuern und Transaktionssicherheit verantwortlich ist, nach den Standards PCI DSS, SOC 2 und DSGVO mit starker Kundenauthentifizierung (SCA/PSD2). Kartendaten erreichen uns nicht.",
          ],
        },
        {
          h: "8. Kündigung und Rückerstattung",
          p: `Sie können das Abo jederzeit kündigen; der Zugang läuft bis zum Ende des bereits bezahlten Zeitraums, ohne weitere Abbuchungen. Online-Käufe können innerhalb von 7 Kalendertagen widerrufen werden, sofern Guthaben oder Paket nicht erheblich genutzt wurden. Anfrage an ${c.email}.`,
        },
        {
          h: "9. Angemessene Nutzung",
          p: "Verboten ist:",
          ul: [
            "Inhalte der App zu kopieren, massenhaft zu extrahieren oder weiterzuverbreiten;",
            "Limits, Abbuchungen, FlashCoin-Guthaben oder Zugriffskontrollen zu umgehen;",
            "den Dienst für illegale, beleidigende oder rechtsverletzende Inhalte zu nutzen;",
            "Zugriffe zu automatisieren, das System zu überlasten oder die Sicherheit ohne Erlaubnis zu testen.",
          ],
        },
        {
          h: "10. PilotAI",
          p: "PilotAI-Antworten unterstützen das Lernen und können Fehler enthalten. Sie ersetzen keine professionelle, rechtliche, medizinische oder akademische Beratung. Prüfen Sie kritische Inhalte immer nach.",
        },
        {
          h: "11. Verfügbarkeit und Änderungen",
          p: "Wir bemühen uns um Verfügbarkeit, doch Unterbrechungen durch Wartung oder Ausfälle Dritter sind möglich. Funktionen können verbessert, geändert oder eingestellt werden; Änderungen, die Ihre Zahlung betreffen, kündigen wir mit angemessener Frist an.",
        },
        {
          h: "12. Beendigung",
          p: "Sie können Ihr Konto jederzeit schließen. Wir können Konten sperren oder schließen, die diese Bedingungen verletzen, und nennen dabei möglichst den Grund.",
        },
        {
          h: "13. Haftungsbeschränkung",
          p: "FlashPilot haftet nicht für indirekte Schäden oder Ergebnisse von Prüfungen und Auswahlverfahren. Bewahren Sie Kopien wichtiger Inhalte auf.",
        },
        {
          h: "14. Anwendbares Recht und Kontakt",
          p: `Diese Bedingungen unterliegen brasilianischem Recht. Fragen und Anfragen: ${c.email}.`,
        },
      ],
    },
    privacy: {
      title: "Datenschutzerklärung",
      metaTitle: "Datenschutzerklärung | FlashPilot",
      metaDesc: "Wie FlashPilot Ihre personenbezogenen Daten erhebt, nutzt, speichert und schützt.",
      seeAlso: "Siehe auch die Nutzungsbedingungen.",
      sections: (c) => [
        {
          h: "1. Verantwortlich für Ihre Daten",
          p: `FlashPilot wird von Marcelo Guimarães betrieben. Für Datenschutzfragen wenden Sie sich an den Datenschutzbeauftragten: ${c.email}.`,
        },
        {
          h: "2. Welche Daten wir erheben",
          ul: [
            "Anmeldung: E-Mail und Passwort (das Passwort wird verschlüsselt gespeichert und ist für uns nie sichtbar).",
            "Lerninhalte: Fächer, Themen, Lernkarten, Notizen, Mindmaps, Bilder und Audios, die Sie erstellen oder hochladen.",
            "Nutzung: Wiederholungsdaten, Bewertungen, Sitzungshistorie und Statistiken.",
            "PilotAI-Funktionen: der bei jeder Aktion gesendete Text und die verbrauchten FlashCoins.",
            "Käufe: Transaktionskennung, Produkt, Betrag, Währung und Gültigkeit des Zugangs. Kartendaten verarbeitet nur der Zahlungsdienstleister.",
            "Stimme: Beim Diktat wird das Audio zur Transkription gesendet und danach nicht aufbewahrt.",
          ],
        },
        {
          h: "3. Zwecke der Verarbeitung",
          ul: [
            "Konto erstellen, Zugang authentifizieren und Ihre Inhalte speichern.",
            "Wiederholungen, Berichte und Lernfortschritt berechnen.",
            "Käufe, Abos, FlashCoin-Guthaben und Paketgültigkeit verarbeiten.",
            "Wiederholungserinnerungen senden, wenn Sie diese Option aktivieren.",
            "Betrug, Missbrauch und unzulässige Nutzung verhindern.",
            "Gesetzliche, steuerliche und regulatorische Pflichten erfüllen.",
          ],
        },
        {
          h: "4. Empfänger",
          p: "Wir geben nur weiter, was für den Betrieb nötig ist, an beauftragte Dienstleister: Cloud-Infrastruktur, PilotAI-Anbieter, Zahlungsdienstleister und – falls aktiviert – den Messaging-Dienst für Erinnerungen. Wir verkaufen Ihre Daten nicht und nutzen Ihre Inhalte nicht für Werbung.",
        },
        {
          h: "5. Internationale Übermittlung",
          p: "Einige dieser Dienstleister betreiben Server außerhalb Ihres Landes. In diesen Fällen erfolgt die Übermittlung mit den gesetzlich geforderten Garantien, beschränkt auf die Zwecke dieser Erklärung.",
        },
        {
          h: "6. Speicherdauer",
          p: "Wir speichern Ihre Daten, solange Ihr Konto besteht. Bei einem Löschwunsch entfernen wir Inhalte und Anmeldedaten und behalten nur Kaufbelege sowie gesetzlich vorgeschriebene Daten für die gesetzlichen Fristen.",
        },
        {
          h: "7. Ihre Rechte",
          p: `Sie können jederzeit Bestätigung der Verarbeitung, Auskunft, Berichtigung, Übertragbarkeit, Anonymisierung, Informationen über Weitergaben, Widerruf der Einwilligung und Löschung Ihrer Daten verlangen. Schreiben Sie an ${c.email}; wir antworten innerhalb von 15 Tagen.`,
        },
        {
          h: "8. Sicherheit",
          p: "Wir nutzen verschlüsselte Verbindungen, gehashte Passwörter, Datentrennung pro Nutzer und Rechtekontrolle in der Datenbank. Kein System ist unfehlbar, doch bei einem relevanten Vorfall informieren wir Sie.",
        },
        {
          h: "9. Cookies und lokaler Speicher",
          p: "Wir nutzen nur essenzielle Cookies und lokalen Speicher: Anmeldung halten, Sprache, Design und Lerneinstellungen speichern sowie Ihre Zustimmung zu diesem Hinweis festhalten. Keine Werbe- oder Cross-Site-Tracking-Cookies.",
        },
        {
          h: "10. Minderjährige",
          p: "FlashPilot ist für Personen ab 16 Jahren bestimmt. Unter 16-Jährige dürfen den Dienst nur mit ausdrücklicher Zustimmung eines Elternteils oder Erziehungsberechtigten nutzen.",
        },
        {
          h: "11. Änderungen dieser Erklärung",
          p: "Bei Änderungen veröffentlichen wir die neue Fassung auf dieser Seite mit dem Aktualisierungsdatum. Wesentliche Änderungen kündigen wir in der App an.",
        },
      ],
    },
  },
};

export const EXTRA_DICTS = {
  pt: extraPt,
  "pt-PT": extraPtPT,
  es: extraEs,
  en: extraEn,
  fr: extraFr,
  it: extraIt,
  de: extraDe,
} as const;
