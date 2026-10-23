import * as THREE from 'three'

// Soft sprites with per-particle size and color. Sizes are in world units and follow the camera's zoom.
function makePuffMaterial(map, blending) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, viewportScale: { value: 1 } },
    vertexShader: `attribute float size; attribute vec4 tint; uniform float viewportScale; varying vec4 vTint;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vTint = tint;
        // Fade puffs that drift right up to the lens instead of filling the screen.
        vTint.a *= smoothstep(0.6, 2.4, -view.z);
        gl_PointSize = size * projectionMatrix[1][1] * viewportScale / -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vTint;
      void main() {
        float alpha = texture2D(map, gl_PointCoord).a * vTint.a;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vTint.rgb, alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending,
  })
}

function makePuffs(count, map, blending) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const tints = new Float32Array(count * 4)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 4))
  const points = new THREE.Points(geometry, makePuffMaterial(map, blending))
  points.frustumCulled = false
  return { points, positions, sizes, tints }
}

export function createCampAmbience(particleTexture, groundHeight, random = Math.random) {
  const group = new THREE.Group()

  // Smoke: warm where the flames light it, then a dark plume that thins out as it rises.
  const smokeCount = 30
  const smoke = makePuffs(smokeCount, particleTexture, THREE.NormalBlending)
  const smokeAge = new Float32Array(smokeCount)
  const smokeLife = new Float32Array(smokeCount)
  const smokeSeed = new Float32Array(smokeCount)
  const resetSmoke = (i, spread = false) => {
    smokeLife[i] = 5 + random() * 3
    smokeAge[i] = spread ? random() * smokeLife[i] : 0
    smokeSeed[i] = random() * 100
  }
  for (let i = 0; i < smokeCount; i += 1) resetSmoke(i, true)

  // Embers and dust motes that catch the firelight around camp.
  const moteCount = 110
  const moteGeometry = new THREE.BufferGeometry()
  const motePositions = new Float32Array(moteCount * 3)
  const moteColors = new Float32Array(moteCount * 3)
  const moteHome = Array.from({ length: moteCount }, () => {
    const angle = random() * Math.PI * 2
    const radius = 0.7 + random() ** 0.8 * 4.2
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, y: 0.25 + random() * 2.1, phase: random() * 100, warm: random() }
  })
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  moteGeometry.setAttribute('color', new THREE.BufferAttribute(moteColors, 3))
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({
    size: 0.03, map: particleTexture, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }))
  motes.frustumCulled = false

  // Cold mist pooled in the low ground beyond the firelight.
  const mistCount = 26
  const mist = makePuffs(mistCount, particleTexture, THREE.NormalBlending)
  const mistHome = Array.from({ length: mistCount }, () => ({
    angle: random() * Math.PI * 2, radius: 6 + random() * 11, size: 5 + random() * 5, phase: random() * 100,
  }))

  group.add(smoke.points, motes, mist.points)

  const update = (elapsed, dt, ignition, viewportScale, frozen) => {
    smoke.points.material.uniforms.viewportScale.value = viewportScale
    mist.points.material.uniforms.viewportScale.value = viewportScale
    const step = frozen ? 0 : dt

    for (let i = 0; i < smokeCount; i += 1) {
      smokeAge[i] += step
      if (smokeAge[i] >= smokeLife[i]) resetSmoke(i)
      const life = smokeAge[i] / smokeLife[i]
      const rise = smokeAge[i]
      const sway = Math.sin(elapsed * 0.6 + smokeSeed[i]) * 0.25 * life
      smoke.positions[i * 3] = sway + rise * 0.09 + Math.sin(smokeSeed[i]) * 0.08
      smoke.positions[i * 3 + 1] = 0.75 + rise * 0.42
      smoke.positions[i * 3 + 2] = Math.cos(elapsed * 0.45 + smokeSeed[i]) * 0.2 * life + Math.cos(smokeSeed[i]) * 0.08
      smoke.sizes[i] = 0.3 + life * 1.7
      const lit = Math.exp(-life * 8)
      smoke.tints.set([0.035 + lit * 0.5, 0.03 + lit * 0.2, 0.028 + lit * 0.06,
        Math.sin(Math.PI * Math.min(1, life * 1.4)) * (1 - life) * 0.24 * ignition], i * 4)
    }

    for (let i = 0; i < moteCount; i += 1) {
      const mote = moteHome[i]
      const t = elapsed * 0.25 + mote.phase
      const x = mote.x + Math.sin(t * 1.3) * 0.35, z = mote.z + Math.cos(t * 1.1) * 0.35
      const y = mote.y + Math.sin(t * 0.7) * 0.25
      motePositions.set([x, y, z], i * 3)
      const distance = Math.hypot(x, y - 0.6, z)
      const light = ignition / (1 + distance * distance * 0.35) * (0.55 + Math.sin(elapsed * 3 + mote.phase) * 0.45)
      moteColors.set([light * 1.6, light * (0.55 + mote.warm * 0.3), light * 0.18], i * 3)
    }

    for (let i = 0; i < mistCount; i += 1) {
      const home = mistHome[i]
      const angle = home.angle + elapsed * 0.006
      const x = Math.cos(angle) * home.radius, z = Math.sin(angle) * home.radius
      mist.positions.set([x, groundHeight(x, z) + 0.5 + Math.sin(elapsed * 0.2 + home.phase) * 0.15, z], i * 3)
      mist.sizes[i] = home.size
      mist.tints.set([0.05, 0.068, 0.088, 0.1 * (0.7 + Math.sin(elapsed * 0.15 + home.phase) * 0.3)], i * 4)
    }

    smoke.points.geometry.attributes.position.needsUpdate = true
    smoke.points.geometry.attributes.size.needsUpdate = true
    smoke.points.geometry.attributes.tint.needsUpdate = true
    mist.points.geometry.attributes.position.needsUpdate = true
    mist.points.geometry.attributes.size.needsUpdate = true
    mist.points.geometry.attributes.tint.needsUpdate = true
    moteGeometry.attributes.position.needsUpdate = true
    moteGeometry.attributes.color.needsUpdate = true
  }

  return { group, update }
}

// A small, distant sun along the direction that lights every planet.
export function createDistantSun(particleTexture, direction) {
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: particleTexture, color: 0xffd9a8, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, fog: false, opacity: 0.45,
  }))
  glow.scale.setScalar(90)
  const core = new THREE.Sprite(glow.material.clone())
  core.material.color.set(0xfff6e6)
  core.material.opacity = 1
  core.scale.setScalar(16)
  const sun = new THREE.Group()
  sun.add(glow, core)
  const offset = direction.clone().normalize().multiplyScalar(1100)
  return { group: sun, follow: (camera) => sun.position.copy(camera.position).add(offset) }
}
