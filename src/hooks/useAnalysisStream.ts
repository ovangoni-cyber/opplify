'use client'

import { useState, useCallback } from 'react'
import type { StreamState, SearchParams, AnalysisResult } from '@/types/analysis'

const JSON_DELIMITER = '---JSON---'
const CACHED_MARKER = '---CACHED---'

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    phase: 'idle',
    summary: '',
    result: null,
    error: null,
  })

  const analyze = useCallback(async (params: SearchParams) => {
    setState({ phase: 'loading', summary: '', result: null, error: null })

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const err = await res.json()
        setState((s) => ({ ...s, phase: 'error', error: err.error ?? 'Error desconocido' }))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let isInJsonPhase = false

      setState((s) => ({ ...s, phase: 'streaming_summary' }))

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Entire response is a cache hit
        if (buffer.includes(CACHED_MARKER)) {
          const jsonStart = buffer.indexOf(JSON_DELIMITER)
          if (jsonStart !== -1) {
            const jsonStr = buffer.slice(jsonStart + JSON_DELIMITER.length).trim()
            try {
              const result: AnalysisResult = JSON.parse(jsonStr)
              setState({
                phase: 'complete',
                summary: result.executive_summary,
                result,
                error: null,
              })
            } catch {
              setState((s) => ({
                ...s,
                phase: 'error',
                error: 'Error al leer resultado cacheado',
              }))
            }
          }
          return
        }

        if (!isInJsonPhase) {
          const delimIdx = buffer.indexOf(JSON_DELIMITER)
          if (delimIdx !== -1) {
            // Transition: everything before delimiter is the summary
            const summary = buffer.slice(0, delimIdx)
            buffer = buffer.slice(delimIdx + JSON_DELIMITER.length)
            isInJsonPhase = true
            setState((s) => ({ ...s, summary, phase: 'streaming_json' }))
          } else {
            // Still streaming summary text — update progressively
            setState((s) => ({ ...s, summary: buffer }))
          }
        }
        // In JSON phase, just accumulate — parse when stream ends
      }

      // Parse structured JSON from remaining buffer
      if (isInJsonPhase && buffer.trim()) {
        try {
          const match = buffer.trim().match(/\{[\s\S]*\}/)
          if (!match) throw new Error('No JSON object')
          const result: AnalysisResult = JSON.parse(match[0])
          setState({
            phase: 'complete',
            summary: result.executive_summary,
            result,
            error: null,
          })
        } catch {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: 'Error al parsear el análisis. Intenta de nuevo.',
          }))
        }
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Error de conexión',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ phase: 'idle', summary: '', result: null, error: null })
  }, [])

  return { state, analyze, reset }
}
