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

interface TrialDay14EmailProps {
  siteName?: string
  siteUrl?: string
}

/**
 * Texto provisório — o texto definitivo deste e-mail será fornecido depois.
 * Enviado uma única vez no 14º dia de teste (véspera do fim do período de
 * teste de 15 dias), apenas para quem ainda está em fase de teste ativa
 * (nunca para assinantes).
 */
export const TrialDay14Email = ({
  siteName = SITE_NAME,
  siteUrl = SITE_URL,
}: TrialDay14EmailProps) => {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu teste do {siteName} termina amanhã</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${siteUrl}/flashpilot-logo.png`} alt={siteName} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>Seu teste termina amanhã</Heading>
            <Text style={text}>
              Amanhã acaba o seu período de teste gratuito do {siteName}. Você vai continuar
              podendo revisar tudo o que já criou, mas para continuar gerando novos flashcards,
              notas, mapas mentais e conversas com o PilotAI, assine o plano Pro.
            </Text>
            <Section style={buttonWrap}>
              <Button style={button} href={`${siteUrl}/home?trial=extend`}>
                Prorrogar mais 5 dias
              </Button>
            </Section>
            <Section style={buttonWrap}>
              <Button style={button} href={`${siteUrl}/store?trial=pro`}>
                Contratar Pro
              </Button>
            </Section>
            <Section style={buttonWrap}>
              <Button style={button} href={`${siteUrl}/home?trial=continue`}>
                Continuar estudando
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TrialDay14Email

export const template = {
  component: TrialDay14Email,
  subject: `Seu teste do ${SITE_NAME} termina amanhã`,
  displayName: 'Régua de teste — dia 14 (provisório)',
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
