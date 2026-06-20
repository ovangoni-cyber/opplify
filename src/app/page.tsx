'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchForm } from '@/components/search/SearchForm'
import { ModeToggle } from '@/components/search/ModeToggle'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useAuth } from '@/hooks/useAuth'
import type { SearchParams, AppMode } from '@/types/analysis'

const FEATURES = [
  {
    n: '01',
    title: 'Análisis de mercado',
    desc: 'Detecta nichos sin explotar, saturación real y puntos de entrada óptimos con datos frescos de Google Places.',
    tag: 'Investigación',
  },
  {
    n: '02',
    title: 'Prospección de leads',
    desc: 'Identifica negocios con mayor potencial para contratar servicios digitales, ordenados por score de oportunidad.',
    tag: 'Agencias',
  },
  {
    n: '03',
    title: 'Análisis semántico de reseñas',
    desc: 'Claude procesa cientos de reseñas reales para extraer pain points, patrones de insatisfacción y huecos competitivos.',
    tag: '',
  },
]

const STEPS = [
  { n: '01', text: 'Elige una ciudad y el tipo de negocio que quieres analizar.' },
  { n: '02', text: 'La IA cruza datos de Google Places con análisis semántico de reseñas.' },
  { n: '03', text: 'Obtienes un informe con oportunidades y leads ordenados por prioridad.' },
]

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<AppMode>('market_research')
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (user) router.replace('/inicio')
  }, [user, authLoading, router])

  const handleSubmit = (params: SearchParams) => {
    const qs = new URLSearchParams({ city: params.city, mode: params.mode })
    if (params.business_type) qs.set('business_type', params.business_type)
    router.push(`/results?${qs.toString()}`)
  }

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-heading font-bold text-base tracking-tight">
            Opplify<span className="text-primary">.</span>ai
          </span>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <a
              href="/auth/login"
              className="btn-press text-xs font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Acceder
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative home-grid pt-32 pb-0 px-6 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/[0.06] blur-[120px]" />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Top label */}
          <div className="animate-fade-up flex justify-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              Google Places + Claude AI · En tiempo real
            </div>
          </div>

          {/* Split layout */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center pb-24">
            {/* Left: copy */}
            <div>
              <h1 className="animate-fade-up animate-delay-1 font-heading font-bold leading-[1.05] text-4xl sm:text-5xl lg:text-6xl" style={{ letterSpacing: '-0.03em' }}>
                Inteligencia<br />
                de mercado<br />
                <span className="text-primary">impulsada por IA</span>
              </h1>
              <p className="animate-fade-up animate-delay-2 mt-7 text-base text-muted-foreground leading-relaxed max-w-md">
                Analiza cualquier ciudad, detecta nichos sin explotar y encuentra
                negocios que necesitan tus servicios — con datos reales de Google Places.
              </p>
              <div className="animate-fade-up animate-delay-3 mt-10 flex items-center gap-4">
                <Link
                  href="/buscar"
                  className="btn-press px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Analizar ahora →
                </Link>
                <a href="/precios" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Ver precios
                </a>
              </div>
            </div>

            {/* Right: mock analysis card */}
            <div className="animate-fade-up animate-delay-2 relative">
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Madrid · Restaurantes</span>
                  </div>
                  <span className="text-[10px] text-primary border border-primary/30 px-2 py-0.5 rounded">Completado</span>
                </div>
                {/* Score row */}
                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="px-5 py-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-1">Score</p>
                    <p className="font-heading font-bold text-4xl text-primary tabular-nums leading-none">78</p>
                    <p className="text-xs text-muted-foreground mt-1">/100 · Buena oportunidad</p>
                  </div>
                  <div className="px-5 py-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-1">Saturación</p>
                    <p className="font-heading font-bold text-lg text-amber-400 mt-1">Medio</p>
                    <p className="text-xs text-muted-foreground mt-1">47 negocios · 3.9★ avg</p>
                  </div>
                </div>
                {/* Opportunities */}
                <div className="divide-y divide-border">
                  {[
                    { score: 84, title: 'Cocina asiática fusión', tag: 'Categoría faltante' },
                    { score: 71, title: 'Servicio de delivery propio', tag: 'Punto débil' },
                    { score: 63, title: 'Menú vegano diferenciado', tag: 'Tendencia' },
                  ].map((op) => (
                    <div key={op.title} className="grid grid-cols-[2.5rem_1fr_auto] gap-3 px-5 py-5 items-center">
                      <span className="font-heading font-bold text-base text-primary tabular-nums">{op.score}</span>
                      <span className="text-xs font-medium">{op.title}</span>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 border border-border/60 px-1.5 py-0.5 rounded whitespace-nowrap hidden sm:block">{op.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Subtle glow under card */}
              <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 h-16 w-3/4 bg-primary/10 blur-2xl rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section-divider py-24 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-[1fr_2fr] gap-20 items-start">
          <div>
            <p className="label-eyebrow mb-5">Capacidades</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Dos modos,<br />un solo análisis
            </h2>
          </div>
          <div className="divide-y divide-border">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="stagger-item grid grid-cols-[1fr_auto] gap-8 py-7 group"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="space-y-1">
                  <h3 className="font-heading font-semibold text-sm text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
                {f.tag && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 border border-border/50 px-2 py-1 rounded self-start whitespace-nowrap">
                    {f.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="section-divider py-24 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-[1fr_2fr] gap-20 items-start">
          <div>
            <p className="label-eyebrow mb-5">Proceso</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              De la búsqueda<br />al informe en segundos
            </h2>
          </div>
          <div className="divide-y divide-border">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="stagger-item flex gap-6 py-7"
                style={{ animationDelay: `${(i + 3) * 80}ms` }}
              >
                <span className="font-heading text-sm font-bold text-primary/50 tabular-nums mt-0.5 shrink-0 w-6">{s.n}</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEARCH ── */}
      <section id="buscar" className="section-divider py-24 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-[1fr_2fr] gap-20 items-start">
          <div>
            <p className="label-eyebrow mb-5">Análisis</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
              Empieza ahora
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Elige un modo, escribe ciudad y tipo de negocio.
              El análisis tarda entre 30 y 60 segundos.
            </p>
            <div className="mt-10 flex flex-col gap-3">
              {['Datos actualizados de Google Places', 'Análisis en español', 'Resultados en caché sin coste'].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <span className="h-px w-4 bg-primary/50 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <ModeToggle mode={mode} onChange={setMode} />
            <SearchForm mode={mode} onSubmit={handleSubmit} />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="section-divider py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-heading font-bold text-sm tracking-tight">
            Opplify<span className="text-primary">.</span>ai
          </span>
          <p className="text-xs text-muted-foreground">
            Google Places · Claude AI · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

    </div>
  )
}
