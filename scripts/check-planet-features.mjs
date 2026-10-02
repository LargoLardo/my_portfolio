// Run: node scripts/check-planet-features.mjs
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createPlanetFeatures, rollPlanetFeatures } from '../src/spacePlanetFeatures.js'

const cool = { radius: 3, palette: ['#172e3c', '#34576b', '#799488', '#d3d5bd'] }
const warm = { radius: 3, palette: ['#4a3025', '#825940', '#b68d69', '#dbbe95'] }
let seed = 612
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const counts = { mountains: 0, clouds: 0, rain: 0, craters: 0 }
for (let i = 0; i < 20000; i++) {
  const config = rollPlanetFeatures((i % 2 ? warm : cool).palette, random)
  for (const key of Object.keys(counts)) counts[key] += Number(config[key])
  assert.equal(config.warm ? config.water : config.volcanoes, false)
  assert.equal(config.cloudColor, config.warm ? 0xf3ae74 : 0xe5eef2)
  assert.equal(config.rainColor, config.warm ? 0xffd85b : 0x52b9ed)
}
for (const [key, rate] of Object.entries({ mountains: 0.3, clouds: 0.25, rain: 0.15, craters: 0.5 })) {
  assert.ok(Math.abs(counts[key] / 20000 - rate) < 0.015, `${key} must honor its independent probability`)
}
const exact = values => () => values.shift() ?? 0.99
assert.deepEqual(Object.entries(rollPlanetFeatures(cool.palette, exact([0.3, 0.25, 0.15, 0.5, 0.65]))).filter(([, v]) => v === true), [])
const stormOnly = rollPlanetFeatures(cool.palette, exact([0.9, 0.9, 0.01, 0.9, 0.9]))
assert.ok(stormOnly.rain && !stormOnly.clouds, 'Rainclouds have their own independent roll')
for (const world of [cool, warm]) {
  let rolls = 0
  const planet = new THREE.Mesh(new THREE.SphereGeometry(world.radius, 128, 96), new THREE.MeshStandardMaterial())
  const original = planet.geometry.attributes.position.array.slice()
  const features = createPlanetFeatures(world, planet, () => ++rolls <= 5 ? 0.01 : random())
  const { group, config } = features
  assert.equal(group.visible, false, 'Features start hidden')
  assert.ok(group.getObjectByName(config.warm ? 'volcanoes' : 'oceans-and-lakes'))
  assert.ok(group.getObjectByName('mountains'))
  assert.deepEqual(planet.geometry.attributes.position.array, original, 'Craters must not appear before inspection')
  assert.ok(group.userData.craters.length > 0 && group.userData.craters.length <= 5)
  const sites = group.userData.terrainSites
  assert.ok(sites.length <= 14, 'Terrain stays sparse even when every feature is enabled')
  sites.forEach((site, i) => sites.slice(i + 1).forEach(other => {
    assert.ok(site.normal.angleTo(other.normal) >= site.span + other.span + 0.059, 'Terrain clusters must stay separated')
  }))
  if (config.water) {
    const pixels = group.getObjectByName('oceans-and-lakes').material.map.image.data
    const coverage = [...pixels].filter((_, i) => i % 4 === 3).filter(alpha => alpha > 128).length / (pixels.length / 4)
    assert.ok(coverage > 0.2 && coverage < 0.75, 'Water should form substantial bodies with land remaining')
  }
  assert.ok(group.getObjectByName('clouds').isInstancedMesh)
  assert.ok(group.getObjectByName('rainclouds').isInstancedMesh)
  const meshes = []
  group.traverse(object => {
    if (!object.geometry) return
    meshes.push(object)
    const positions = object.geometry.attributes.position.array
    assert.ok([...positions].every(Number.isFinite), `${object.name} geometry must be finite`)
    if (object.userData.isTerrain) {
      for (let i = 0; i < positions.length; i += 3) {
        const distance = Math.hypot(...positions.subarray(i, i + 3))
        assert.ok(distance > world.radius * 0.97 && distance < world.radius * 1.22, `${object.name} should follow the surface`)
      }
    }
  })
  features.update(1, true, false)
  assert.equal(group.visible, true)
  const deformed = planet.geometry.attributes.position.array.slice()
  assert.notDeepEqual(deformed, original, 'Craters deform the actual surface')
  let minRadius = Infinity, maxRadius = 0
  for (let i = 0; i < deformed.length; i += 3) {
    const r = Math.hypot(...deformed.subarray(i, i + 3))
    minRadius = Math.min(minRadius, r); maxRadius = Math.max(maxRadius, r)
  }
  assert.ok(minRadius < world.radius * 0.99 && maxRadius > world.radius * 1.003, 'Craters need depressed bowls and raised rims')
  const craterTint = planet.geometry.attributes.color.array
  assert.ok(craterTint.some(v => v < 0.65) && craterTint.some(v => v > 1.1), 'Crater bowls and rims need readable contrast')
  const drops = group.getObjectByName('rain').geometry.attributes.position.array
  const before = [...drops]
  features.update(0.1, true, false)
  assert.notDeepEqual([...drops], before, 'Rain must move')
  for (let i = 0; i < drops.length; i += 6) {
    const bottom = Math.hypot(...drops.subarray(i, i + 3)), top = Math.hypot(...drops.subarray(i + 3, i + 6))
    assert.ok(bottom >= world.radius && top > bottom, 'Rain must point down toward the surface')
  }
  const still = [...drops], wind = group.getObjectByName('weather').rotation.y
  features.update(1, true, true)
  assert.deepEqual([...drops], still)
  assert.equal(group.getObjectByName('weather').rotation.y, wind, 'Reduced motion freezes weather')
  const rollsUsed = rolls
  features.update(1, false, false)
  assert.equal(group.visible, false, 'Features must disappear on leaving inspection')
  assert.deepEqual(planet.geometry.attributes.position.array, original, 'Leaving restores the distant globe')
  assert.ok(craterTint.every(v => v === 1), 'Leaving restores the original globe colors')
  features.update(1, true, false)
  assert.equal(rolls, rollsUsed, 'Revisiting must keep the same features')
  assert.deepEqual(planet.geometry.attributes.position.array, deformed, 'Revisiting preserves the same craters')
  planet.geometry.dispose(); planet.material.dispose()
  meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); if (mesh.isInstancedMesh) mesh.dispose() })
}
console.log('PASS: color-based terrain/weather, independent 30%/25%/15%/50% rolls, spaced terrain, oceans, recessed craters, 3D geometry, radial rain, inspection visibility, stable revisits and reduced motion.')
