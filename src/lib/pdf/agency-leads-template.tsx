import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { AgencyLeadsResult, AgencyService } from '@/types/analysis'
import { PDF_COLORS } from './colors'

const SERVICE_LABEL: Record<AgencyService, string> = {
  seo: 'SEO',
  ai_automation: 'Automatización IA',
  chatbot: 'Chatbot',
  branding: 'Branding',
  ads: 'Ads',
  web_redesign: 'Rediseño Web',
  crm: 'CRM',
  reputation: 'Reputación',
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: '#0f172a', padding: 32, fontSize: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 12,
  },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  agencyName: { fontSize: 14, fontWeight: 700 },
  cityLine: { fontSize: 9, color: PDF_COLORS.mutedForeground, marginTop: 2 },
  sectionLabel: {
    fontSize: 8,
    color: PDF_COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  leadCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10, marginBottom: 8 },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  leadName: { fontSize: 11, fontWeight: 700 },
  leadScore: { fontSize: 11, fontWeight: 700 },
  leadMeta: { fontSize: 8, color: PDF_COLORS.mutedForeground, marginBottom: 4 },
  leadServices: { fontSize: 8, color: PDF_COLORS.bodyText },
})

function scoreColor(score: number): string {
  if (score >= 70) return PDF_COLORS.primary
  if (score >= 40) return PDF_COLORS.amber
  return PDF_COLORS.rose
}

type Props = {
  result: AgencyLeadsResult
  city: string
  businessType: string | null
  agencyName: string | null
  logoDataUrl: string | null
}

export function AgencyLeadsPdf({ result, city, businessType, agencyName, logoDataUrl }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.agencyName}>{agencyName || 'Opplify.ai'}</Text>
            <Text style={styles.cityLine}>
              {city}{businessType ? ` · ${businessType}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Leads detectados ({result.leads.length})</Text>
        {result.leads.map((lead, i) => (
          <View key={`${lead.business_name}-${i}`} style={styles.leadCard}>
            <View style={styles.leadHeader}>
              <Text style={styles.leadName}>{lead.business_name}</Text>
              <Text style={[styles.leadScore, { color: scoreColor(lead.lead_score) }]}>{lead.lead_score}</Text>
            </View>
            <Text style={styles.leadMeta}>
              {lead.address} · {lead.rating > 0 ? `${lead.rating}★ (${lead.review_count})` : 'Sin rating'}
            </Text>
            {lead.recommended_services.length > 0 && (
              <Text style={styles.leadServices}>
                {lead.recommended_services.map((s) => SERVICE_LABEL[s] ?? s).join(' · ')}
              </Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  )
}
