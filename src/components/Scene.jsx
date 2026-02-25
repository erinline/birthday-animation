import { PerspectiveCamera, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import RibbonField from './RibbonField'
import Effects from './Effects'
import useMouse from '../hooks/useMouse'

function MouseSync() {
  const mouseWorld = useMouse()
  const { scene } = useThree()

  useFrame(() => {
    scene.userData.mouseWorld = mouseWorld.current
  })

  return null
}

export default function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={60} />
      <OrbitControls enablePan={false} enableZoom={false} />
      <MouseSync />
      <RibbonField />
      <Effects />
    </>
  )
}
