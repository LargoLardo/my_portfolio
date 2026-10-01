import * as THREE from 'three'

function hash(x, y, z, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function noise(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const ease = (t) => t * t * (3 - 2 * t)
  const fx = ease(x - ix), fy = ease(y - iy), fz = ease(z - iz)
  const mix = THREE.MathUtils.lerp
  return mix(
    mix(mix(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), fx), mix(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), fx), fy),
    mix(mix(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), fx), mix(hash(ix, iy + 1, iz + 1, seed), hash(ix + 1, iy + 1, iz + 1, seed), fx), fy), fz,
  )
}

function fractal(x, y, z, seed) {
  return noise(x, y, z, seed) * 0.56 + noise(x * 2.1, y * 2.1, z * 2.1, seed) * 0.28 + noise(x * 4.3, y * 4.3, z * 4.3, seed) * 0.16
}

export function makeDirtTexture(size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Sampling a torus keeps both edges seamless when the ground texture repeats.
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const radius = 8 + Math.cos(v) * 3
      const dust = fractal(Math.cos(u) * radius, Math.sin(u) * radius, Math.sin(v) * 3, 91)
      const grain = hash(x, y, 0, 91)
      const value = 80 + dust * 75 + grain * 12
      const pixel = (y * size + x) * 4
      image.data[pixel] = value
      image.data[pixel + 1] = value * 0.76
      image.data[pixel + 2] = value * 0.53
      image.data[pixel + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

export function makePlanetTexture(palette, seed, style = {}, width = 512, height = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const image = context.createImageData(width, height)
  const colors = palette.map(value => new THREE.Color(value).convertLinearToSRGB())
  const color = new THREE.Color()
  for (let y = 0; y < height; y += 1) {
    const latitude = (y / height - 0.5) * Math.PI
    for (let x = 0; x < width; x += 1) {
      const longitude = x / width * Math.PI * 2
      const nx = Math.cos(latitude) * Math.cos(longitude)
      const ny = Math.sin(latitude)
      const nz = Math.cos(latitude) * Math.sin(longitude)
      const turbulence = fractal(nx * 4 + seed, ny * 4, nz * 4, seed)
      const detail = fractal(nx * 22, ny * 22, nz * 22, seed + 7)
      let value = style.bands
        ? 0.26 + noise(ny * 16 + turbulence * 0.9, seed, 0, seed) * 0.5 + Math.sin(ny * 115 + turbulence * 6) * 0.025 + (detail - 0.5) * 0.12
        : THREE.MathUtils.clamp((turbulence - 0.28) * 1.9 + (detail - 0.5) * 0.16, 0, 1)
      if (!style.bands) value = THREE.MathUtils.lerp(value, 0.94, THREE.MathUtils.smoothstep(Math.abs(ny), 0.88, 0.99) * 0.65)
      const stop = THREE.MathUtils.clamp(value, 0, 0.999) * (colors.length - 1)
      const index = Math.floor(stop)
      color.copy(colors[index]).lerp(colors[index + 1], stop - index)
      const grain = 0.94 + detail * 0.12
      const pixel = (y * width + x) * 4
      image.data[pixel] = color.r * 255 * grain
      image.data[pixel + 1] = color.g * 255 * grain
      image.data[pixel + 2] = color.b * 255 * grain
      image.data[pixel + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

export function makeParticleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, '#fff')
  gradient.addColorStop(0.2, '#ffffffef')
  gradient.addColorStop(0.5, '#ffffff55')
  gradient.addColorStop(1, '#ffffff00')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

export function makeRingTexture(seed) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1
  const context = canvas.getContext('2d')
  for (let x = 0; x < 512; x += 1) {
    const t = x / 512
    const band = 0.42 + hash(x, 0, 0, seed) * 0.33 + Math.sin(t * 180) * 0.12
    const edge = Math.min(1, t * 28, (1 - t) * 18)
    const gap = t > 0.61 && t < 0.66 ? 0.06 : 1
    context.fillStyle = `rgba(194,180,149,${band * edge * gap})`
    context.fillRect(x, 0, 1, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function makePlanetPortrait(renderer, planet, ring, viewpoint) {
  const size = 160
  const target = new THREE.WebGLRenderTarget(size, size)
  target.texture.colorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const material = planet.material.clone()
  material.color.set(0xffffff)
  material.emissiveIntensity = 0.12
  const globe = new THREE.Mesh(planet.geometry, material)
  scene.add(globe, new THREE.HemisphereLight(0xc3d6eb, 0x182027, 0.65))
  const light = new THREE.DirectionalLight(0xffffff, 2.5)
  light.position.set(-35, 45, 25)
  scene.add(light)
  let ringMaterial
  if (ring) {
    ringMaterial = ring.material.clone()
    ringMaterial.opacity = 0.85
    const orbit = new THREE.Mesh(ring.geometry, ringMaterial)
    orbit.quaternion.copy(ring.quaternion)
    scene.add(orbit)
  }
  const radius = planet.geometry.parameters.radius
  const frame = radius * (ring ? 2.35 : 1.18)
  const camera = new THREE.OrthographicCamera(-frame, frame, frame, -frame, 0.1, 100)
  camera.position.copy(viewpoint).sub(planet.position).normalize().multiplyScalar(30)
  camera.lookAt(0, 0, 0)
  const previousTarget = renderer.getRenderTarget()
  const clearColor = renderer.getClearColor(new THREE.Color())
  const clearAlpha = renderer.getClearAlpha()
  renderer.setRenderTarget(target)
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)
  const pixels = new Uint8Array(size * size * 4)
  renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
  renderer.setRenderTarget(previousTarget)
  renderer.setClearColor(clearColor, clearAlpha)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
  }
  context.putImageData(image, 0, 0)
  target.dispose()
  material.dispose()
  ringMaterial?.dispose()
  return canvas.toDataURL()
}

export function makeAtmosphereMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: 0.35 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `uniform vec3 tint; uniform float opacity; varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(cameraPosition - vPosition)), 0.0), 3.2);
        float light = 0.18 + 0.82 * max(dot(normalize(vNormal), normalize(vec3(-35.0, 45.0, 25.0))), 0.0);
        gl_FragColor = vec4(tint, rim * light * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function makeFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float opacity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
      }
      void main() {
        float y = vUv.y;
        float n = noise(vec2(vUv.x * 5.0, y * 5.0 - time * 1.8));
        float drift = sin(y * 7.0 - time * 2.0) * y * 0.07 + (n - 0.5) * y * 0.18;
        float width = (1.0 - y) * 0.32;
        float body = 1.0 - smoothstep(width * 0.2, width + 0.05, abs(vUv.x - 0.5 + drift));
        float alpha = body * smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.65 + n * 0.28, 1.0, y));
        vec3 color = mix(vec3(1.0, 0.19, 0.025), vec3(1.0, 0.83, 0.4), body * (1.0 - y));
        gl_FragColor = vec4(color, alpha * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}
