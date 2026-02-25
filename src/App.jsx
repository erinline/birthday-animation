import { Canvas } from '@react-three/fiber'
import { useRef, useState } from 'react'
import Scene from './components/Scene'

export default function App() {
  const timelineRef = useRef({ started: false, phase: 'IDLE', phaseElapsed: 0 })
  const [uiPhase, setUiPhase] = useState('IDLE')

  function handleClick() {
    if (uiPhase === 'IDLE') {
      timelineRef.current.started = true
      setUiPhase('RUNNING')
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas
        style={{ width: '100%', height: '100%', background: '#000' }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [-7, 0, 12], fov: 60 }}
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
            Click anywhere
          </p>
        </div>
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
            letterSpacing: '0.08em',
            animation: 'bday-fadein 1.5s ease-out 1s both',
            margin: 0,
            textShadow: '0 0 40px rgba(255,255,255,0.4)',
          }}>
            Happy Birthday
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
