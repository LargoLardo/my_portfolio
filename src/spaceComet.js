import * as THREE from 'three'

export function createComet(particleTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')
  const pixels = context.createImageData(256, 64)
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const t = x / 255
      const distance = Math.abs(y / 63 - 0.5)
      const width = 0.025 + (1 - t) * 0.25
      const alpha = Math.exp(-distance * distance / (width * width)) * t ** 1.4 * (1 - Math.exp(-t * 20))
      const i = (y * 256 + x) * 4
      pixels.data[i] = 150 + t * 90
      pixels.data[i + 1] = 190 + t * 55
      pixels.data[i + 2] = 255
      pixels.data[i + 3] = alpha * 175
    }
  }
  context.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const tail = new THREE.Mesh(
    new THREE.PlaneGeometry(21, 2.8).translate(-10.5, 0, 0),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, side: THREE.DoubleSide }),
  )
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTexture, color: 0xdaedff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }))
  head.scale.setScalar(0.85)
  const group = new THREE.Group()
  group.add(tail, head)
  group.visible = false

  const start = new THREE.Vector3()
  const end = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const toCamera = new THREE.Vector3()
  const side = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)
  let nextArrival = 12 + Math.random() * 7
  let age = 0
  let duration = 6

  return {
    group,
    update(elapsed, dt, camera, reducedMotion) {
      if (reducedMotion) {
        group.visible = false
        nextArrival = elapsed + 12
        return
      }
      if (!group.visible && elapsed >= nextArrival) {
        camera.getWorldDirection(direction)
        const heading = Math.atan2(-direction.x, -direction.z)
        const travelSign = Math.random() > 0.5 ? 1 : -1
        const height = 33 + Math.random() * 25
        start.set(-60 * travelSign, height, -115).applyAxisAngle(up, heading).add(camera.position)
        end.set(65 * travelSign, height - 12 - Math.random() * 10, -115).applyAxisAngle(up, heading).add(camera.position)
        direction.subVectors(end, start).normalize()
        duration = 5 + Math.random() * 3
        age = 0
        group.visible = true
      }
      if (!group.visible) return
      age += dt
      const progress = Math.min(1, age / duration)
      group.position.lerpVectors(start, end, progress)
      // Face the trail toward the viewer while keeping it aligned with its flight.
      toCamera.subVectors(camera.position, group.position)
      side.crossVectors(toCamera, direction).normalize()
      normal.crossVectors(direction, side).normalize()
      tail.quaternion.setFromRotationMatrix(basis.makeBasis(direction, side, normal))
      const fade = Math.sin(progress * Math.PI) ** 0.7
      tail.material.opacity = fade * 0.8
      head.material.opacity = fade
      if (progress === 1) {
        group.visible = false
        nextArrival = elapsed + 28 + Math.random() * 24
      }
    },
  }
}
