'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ShieldCheck, Brain, Tag, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

interface Analysis {
  score:          number
  verdict:        string
  resume:         string
  points_forts:   string[]
  points_faibles: string[]
  erreurs:        string[]
  conseils:       string[]
  gestion_risque: string
  psychologie:    string
  tag_suggestion: string | null
}

interface Props {
  tradeId:   string
  isClosed:  boolean
  plan:      string
  existingAnalysis?: Analysis | null
  existingScore?:    number | null
  analyzedAt?:       string | null
}

// ── Score ring ────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const s     = Math.round(score * 100)
  const color = s >= 70 ? '#00d17a' : s >= 40 ? '#f59e0b' : '#ff3b5c'
  const r     = 28
  const circ  = 2 * Math.PI * r
  const dash  = (s / 100) * circ

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5"
          className="text-light-hover dark:text-dark-hover" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-mono font-bold" style={{ color }}>{s}</span>
        <span className="text-[9px] font-mono text-gray-400">/100</span>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────────────────
function Section({ icon, title, color, items, single }: {
  icon:    React.ReactNode
  title:   string
  color:   string
  items?:  string[]
  single?: string
}) {
  if ((!items || items.length === 0) && !single) return null
  return (
    <div className="card p-4">
      <div className={cn('flex items-center gap-2 mb-3 text-xs font-mono font-semibold uppercase tracking-wider', color)}>
        {icon}{title}
      </div>
      {single ? (
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{single}</p>
      ) : (
        <ul className="space-y-2">
          {items!.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ChevronRight size={13} className={cn('mt-0.5 flex-shrink-0', color)} />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function TradeAIAnalysis({ tradeId, isClosed, plan, existingAnalysis, existingScore, analyzedAt }: Props) {
  const [analysis, setAnalysis]   = useState<Analysis | null>(existingAnalysis || null)
  const [score,    setScore]      = useState<number | null>(existingScore ?? null)
  const [date,     setDate]       = useState<string | null>(analyzedAt || null)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')

  const canAnalyze = isClosed && plan !== 'free' || (plan === 'free')

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      const res   = await fetch(`${API}/trades/${tradeId}/ai-analyze`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.upgrade_required) {
          setError('Limite de 5 analyses IA/mois atteinte sur le plan Free. Passe au plan Pro pour des analyses illimitées.')
        } else {
          setError(data.error || 'Erreur lors de l\'analyse')
        }
        return
      }
      setAnalysis(data.analysis)
      setScore(data.score)
      setDate(new Date().toISOString())
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  if (!isClosed) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center gap-3 text-center">
        <Sparkles size={28} className="text-gray-400" />
        <p className="text-sm font-mono text-gray-500">L'analyse IA est disponible uniquement pour les trades clôturés.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header card ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <Sparkles size={14} className="text-accent" />
            </div>
            <h3 className="font-display font-700 text-sm uppercase tracking-wider text-gray-900 dark:text-white">
              Analyse IA
            </h3>
            {plan === 'free' && (
              <span className="text-[9px] font-mono bg-yellow-400/10 text-yellow-500 border border-yellow-400/20 px-1.5 py-0.5 rounded-full">
                5/mois · Free
              </span>
            )}
          </div>
          {date && (
            <span className="text-[10px] font-mono text-gray-400">
              {new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>

        {analysis && score !== null ? (
          /* ── Has analysis : show score + verdict + re-analyze button ── */
          <div className="flex items-center gap-5 mt-4">
            <ScoreRing score={score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug mb-3">
                {analysis.verdict}
              </p>
              <button onClick={run} disabled={loading}
                className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-accent transition-colors">
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Relancer l'analyse
              </button>
            </div>
          </div>
        ) : (
          /* ── No analysis yet ── */
          <div className="mt-4">
            <p className="text-sm text-gray-400 font-body mb-4 leading-relaxed">
              Claude analyse ton trade : gestion du risque, psychologie, points forts et axes d'amélioration.
            </p>
            {error && (
              <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-3 flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
            <button onClick={run} disabled={loading}
              className="btn-primary flex items-center gap-2 text-sm">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyse en cours…</>
                : <><Sparkles size={14} />Analyser ce trade</>
              }
            </button>
          </div>
        )}

        {error && analysis && (
          <div className="mt-3 bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2 rounded-lg flex items-center gap-2">
            <AlertTriangle size={11} />{error}
          </div>
        )}
      </div>

      {/* ── Analysis blocks (only when analysis exists) ── */}
      {analysis && (
        <>
          {/* Résumé */}
          <div className="card p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.resume}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section
              icon={<TrendingUp size={12} />}
              title="Points forts"
              color="text-profit"
              items={analysis.points_forts}
            />
            <Section
              icon={<TrendingDown size={12} />}
              title="Points faibles"
              color="text-loss"
              items={analysis.points_faibles}
            />
          </div>

          {analysis.erreurs?.length > 0 && (
            <Section
              icon={<AlertTriangle size={12} />}
              title="Erreurs identifiées"
              color="text-yellow-500"
              items={analysis.erreurs}
            />
          )}

          <Section
            icon={<Lightbulb size={12} />}
            title="Conseils"
            color="text-accent"
            items={analysis.conseils}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analysis.gestion_risque && (
              <Section
                icon={<ShieldCheck size={12} />}
                title="Gestion du risque"
                color="text-accent"
                single={analysis.gestion_risque}
              />
            )}
            {analysis.psychologie && (
              <Section
                icon={<Brain size={12} />}
                title="Psychologie"
                color="text-purple-400"
                single={analysis.psychologie}
              />
            )}
          </div>

          {analysis.tag_suggestion && (
            <div className="card p-4 flex items-center gap-3">
              <Tag size={13} className="text-accent flex-shrink-0" />
              <div>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-0.5">Setup suggéré</p>
                <span className="text-xs font-mono bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                  {analysis.tag_suggestion}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
