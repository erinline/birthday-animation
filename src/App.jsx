import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'

export default function App() {
  return (
    <Canvas
      style={{ width: '100vw', height: '100vh', background: '#000' }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <Scene />
    </Canvas>
  )
}
