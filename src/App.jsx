import { Canvas } from '@react-three/fiber'
import { useRef, useState, useEffect } from 'react'
import Scene from './components/Scene'

function NarrativeText({ text, duration = 4, xPos = 0.5 }) {
  const [displayed, setDisplayed] = useState('')
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setFading(false)
    const revealMs = (duration * 0.45 * 1000) / text.length
    let i = 0
    const reveal = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(reveal)
    }, revealMs)
    const fadeTimer = setTimeout(() => setFading(true), duration * 0.78 * 1000)
    return () => { clearInterval(reveal); clearTimeout(fadeTimer) }
  }, [text, duration])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'flex-end',
      paddingBottom: '50px',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <p style={{
        margin: 0,
        maxWidth: '660px',
        textAlign: 'center',
        position: 'absolute',
        left: `${xPos * 100}%`,
        transform: 'translateX(-50%)',
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: '2.15rem',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        letterSpacing: '0.1em',
        lineHeight: '1.6',
        transition: fading ? `opacity ${duration * 0.22}s ease-out` : 'none',
        opacity: fading ? 0 : 0.72,
      }}>
        {displayed}
      </p>
    </div>
  )
}

export default function App() {
  const timelineRef = useRef({ started: false, phase: 'IDLE', phaseElapsed: 0 })
  const [uiPhase, setUiPhase] = useState('IDLE')

  function handleClick() {
    if (uiPhase === 'IDLE') {
      timelineRef.current.started = true
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas
        style={{ width: '100%', height: '100%', background: '#000' }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [-7, 0, 12], fov: 30 }}
      >
        <Scene timelineRef={timelineRef} onPhaseChange={setUiPhase} />
      </Canvas>

      {uiPhase === 'IDLE' && (
        <div
          onClick={handleClick}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '1.2rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: 'system-ui, sans-serif',
            animation: 'bday-pulse 2s ease-in-out infinite',
            margin: 0,
          }}>
            If ur Gus, clik anywhere 2 entar
          </p>
        </div>
      )}

      {uiPhase === 'DUST_TEXT' && (
        <NarrativeText text="before, being was doing a big quiet" xPos={0.25}/>
      )}

      {uiPhase === 'RIBBON_TEXT' && (
        <NarrativeText text="and ego was like wew panko pew-- so many jibbers, she was mostly only jabber" xPos={0.75}/>
      )}

      {uiPhase === 'TOGETHER_TEXT' && (
        <NarrativeText text="but when they met... something new Happened" xPos={0.5}/>
      )}

      {uiPhase === 'EXPLOSION_TEXT' && (
        <NarrativeText text="being saw new things, through movement. ego learned presence. and they didn't live happily ever after, past tense. they're living now, and there is only now." duration={12.0} xPos={0.25}/>
      )}
      
      {uiPhase === 'CALM' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <p style={{
            color: 'white',
            fontSize: '3rem',
            fontFamily: 'Georgia, serif',
            letterSpacing: ' 0.08em',
            animation: 'bday-fadein 1.5s ease-out 1s both',
            margin: 0,
            textShadow: '0 0 40px rgba(255,255,255,0.4)',
          }}>
            heppy bridthday, ilyew gos
          </p>
        </div>
      )}

      <style>{`
        @keyframes bday-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.9; }
        }
@keyframes bday-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
