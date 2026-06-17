import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { AnalysisResult } from '@/types/analysis'
import { PDF_COLORS } from './colors'

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
    marginBottom: 6,
    marginTop: 14,
  },
  card: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 12 },
  summaryText: { fontSize: 10, lineHeight: 1.5 },
  scoreRow: { flexDirection: 'row', gap: 16 },
  scoreBox: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 12 },
  scoreValue: { fontSize: 24, fontWeight: 700 },
  scoreLabel: { fontSize: 8, color: PDF_COLORS.mutedForeground, marginTop: 4 },
  rowItem: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  rowItemLast: { paddingVertical: 8 },
  rowTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  rowDescription: { fontSize: 9, color: PDF_COLORS.bodyText },
})

function scoreColor(score: number): string {
  if (score >= 70) return PDF_COLORS.primary
  if (score >= 40) return PDF_COLORS.amber
  return PDF_COLORS.rose
}

const SATURATION_LABELS: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  saturado: 'Saturado',
}

const FREQ_LABEL: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

type Props = {
  result: AnalysisResult
  city: string
  businessType: string | null
  agencyName: string | null
  logoDataUrl: string | null
}

export function MarketResearchPdf({ result, city, businessType, agencyName, logoDataUrl }: Props) {
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

        <Text style={styles.sectionLabel}>Resumen ejecutivo</Text>
        <View style={styles.card}>
          <Text style={styles.summaryText}>{result.executive_summary}</Text>
        </View>

        <View style={[styles.scoreRow, { marginTop: 14 }]}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { color: scoreColor(result.opportunity_score) }]}>
              {result.opportunity_score}/100
            </Text>
            <Text style={styles.scoreLabel}>{result.opportunity_label}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>
              {SATURATION_LABELS[result.market.saturation_level] ?? result.market.saturation_level}
            </Text>
            <Text style={styles.scoreLabel}>
              {result.market.total_businesses_analyzed} negocios · {result.market.avg_rating}★ promedio
            </Text>
          </View>
        </View>

        {result.opportunities.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Oportunidades detectadas ({result.opportunities.length})</Text>
            <View style={styles.card}>
              {result.opportunities.map((op, i) => (
                <View
                  key={`${op.title}-${i}`}
                  style={i === result.opportunities.length - 1 ? styles.rowItemLast : styles.rowItem}
                >
                  <Text style={styles.rowTitle}>{op.opportunity_score} · {op.title}</Text>
                  <Text style={styles.rowDescription}>{op.description}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {result.pain_points.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Puntos débiles del mercado ({result.pain_points.length})</Text>
            <View style={styles.card}>
              {result.pain_points.map((pp, i) => (
                <View
                  key={`${pp.issue}-${i}`}
                  style={i === result.pain_points.length - 1 ? styles.rowItemLast : styles.rowItem}
                >
                  <Text style={styles.rowTitle}>
                    {FREQ_LABEL[pp.frequency] ?? pp.frequency} · {pp.issue}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Page>
    </Document>
  )
}
