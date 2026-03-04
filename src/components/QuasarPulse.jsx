import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

export default function QuasarPulse() {
  const meshRef = useRef()
  const { scene } = useThree()

  useFrame(() => {
    const { pulseIntensity = 0 } = scene.userData
    if (!meshRef.current) return
    const visible = pulseIntensity > 0.005
    meshRef.current.visible = visible
    if (visible) {
      // Sphere expands outward like a shockwave
      const scale = 0.5 + pulseIntensity * 16
      meshRef.current.scale.setScalar(scale)
      // Super bright to blow out the bloom
      const brightness = pulseIntensity * 55
      meshRef.current.material.color.setRGB(brightness, brightness, brightness)
    }
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial toneMapped={false} />
    </mesh>
  )
}
