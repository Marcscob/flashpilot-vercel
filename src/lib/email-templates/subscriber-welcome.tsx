import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'FlashPilot'
const SITE_URL = 'https://flashpilot.net'

interface SubscriberWelcomeEmailProps {
  siteName?: string
  siteUrl?: string
  /** Nome legível do plano assinado (ex.: "FlashPilot Pro" ou "FlashPilot Pro 2"). */
  planName?: string
  /** Quando true, o conteúdo destaca o pacote superior para heavy users. */
  isPro2?: boolean
}

/**
 * Texto provisório — o texto definitivo deste e-mail será fornecido depois.
 * Enviado uma única vez quando o usuário se torna assinante (inclui quem
 * assina ainda durante o período de teste). Distinto do e-mail de boas-vindas
 * ao kit gratuito (welcome.tsx) e da régua de reengajamento/encerramento do
 * teste (trial-day9 / trial-day14 / trial-ended).
 */
export const SubscriberWelcomeEmail = ({
  siteName = SITE_NAME,
  siteUrl = SITE_URL,
  planName,
  isPro2 = false,
}: SubscriberWelcomeEmailProps) => {
  const plan = planName ?? `${siteName} Pro`
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Bem-vindo ao {plan}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${siteUrl}/flashpilot-logo.png`} alt={siteName} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>Bem-vindo ao {plan}!</Heading>
            {isPro2 ? (
              <Text style={text}>
                Sua assinatura está ativa. Você agora tem o pacote mais completo do {siteName}:
                até 2.200 flashcards gerados por ciclo e 400 FlashCoins incluídas a cada cobrança,
                além de cotas ampliadas para mapas mentais, formatação de notas e conversas com o
                PilotAI. Obrigado por confiar no {siteName}.
              </Text>
            ) : (
              <Text style={text}>
                Sua assinatura está ativa. Agora você tem até 700 flashcards gerados por ciclo e
                150 FlashCoins incluídas a cada cobrança, além de cotas maiores para mapas mentais,
                formatação de notas e conversas com o PilotAI. Obrigado por confiar no {siteName}.
              </Text>
            )}
            <Section style={buttonWrap}>
              <Button style={button} href={siteUrl}>
                Abrir o {siteName}
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default SubscriberWelcomeEmail

export const template = {
  component: SubscriberWelcomeEmail,
  subject: (data: Record<string, any>) =>
    `Bem-vindo ao ${data?.planName ?? `${SITE_NAME} Pro`}!`,
  displayName: 'Boas-vindas ao assinante (provisório)',
  previewData: { siteName: SITE_NAME, siteUrl: SITE_URL },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, Helvetica, sans-serif',
}
const container = { padding: '24px 16px', maxWidth: '600px' }
const logoWrap = { textAlign: 'center' as const, padding: '0 0 16px' }
const logo = { margin: '0 auto', display: 'block' }
const card = {
  backgroundColor: '#faf6ee',
  border: '1px solid #e7ded0',
  borderRadius: '14px',
  padding: '28px 26px',
}
const h1 = {
  fontSize: '23px',
  fontWeight: 'bold' as const,
  color: '#1d2233',
  margin: '0 0 16px',
  lineHeight: '1.3',
}
const text = {
  fontSize: '14px',
  color: '#4a4f60',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const buttonWrap = { textAlign: 'center' as const, padding: '4px 0 8px' }
const button = {
  backgroundColor: '#e2680f',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  border: '1px solid #e2680f',
  borderRadius: '10px',
  padding: '13px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}
