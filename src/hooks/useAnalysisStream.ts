'use client'

import { useState, useCallback } from 'react'
import type { StreamState, SearchParams, AnalysisResult } from '@/types/analysis'
import { supabaseBrowser } from '@/lib/supabase-browser'

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
      const { data: sessionData } = await supabaseBrowser.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        if (res.status === 401) {
          setState((s) => ({ ...s, phase: 'error', error: 'ERR_UNAUTHENTICATED' }))
          return
        }
        if (res.status === 402) {
          setState((s) => ({ ...s, phase: 'error', error: 'ERR_NO_CREDITS' }))
          return
        }
        let errorMessage = `Error del servidor (${res.status})`
        try {
          const err = await res.json()
          errorMessage = err.error ?? errorMessage
        } catch {
          // response body is HTML (Next.js error page), not JSON
        }
        setState((s) => ({ ...s, phase: 'error', error: errorMessage }))
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
          setState((s) => ({
            phase: 'complete',
            summary: s.summary || result.executive_summary,
            result,
            error: null,
          }))
        } catch {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: 'Error al parsear el análisis. Intenta de nuevo.',
          }))
        }
      } else if (!isInJsonPhase && buffer.trim()) {
        // Stream ended before JSON delimiter was received
        setState((s) => ({
          ...s,
          phase: 'error',
          error: 'Respuesta incompleta del servidor. Intenta de nuevo.',
        }))
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
