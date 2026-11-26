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

interface TrialEndedEmailProps {
  siteName?: string
  siteUrl?: string
}

/**
 * Texto provisório — o texto definitivo deste e-mail será fornecido depois.
 * Enviado uma única vez quando o período de teste (15 ou 20 dias) termina
 * sem assinatura ativa.
 */
export const TrialEndedEmail = ({
  siteName = SITE_NAME,
  siteUrl = SITE_URL,
}: TrialEndedEmailProps) => {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu período de teste do {siteName} acabou</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${siteUrl}/flashpilot-logo.png`} alt={siteName} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>Seu período de teste acabou</Heading>
            <Text style={text}>
              Você já pode continuar revendo tudo o que criou no {siteName}, mas para criar
              novos flashcards, notas, mapas mentais ou conversar com o PilotAI, assine o plano Pro.
            </Text>
            <Section style={buttonWrap}>
              <Button style={button} href={`${siteUrl}/store`}>
                Assinar Plano Pro
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TrialEndedEmail

export const template = {
  component: TrialEndedEmail,
  subject: 'Seu período de teste do FlashPilot acabou',
  displayName: 'Período de teste encerrado (provisório)',
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
