import * as THREE from 'three'
import { fractal, planetNoise } from './spaceMaterials.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const UP = new THREE.Vector3(0, 1, 0)
const TAU = Math.PI * 2

export function rollPlanetFeatures(palette, random = Math.random) {
  const hsl = new THREE.Color(palette[Math.floor(palette.length / 2)]).getHSL({})
  const warm = hsl.h < 0.17 || hsl.h > 0.9
  return {
    warm,
    mountains: random() < 0.3,
    clouds: random() < 0.25,
    rain: random() < 0.15,
    craters: random() < 0.5,
    water: !warm && random() < 0.65,
    volcanoes: warm && random() < 0.65,
    cloudColor: warm ? 0xf3ae74 : 0xe5eef2,
    rainColor: warm ? 0xffd85b : 0x52b9ed,
  }
}

// One local group per world keeps terrain attached to its rotating surface.
export function createPlanetFeatures(discovery, planet, random = Math.random) {
  const config = rollPlanetFeatures(discovery.palette, random)
  const radius = discovery.radius
  const group = new THREE.Group()
  group.name = 'inspection-features'
  group.visible = false
  group.userData.features = config
  const materials = []
  const weather = new THREE.Group()
  weather.name = 'weather'
  group.add(weather)
  let fade = 0, age = 0
  let rain = null
  const rainDirections = [], rainPhases = []
  const scratch = new THREE.Vector3()
  const color = new THREE.Color()
  const terrainSites = [], weatherSites = []
  const waterSeed = Math.floor(random() * 100000)
  const elevation = n => fractal(n.x * 2.3, n.y * 2.3, n.z * 2.3, waterSeed) * 0.9
    + fractal(n.x * 12, n.y * 12, n.z * 12, waterSeed + 1) * 0.1
  group.userData.terrainSites = terrainSites

  const direction = () => {
    const y = random() * 1.8 - 0.9, angle = random() * TAU
    const r = Math.sqrt(1 - y * y)
    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
  }
  const frame = normal => {
    const east = new THREE.Vector3().crossVectors(UP, normal).normalize()
    const north = new THREE.Vector3().crossVectors(normal, east).normalize()
    return { normal, east, north }
  }
  // Reserve breathing room around terrain clusters and keep them on dry land.
  const reserve = (span, sites = terrainSites) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const normal = direction()
      if (sites.some(site => normal.angleTo(site.normal) < span + site.span + 0.06)) continue
      if (config.water && sites === terrainSites) {
        const basis = frame(normal)
        const samples = [normal, ...Array.from({ length: 8 }, (_, i) => point(basis, Math.cos(i * TAU / 8) * span, Math.sin(i * TAU / 8) * span).normalize())]
        if (samples.some(n => elevation(n) < 0.505)) continue
      }
      sites.push({ normal, span })
      return frame(normal)
    }
    return null
  }
  const point = (basis, x, y, height = 0) => basis.normal.clone()
    .addScaledVector(basis.east, x).addScaledVector(basis.north, y).normalize().multiplyScalar(radius + height)
  const material = options => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.92, fog: false, transparent: true, ...options })
    m.userData.baseOpacity = options.opacity ?? 1
    materials.push(m)
    return m
  }
  const terrainMaterial = () => {
    const m = planet.material.clone()
    m.onBeforeCompile = planet.material.onBeforeCompile
    m.transparent = true
    m.vertexColors = true
    m.color.setScalar(1.45)
    m.emissiveIntensity = 0.72
    m.userData.baseOpacity = 1
    materials.push(m)
    return m
  }
  const batch = (name, geometries, mat) => {
    if (!geometries.length) return
    const geometry = mergeGeometries(geometries)
    geometries.forEach(g => g.dispose())
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.name = name
    mesh.userData.isTerrain = true
    group.add(mesh)
    return mesh
  }
  const geometryFrom = (vertices, indices, colors) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    // Match the globe's texture coordinates, unwrapping triangles at the seam.
    const flat = geometry.toNonIndexed()
    geometry.dispose()
    const positions = flat.attributes.position, uv = new Float32Array(positions.count * 2)
    for (let i = 0; i < positions.count; i++) {
      scratch.fromBufferAttribute(positions, i).normalize()
      uv[i * 2] = (Math.atan2(scratch.z, -scratch.x) / TAU + 1) % 1
      uv[i * 2 + 1] = 1 - Math.acos(scratch.y) / Math.PI
    }
    for (let i = 0; i < positions.count; i += 3) {
      const us = [uv[i * 2], uv[i * 2 + 2], uv[i * 2 + 4]]
      if (Math.max(...us) - Math.min(...us) > 0.5) {
        for (let j = 0; j < 3; j++) if (us[j] < 0.5) uv[(i + j) * 2] += 1
      }
    }
    flat.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return flat
  }

  // Deform the actual globe for bowls below the surface; restore it at camp.
  let originalPositions = null, craterPositions = null, originalNormals = null, craterNormals = null
  if (config.craters) {
    const craters = []
    for (let i = 0; i < 5; i++) {
      const span = 0.13 + random() * 0.09, basis = reserve(span * 1.15)
      if (basis) craters.push({ ...basis, span, depth: radius * (0.027 + random() * 0.018), phase: random() * TAU })
    }
    group.userData.craters = craters
    const geometry = planet.geometry, positions = geometry.attributes.position
    originalPositions = positions.array.slice()
    originalNormals = geometry.attributes.normal.array.slice()
    for (let i = 0; i < positions.count; i++) {
      scratch.fromBufferAttribute(positions, i).normalize()
      let height = 0
      for (const crater of craters) {
        const angle = Math.atan2(scratch.dot(crater.north), scratch.dot(crater.east))
        const d = scratch.angleTo(crater.normal) / (crater.span * (1 + Math.sin(angle * 7 + crater.phase) * 0.035))
        if (d >= 1.15) continue
        const bowl = -crater.depth * Math.max(0, 1 - (d / 0.79) ** 2) ** 2
        const rim = crater.depth * 0.46 * Math.exp(-(((d - 0.81) / 0.14) ** 2))
        height += bowl + rim
      }
      scratch.multiplyScalar(radius + height)
      positions.setXYZ(i, scratch.x, scratch.y, scratch.z)
    }
    geometry.computeVertexNormals()
    craterPositions = positions.array.slice()
    craterNormals = geometry.attributes.normal.array.slice()
    positions.array.set(originalPositions)
    geometry.attributes.normal.array.set(originalNormals)
    geometry.computeBoundingSphere()
    geometry.boundingSphere.radius = radius * 1.03
  }

  if (config.mountains) {
    const patches = []
    for (let patch = 0; patch < 5; patch++) {
      const span = 0.12 + random() * 0.1, basis = reserve(span)
      if (!basis) continue
      const height = radius * (0.035 + random() * 0.05), seed = random() * 40
      const vertices = [], indices = [], colors = [], segments = 24
      for (let y = 0; y <= segments; y++) {
        for (let x = 0; x <= segments; x++) {
          const u = x / segments * 2 - 1, v = y / segments * 2 - 1
          const falloff = Math.max(0, 1 - Math.hypot(u, v))
          const ridge = 0.65 + Math.sin(u * 19 + seed + Math.sin(v * 7)) * Math.cos(v * 14 + seed) * 0.24
          const elevation = Math.pow(falloff, 1.35) * ridge
          point(basis, u * span, v * span, height * elevation - radius * 0.003).toArray(vertices, vertices.length)
          color.setScalar(1 - elevation * 0.25)
          if (!config.warm) color.lerp(new THREE.Color(0xd7e4e8), THREE.MathUtils.smoothstep(elevation, 0.52, 0.75) * 0.5)
          color.toArray(colors, colors.length)
          if (x < segments && y < segments) {
            const a = y * (segments + 1) + x, b = a + segments + 1
            indices.push(a, a + 1, b, a + 1, b + 1, b)
          }
        }
      }
      patches.push(geometryFrom(vertices, indices, colors))
    }
    batch('mountains', patches, terrainMaterial())
  }

  if (config.water) {
    // A spherical noise field makes connected oceans, islands and inland lakes.
    const width = 1024, height = 512, pixels = new Uint8Array(width * height * 4)
    const deep = new THREE.Color(0x123b61), shallow = new THREE.Color(0x438f99)
    for (let y = 0; y < height; y++) {
      const theta = (1 - (y + 0.5) / height) * Math.PI
      for (let x = 0; x < width; x++) {
        const phi = (x + 0.5) / width * TAU
        scratch.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
        const land = elevation(scratch), depth = THREE.MathUtils.smoothstep(0.495 - land, 0, 0.075)
        color.copy(shallow).lerp(deep, depth).convertLinearToSRGB()
        const offset = (y * width + x) * 4
        pixels[offset] = color.r * 255
        pixels[offset + 1] = color.g * 255
        pixels[offset + 2] = color.b * 255
        pixels[offset + 3] = (1 - THREE.MathUtils.smoothstep(land, 0.492, 0.499)) * 255
      }
    }
    const texture = new THREE.DataTexture(pixels, width, height)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
    const oceanMaterial = material({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.65, roughness: 0.32, metalness: 0.1, depthWrite: false })
    oceanMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterNormal;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWaterNormal = normalize(mat3(modelMatrix) * objectNormal);')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterNormal;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float daylight = max(dot(normalize(vWaterNormal), normalize(vec3(-35.0, 45.0, 25.0))), 0.0);
          totalEmissiveRadiance *= 0.14 + 0.94 * daylight;`)
    }
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.0008, 128, 96), oceanMaterial)
    ocean.name = 'oceans-and-lakes'
    group.add(ocean)
  }

  let lavaMaterial = null
  if (config.volcanoes) {
    const cones = [], lava = []
    lavaMaterial = material({ color: 0xffa039, emissive: 0xff5312, emissiveIntensity: 1.3, roughness: 0.65 })
    for (let vent = 0; vent < 4; vent++) {
      const width = 0.1 + random() * 0.06, basis = reserve(width * 1.1)
      if (!basis) continue
      const height = radius * (0.045 + random() * 0.045)
      const vertices = [], indices = [], colors = [], segments = 40, phase = random() * TAU
      const profile = [[1, -0.04], [0.76, 0.22], [0.49, 0.62], [0.29, 1], [0.21, 0.9], [0.09, 0.5], [0, 0.5]]
      profile.forEach(([r, h], row) => {
        for (let i = 0; i <= segments; i++) {
          const angle = i / segments * TAU
          const crag = 1 + Math.sin(angle * 7 + phase) * 0.065 + Math.cos(angle * 13 + phase) * 0.035
          point(basis, Math.cos(angle) * width * r * crag, Math.sin(angle) * width * r * crag, height * h * crag).toArray(vertices, vertices.length)
          color.setScalar(1 - Math.max(0, h) * 0.6)
          color.toArray(colors, colors.length)
          if (row < profile.length - 1 && i < segments) {
            const a = row * (segments + 1) + i, b = a + segments + 1
            indices.push(a, a + 1, b, a + 1, b + 1, b)
          }
        }
      })
      cones.push(geometryFrom(vertices, indices, colors))
      const poolVertices = [], poolIndices = []
      point(basis, 0, 0, height * 0.62).toArray(poolVertices)
      for (let i = 0; i <= 32; i++) {
        const angle = i / 32 * TAU
        point(basis, Math.cos(angle) * width * 0.115, Math.sin(angle) * width * 0.115, height * 0.62).toArray(poolVertices, poolVertices.length)
        if (i < 32) poolIndices.push(0, i + 1, i + 2)
      }
      lava.push(geometryFrom(poolVertices, poolIndices))
      for (let flow = 0; flow < 2; flow++) {
        const angle = phase + flow * 2.5
        const points = Array.from({ length: 36 }, (_, i) => {
          const t = i / 35, r = 0.29 + t * 0.7, bend = angle + Math.sin(t * 9) * 0.06
          const segment = profile.slice(0, 4).findIndex(([pr]) => pr <= r)
          const outer = profile[Math.max(0, segment - 1)], inner = profile[Math.max(1, segment)]
          const h = THREE.MathUtils.mapLinear(r, inner[0], outer[0], inner[1], outer[1])
          const crag = 1 + Math.sin(bend * 7 + phase) * 0.065 + Math.cos(bend * 13 + phase) * 0.035
          return point(basis, Math.cos(bend) * width * r * crag, Math.sin(bend) * width * r * crag, height * h * crag + radius * 0.004)
        })
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 35, radius * 0.0018, 5, false)
        lava.push(tube.toNonIndexed())
        tube.dispose()
      }
    }
    batch('volcanoes', cones, terrainMaterial())
    batch('lava', lava, lavaMaterial)
  }

  const addClouds = (storm) => {
    const count = storm ? 2 : 4, lobes = storm ? 12 : 9
    const cloudMaterial = material({ color: config.cloudColor, emissive: config.cloudColor, emissiveIntensity: storm ? 0.2 : 0.35, opacity: storm ? 0.73 : 0.62, depthWrite: false })
    cloudMaterial.onBeforeCompile = shader => {
      shader.uniforms.cloudScale = { value: 28 / radius }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCloudPoint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloudPoint = (instanceMatrix * vec4(position, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vCloudPoint; uniform float cloudScale;\n${planetNoise}`)
        .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
          float vapor = planetFbm(vCloudPoint * cloudScale);
          float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          diffuseColor.a *= smoothstep(0.0, 0.85, facing) * smoothstep(0.18, 0.65, vapor);
          diffuseColor.rgb *= 0.65 + vapor * 0.55;`)
    }
    const cloud = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 12), cloudMaterial, count * lobes)
    cloud.name = storm ? 'rainclouds' : 'clouds'
    const instance = new THREE.Object3D()
    for (let patch = 0; patch < count; patch++) {
      const span = 0.055 + random() * 0.035, basis = reserve(span * 2, weatherSites)
      if (!basis) { cloud.count = patch * lobes; break }
      for (let lobe = 0; lobe < lobes; lobe++) {
        const x = (random() - 0.5) * span * 1.8, y = (random() - 0.5) * span * 1.2
        const normal = point(basis, x, y).normalize()
        instance.position.copy(normal).multiplyScalar(radius * (1.065 + random() * 0.025))
        instance.quaternion.setFromUnitVectors(UP, normal)
        instance.scale.set(radius * span * (0.45 + random() * 0.5), radius * (0.022 + random() * 0.022), radius * span * (0.3 + random() * 0.4))
        instance.updateMatrix()
        cloud.setMatrixAt(patch * lobes + lobe, instance.matrix)
        cloud.setColorAt(patch * lobes + lobe, color.setScalar((storm ? 0.6 : 0.85) + random() * 0.15))
      }
      if (storm) {
        for (let drop = 0; drop < 100; drop++) {
          rainDirections.push(point(basis, (random() - 0.5) * span * 2, (random() - 0.5) * span).normalize())
          rainPhases.push(random())
        }
      }
    }
    weather.add(cloud)
  }
  if (config.clouds) addClouds(false)
  if (config.rain) {
    addClouds(true)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(rainDirections.length * 6), 3))
    const rainMaterial = new THREE.LineBasicMaterial({ color: config.rainColor, transparent: true, opacity: 0.65, depthWrite: false, fog: false })
    rainMaterial.userData.baseOpacity = 0.65
    materials.push(rainMaterial)
    rain = new THREE.LineSegments(geometry, rainMaterial)
    rain.name = 'rain'
    rain.frustumCulled = false
    weather.add(rain)
  }

  return {
    group, config,
    update(dt, inspecting, reducedMotion) {
      if (config.craters && group.visible !== inspecting) {
        const { position, normal } = planet.geometry.attributes
        position.array.set(inspecting ? craterPositions : originalPositions)
        normal.array.set(inspecting ? craterNormals : originalNormals)
        position.needsUpdate = normal.needsUpdate = true
      }
      group.visible = inspecting
      if (!inspecting) { fade = 0; return }
      fade = reducedMotion ? 1 : THREE.MathUtils.damp(fade, 1, 7, dt)
      materials.forEach(m => { m.opacity = m.userData.baseOpacity * fade })
      if (!reducedMotion) {
        age += dt
        weather.rotation.y += dt * 0.016
      }
      if (lavaMaterial) lavaMaterial.emissiveIntensity = reducedMotion ? 1.3 : 1.3 + Math.sin(age * 1.7) * 0.18
      if (rain) {
        const positions = rain.geometry.attributes.position
        rainDirections.forEach((normal, i) => {
          const t = (rainPhases[i] + age * 0.9) % 1
          const altitude = THREE.MathUtils.lerp(1.065, 1.003, t)
          scratch.copy(normal).multiplyScalar(radius * altitude).toArray(positions.array, i * 6)
          scratch.copy(normal).multiplyScalar(radius * Math.min(1.068, altitude + 0.017)).toArray(positions.array, i * 6 + 3)
        })
        positions.needsUpdate = true
      }
    },
  }
}
