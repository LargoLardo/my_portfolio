import * as THREE from 'three'
import { makePlanetTexture, makePlanetSurfaceMaterial, makePlanetGeometry } from './spaceMaterials.js'

const TAU = Math.PI * 2
const UP = new THREE.Vector3(0, 1, 0)
const MOON_PALETTES = [
  ['#242b34', '#596575', '#a0adbb', '#d4d7d9'],
  ['#35231d', '#795139', '#b5916e', '#dccbb0'],
  ['#202830', '#405d69', '#83a8ac', '#d0ddda'],
  ['#292338', '#665572', '#aa94ae', '#d6cbd4'],
]

export function rollPlanetCompanions(random = Math.random) {
  const roll = random()
  return { moonCount: roll < 0.35 ? 1 : roll < 0.55 ? 2 : roll < 0.65 ? 3 : 0, ufo: random() < 0.1 }
}

export function rollSystemCompanions(count, random = Math.random) {
  const configs = Array.from({ length: count }, () => rollPlanetCompanions(random))
  const visitors = configs.filter(config => config.ufo)
  if (!visitors.length && count) configs[Math.floor(random() * count)].ufo = true
  while (visitors.length > 2) {
    visitors.splice(Math.floor(random() * visitors.length), 1)[0].ufo = false
  }
  return configs
}

export function companionOpacity(distance, arrivalDistance) {
  return 1 - THREE.MathUtils.smoothstep(distance, arrivalDistance * 1.2, arrivalDistance * 2.8)
}

export function createPlanetCompanions(discovery, particleTexture, config, random = Math.random) {
  const radius = discovery.radius
  const planetClearance = radius * (discovery.planetStyle.rings ? 2.25 : 1.15)
  const group = new THREE.Group()
  group.name = 'planet-companions'
  group.visible = false
  group.userData.config = config
  const moons = []
  const materials = []
  const paletteOffset = Math.floor(random() * MOON_PALETTES.length)
  const sizeOffset = Math.floor(random() * 3), surfaceOffset = Math.floor(random() * 3)
  const orbitalRate = 0.1 + random() * 0.07
  let previousOrbit = planetClearance, previousRadius = 0
  const moonPosition = (moon, time, out) => {
    const angle = moon.phase + time * moon.speed
    return out.set(Math.cos(angle) * moon.orbit, 0, Math.sin(angle) * moon.orbit).applyQuaternion(moon.tilt)
  }
  const register = material => {
    material.transparent = true
    material.userData.baseOpacity = material.opacity
    materials.push(material)
    return material
  }
  for (let i = 0; i < config.moonCount; i++) {
    const moonRadius = radius * (0.09 + ((sizeOffset + i) % 3) * 0.095 + random() * 0.055)
    const orbit = previousOrbit + previousRadius + moonRadius + radius * 0.36
    previousOrbit = orbit
    previousRadius = moonRadius
    const surface = ['dust', 'ice', 'basalt'][(surfaceOffset + i) % 3]
    const style = { surface, cracked: surface === 'ice', craters: surface !== 'ice' }
    const seed = Math.floor(random() * 100000)
    const texture = new THREE.CanvasTexture(makePlanetTexture(MOON_PALETTES[(paletteOffset + i) % MOON_PALETTES.length], seed, style, 256, 128))
    texture.colorSpace = THREE.SRGBColorSpace
    const material = register(makePlanetSurfaceMaterial(texture, seed, style))
    material.color.setScalar(1.4)
    material.emissiveIntensity = 0.72
    material.bumpScale = moonRadius * (surface === 'ice' ? 0.025 : surface === 'basalt' ? 0.045 : 0.1)
    material.userData.detail.value = 1
    const mesh = new THREE.Mesh(makePlanetGeometry(moonRadius, seed, style, 64, 48), material)
    mesh.name = `moon-${i + 1}`
    group.add(mesh)
    moons.push({
      mesh, radius: moonRadius, surface, orbit,
      phase: random() * TAU,
      speed: orbitalRate * (0.85 + random() * 0.3) * (moons.length ? (moons[0].orbit / orbit) ** 1.5 : 1),
      spin: 0.015 + random() * 0.06,
      tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18 + random() * 0.35, random() * TAU, (random() - 0.5) * 0.4)),
    })
  }
  let outerRadius = Math.max(radius * (discovery.planetStyle.rings ? 2.2 : 1.1), ...moons.map(moon => moon.orbit + moon.radius))
  const craft = new THREE.Group()
  craft.name = 'ufo'
  const shipRadius = radius * 0.13
  const a = new THREE.Vector3(), b = new THREE.Vector3(), center = new THREE.Vector3(), delta = new THREE.Vector3()
  const turn = new THREE.Quaternion(), rotation = new THREE.Quaternion()
  const next = new THREE.Vector3(), attitude = new THREE.Matrix4()
  const pathPhase = random() * TAU
  const loopPosition = (body, time, out, orbitTime = time) => {
    const angle = orbitTime * 0.82 + pathPhase + body * 1.7
    const moon = moons[body - 1]
    const distance = moon ? moon.radius + radius * 0.34 : planetClearance + radius * 0.28
    out.set(Math.cos(angle) * distance, Math.sin(angle * 2) * distance * 0.28, Math.sin(angle) * distance * 0.9)
    if (moon) out.applyQuaternion(moon.tilt).add(moonPosition(moon, time, center))
    return out
  }
  const flightPosition = (time, out) => {
    const leg = time / 10
    const body = Math.floor(leg) % (moons.length + 1)
    const start = Math.floor(leg) * 10, progress = leg % 1
    if (!moons.length || progress < 0.65) {
      const orbitTime = moons.length ? start + 6.5 * THREE.MathUtils.smoothstep(progress, 0, 0.65) : time
      loopPosition(body, time, out, orbitTime)
    } else {
      // Fixed departure/arrival points keep the arc from flipping when moving
      // moons pass opposite sides of the planet during a transfer.
      const blend = THREE.MathUtils.smoothstep(progress, 0.65, 1)
      loopPosition(body, start + 6.5, a)
      loopPosition((body + 1) % (moons.length + 1), start + 10, b)
      const distanceA = a.length(), distanceB = b.length()
      a.divideScalar(distanceA); b.divideScalar(distanceB)
      turn.setFromUnitVectors(a, b)
      rotation.identity().slerp(turn, blend)
      out.copy(a).applyQuaternion(rotation).multiplyScalar(THREE.MathUtils.lerp(distanceA, distanceB, blend))
      // Pass above the moving moons while preserving the camera's system bounds.
      out.y += Math.sin(Math.PI * blend) ** 2 * radius * 1.2
      out.setLength(THREE.MathUtils.lerp(distanceA, distanceB, blend))
    }
    // Smooth clearance keeps the saucer outside both the globe/rings and moons.
    const clear = (position, minimum) => {
      delta.subVectors(out, position)
      const distance = delta.length()
      const safe = 0.5 * (distance + minimum + Math.sqrt((distance - minimum) ** 2 + (radius * 0.035) ** 2))
      out.copy(position).addScaledVector(delta, safe / Math.max(distance, 0.00001))
    }
    moons.forEach(moon => clear(moonPosition(moon, time, center), moon.radius + shipRadius + radius * 0.04))
    center.set(0, 0, 0)
    clear(center, planetClearance + shipRadius)
    return out
  }

  let trail = null
  const trailCount = 100, trailDuration = 2.6
  let age = 0
  if (config.ufo) {
    const hullMaterial = register(new THREE.MeshStandardMaterial({ color: 0x677b75, emissive: 0x25352f, emissiveIntensity: 0.45, roughness: 0.36, metalness: 0.65, fog: false }))
    const profile = [[0, -0.23], [0.38, -0.21], [0.82, -0.1], [1, 0], [0.86, 0.12], [0.42, 0.22], [0, 0.22]].map(([x, y]) => new THREE.Vector2(x * shipRadius, y * shipRadius))
    craft.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 40), hullMaterial))
    const dome = new THREE.Mesh(new THREE.SphereGeometry(shipRadius * 0.46, 24, 16), register(new THREE.MeshStandardMaterial({ color: 0x133f2e, emissive: 0x1b8251, emissiveIntensity: 0.65, roughness: 0.16, metalness: 0.35, fog: false })))
    dome.scale.y = 0.62
    dome.position.y = shipRadius * 0.22
    craft.add(dome)
    const lights = register(new THREE.MeshBasicMaterial({ color: 0x75ff9b, toneMapped: false, fog: false }))
    const rim = new THREE.Mesh(new THREE.TorusGeometry(shipRadius * 0.87, shipRadius * 0.035, 8, 40), lights)
    rim.rotation.x = Math.PI / 2
    craft.add(rim)
    const lampGeometry = new THREE.SphereGeometry(shipRadius * 0.09, 8, 6)
    for (let i = 0; i < 10; i++) {
      const lamp = new THREE.Mesh(lampGeometry, lights)
      lamp.position.set(Math.cos(i / 10 * TAU) * shipRadius * 0.86, -shipRadius * 0.09, Math.sin(i / 10 * TAU) * shipRadius * 0.86)
      craft.add(lamp)
    }
    const glow = new THREE.Sprite(register(new THREE.SpriteMaterial({ map: particleTexture, color: 0x4bff89, opacity: 0.38, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })))
    glow.scale.setScalar(shipRadius * 3.8)
    craft.add(glow)
    group.add(craft)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(trailCount * 3), 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(trailCount * 3), 3))
    trail = new THREE.Points(geometry, register(new THREE.PointsMaterial({ map: particleTexture, color: 0x61ff94, size: radius * 0.065, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })))
    trail.name = 'ufo-trail'
    trail.frustumCulled = false
    group.add(trail)
    outerRadius = Math.max(outerRadius, planetClearance + radius * 0.62, ...moons.map(moon => moon.orbit + moon.radius + radius * 0.62))
  }

  return {
    group, config, moons, craft, outerRadius,
    update(dt, opacity, reducedMotion) {
      group.visible = opacity > 0 && Boolean(moons.length || config.ufo)
      materials.forEach(material => { material.opacity = material.userData.baseOpacity * opacity })
      if (dt === 0 && !group.visible) return
      if (!reducedMotion) age += dt
      moons.forEach(moon => {
        moonPosition(moon, age, moon.mesh.position)
        if (!reducedMotion) moon.mesh.rotation.y += dt * moon.spin
      })
      if (!config.ufo) return
      flightPosition(age, craft.position)
      flightPosition(age + 0.025, next)
      craft.quaternion.setFromRotationMatrix(attitude.lookAt(next, craft.position, UP))
      craft.rotateZ(Math.sin(age * 0.82 + pathPhase) * 0.15)
      trail.visible = !reducedMotion
      const positions = trail.geometry.attributes.position, colors = trail.geometry.attributes.color
      for (let i = 0; i < trailCount; i++) {
        const t = i / (trailCount - 1), ago = t * trailDuration
        flightPosition(Math.max(0, age - ago), next).toArray(positions.array, i * 3)
        const alpha = ago <= age ? (1 - t) ** 2 * 0.75 : 0
        colors.setXYZ(i, alpha, alpha, alpha)
      }
      positions.needsUpdate = colors.needsUpdate = true
    },
  }
}
