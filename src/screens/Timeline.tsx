import { useEffect, useRef, useState } from 'react'
import type { Snapshot } from '../state/store'
import { DAY_END, DAY_START, SUNSET } from '../data/course'
import { upcomingMeetings, type StationProj } from '../model/projection'
import { fmtClock, fmtT } from '../model/time'
import { Sheet } from '../components/Sheet'
import { MeetEditor } from '../components/MeetEditor'
import { go } from '../state/router'

const PAD = 24
const y = (ts: number) => Math.round((ts - DAY_START) / 60_000) + PAD
const HEIGHT = y(DAY_END) + PAD

/** Day view, Sat 6:00 AM → Sun 2:15 AM at ~1 px per minute. Crew stops: filled cyan. Other aid stations: grey outline. */
export function Timeline({ snap }: { snap: Snapshot }) {
  const [pick, setPick] = useState<{ runner: string; sp: StationProj } | null>(null)
  const nowRef = useRef<HTMLDivElement>(null)
  const meetings = upcomingMeetings(snap.projs, snap.state)
  const tight = new Set(meetings.filter(m => m.clashes.length).map(m => `${m.runnerId}:${m.sp.st.id}`))
  const now = snap.now
  const nowIn = now >= DAY_START && now <= DAY_END

  // open scrolled to "now" (instantly — no animation)
  useEffect(() => {
    if (nowIn && nowRef.current) window.scrollTo({ top: Math.max(0, nowRef.current.getBoundingClientRect().top + window.scrollY - 220), behavior: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hours: number[] = []
  for (let t = DAY_START; t <= DAY_END; t += 3600_000) hours.push(t)

  return (
    <div className="page">
      <h1 className="title">Timeline</h1>
      <div className="legend">
        <span><span className="sw" style={{ background: 'var(--crew)' }} />Crew can meet</span>
        <span><span className="sw" style={{ border: '2px solid #777' }} />Aid station, no crew</span>
        <span><span className="sw" style={{ background: 'var(--crew)', border: '3px solid #fff' }} />Planned meeting</span>
        <span>✓ arrived · ~ projected · ▸ plan</span>
        <span className="red">— cut-off</span>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>Tap a cyan stop to plan who meets that runner there.</div>
      <div className="tl">
        <div className="tl-head">
          <div />
          {snap.projs.map(p => <div key={p.runnerId}>{p.name}<div className="tiny muted">{p.race.name}{!p.hasPlan ? ' · no plan' : ''}{p.dropped ? ' · DROP' : ''}</div></div>)}
        </div>
        <div className="tl-body" style={{ height: HEIGHT }}>
          <div className="tl-gutter">
            {hours.map(h => <div key={h} className="hr" style={{ top: y(h) }}>{fmtClock(h).replace(':00', '')}</div>)}
          </div>
          {hours.map(h => <div key={'l' + h} className="tl-hline" style={{ top: y(h) }} />)}
          <div className="tl-sun" style={{ top: y(SUNSET) }}><span>sunset ~{fmtClock(SUNSET)}</span></div>
          {nowIn && <div className="tl-now" ref={nowRef} style={{ top: y(now) }}><span>now</span></div>}
          {snap.projs.map(p => (
            <div key={p.runnerId} className="tl-col">
              {p.stations.map(sp => {
                if (sp.cutoff == null || sp.cutoff > DAY_END) return null
                return <div key={'c' + sp.st.id} className="tl-cut" style={{ top: y(sp.cutoff) }}><span>{sp.st.code} cut</span></div>
              })}
              {p.stations.map(sp => {
                const t = sp.actual ?? sp.proj ?? (p.dropped ? null : sp.plan)
                if (t == null || t < DAY_START - 30 * 60_000 || t > DAY_END + 30 * 60_000) return null
                const meet = !!sp.meet?.meeting
                const isTight = tight.has(`${p.runnerId}:${sp.st.id}`)
                const cls = `chipst ${sp.st.crew ? 'crew' : ''} ${meet ? 'meet' : ''} ${isTight ? 'tight' : ''}`
                const mark = sp.actual != null ? '✓' : sp.proj != null ? '~' : '▸'
                return (
                  <div key={sp.st.id}>
                    {sp.plan != null && sp.actual == null && Math.abs(sp.plan - t) > 3 * 60_000 && <div className="tl-tick" style={{ top: y(sp.plan) }} title={`plan ${fmtT(sp.plan)}`} />}
                    <button className={cls} style={{ top: y(t) }} onClick={() => (sp.st.crew ? setPick({ runner: p.runnerId, sp }) : go('runner/' + p.runnerId))}
                      aria-label={`${p.name} ${sp.st.name} ${fmtT(t)}${meet ? ', crew meeting' : ''}`}>
                      <span className="c">{sp.st.code}</span> {mark}{fmtClock(t).replace(' ', '').toLowerCase().replace('m', '')}
                      {meet && <span className="w">MEET{sp.meet?.who ? ` · ${sp.meet.who}` : ''}</span>}
                      {isTight && <span className="w">⚠ tight</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <Sheet open={!!pick} onClose={() => setPick(null)}>
        {pick && <MeetEditor snap={snap} runnerId={pick.runner} stationId={pick.sp.st.id} onDone={() => setPick(null)} />}
      </Sheet>
    </div>
  )
}
