import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './space.css'
import { makeDirtTexture, makePlanetTexture, makePlanetSurfaceMaterial, makePlanetGeometry, makePlanetCloudMaterial, makePlanetPortrait, makeParticleTexture, makeRingTexture, makeAtmosphereMaterial, makeFlameMaterial } from './spaceMaterials.js'
import { createPlanetOrbit } from './spaceOrbit.js'
import { createComet } from './spaceComet.js'
import { createPlanetCompanions, rollSystemCompanions, companionOpacity } from './spaceCompanions.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import phonographBinUrl from './assets/phonograph/scene.bin?url'
import phonographSceneUrl from './assets/phonograph/scene.gltf?url'
import phonographTextureUrl from './assets/phonograph/textures/Material_baseColor.png?url'

const PLAYER_RADIUS = 14.4
const CAMPFIRE_RADIUS = 1.05
const EYE_HEIGHT = 1.54
const UP = new THREE.Vector3(0, 1, 0)
const RECORD_TRACK_CONFIG_URL = '/record-player-tracks.json'
const SIGN_READ_DISTANCE = 6.5
const PHONOGRAPH_INTERACT_DISTANCE = 6.5
const SCOPE_AUTO_OPEN_DURATION = 0.85
const MUSIC_FADE_SECONDS = 5
const UPLINK_MESSAGE = 'ESTABLISHING UPLINK'
const RECORD_X = 1.7
const RECORD_Z = -1.6

const DEFAULT_RECORD_TRACKS = [
  {
    title: 'Campfire Drift',
    tempo: 68,
    durationSeconds: 18,
    notes: [196, 246.94, 293.66, 329.63, 293.66, 246.94, 220, 246.94],
  },
]

const DISCOVERIES = [
  {
    id: 'about',
    signal: 'traveler\'s signal',
    world: 'Wanderer',
    title: 'Logan Zhao',
    subtitle: 'Systems Design Engineering student at the University of Waterloo',
    color: '#7bdff2',
    hex: 0x7bdff2,
    position: [-31, 23, -75],
    radius: 3.35,
    palette: ['#172e3c', '#34576b', '#799488', '#d3d5bd'],
    planetStyle: { spots: 3 },
    body: [
      'I am a Waterloo Systems Design Engineering student aiming toward machine learning, applied AI, and intelligent tools that turn messy inputs into useful systems.',
      'The thread through my work is creation through algorithmic design: reconstruction pipelines, game-playing agents, evolutionary search, and interfaces that make complex systems feel explorable.',
    ],
    tags: ['Machine learning', 'Algorithmic design', 'Creative systems', 'Systems engineering'],
  },
  {
    id: 'experience',
    signal: 'recursive orbit',
    world: 'Green Giant',
    title: "Heads-up Hold'em Poker AI",
    subtitle: 'External-sampling MCCFR solver for no-limit poker',
    color: '#8ef6a4',
    hex: 0x8ef6a4,
    position: [36, 25, -72],
    radius: 3.1,
    palette: ['#324541', '#64746b', '#a7b5a2', '#d3ceae'],
    planetStyle: { rings: true, bands: true, ringTilt: 0.42 },
    body: [
      "Built a heads-up no-limit Texas Hold'em AI and solver that trained a policy capable of winning more than 10BB/hr against basic heuristics using external-sampling MCCFR with regret matching.",
      'Engineered card abstraction through bucketing with Monte Carlo equity and potential calculations, reaching roughly 80% similarity to known solvers.',
      'Increased training speed by more than 10x on an 8-core CPU with a multiprocessing chunk-and-merge traversal pipeline.',
    ],
    tags: ['NumPy', 'MCCFR', 'Plotly', 'React', 'Flask', 'github.com/LargoLardo/lard_plays_poker'],
  },
  {
    id: 'reminiscence',
    signal: 'memory reconstruction',
    world: 'Timeless Twin',
    title: 'Reminiscence',
    subtitle: 'iPhone video to VR-ready Gaussian splats',
    color: '#ffbd6b',
    hex: 0xffbd6b,
    position: [46, 54, 54],
    radius: 2.5,
    palette: ['#4a3025', '#825940', '#b68d69', '#dbbe95'],
    planetStyle: { spots: 7, cracked: true },
    body: [
      'Engineered an end-to-end app pipeline that converts iPhone videos into VR-ready Gaussian splats, coordinating a 9-stage workflow across SwiftUI, FastAPI, COLMAP, FastGS, and Unity.',
      'Optimized reconstruction to run in under 2 minutes by streamlining frame extraction, sparse reconstruction, Gaussian splat training, and Unity prefab generation through Python backend automation.',
    ],
    tags: ['PyTorch', 'Swift', 'Unity/C#', 'OpenXR', 'FastAPI', 'github.com/LargoLardo/reminiscence'],
  },
  {
    id: 'synesthesia',
    signal: 'cross-media resonance',
    world: 'Lunar Hollow',
    title: 'Synthetic Synesthesia',
    subtitle: 'Full-stack cross-media vibe translation',
    color: '#ff7a90',
    hex: 0xff7a90,
    position: [-48, 34, 62],
    radius: 2.7,
    palette: ['#250c17', '#6f1e30', '#c84a51', '#f4b184'],
    planetStyle: { rings: true, spots: 4, ringTilt: -0.24 },
    body: [
      'Built a full-stack cross-media app that encodes an input emotional signature, generates a matching output in another medium, and reached up to 95% emotional-response alignment using TribeV2 scoring.',
      'Improved output quality and cut processing time by owning DataFrame construction in the TribeV2 pipeline and using an evolutionary algorithm to iteratively evolve final outputs.',
    ],
    tags: ['PyTorch', 'Pandas', 'MongoDB', 'React', 'FastAPI', 'github.com/LargoLardo/synthetic_synesthesia'],
  },
  {
    id: 'chess',
    signal: 'waterloo transmission',
    world: 'Scholar\'s Moon',
    title: 'Education',
    subtitle: 'University of Waterloo, Systems Design Engineering',
    color: '#c69cff',
    hex: 0xc69cff,
    position: [-74, 44, -12],
    radius: 2.35,
    palette: ['#151023', '#4f3c78', '#9f7bd5', '#e1d5ff'],
    planetStyle: { bands: true, spots: 5 },
    body: [
      'Bachelor of Applied Science in Systems Design Engineering at the University of Waterloo, expected 2030, with a 3.9 GPA.',
      "Recipient of the W.J. Beynon Memorial Entrance Scholarship and President's Scholarship of Distinction.",
    ],
    tags: ['Systems Design Engineering', '3.9 GPA', 'Waterloo', 'Scholarships'],
  },
  {
    id: 'poker',
    signal: 'journeygoer\'s relay',
    world: 'Midnight Seed',
    title: 'Experience',
    subtitle: 'Application Programmer, Ontario Government MPBSDP',
    color: '#7195cd',
    hex: 0x31558f,
    position: [4, 66, -78],
    radius: 2.2,
    palette: ['#030815', '#17345c', '#285488', '#6e92ad'],
    planetStyle: { rings: true, ringTilt: 0.78 },
    body: [
      'Built and supported automated QA tooling for Cognos BI reports using the IBM Cognos API and Playwright, helping validate 1,000+ reports per hour and protect reporting integrity.',
      'Worked with Redshift, DBeaver SQL, AWS Lambda ETL, audit logs, and Python Excel automation to clean, transform, monitor, and prepare analytics data across large BI workflows.',
      'Previously organized NRGHacks for 200+ attendees, led a 50+ member coding club, and designed a Rotary club website that helped increase membership.',
    ],
    tags: ['Playwright', 'Cognos API', 'Redshift', 'AWS Lambda', 'Python', 'Leadership'],
  },
  {
    id: 'education',
    signal: 'search tree beacon',
    world: 'Glass Oracle',
    title: 'RL/SL Chess Engine',
    subtitle: 'Policy/value network with MCTS/PUCT search',
    color: '#9ee493',
    hex: 0x9ee493,
    position: [-26, 78, 50],
    radius: 2.3,
    palette: ['#0b2115', '#245d3b', '#72b36e', '#e2ffd4'],
    planetStyle: { rings: true, bands: true, ringTilt: -0.58 },
    body: [
      'Architected a full-stack RL/SL hybrid chess engine from scratch with a policy/value network and MCTS/PUCT move search, reaching expert-level 2000 Elo strength through self-play.',
      'Improved runtime search speed by more than 8x with lazy inference batching, transposition tables, and cached board encodings for deeper lookahead under fixed move-time budgets.',
    ],
    tags: ['PyTorch', 'MCTS', 'React', 'Vite', 'Flask', 'github.com/LargoLardo/lard_plays_chess'],
  },
  {
    id: 'hobbies',
    signal: 'campfire frequency',
    world: 'Hearth Twin',
    title: 'Hobbies',
    subtitle: 'Games, movement, and worlds that make curiosity feel physical',
    color: '#ffcf87',
    hex: 0xffcf87,
    position: [82, 24, 44],
    radius: 2.55,
    palette: ['#261407', '#70411e', '#d1883e', '#ffe0a3'],
    planetStyle: { bands: true, spots: 6 },
    body: [
      'Outside of building things, I enjoy badminton, chess, poker, ultimate frisbee, and games that reward exploration and patient systems thinking.',
      'Outer Wilds is one of the major inspirations for this portfolio: the campfire, signalscope, mystery-first navigation, and feeling of looking into a huge unknown space all come from that love.',
      'Reach me through email, LinkedIn, or GitHub if you want to talk ML, creative tools, game AI, or strange interactive projects.',
    ],
    tags: ['Badminton', 'Chess', 'Poker', 'Ultimate frisbee', 'Outer Wilds', 'logan.zhao@uwaterloo.ca', 'github.com/LargoLardo', 'linkedin.com/in/logan-zhao-328653232'],
  },
]

const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map((item) => [item.id, item]))
const EGO_SECTION_TITLES = ['Logan Zhao', 'Education', 'Experience', 'Hobbies']
const EGO_SECTION_TITLE_SET = new Set(EGO_SECTION_TITLES)

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function terrainHeight(x, z) {
  const ripples = Math.sin(x * 0.33 + z * 0.18) * 0.045 + Math.sin(z * 0.47) * 0.035
  const distance = Math.hypot(x, z)
  const ridge = smoothstep(14, 48, distance) * (1.6 + Math.sin(x * 0.12 + z * 0.08) * 1.2 + Math.sin(z * 0.18 - x * 0.07) * 0.7)
  const hummocks = Math.sin(x * 1.2 + Math.sin(z * 0.8)) * Math.cos(z * 1.6) * 0.09
  const h = ripples + ridge + hummocks + Math.sin(x * 0.73) * Math.cos(z * 0.51) * 0.16

  const campFlatten = 1 - smoothstep(1.2, 6.2, Math.sqrt(x * x + z * z))
  // Shape the phonograph's sandy drift into the same surface so its color and texture stay continuous.
  const dx = x - RECORD_X, dz = z - RECORD_Z
  const driftEdge = Math.max(0, 1 - (dx / 1.05) ** 2) * Math.max(0, 1 - (dz / 0.875) ** 2)
  const drift = driftEdge * (0.13 + Math.sin(dx * 9 + dz * 5) * 0.025)
  return THREE.MathUtils.lerp(h, 0, campFlatten) + drift
}

function makeWoodGrainTexture(seed = 1, width = 512, height = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const rand = seededRandom(seed)
  const base = ctx.createLinearGradient(0, 0, width, height)
  base.addColorStop(0, '#4a2b18')
  base.addColorStop(0.45, '#7b4d2a')
  base.addColorStop(1, '#342014')

  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  for (let i = 0; i < 86; i += 1) {
    const y = rand() * height
    const alpha = 0.07 + rand() * 0.18
    ctx.strokeStyle = `rgba(24, 13, 7, ${alpha})`
    ctx.lineWidth = 0.8 + rand() * 2.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(width * 0.24, y + rand() * 16 - 8, width * 0.68, y + rand() * 16 - 8, width, y)
    ctx.stroke()
  }

  for (let i = 0; i < 10; i += 1) {
    const x = rand() * width
    const y = rand() * height
    const r = 8 + rand() * 24
    const knot = ctx.createRadialGradient(x, y, 0, x, y, r)
    knot.addColorStop(0, 'rgba(28, 14, 7, 0.36)')
    knot.addColorStop(0.42, 'rgba(74, 42, 22, 0.18)')
    knot.addColorStop(1, 'rgba(74, 42, 22, 0)')
    ctx.fillStyle = knot
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.8, r * 0.55, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas
}

function makeWoodBumpTexture(seed = 1, width = 512, height = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const rand = seededRandom(seed + 4000)

  ctx.fillStyle = '#7f7f7f'
  ctx.fillRect(0, 0, width, height)

  for (let i = 0; i < 96; i += 1) {
    const y = rand() * height
    ctx.strokeStyle = `rgba(${88 + rand() * 40}, ${88 + rand() * 40}, ${88 + rand() * 40}, 0.55)`
    ctx.lineWidth = 1 + rand() * 2.2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(width * 0.3, y + rand() * 12 - 6, width * 0.7, y + rand() * 12 - 6, width, y)
    ctx.stroke()
  }

  return canvas
}

function makeCarvedWoodTexture(text, seed) {
  const canvas = makeWoodGrainTexture(seed, 1024, 256)
  const ctx = canvas.getContext('2d')
  const rand = seededRandom(seed + 512)
  const weather = ctx.createLinearGradient(0, 0, 0, 256)
  weather.addColorStop(0, '#140e09aa')
  weather.addColorStop(0.18, '#140e0910')
  weather.addColorStop(0.75, '#140e0922')
  weather.addColorStop(1, '#140e09bb')
  ctx.fillStyle = weather
  ctx.fillRect(0, 0, 1024, 256)
  // Uneven yellow strokes follow the scratched lettering across each plank.
  const letters = {
    L: [[[0, 0], [0, 1], [0.7, 1]]],
    O: [[[0.1, 0], [0.65, 0.04], [0.72, 0.9], [0.1, 1], [0, 0.1], [0.1, 0]]],
    K: [[[0, 0], [0, 1]], [[0.7, 0], [0.04, 0.5], [0.72, 1]]],
    U: [[[0, 0], [0.03, 0.94], [0.65, 1], [0.7, 0]]],
    P: [[[0, 1], [0, 0], [0.66, 0.03], [0.67, 0.46], [0, 0.48]]],
    H: [[[0, 0], [0, 1]], [[0.7, 0], [0.7, 1]], [[0, 0.5], [0.7, 0.5]]],
    D: [[[0, 1], [0, 0], [0.5, 0.05], [0.7, 0.28], [0.68, 0.8], [0.45, 1], [0, 1]]],
    S: [[[0.7, 0.04], [0.08, 0], [0, 0.43], [0.7, 0.56], [0.64, 1], [0, 0.94]]],
    A: [[[0, 1], [0.34, 0], [0.72, 1]], [[0.15, 0.6], [0.57, 0.6]]],
    C: [[[0.7, 0.07], [0.1, 0], [0, 0.88], [0.65, 1]]],
    E: [[[0.7, 0], [0, 0], [0, 1], [0.7, 1]], [[0, 0.5], [0.57, 0.5]]],
  }
  const carve = (text, x, y, size) => {
    for (const letter of text) {
      const tilt = (rand() - 0.5) * 0.12
      const baseline = y + (rand() - 0.5) * 12
      for (const stroke of letters[letter] ?? []) {
        const points = stroke.map(([px, py]) => [x + (px + py * tilt) * size + rand() * 2, baseline + py * size])
        for (let segment = 1; segment < points.length; segment += 1) {
          const [ax, ay] = points[segment - 1], [bx, by] = points[segment]
          const length = Math.hypot(bx - ax, by - ay)
          const nx = -(by - ay) / length, ny = (bx - ax) / length
          const width = size * (0.035 + rand() * 0.021)
          ctx.fillStyle = '#ffe36a'
          ctx.beginPath()
          ctx.moveTo(ax - nx * width, ay - ny * width)
          ctx.lineTo((ax + bx) * 0.5 - nx * width * 1.6, (ay + by) * 0.5 - ny * width * 1.6)
          ctx.lineTo(bx + nx, by + ny)
          ctx.lineTo(bx + nx * width, by + ny * width)
          ctx.lineTo(ax + nx * width * 0.6, ay + ny * width * 0.6)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#ffe36a'
          ctx.lineWidth = width * 1.25
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo((ax + bx) * 0.5 + rand() * 2, (ay + by) * 0.5)
          ctx.lineTo(bx, by)
          ctx.stroke()
          // Fine overshoots and splinters avoid the look of printed lettering.
          ctx.strokeStyle = '#ffe78bba'
          ctx.lineWidth = 0.9
          ctx.beginPath()
          ctx.moveTo(ax - nx * width, ay - ny * width)
          ctx.lineTo(bx + (bx - ax) * 0.08 - nx * width, by + (by - ay) * 0.08 - ny * width)
          ctx.stroke()
        }
      }
      x += size * (letter === ' ' ? 0.55 : 0.95)
    }
  }
  const size = text === 'LOOK UP' ? 142 : 98
  carve(text, text === 'LOOK UP' ? 78 : 72, (256 - size) / 2, size)
  for (let i = 0; i < 85; i += 1) {
    const x = rand() * 1024, y = rand() * 256
    ctx.strokeStyle = rand() > 0.5 ? '#cfb48d22' : '#20110855'
    ctx.lineWidth = 0.5 + rand() * 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 8 + rand() * 115, y + (rand() - 0.5) * 6)
    ctx.stroke()
  }
  for (let i = 0; i < 7; i += 1) {
    const x = i % 2 ? 0 : 1024, y = 15 + rand() * 226
    ctx.strokeStyle = '#170f0bc0'
    ctx.lineWidth = 1 + rand() * 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (x ? -1 : 1) * (100 + rand() * 180), y + rand() * 6)
    ctx.stroke()
  }
  return canvas
}

function createWoodMaterial(seed, color, repeatX = 2.2, repeatY = 1) {
  const map = new THREE.CanvasTexture(makeWoodGrainTexture(seed))
  const bumpMap = new THREE.CanvasTexture(makeWoodBumpTexture(seed))
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeatX, repeatY)
  bumpMap.wrapS = THREE.RepeatWrapping
  bumpMap.wrapT = THREE.RepeatWrapping
  bumpMap.repeat.copy(map.repeat)

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.018,
    color,
    roughness: 0.96,
    metalness: 0,
  })
}

function loadRecordTracks() {
  return fetch(RECORD_TRACK_CONFIG_URL, { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
        return data.tracks
      }

      return DEFAULT_RECORD_TRACKS
    })
    .catch(() => DEFAULT_RECORD_TRACKS)
}

function writeAscii(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function createProceduralRecordUrl(track) {
  const sampleRate = 22050
  const duration = Math.max(8, Math.min(42, track.durationSeconds ?? 18))
  const sampleCount = Math.floor(sampleRate * duration)
  const notes = Array.isArray(track.notes) && track.notes.length > 0 ? track.notes : DEFAULT_RECORD_TRACKS[0].notes
  const tempo = track.tempo ?? 70
  const beatLength = 60 / tempo
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate
    const beat = Math.floor(t / beatLength)
    const beatT = (t % beatLength) / beatLength
    const freq = notes[beat % notes.length]
    const nextFreq = notes[(beat + 3) % notes.length] / 2
    const envelope = Math.sin(Math.PI * beatT) * Math.pow(1 - beatT, 0.24)
    const crackle = Math.sin(t * 127.31 + Math.sin(t * 11.2) * 8) > 0.985 ? 0.035 : 0
    const wave =
      Math.sin(Math.PI * 2 * freq * t) * 0.13 * envelope +
      Math.sin(Math.PI * 2 * nextFreq * t) * 0.08 * envelope +
      Math.sin(Math.PI * 2 * freq * 2.01 * t) * 0.025 * envelope +
      crackle
    const sample = THREE.MathUtils.clamp(wave, -0.92, 0.92)
    view.setInt16(44 + i * 2, sample * 32767, true)
  }

  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function disposeObjectTree(root) {
  root.traverse((object) => {
    if (object.isInstancedMesh) object.dispose()
    if (object.geometry) {
      object.geometry.dispose()
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach((material) => {
      Object.keys(material).forEach((key) => {
        const value = material[key]
        if (value && typeof value.dispose === 'function') {
          value.dispose()
        }
      })
      material.dispose()
    })
  })
}

function disposeScene(scene, renderer) {
  disposeObjectTree(scene)
  renderer.dispose()
}

function Panel({ panelRef, discovery, closing, onClose, onExited }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (!discovery) return undefined
    const previousFocus = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      const target = previousFocus?.isConnected && !previousFocus.closest('[inert]')
        ? previousFocus : document.querySelector('.sections-button')
      target?.focus({ preventScroll: true })
    }
  }, [discovery])
  if (!discovery) return null

  return (
    <aside ref={panelRef} className={`discovery-panel ${closing ? 'is-closing' : ''}`} aria-label={discovery.title} aria-hidden={closing} inert={closing} style={{ '--accent': discovery.color }} onAnimationEnd={(event) => {
      if (event.animationName === 'panel-exit') onExited()
    }}>
      <button ref={closeRef} className="panel-close" type="button" onClick={onClose} aria-label="Close discovery">
        ×
      </button>
      <p className="panel-eyebrow">FIELD NOTES / {String(DISCOVERIES.indexOf(discovery) + 1).padStart(2, '0')}</p>
      <p className="panel-signal"><span />{discovery.world} · {discovery.signal}</p>
      <h1>{discovery.title}</h1>
      <p className="panel-subtitle">{discovery.subtitle}</p>
      <div className="panel-body">
        {discovery.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="tag-list">
        {discovery.tags.map((tag) => {
          const href =
            tag.includes('@') ? `mailto:${tag}` : tag.includes('.com') ? `https://${tag}` : null

          return href ? (
            <a key={tag} href={href} target={tag.includes('@') ? undefined : '_blank'} rel="noreferrer">
              {tag}
            </a>
          ) : (
            <span key={tag}>{tag}</span>
          )
        })}
      </div>
    </aside>
  )
}

function PortfolioSidebar({ open, activeId, onSelect, onClose, discoveredIds, portraits, children }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true })
  }, [open])
  const egoSections = EGO_SECTION_TITLES.map((title) => DISCOVERIES.find((discovery) => discovery.title === title)).filter(Boolean)
  const projectSections = DISCOVERIES.filter((discovery) => !EGO_SECTION_TITLE_SET.has(discovery.title))
  const sidebarGroups = [
    ['The explorer', egoSections],
    ['Projects & experiments', projectSections],
  ]

  return (
    <aside id="field-log" className={`section-sidebar ${open ? 'is-open' : ''}`} aria-label="Field log" aria-hidden={!open} inert={!open}>
      <div className="section-sidebar-header">
        <div>
          <span>EXPEDITION DIRECTORY / 08</span>
          <strong>Field log</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close field log">
          ×
        </button>
      </div>
      <p className="section-intro">Every signal has a story. Choose a destination.</p>

      <div className="section-list">
        {sidebarGroups.map(([groupName, discoveries]) => (
          <div className="section-group" key={groupName}>
            <p className="section-group-label">{groupName}</p>
            {discoveries.map((discovery) => (
              <button
                className={`${activeId === discovery.id ? 'is-active' : ''} ${discoveredIds.has(discovery.id) ? 'is-discovered' : 'is-uncharted'}`}
                data-discovered={discoveredIds.has(discovery.id)}
                type="button"
                key={discovery.id}
                onClick={() => onSelect(discovery.id)}
                style={{ '--accent': discovery.color }}
              >
                <img className="destination-portrait" src={portraits[discovery.id]} alt="" aria-hidden="true" />
                <span className="destination-name">{discovery.world}<small>{discoveredIds.has(discovery.id) ? 'Located' : 'Uncharted'}</small></span>
                <strong>{discovery.title}</strong>
                <small>{discovery.subtitle}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
      {children}
    </aside>
  )
}

export default function App() {
  const mountRef = useRef(null)
  const directoryButtonRef = useRef(null)
  const helpCloseRef = useRef(null)
  const cursorRef = useRef(null)
  const scopeActiveRef = useRef(false)
  const discoveredIdsRef = useRef(new Set())
  const discoveryEventsRef = useRef([])
  const orbitTargetRef = useRef(null)
  const panelRef = useRef(null)
  const connectorRef = useRef(null)
  const [orbitPhase, setOrbitPhase] = useState('ground')
  const [scopeActiveState, setScopeActiveState] = useState(false)
  const scopeSignalRef = useRef(null)
  const progressCircleRef = useRef(null)
  const [completedDiscovery, setCompletedDiscovery] = useState(null)
  const [discoveredIds, setDiscoveredIds] = useState(new Set())
  const [planetPortraits, setPlanetPortraits] = useState({})
  const [focusedTarget, setFocusedTarget] = useState(null)
  const [activeDiscovery, setActiveDiscovery] = useState(null)
  const [discoveryClosing, setDiscoveryClosing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [ignited, setIgnited] = useState(false)
  const [readSignAvailable, setReadSignAvailable] = useState(false)
  const readSignAvailableRef = useRef(false)
  const [signPanelOpen, setSignPanelOpen] = useState(false)
  const [phonographPromptAvailable, setPhonographPromptAvailableState] = useState(false)
  const phonographPromptAvailableRef = useRef(false)
  const [currentRecordTitle, setCurrentRecordTitle] = useState('')
  const [audioMuted, setAudioMuted] = useState(false)
  const audioMutedRef = useRef(false)

  const activeData = useMemo(() => DISCOVERY_BY_ID[activeDiscovery] ?? null, [activeDiscovery])
  const focusedData = useMemo(() => DISCOVERY_BY_ID[focusedTarget] ?? null, [focusedTarget])
  const cursorPrompt = useMemo(() => {
    if (signPanelOpen) return ''
    if (readSignAvailable) return 'read sign?'
    if (phonographPromptAvailable && currentRecordTitle) return `now playing: ${currentRecordTitle}`
    return ''
  }, [currentRecordTitle, phonographPromptAvailable, readSignAvailable, signPanelOpen])

  const setScopeActive = useCallback((value) => {
    scopeActiveRef.current = value
    setScopeActiveState(value)
    if (!value) {
      if (progressCircleRef.current) progressCircleRef.current.style.strokeDashoffset = '1'
    }
  }, [])

  const toggleAudioMuted = useCallback(() => {
    setAudioMuted((muted) => {
      const nextMuted = !muted
      audioMutedRef.current = nextMuted
      return nextMuted
    })
  }, [])

  const markDiscovered = useCallback((id) => {
    if (!id || discoveredIdsRef.current.has(id)) return
    discoveredIdsRef.current.add(id)
    setDiscoveredIds(new Set(discoveredIdsRef.current))
    discoveryEventsRef.current.push({ id, firstDiscovery: true })
  }, [])

  const revealDiscovery = useCallback((id) => {
    if (!id) return
    setCompletedDiscovery(null)
    markDiscovered(id)
    setDiscoveryClosing(false)
    setActiveDiscovery(id)
    orbitTargetRef.current = id
    setScopeActive(false)
  }, [markDiscovered, setScopeActive])

  const closeDiscovery = useCallback(() => {
    orbitTargetRef.current = null
    setDiscoveryClosing(true)
  }, [])

  useEffect(() => {
    if (signPanelOpen) helpCloseRef.current?.focus({ preventScroll: true })
  }, [signPanelOpen])

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return undefined

    const moveCursor = (event) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-4px, -4px)`
    }

    cursor.style.transform = `translate3d(${window.innerWidth / 2}px, ${window.innerHeight / 2}px, 0) translate(-4px, -4px)`
    window.addEventListener('pointermove', moveCursor)

    return () => window.removeEventListener('pointermove', moveCursor)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionPreference.matches
    const updateMotionPreference = () => { reducedMotion = motionPreference.matches }
    motionPreference.addEventListener('change', updateMotionPreference)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000102)
    scene.fog = new THREE.FogExp2(0x000102, 0.12)

    const camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.05, 3500)
    camera.position.set(0, EYE_HEIGHT, 4.15)

    const ambient = new THREE.HemisphereLight(0x6c7d97, 0x25180f, 0.035)
    scene.add(ambient)
    const sunlight = new THREE.DirectionalLight(0x8f9fb7, 0.5)
    sunlight.position.set(-35, 45, 25)
    scene.add(sunlight)
    const particleTexture = makeParticleTexture()

    const dirtMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(makeDirtTexture()),
      color: 0xb1a390,
      roughness: 1,
      metalness: 0,
    })
    dirtMaterial.map.wrapS = THREE.RepeatWrapping
    dirtMaterial.map.wrapT = THREE.RepeatWrapping
    dirtMaterial.map.repeat.set(24, 24)
    dirtMaterial.map.colorSpace = THREE.SRGBColorSpace
    dirtMaterial.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    dirtMaterial.bumpMap = dirtMaterial.map
    dirtMaterial.bumpScale = 0.085
    dirtMaterial.vertexColors = true

    const groundGeometry = new THREE.PlaneGeometry(120, 120, 240, 240)
    const groundPositions = groundGeometry.attributes.position
    const groundColors = new Float32Array(groundPositions.count * 3)
    const soilColor = new THREE.Color()
    const sandColor = new THREE.Color(0xd8bc8e)
    const earthColor = new THREE.Color(0x726953)
    for (let i = 0; i < groundPositions.count; i += 1) {
      const x = groundPositions.getX(i)
      const z = -groundPositions.getY(i)
      groundPositions.setZ(i, terrainHeight(x, z))
      const sand = smoothstep(-0.5, 0.65, Math.sin(x * 0.83 + Math.sin(z)) * Math.cos(z * 0.57))
      soilColor.copy(earthColor).lerp(sandColor, sand)
      soilColor.multiplyScalar(THREE.MathUtils.lerp(0.5, 1, smoothstep(0.8, 2.8, Math.hypot(x, z))))
      soilColor.toArray(groundColors, i * 3)
    }
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3))
    groundGeometry.computeVertexNormals()

    const ground = new THREE.Mesh(groundGeometry, dirtMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const rocks = new THREE.Group()
    const rockGeometry = mergeVertices(new THREE.IcosahedronGeometry(0.24, 2))
    const rockVertices = rockGeometry.attributes.position
    for (let i = 0; i < rockVertices.count; i += 1) {
      const x = rockVertices.getX(i), y = rockVertices.getY(i), z = rockVertices.getZ(i)
      const crag = 1 + Math.sin(x * 31 + y * 13) * Math.cos(z * 23 - y * 17) * 0.18
      rockVertices.setXYZ(i, x * crag, y * crag, z * crag)
    }
    rockGeometry.computeVertexNormals()
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x928878, map: dirtMaterial.map, bumpMap: dirtMaterial.map, bumpScale: 0.028, roughness: 1 })
    const rockRand = seededRandom(244)

    for (let i = 0; i < 100; i += 1) {
      const angle = rockRand() * Math.PI * 2
      const radius = 3.2 + rockRand() ** 2 * 36
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      const rock = new THREE.Mesh(rockGeometry, rockMaterial)
      const scale = 0.5 + rockRand() ** 2 * 2.8
      rock.position.set(x, terrainHeight(x, z) + scale * 0.12, z)
      rock.rotation.set(rockRand() * Math.PI, rockRand() * Math.PI, rockRand() * Math.PI)
      rock.scale.set(scale * 1.25, scale * 0.7, scale)
      rock.castShadow = true
      rock.receiveShadow = true
      rocks.add(rock)
    }

    scene.add(rocks)

    // Instanced gravel and dry grass keep the campsite detailed with two draw calls.
    const gravel = new THREE.InstancedMesh(rockGeometry, rockMaterial, 460)
    const instance = new THREE.Object3D()
    const instanceColor = new THREE.Color()
    for (let i = 0; i < gravel.count; i += 1) {
      const angle = rockRand() * Math.PI * 2
      const radius = 1.15 + rockRand() ** 0.7 * 10
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
      const size = 0.06 + rockRand() ** 2 * 0.48
      instance.position.set(x, terrainHeight(x, z) + size * 0.07, z)
      instance.rotation.set(rockRand() * 3, rockRand() * 6, rockRand() * 3)
      instance.scale.set(size * 1.4, size * 0.65, size)
      instance.updateMatrix()
      gravel.setMatrixAt(i, instance.matrix)
      gravel.setColorAt(i, instanceColor.setHSL(0.08 + rockRand() * 0.05, 0.12, 0.42 + rockRand() * 0.3))
    }
    gravel.receiveShadow = true
    scene.add(gravel)

    const grassVertices = []
    for (let blade = 0; blade < 7; blade += 1) {
      const angle = blade * 2.4
      const x = Math.cos(angle) * 0.055, z = Math.sin(angle) * 0.055
      const height = 0.13 + rockRand() * 0.18
      const leanX = x * 1.8, leanZ = z * 1.8
      const width = 0.004 + rockRand() * 0.005
      const a = [x - width, 0, z], b = [x + width, 0, z]
      const c = [x + leanX * 0.4 - width * 0.5, height * 0.6, z + leanZ * 0.4]
      const d = [c[0] + width, c[1], c[2]], tip = [x + leanX, height, z + leanZ]
      grassVertices.push(...a, ...b, ...c, ...b, ...d, ...c, ...c, ...d, ...tip)
    }
    const grassGeometry = new THREE.BufferGeometry()
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassVertices, 3))
    grassGeometry.computeVertexNormals()
    const grass = new THREE.InstancedMesh(grassGeometry, new THREE.MeshStandardMaterial({ color: 0x8b8460, roughness: 1, side: THREE.DoubleSide }), 220)
    for (let i = 0; i < grass.count; i += 1) {
      // Small patches leave the trampled ground around the fire mostly bare.
      const patch = i % 18, angle = patch * 2.4
      const radius = 3.1 + (patch % 7) * 0.72
      const x = Math.cos(angle) * radius + (rockRand() - 0.5) * 1.3
      const z = Math.sin(angle) * radius + (rockRand() - 0.5) * 1.3
      instance.position.set(x, terrainHeight(x, z) - 0.012, z)
      instance.rotation.set(0, rockRand() * Math.PI * 2, 0)
      instance.scale.setScalar(0.6 + rockRand() * 0.9)
      instance.updateMatrix()
      grass.setMatrixAt(i, instance.matrix)
      grass.setColorAt(i, instanceColor.setHSL(0.12 + rockRand() * 0.08, 0.16, 0.38 + rockRand() * 0.2))
    }
    grass.receiveShadow = true
    scene.add(grass)

    const starGeometry = new THREE.BufferGeometry()
    const starCount = 4200
    const starRadiusConst = 1200
    const starPositions = new Float32Array(starCount * 3)
    const starColors = new Float32Array(starCount * 3)
    const starRand = seededRandom(612)

    for (let i = 0; i < starCount; i += 1) {
      const theta = starRand() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.lerp(-0.985, 0.985, starRand()))
      const radius = starRadiusConst + starRand() * starRadiusConst / 2
      const y = Math.cos(phi) * radius
      const x = Math.sin(phi) * Math.cos(theta) * radius
      const z = Math.sin(phi) * Math.sin(theta) * radius
      const brightness = 0.65 + starRand() * 0.85
      const cold = starRand() > 0.28

      starPositions[i * 3] = x
      starPositions[i * 3 + 1] = y
      starPositions[i * 3 + 2] = z
      starColors[i * 3] = cold ? brightness * 0.9 : brightness * 1.25
      starColors[i * 3 + 1] = brightness
      starColors[i * 3 + 2] = cold ? brightness * 1.35 : brightness * 0.86
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 7.5,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    )
    scene.add(stars)

    const anchorStarCount = 420
    const anchorStarRadiusConst = 1500
    const anchorStarGeometry = new THREE.BufferGeometry()
    const anchorStarPositions = new Float32Array(anchorStarCount * 3)
    const anchorStarColors = new Float32Array(anchorStarCount * 3)
    const anchorRand = seededRandom(1717)

    for (let i = 0; i < anchorStarCount; i += 1) {
      const theta = anchorRand() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.lerp(-0.98, 0.98, anchorRand()))
      const radius = anchorStarRadiusConst + anchorRand() * anchorStarRadiusConst / 2
      const y = Math.cos(phi) * radius
      const twinkle = 1.6 + anchorRand() * 1.2

      anchorStarPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      anchorStarPositions[i * 3 + 1] = y
      anchorStarPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
      anchorStarColors[i * 3] = twinkle
      anchorStarColors[i * 3 + 1] = twinkle * (0.9 + anchorRand() * 0.25)
      anchorStarColors[i * 3 + 2] = twinkle * (0.95 + anchorRand() * 0.35)
    }

    anchorStarGeometry.setAttribute('position', new THREE.BufferAttribute(anchorStarPositions, 3))
    anchorStarGeometry.setAttribute('color', new THREE.BufferAttribute(anchorStarColors, 3))
    const anchorStars = new THREE.Points(
      anchorStarGeometry,
      new THREE.PointsMaterial({
        size: 16.2,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    )
    scene.add(anchorStars)
    const comet = createComet(particleTexture)
    scene.add(comet.group)

    const campfire = new THREE.Group()
    scene.add(campfire)

    const coalMaterial = new THREE.MeshStandardMaterial({
      color: 0x170806,
      emissive: 0xff3b12,
      emissiveIntensity: 0,
      roughness: 0.8,
    })
    const coalGeometry = new THREE.IcosahedronGeometry(0.12, 1)
    for (let i = 0; i < 20; i += 1) {
      const angle = (i / 20) * Math.PI * 2
      const radius = 0.12 + Math.random() * 0.32
      const coal = new THREE.Mesh(coalGeometry, coalMaterial)
      coal.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius)
      coal.scale.setScalar(0.65 + Math.random() * 1.1)
      coal.castShadow = true
      campfire.add(coal)
    }

    const logGeometry = new THREE.CylinderGeometry(0.095, 0.13, 1.28, 14)
    const logMaterial = createWoodMaterial(431, 0x38291d, 1, 3)
    for (let i = 0; i < 5; i += 1) {
      const log = new THREE.Mesh(logGeometry, logMaterial)
      log.position.set(0, 0.18 + i * 0.018, 0)
      log.rotation.z = Math.PI / 2 + (i % 2) * 0.1
      log.rotation.y = (i / 5) * Math.PI * 2
      log.castShadow = true
      log.receiveShadow = true
      campfire.add(log)
    }

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x85817a, map: dirtMaterial.map, bumpMap: dirtMaterial.map, bumpScale: 0.025, roughness: 1 })
    const stoneGeometry = new THREE.IcosahedronGeometry(0.18, 2)
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
      const radius = 0.8 + Math.sin(i * 7.1) * 0.035
      stone.position.set(Math.cos(angle) * radius, 0.10, Math.sin(angle) * radius)
      stone.scale.set(1.05 + Math.sin(i * 4.1) * 0.15, 0.68 + Math.sin(i * 2.3) * 0.12, 0.94)
      stone.rotation.set(angle * 0.7, angle, angle * 0.31)
      stone.castShadow = true
      stone.receiveShadow = true
      campfire.add(stone)
    }

    const signX = -1.62
    const signZ = -1.34
    const signGroup = new THREE.Group()
    signGroup.position.set(signX, terrainHeight(signX, signZ), signZ)
    signGroup.rotation.y = 0.18
    scene.add(signGroup)

    const signWood = createWoodMaterial(716, 0x9e8b6f, 1, 1)
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.27, 0.085), signWood)
      post.position.set(side * 0.52, 0.5, -0.1)
      post.rotation.z = side * 0.07
      post.castShadow = true
      signGroup.add(post)
    }

    const signBoardGroup = new THREE.Group()
    signBoardGroup.position.set(0, 1, 0)
    signBoardGroup.rotation.z = -0.04
    signGroup.add(signBoardGroup)
    const brace = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.1, 0.07), signWood)
    brace.position.z = -0.15
    brace.rotation.z = 0.37
    brace.castShadow = true
    signBoardGroup.add(brace)
    const pegMaterial = new THREE.MeshStandardMaterial({ color: 0x493020, roughness: 1 })
    const pegGeometry = new THREE.CylinderGeometry(0.016, 0.013, 0.016, 7)
    const planks = [
      { text: 'LOOK UP', width: 1.86, height: 0.36, x: -0.025, y: 0.17, tilt: 0.015 },
      { text: 'HOLD SPACE', width: 1.71, height: 0.27, x: 0.045, y: -0.18, tilt: -0.028 },
    ]
    planks.forEach((plank, index) => {
      const group = new THREE.Group()
      group.position.set(plank.x, plank.y, index * 0.012)
      group.rotation.z = plank.tilt
      const outline = new THREE.Shape()
      const corners = [[-0.5, -0.42], [-0.33, -0.48], [0.32, -0.46], [0.49, -0.5], [0.482, -0.13], [0.5, 0.08], [0.485, 0.46], [0.17, 0.49], [-0.12, 0.46], [-0.49, 0.5], [-0.48, 0.08], [-0.5, -0.03]]
      corners.forEach(([x, y], i) => {
        const px = (x + Math.sin(i * 3 + index * 5) * 0.005) * plank.width, py = y * plank.height
        if (i === 0) outline.moveTo(px, py)
        else outline.lineTo(px, py)
      })
      outline.closePath()
      const board = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.09, bevelEnabled: false }), signWood)
      board.position.z = -0.05
      board.castShadow = true
      board.receiveShadow = true
      group.add(board)
      const faceGeometry = new THREE.ShapeGeometry(outline)
      const positions = faceGeometry.attributes.position, uv = faceGeometry.attributes.uv
      for (let i = 0; i < positions.count; i += 1) {
        uv.setXY(i, positions.getX(i) / plank.width + 0.5, positions.getY(i) / plank.height + 0.5)
      }
      const texture = new THREE.CanvasTexture(makeCarvedWoodTexture(plank.text, 719 + index * 13))
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      const face = new THREE.Mesh(faceGeometry, new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 0.008, roughness: 1 }))
      face.position.z = 0.041
      face.receiveShadow = true
      group.add(face)
      for (const side of [-1, 1]) {
        const peg = new THREE.Mesh(pegGeometry, pegMaterial)
        peg.rotation.x = Math.PI / 2
        peg.position.set(side * 0.57, 0.015 * side, 0.046)
        group.add(peg)
      }
      signBoardGroup.add(group)
    })
    const signInteractionMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.73, 0.15),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    signInteractionMesh.geometry.computeBoundingBox()
    signBoardGroup.add(signInteractionMesh)
    const recordX = RECORD_X
    const recordZ = RECORD_Z
    const recordPlayer = new THREE.Group()
    recordPlayer.position.set(recordX, terrainHeight(recordX, recordZ) - 0.22, recordZ)
    const toSpawn = new THREE.Vector3(-recordX, 0, 4.15 - recordZ).normalize()
    recordPlayer.rotation.y = Math.atan2(-toSpawn.x, -toSpawn.z) - Math.PI / 6
    recordPlayer.rotation.x = -0.13
    recordPlayer.rotation.z = 0.14
    scene.add(recordPlayer)

    const rubbleRand = seededRandom(145)
    for (let i = 0; i < 28; i += 1) {
      const angle = rubbleRand() * Math.PI * 2
      const radius = 0.32 + rubbleRand() * 0.68
      const x = recordX + Math.cos(angle) * radius
      const z = recordZ + Math.sin(angle) * radius * 0.8
      const stone = new THREE.Mesh(rockGeometry, rockMaterial)
      const scale = 0.1 + rubbleRand() ** 2 * 0.6
      stone.scale.set(scale * 1.3, scale * 0.6, scale)
      stone.position.set(x, terrainHeight(x, z) + scale * 0.09, z)
      stone.rotation.set(rubbleRand(), rubbleRand() * 6, rubbleRand())
      stone.castShadow = stone.receiveShadow = true
      scene.add(stone)
    }


    const recordInteractionMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 1.55, 1.35),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    recordInteractionMesh.geometry.computeBoundingBox()
    recordInteractionMesh.position.set(0, 0.68, -0.08)
    recordPlayer.add(recordInteractionMesh)

    let phonographLoadCancelled = false
    let recordDisc = null
    const phonographManager = new THREE.LoadingManager()
    phonographManager.setURLModifier((url) => {
      const normalizedUrl = url.replace(/\\/g, '/')
      if (normalizedUrl.endsWith('scene.bin')) return phonographBinUrl
      if (normalizedUrl.endsWith('textures/Material_baseColor.png') || normalizedUrl.endsWith('Material_baseColor.png')) {
        return phonographTextureUrl
      }

      return url
    })

    new GLTFLoader(phonographManager).load(phonographSceneUrl, (gltf) => {
      if (phonographLoadCancelled) {
        disposeObjectTree(gltf.scene)
        return
      }

      const phonograph = gltf.scene
      phonograph.name = 'phonograph'
      phonograph.position.set(0, 0.01, 0)
      phonograph.scale.setScalar(0.352)

      phonograph.traverse((object) => {
        if (!object.isMesh) return

        object.castShadow = true
        object.receiveShadow = true
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.filter(Boolean).forEach((material) => {
          if (material.map) {
            material.map.colorSpace = THREE.SRGBColorSpace
            material.map.anisotropy = 4
          }
          material.roughness = 0.94
          material.color.set(0x817567)
          material.metalness = material.metalness ?? 0
        })
      })

      // Smooth the existing horn mesh and give its brass a restrained metal response.
      phonograph.getObjectByName('horn_5')?.traverse((object) => {
        if (!object.isMesh) return
        const geometry = object.geometry
        geometry.deleteAttribute('normal')
        geometry.deleteAttribute('uv')
        object.geometry = mergeVertices(geometry)
        object.geometry.computeVertexNormals()
        geometry.dispose()
        object.material = new THREE.MeshStandardMaterial({ color: 0x736749, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
      })

      recordPlayer.add(phonograph)
      recordPlayer.updateWorldMatrix(true, true)
      phonograph.updateWorldMatrix(true, true)

      recordDisc = phonograph.getObjectByName('record_2')
    })

    let recordTracks = DEFAULT_RECORD_TRACKS
    let recordTrackIndex = 0
    let recordTrackTitle = ''
    let recordAudio = null
    let recordObjectUrl = null
    let recordMaxVolume = DEFAULT_RECORD_TRACKS[0].volume ?? 0.28
    let recordFadeElapsed = 0
    let recordListeningDistance = camera.position.distanceTo(recordPlayer.position)
    let audioCancelled = false
    let audioUnlockRegistered = false
    const playRecordAudio = () => {
      if (!recordAudio) return
      recordAudio
        .play()
        .then(() => {
          audioUnlockRegistered = false
          removeAudioUnlock()
        })
        .catch(() => {})
    }
    const removeAudioUnlock = () => {
      window.removeEventListener('pointerdown', playRecordAudio)
      window.removeEventListener('keydown', playRecordAudio)
    }

    const revokeRecordObjectUrl = () => {
      if (!recordObjectUrl) return
      URL.revokeObjectURL(recordObjectUrl)
      recordObjectUrl = null
    }

    const registerAudioUnlock = () => {
      if (audioUnlockRegistered) return
      audioUnlockRegistered = true
      window.addEventListener('pointerdown', playRecordAudio, { once: true })
      window.addEventListener('keydown', playRecordAudio, { once: true })
    }

    const setRecordTrack = (index) => {
      if (audioCancelled || recordTracks.length === 0) return

      const normalizedIndex = ((index % recordTracks.length) + recordTracks.length) % recordTracks.length
      const track = recordTracks[normalizedIndex] ?? DEFAULT_RECORD_TRACKS[0]

      if (recordAudio) {
        recordAudio.pause()
        recordAudio.src = ''
      }
      revokeRecordObjectUrl()

      recordTrackIndex = normalizedIndex
      recordObjectUrl = track.src ? null : createProceduralRecordUrl(track)
      recordAudio = new Audio(track.src || recordObjectUrl)
      recordAudio.loop = true
      recordMaxVolume = THREE.MathUtils.clamp(track.volume ?? 0.28, 0, 0.65)
      recordFadeElapsed = 0
      recordAudio.volume = 0
      recordAudio.preload = 'auto'
      recordTrackTitle = track.title ?? DEFAULT_RECORD_TRACKS[0].title
      setCurrentRecordTitle(recordTrackTitle)
      recordAudio
        .play()
        .then(() => {
          audioUnlockRegistered = false
          removeAudioUnlock()
        })
        .catch(registerAudioUnlock)
    }

    const skipRecordTrack = () => {
      if (recordTracks.length === 0) return false

      setRecordTrack(recordTracks.length > 1 ? recordTrackIndex + 1 : recordTrackIndex)
      return true
    }

    loadRecordTracks().then((tracks) => {
      if (audioCancelled) return

      recordTracks = tracks
      setRecordTrack(Math.floor(Math.random() * recordTracks.length))
    })

    const flameGroup = new THREE.Group()
    campfire.add(flameGroup)

    const flameMeshes = Array.from({ length: 3 }, (_, index) => {
      const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.72 - index * 0.1, 1.08 - index * 0.15), makeFlameMaterial())
      flame.position.set((index - 1) * 0.12, 0.68 - index * 0.07, index * 0.08)
      flameGroup.add(flame)
      return flame
    })

    const fireLight = new THREE.PointLight(0xffbb7d, 0, 10, 1.8)
    fireLight.position.set(0, 1.15, 0)
    fireLight.castShadow = true
    fireLight.shadow.mapSize.set(1024, 1024)
    fireLight.shadow.bias = -0.0005
    fireLight.shadow.normalBias = 0.045
    campfire.add(fireLight)

    const lowGlow = new THREE.PointLight(0xff3b18, 0, 4.2, 2)
    lowGlow.position.set(0, 0.24, 0)
    campfire.add(lowGlow)

    const sparkCount = 64
    const sparkGeometry = new THREE.BufferGeometry()
    const sparkPositions = new Float32Array(sparkCount * 3)
    const sparkVelocities = new Float32Array(sparkCount * 3)
    const sparkColors = new Float32Array(sparkCount * 3)
    const sparkAges = new Float32Array(sparkCount)
    const sparkLifetimes = new Float32Array(sparkCount)
    const sparkRand = seededRandom(700)

    const respawnFireSpark = (index, randomizeAge = false) => {
      const angle = sparkRand() * Math.PI * 2
      const radius = sparkRand() * 0.18
      const slot = index * 3

      sparkPositions[slot] = Math.cos(angle) * radius
      sparkPositions[slot + 1] = 0.18 + sparkRand() * 0.26
      sparkPositions[slot + 2] = Math.sin(angle) * radius
      sparkVelocities[slot] = Math.cos(angle) * (0.07 + sparkRand() * 0.18) + (sparkRand() - 0.5) * 0.08
      sparkVelocities[slot + 1] = 0.42 + sparkRand() * 0.78
      sparkVelocities[slot + 2] = Math.sin(angle) * (0.07 + sparkRand() * 0.18) + (sparkRand() - 0.5) * 0.08
      sparkLifetimes[index] = 1.1 + sparkRand() * 1.45
      sparkAges[index] = randomizeAge ? sparkRand() * sparkLifetimes[index] : 0
    }

    for (let i = 0; i < sparkCount; i += 1) {
      respawnFireSpark(i, true)
    }

    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
    sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3))
    const sparks = new THREE.Points(
      sparkGeometry,
      new THREE.PointsMaterial({
        size: 0.035,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    campfire.add(sparks)

    const planetMeshes = []
    const planetDecorRings = []
    const skyGroup = new THREE.Group()
    scene.add(skyGroup)

    const portraits = {}
    const companionConfigs = rollSystemCompanions(DISCOVERIES.length)
    DISCOVERIES.forEach((discovery, index) => {
      const planetTexture = new THREE.CanvasTexture(makePlanetTexture(discovery.palette, index + 10, discovery.planetStyle))
      planetTexture.colorSpace = THREE.SRGBColorSpace
      planetTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      const planet = new THREE.Mesh(
        makePlanetGeometry(discovery.radius, index + 10, discovery.planetStyle),
        makePlanetSurfaceMaterial(planetTexture, index + 10, discovery.planetStyle),
      )
      planet.position.set(...discovery.position).multiplyScalar(1.65)
      planet.userData.discoveryId = discovery.id
      planet.userData.orbitRadius = discovery.radius * (discovery.planetStyle.rings ? 2.2 : 1.1)
      planet.userData.discovered = discoveredIdsRef.current.has(discovery.id)
      planet.userData.discoveryGlow = 0
      skyGroup.add(planet)
      planetMeshes.push(planet)

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(discovery.radius * 1.025, 48, 32),
        makeAtmosphereMaterial(discovery.hex),
      )
      atmosphere.position.copy(planet.position)
      skyGroup.add(atmosphere)
      planet.userData.atmosphere = atmosphere
      if (!discovery.planetStyle.bands && !discovery.planetStyle.cracked) {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(discovery.radius * 1.008, 96, 64),
          makePlanetCloudMaterial(index + 21, discovery.palette.at(-1)),
        )
        clouds.position.copy(planet.position)
        skyGroup.add(clouds)
        planet.userData.clouds = clouds
      }

      let decorRing = null
      if (discovery.planetStyle?.rings) {
        const inner = discovery.radius * 1.35
        const outer = discovery.radius * 2.12
        const geometry = new THREE.RingGeometry(inner, outer, 128, 1)
        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i += 1) {
          geometry.attributes.uv.setXY(i, (Math.hypot(position.getX(i), position.getY(i)) - inner) / (outer - inner), 0.5)
        }
        decorRing = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
          map: makeRingTexture(index + 1), roughness: 1, transparent: true, opacity: 1,
          depthWrite: false, side: THREE.DoubleSide, fog: false,
        }))
        decorRing.material.emissive.set(0x656457)
        decorRing.material.emissiveMap = decorRing.material.map
        decorRing.material.emissiveIntensity = 0
        decorRing.position.copy(planet.position)
        decorRing.rotation.set(Math.PI / 2 + discovery.planetStyle.ringTilt, index * 0.48, index * 0.2)
        skyGroup.add(decorRing)
      }
      planetDecorRings.push(decorRing)
      portraits[discovery.id] = makePlanetPortrait(renderer, planet, decorRing, camera.position)
      const companions = createPlanetCompanions(discovery, particleTexture, companionConfigs[index])
      companions.group.position.copy(planet.position)
      skyGroup.add(companions.group)
      planet.userData.companions = companions
      planet.userData.orbitRadius = Math.max(planet.userData.orbitRadius, companions.outerRadius)
    })

    const burstCount = 256
    const burstPositions = new Float32Array(burstCount * 3)
    const burstVelocities = new Float32Array(burstCount * 3)
    const burstColors = new Float32Array(burstCount * 3)
    const burstBaseColors = new Float32Array(burstCount * 3)
    const burstAges = new Float32Array(burstCount)
    const burstLifetimes = new Float32Array(burstCount)
    const burstRand = seededRandom(1042)
    let burstCursor = 0

    const burstGeometry = new THREE.BufferGeometry()
    burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3))
    burstGeometry.setAttribute('color', new THREE.BufferAttribute(burstColors, 3))
    const burstParticles = new THREE.Points(
      burstGeometry,
      new THREE.PointsMaterial({
        size: 2,
        map: particleTexture,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    burstParticles.frustumCulled = false
    burstParticles.renderOrder = 8
    skyGroup.add(burstParticles)
    const discoveryWave = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.025, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    )
    skyGroup.add(discoveryWave)
    let waveAge = 2
    let waveRadius = 1

    const spawnDiscoveryBurst = (planet, index, firstDiscovery) => {
      if (!firstDiscovery) return

      const discovery = DISCOVERIES[index]
      const color = new THREE.Color(discovery.hex)
      waveAge = 0
      waveRadius = discovery.radius
      discoveryWave.position.copy(planet.position)
      discoveryWave.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.4)
      const burstSize = 72
      const visibilityBoost = discovery.visibilityBoost ?? 1
      planet.userData.discovered = true
      planet.userData.discoveryGlow = Math.max(planet.userData.discoveryGlow, 2.4)
      planet.material.color.setRGB(1 * visibilityBoost, 1 * visibilityBoost, 1 * visibilityBoost)
      for (let i = 0; i < burstSize; i += 1) {
        const slot = burstCursor
        burstCursor = (burstCursor + 1) % burstCount

        const y = burstRand() * 2 - 1
        const theta = burstRand() * Math.PI * 2
        const radial = Math.sqrt(1 - y * y)
        const dx = radial * Math.cos(theta)
        const dy = y
        const dz = radial * Math.sin(theta)
        const surface = discovery.radius * (1.08 + burstRand() * 0.5)
        const speed = 2 + burstRand() * 4

        burstPositions[slot * 3] = planet.position.x + dx * surface
        burstPositions[slot * 3 + 1] = planet.position.y + dy * surface
        burstPositions[slot * 3 + 2] = planet.position.z + dz * surface
        burstVelocities[slot * 3] = dx * speed + (burstRand() - 0.5) * 2.4
        burstVelocities[slot * 3 + 1] = dy * speed + burstRand() * 1.8
        burstVelocities[slot * 3 + 2] = dz * speed + (burstRand() - 0.5) * 2.4
        burstAges[slot] = 0
        burstLifetimes[slot] = 0.48 + burstRand() * 0.58
        const sparkleColor = color.clone().lerp(new THREE.Color(0xffffff), 0.08 + burstRand() * 0.16)
        const sparkleIntensity = 0.6 + burstRand() * 0.5
        burstBaseColors[slot * 3] = sparkleColor.r * sparkleIntensity
        burstBaseColors[slot * 3 + 1] = sparkleColor.g * sparkleIntensity
        burstBaseColors[slot * 3 + 2] = sparkleColor.b * sparkleIntensity
      }

      burstGeometry.attributes.position.needsUpdate = true
      burstGeometry.attributes.color.needsUpdate = true
      burstParticles.material.opacity = 1
    }

    const orbit = createPlanetOrbit(camera, setOrbitPhase, planetMeshes)
    const campObjects = scene.children.filter(object => !object.isLight && ![skyGroup, stars, anchorStars, comet.group].includes(object))
    // Upload every companion's geometry, textures and shaders behind the intro.
    // A tiny offscreen render also prepares planets outside the camera's view.
    const preloadTarget = new THREE.WebGLRenderTarget(1, 1)
    const companionCulling = new Map()
    planetMeshes.forEach(planet => {
      const companions = planet.userData.companions
      companions.update(0, 1, reducedMotion)
      companions.group.traverse(object => {
        companionCulling.set(object, object.frustumCulled)
        object.frustumCulled = false
      })
    })
    // Warm both lighting variants: firelight near camp and sunlight in orbit.
    for (const campVisible of [false, true]) {
      campObjects.forEach(object => { object.visible = campVisible })
      renderer.setRenderTarget(preloadTarget)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.compile(skyGroup, camera, scene)
    }
    preloadTarget.dispose()
    companionCulling.forEach((culled, object) => { object.frustumCulled = culled })
    planetMeshes.forEach(planet => planet.userData.companions.update(0, 0, reducedMotion))

    const frameOffset = new THREE.Vector2()
    const projected = new THREE.Vector3()
    const anchorNormal = new THREE.Vector3()
    const anchorView = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    const center = new THREE.Vector2(0, 0)
    const pointerNdc = new THREE.Vector2()
    const cameraDirection = new THREE.Vector3()
    const targetDirection = new THREE.Vector3()
    const planetTint = new THREE.Color()
    const interactionCenter = new THREE.Vector3()
    const pressed = new Set()
    let scopeKeyHeld = false
    const velocity = new THREE.Vector3()
    const desiredVelocity = new THREE.Vector3()
    const viewEuler = new THREE.Euler(0, 0, 0, 'YXZ')
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    const drag = {
      active: false,
      pointerId: null,
      x: 0,
      y: 0,
      moved: 0,
    }

    let yaw = 0
    let pitch = -0.1
    let viewYaw = yaw
    let viewPitch = pitch
    let localFocus = null
    let scopeHoldTarget = null
    let scopeHoldElapsed = 0
    let scopeAutoOpenedTarget = null
    let scopeLostTime = 0
    let displayedProgress = 0
    let displayedProximity = 0
    let hasStartedIntro = false
    const startTime = performance.now()
    let lastTime = startTime
    let raf = 0

    const setFocus = (id) => {
      if (localFocus === id) return
      localFocus = id
      setFocusedTarget(id)
    }

    const resetScopeHold = () => {
      scopeHoldTarget = null
      scopeHoldElapsed = 0
      scopeLostTime = 0
      scopeAutoOpenedTarget = null
    }

    const updateScopeAutoOpen = (id, dt) => {
      if (!scopeActiveRef.current) {
        resetScopeHold()
      } else if (!id) {
        if (scopeAutoOpenedTarget) resetScopeHold()
        scopeLostTime += dt
        if (scopeLostTime > 0.2) scopeHoldElapsed = Math.max(0, scopeHoldElapsed - dt * 1.5)
        if (scopeHoldElapsed === 0) resetScopeHold()
      } else {
        scopeLostTime = 0
        if (scopeHoldTarget !== id) {
          scopeHoldTarget = id
          scopeHoldElapsed = 0
          scopeAutoOpenedTarget = null
        }
        if (scopeAutoOpenedTarget !== id) {
          scopeHoldElapsed = Math.min(SCOPE_AUTO_OPEN_DURATION, scopeHoldElapsed + dt)
          if (scopeHoldElapsed >= SCOPE_AUTO_OPEN_DURATION) {
            scopeAutoOpenedTarget = id
            revealDiscovery(id)
            setCompletedDiscovery(id)
          }
        }
      }
      const progress = scopeHoldElapsed / SCOPE_AUTO_OPEN_DURATION
      displayedProgress = progress === 1 ? 1 : THREE.MathUtils.damp(displayedProgress, progress, 22, dt)
      if (progressCircleRef.current) progressCircleRef.current.style.strokeDashoffset = String(1 - displayedProgress)
    }

    const setSignPromptAvailable = (value) => {
      if (readSignAvailableRef.current === value) return
      readSignAvailableRef.current = value
      setReadSignAvailable(value)
    }

    const setPhonographPromptAvailable = (value) => {
      if (phonographPromptAvailableRef.current === value) return
      phonographPromptAvailableRef.current = value
      setPhonographPromptAvailableState(value)
    }

    const clampPlayer = () => {
      const flatLength = Math.sqrt(camera.position.x * camera.position.x + camera.position.z * camera.position.z)

      if (flatLength > PLAYER_RADIUS) {
        const scale = PLAYER_RADIUS / flatLength
        camera.position.x *= scale
        camera.position.z *= scale
      }

      const innerLength = Math.sqrt(camera.position.x * camera.position.x + camera.position.z * camera.position.z)
      if (innerLength < CAMPFIRE_RADIUS) {
        const angle = Math.atan2(camera.position.z, camera.position.x || 0.001)
        camera.position.x = Math.cos(angle) * CAMPFIRE_RADIUS
        camera.position.z = Math.sin(angle) * CAMPFIRE_RADIUS
      }

      camera.position.y = terrainHeight(camera.position.x, camera.position.z) + EYE_HEIGHT
    }

    const setRaycasterFromPointer = (event) => {
      const rect = mount.getBoundingClientRect()
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return false
      }

      pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      camera.updateMatrixWorld()
      raycaster.setFromCamera(pointerNdc, camera)
      return true
    }

    const getDiscoveredPlanetIdAtPointer = (event) => {
      if (!setRaycasterFromPointer(event)) return null

      const hit = raycaster.intersectObjects(planetMeshes, false).find(({ object }) => object.userData.discovered)
      return hit?.object.userData.discoveryId ?? null
    }

    const isInteractionBoxAtPointer = (event, interactionMesh, maxDistance) => {
      if (scopeActiveRef.current || orbit.active || orbitTargetRef.current) return false

      interactionMesh.updateWorldMatrix(true, false)
      interactionMesh.getWorldPosition(interactionCenter)
      if (interactionCenter.distanceTo(camera.position) > maxDistance) return false
      if (!setRaycasterFromPointer(event)) return false

      return raycaster.intersectObject(interactionMesh, false).some((hit) => hit.distance <= maxDistance)
    }

    const isReadableSignAtPointer = (event) => isInteractionBoxAtPointer(event, signInteractionMesh, SIGN_READ_DISTANCE)

    const isSkippableRecordAtPointer = (event) =>
      Boolean(recordAudio && recordTrackTitle) && isInteractionBoxAtPointer(event, recordInteractionMesh, PHONOGRAPH_INTERACT_DISTANCE)

    const openFocusedPlanet = (event = null) => {
      if (scopeActiveRef.current) return

      const clickedId = event ? getDiscoveredPlanetIdAtPointer(event) : null
      if (clickedId) {
        revealDiscovery(clickedId)
        return
      }

      const focusedPlanet = planetMeshes.find((planet) => planet.userData.discoveryId === localFocus)
      if (focusedPlanet?.userData.discovered) {
        revealDiscovery(localFocus)
      }
    }

    const tryOpenSignPanel = (event = null) => {
      if (!readSignAvailableRef.current && !(event && isReadableSignAtPointer(event))) return false
      setSignPanelOpen(true)
      return true
    }

    const trySkipRecord = (event = null) => {
      if (!phonographPromptAvailableRef.current && !(event && isSkippableRecordAtPointer(event))) return false
      skipRecordTrack()
      return true
    }

    const onPointerHover = (event) => {
      if (event.target !== renderer.domElement) {
        setSignPromptAvailable(false)
        setPhonographPromptAvailable(false)
        return
      }
      const signAvailable = isReadableSignAtPointer(event)
      setSignPromptAvailable(signAvailable)
      setPhonographPromptAvailable(!signAvailable && isSkippableRecordAtPointer(event))
    }

    const onPointerDown = (event) => {
      if (event.button !== 0 && event.button !== 2) return
      if (event.button === 2 && !orbit.active && !orbitTargetRef.current) setScopeActive(true)

      mount.focus({ preventScroll: true })
      drag.active = true
      drag.pointerId = event.pointerId
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved = 0
      mount.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event) => {
      if (!drag.active || drag.pointerId !== event.pointerId) return

      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved += Math.abs(dx) + Math.abs(dy)

      if (orbit.active || orbitTargetRef.current) {
        orbit.drag(dx, dy)
        return
      }
      const sensitivity = scopeActiveRef.current ? 0.0014 : 0.003
      yaw -= dx * sensitivity
      pitch = THREE.MathUtils.clamp(pitch - dy * sensitivity, -0.65, 1.18)
    }

    const onPointerLeave = () => {
      setSignPromptAvailable(false)
      setPhonographPromptAvailable(false)
    }

    const onPointerUp = (event) => {
      if (event.button === 2) setScopeActive(false)

      if (!drag.active || drag.pointerId !== event.pointerId) return

      if (!orbit.active && !orbitTargetRef.current && event.button === 0 && drag.moved < 7) {
        if (!tryOpenSignPanel(event) && !trySkipRecord(event)) {
          openFocusedPlanet(event)
        }
      }

      drag.active = false
      drag.pointerId = null
      if (mount.hasPointerCapture(event.pointerId)) {
        mount.releasePointerCapture(event.pointerId)
      }
    }

    const onContextMenu = (event) => event.preventDefault()

    const onKeyDown = (event) => {
      // Discovery moves focus to Close; keep the held scan key from activating it.
      if (event.code === 'Space' && scopeKeyHeld) {
        event.preventDefault()
        return
      }
      if (mount.inert) return
      if (event.repeat) return
      if (event.code === 'Escape') {
        setCompletedDiscovery(null)
        resetScopeHold()
        closeDiscovery()
        setSidebarOpen(false)
        setSignPanelOpen(false)
        setScopeActive(false)
        mount.focus({ preventScroll: true })
        return
      }
      if (event.target.closest('button, a, aside')) return
      if (orbit.active || orbitTargetRef.current) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
        if (event.code === 'ArrowLeft') orbit.drag(-30, 0)
        if (event.code === 'ArrowRight') orbit.drag(30, 0)
        if (event.code === 'ArrowUp') orbit.drag(0, -30)
        if (event.code === 'ArrowDown') orbit.drag(0, 30)
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      if (event.code === 'Space') {
        event.preventDefault()
        scopeKeyHeld = true
        setScopeActive(true)
      }
      pressed.add(event.code)

      if (event.code === 'Enter') {
        if (!tryOpenSignPanel() && !trySkipRecord()) {
          openFocusedPlanet()
        }
      }
    }

    const onKeyUp = (event) => {
      if (event.code === 'Space' && scopeKeyHeld) {
        event.preventDefault()
        scopeKeyHeld = false
        setScopeActive(false)
      }
      pressed.delete(event.code)
    }

    const onBlur = () => {
      scopeKeyHeld = false
      setCompletedDiscovery(null)
      pressed.clear()
      velocity.set(0, 0, 0)
      drag.active = false
      drag.pointerId = null
      setScopeActive(false)
    }

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
    }

    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    mount.addEventListener('pointercancel', onBlur)
    mount.addEventListener('pointerleave', onPointerLeave)
    mount.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointermove', onPointerHover)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', resize)

    const tick = (time) => {
      raf = requestAnimationFrame(tick)
      const elapsed = (time - startTime) * 0.001
      const dt = Math.min(0.04, (time - lastTime) * 0.001)
      lastTime = time
      const ignition = smoothstep(0, 1.6, elapsed)
      const firePulse = reducedMotion ? 0.85 : 0.85 + Math.sin(elapsed * 4.1) * 0.08 + Math.sin(elapsed * 7.7) * 0.035
      const scopeAmount = scopeActiveRef.current ? 1 : 0

      ambient.intensity = 0.025 + ignition * 0.01
      fireLight.intensity = ignition * (10.5 + firePulse * 2.2)
      lowGlow.intensity = ignition * (0.55 + firePulse * 0.3)
      coalMaterial.emissiveIntensity = ignition * (0.5 + firePulse * 0.3)

      flameMeshes.forEach((flame, index) => {
        flame.material.uniforms.time.value = (reducedMotion ? 0 : elapsed) + index * 11
        flame.material.uniforms.opacity.value = ignition * (0.66 - index * 0.12)
        flame.rotation.y = Math.atan2(camera.position.x, camera.position.z)
        flame.scale.y = reducedMotion ? 1 : 0.94 + Math.sin(elapsed * 3.2 + index) * 0.06
      })

      if (recordDisc && !reducedMotion) {
        recordDisc.rotation.y += dt * 2.85
      }

      // Keep the departure listening distance through flights, orbits and transfers.
      if (!orbit.active) recordListeningDistance = camera.position.distanceTo(recordPlayer.position)
      if (recordAudio) {
        recordAudio.muted = audioMutedRef.current
        if (!recordAudio.paused) {
          recordFadeElapsed = Math.min(MUSIC_FADE_SECONDS, recordFadeElapsed + dt)
        }
        const fadeAmount = recordFadeElapsed / MUSIC_FADE_SECONDS
        const recordVolumeTarget =
          (audioMutedRef.current ? 0 : recordMaxVolume) *
          fadeAmount *
          THREE.MathUtils.clamp(1 - (recordListeningDistance - 1) / 8, 0.1, 1)
        recordAudio.volume = THREE.MathUtils.lerp(recordAudio.volume, recordVolumeTarget, 1 - Math.exp(-dt * 3.4))
      }

      sparks.material.opacity = ignition * 0.88
      sparks.visible = !reducedMotion
      burstParticles.visible = !reducedMotion
      for (let i = 0; i < sparkCount; i += 1) {
        sparkAges[i] += dt
        if (sparkAges[i] >= sparkLifetimes[i]) {
          respawnFireSpark(i)
        }

        const slot = i * 3
        const life = THREE.MathUtils.clamp(sparkAges[i] / sparkLifetimes[i], 0, 1)
        const swirl = Math.sin(elapsed * 3.4 + i * 1.7) * 0.032 * (1 - life)
        sparkVelocities[slot] += swirl * dt
        sparkVelocities[slot + 2] += Math.cos(elapsed * 2.8 + i) * 0.026 * dt
        sparkVelocities[slot + 1] = Math.max(
          0.12 + (1 - life) * 0.24,
          sparkVelocities[slot + 1] - dt * (0.04 + life * 0.08),
        )

        sparkPositions[slot] += sparkVelocities[slot] * dt
        sparkPositions[slot + 1] += sparkVelocities[slot + 1] * dt
        sparkPositions[slot + 2] += sparkVelocities[slot + 2] * dt

        const fade = Math.sin(Math.PI * life) * Math.pow(1 - life, 1.45) * ignition
        const ember = 0.42 + life * 0.58
        sparkColors[slot] = fade * (2.2 - life * 0.7)
        sparkColors[slot + 1] = fade * (0.72 - life * 0.42)
        sparkColors[slot + 2] = fade * 0.12 * ember
      }
      sparkGeometry.attributes.position.needsUpdate = true
      sparkGeometry.attributes.color.needsUpdate = true

      const orbitPlanet = planetMeshes.find(planet => planet.userData.discoveryId === orbitTargetRef.current) ?? null
      const panelBounds = panelRef.current?.getBoundingClientRect()
      const log = mount.parentElement.querySelector('.section-sidebar.is-open')
      const logBounds = log?.getBoundingClientRect()
      const width = mount.clientWidth, height = mount.clientHeight
      const mobile = width <= 760
      // Frame the actual free sky between instruments, including when the log opens.
      const left = !mobile && panelBounds ? panelBounds.right + 30 : 20
      const rightEdge = !mobile && logBounds ? logBounds.left - 30 : width - 20
      const top = 76
      const bottom = mobile && panelBounds ? panelBounds.top - 24 : height - 70
      const centerX = (left + rightEdge) / 2, centerY = (top + bottom) / 2
      const hasCompanions = orbitPlanet && (orbitPlanet.userData.companions.config.moonCount || orbitPlanet.userData.companions.config.ufo)
      const diameter = Math.max(80, Math.min(rightEdge - left, bottom - top) * (hasCompanions ? 0.88 : 0.72))
      const discovery = orbitPlanet && DISCOVERY_BY_ID[orbitPlanet.userData.discoveryId]
      const outerRadius = orbitPlanet?.userData.orbitRadius ?? 1
      const angularRadius = Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) * diameter / height)
      const orbitDistance = outerRadius / Math.sin(angularRadius)
      if (orbit.active || orbitPlanet) {
        pressed.clear()
        velocity.set(0, 0, 0)
        // Freeze the ground look controls at the saved view, not their damped target.
        yaw = viewYaw
        pitch = viewPitch
      } else {
        const lookEase = reducedMotion ? 1 : 1 - Math.exp(-dt * 22)
        viewYaw += shortestAngleDelta(viewYaw, yaw) * lookEase
        viewPitch = THREE.MathUtils.lerp(viewPitch, pitch, lookEase)
        camera.quaternion.setFromEuler(viewEuler.set(viewPitch, viewYaw, 0))
        forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
        forward.y = 0
        forward.normalize()
        right.crossVectors(forward, UP).normalize()
        desiredVelocity.set(0, 0, 0)

        if (pressed.has('KeyW') || pressed.has('ArrowUp')) desiredVelocity.add(forward)
        if (pressed.has('KeyS') || pressed.has('ArrowDown')) desiredVelocity.sub(forward)
        if (pressed.has('KeyD') || pressed.has('ArrowRight')) desiredVelocity.add(right)
        if (pressed.has('KeyA') || pressed.has('ArrowLeft')) desiredVelocity.sub(right)

        desiredVelocity.normalize().multiplyScalar(scopeActiveRef.current ? 1.05 : 1.85)
        velocity.lerp(desiredVelocity, 1 - Math.exp(-dt * 12))
        if (velocity.lengthSq() > 0.00001) {
          camera.position.addScaledVector(velocity, dt)
          clampPlayer()
        }
      }
      orbit.update(orbitPlanet, orbitDistance, dt, reducedMotion)
      const campVisible = !orbit.active || orbit.distanceFromCamp < 27
      campObjects.forEach(object => { object.visible = campVisible })

      // Preserve enough horizontal view to include the camp and planets in portrait.
      const explorationFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(34)) / Math.min(1, Math.max(0.5, camera.aspect))))
      camera.fov = THREE.MathUtils.lerp(camera.fov, orbitPlanet ? 48 : scopeActiveRef.current ? 19 : explorationFov, reducedMotion ? 1 : 1 - Math.exp(-dt * 18))
      const frameEase = reducedMotion ? 1 : 1 - Math.exp(-dt * 5)
      frameOffset.x = THREE.MathUtils.lerp(frameOffset.x, orbitPlanet ? width / 2 - centerX : 0, frameEase)
      frameOffset.y = THREE.MathUtils.lerp(frameOffset.y, orbitPlanet ? height / 2 - centerY : 0, frameEase)
      camera.setViewOffset(width, height, frameOffset.x, frameOffset.y, width, height)
      camera.updateMatrixWorld()

      stars.position.copy(camera.position)
      anchorStars.position.copy(camera.position)
      comet.update(elapsed, dt, camera, reducedMotion)
      waveAge += dt
      discoveryWave.visible = waveAge < 1.3 && !reducedMotion
      if (discoveryWave.visible) {
        discoveryWave.lookAt(camera.position)
        discoveryWave.scale.setScalar(waveRadius * (1.1 + waveAge * 3.5))
        discoveryWave.material.opacity = Math.max(0, 1 - waveAge / 1.3) ** 2 * 0.85
      }

      while (discoveryEventsRef.current.length > 0) {
        const event = discoveryEventsRef.current.shift()
        const planetIndex = DISCOVERIES.findIndex((discovery) => discovery.id === event.id)
        if (planetIndex >= 0) {
          spawnDiscoveryBurst(planetMeshes[planetIndex], planetIndex, event.firstDiscovery)
        }
      }

      let activeBurstParticles = false
      let burstParticlesChanged = false
      for (let i = 0; i < burstCount; i += 1) {
        if (burstAges[i] >= burstLifetimes[i]) {
          continue
        }

        burstParticlesChanged = true
        burstAges[i] += dt
        const life = Math.min(1, burstAges[i] / burstLifetimes[i])
        const flare = Math.sin(Math.PI * life)
        const fade = Math.pow(1 - life, 2.15) * (0.85 + flare * 1.1) * (0.76 + Math.sin(elapsed * 24 + i) * 0.24)
        activeBurstParticles = activeBurstParticles || fade > 0.01

        burstVelocities[i * 3] *= Math.exp(-dt * 0.48)
        burstVelocities[i * 3 + 1] *= Math.exp(-dt * 0.48)
        burstVelocities[i * 3 + 2] *= Math.exp(-dt * 0.48)
        burstPositions[i * 3] += burstVelocities[i * 3] * dt
        burstPositions[i * 3 + 1] += burstVelocities[i * 3 + 1] * dt
        burstPositions[i * 3 + 2] += burstVelocities[i * 3 + 2] * dt
        burstColors[i * 3] = burstBaseColors[i * 3] * fade
        burstColors[i * 3 + 1] = burstBaseColors[i * 3 + 1] * fade
        burstColors[i * 3 + 2] = burstBaseColors[i * 3 + 2] * fade
      }
      burstGeometry.attributes.position.needsUpdate = burstParticlesChanged
      burstGeometry.attributes.color.needsUpdate = burstParticlesChanged
      burstParticles.material.opacity = THREE.MathUtils.lerp(burstParticles.material.opacity, activeBurstParticles ? 1 : 0, 1 - Math.exp(-dt * 5))

      raycaster.setFromCamera(center, camera)
      const hits = raycaster.intersectObjects(planetMeshes, false)
      const focusedHit = hits.find(({ object }) => scopeActiveRef.current || object.userData.discovered)
      let focusedId = focusedHit?.object.userData.discoveryId ?? null
      let proximity = 0

      if (scopeActiveRef.current) {
        camera.getWorldDirection(cameraDirection)
        let bestAngle = Infinity

        planetMeshes.forEach((planet, index) => {
          targetDirection.copy(planet.position).sub(camera.position)
          const distance = targetDirection.length()
          targetDirection.multiplyScalar(1 / distance)
          const angle = cameraDirection.angleTo(targetDirection)
          const lockAngle = Math.atan(DISCOVERIES[index].radius / distance) + 0.016
          const scanAngle = 0.72
          proximity = Math.max(proximity, 1 - THREE.MathUtils.clamp((angle - lockAngle) / (scanAngle - lockAngle), 0, 1))

          if (!focusedId && angle < lockAngle && angle < bestAngle) {
            bestAngle = angle
            focusedId = planet.userData.discoveryId
          }
        })
      }
      if (focusedId && scopeActiveRef.current) proximity = 1
      displayedProximity = reducedMotion ? proximity : THREE.MathUtils.damp(displayedProximity, proximity, 24, dt)
      if (proximity === 1 && displayedProximity > 0.99) displayedProximity = 1
      if (scopeSignalRef.current) {
        scopeSignalRef.current.style.setProperty('--signal-gap', `${(1 - displayedProximity) * 80}px`)
        scopeSignalRef.current.style.opacity = String(0.28 + displayedProximity * 0.72)
      }
      if (progressCircleRef.current) progressCircleRef.current.style.opacity = displayedProximity === 1 ? '1' : '0'
      if (orbit.active) focusedId = null
      setFocus(focusedId)
      updateScopeAutoOpen(displayedProximity === 1 ? focusedId : null, dt)

      planetMeshes.forEach((planet, index) => {
        const planetData = DISCOVERIES[index]
        const focused = focusedId === planetData.id
        planet.userData.discoveryGlow = Math.max(0, planet.userData.discoveryGlow - dt * 1.2)
        const burstGlow = planet.userData.discoveryGlow
        const blend = 1 - Math.exp(-dt * 5)
        planet.scale.setScalar(THREE.MathUtils.lerp(planet.scale.x, focused ? 1.025 : 1, blend))
        const inspecting = orbitPlanet === planet
        const companions = planet.userData.companions
        const arrivalDistance = companions.outerRadius / Math.sin(angularRadius)
        const companionFade = orbit.active
          ? companionOpacity(camera.position.distanceTo(planet.position), arrivalDistance) * smoothstep(0, 12, orbit.distanceFromCamp)
          : 0
        companions.update(orbit.active ? dt : 0, companionFade, reducedMotion)
        const closeDetail = inspecting ? 1 - smoothstep(planetData.radius * 7, planetData.radius * 24, camera.position.distanceTo(planet.position)) : 0
        planet.material.userData.detail.value = THREE.MathUtils.damp(planet.material.userData.detail.value, closeDetail, 4, dt)
        const clouds = planet.userData.clouds
        if (clouds) {
          clouds.material.opacity = planet.material.userData.detail.value * 0.52
          clouds.visible = clouds.material.opacity > 0.001
          clouds.scale.copy(planet.scale)
          if (!reducedMotion) clouds.rotation.y += dt * (0.018 + index * 0.002)
        }
        const spotted = focused && scopeAmount
        const brightness = inspecting ? 1.45 : scopeAmount ? 1.7 : planet.userData.discovered ? 0.95 : 0.62
        planetTint.setRGB(brightness, brightness, brightness)
        planet.material.color.lerp(planetTint, blend)
        planet.material.emissiveIntensity = THREE.MathUtils.lerp(planet.material.emissiveIntensity, inspecting ? 0.72 : spotted ? 1.35 : scopeAmount ? 0.65 : planet.userData.discovered ? 0.28 : 0.12, blend)
        if (!reducedMotion) planet.rotation.y += dt * (0.012 + index * 0.002)
        const atmosphere = planet.userData.atmosphere
        atmosphere.scale.copy(planet.scale)
        atmosphere.material.uniforms.opacity.value = THREE.MathUtils.lerp(atmosphere.material.uniforms.opacity.value, (inspecting ? 0.32 : scopeAmount ? 0.3 : planet.userData.discovered ? 0.12 : 0.06) + Math.min(0.06, burstGlow * 0.02) * scopeAmount, blend)
        const decorRing = planetDecorRings[index]
        if (decorRing) {
          decorRing.scale.copy(planet.scale)
          decorRing.material.emissiveIntensity = THREE.MathUtils.damp(decorRing.material.emissiveIntensity, inspecting ? 0.22 : 0, 5, dt)
          decorRing.material.opacity = THREE.MathUtils.lerp(decorRing.material.opacity, inspecting ? 1 : scopeAmount ? 0.94 : planet.userData.discovered ? 0.6 : 0.4, blend)
        }
      })

      const connector = connectorRef.current
      if (connector) {
        const visible = orbit.phase === 'orbit' && orbitPlanet && panelBounds
        connector.style.opacity = visible ? '0.65' : '0'
        if (visible) {
          if (!orbitPlanet.userData.menuAnchor) {
            // Choose a visible location once, then store it in the globe's local
            // coordinates so it follows the same terrain as the planet rotates.
            const angle = Math.random() * Math.PI * 2
            const radius = 0.35 + Math.random() * 0.4
            projected.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sqrt(1 - radius ** 2))
              .applyQuaternion(camera.quaternion)
              .multiplyScalar(discovery.radius * orbitPlanet.scale.x)
              .add(orbitPlanet.position)
            // Keep the fixed landmark on the actual surface, including crater bowls.
            orbitPlanet.updateWorldMatrix(true, false)
            anchorNormal.copy(projected).sub(orbitPlanet.position).normalize()
            anchorView.copy(orbitPlanet.position).addScaledVector(anchorNormal, discovery.radius * 1.1)
            raycaster.set(anchorView, anchorNormal.negate())
            const surfaceHit = raycaster.intersectObject(orbitPlanet, false)[0]
            if (surfaceHit) projected.copy(surfaceHit.point)
            orbitPlanet.userData.menuAnchor = orbitPlanet.worldToLocal(projected.clone())
          }
          orbitPlanet.localToWorld(projected.copy(orbitPlanet.userData.menuAnchor))
          anchorNormal.copy(projected).sub(orbitPlanet.position).normalize()
          anchorView.copy(camera.position).sub(projected).normalize()
          // Fade behind the horizon instead of attaching to a different location.
          connector.style.opacity = String(0.65 * smoothstep(0, 0.16, anchorNormal.dot(anchorView)))
          projected.project(camera)
          const startX = mobile ? panelBounds.left + panelBounds.width / 2 : panelBounds.right
          const startY = mobile ? panelBounds.top : panelBounds.top + Math.min(160, panelBounds.height / 2)
          const endX = (projected.x + 1) * width / 2
          const endY = (1 - projected.y) * height / 2
          connector.querySelector('path').setAttribute('d', mobile
            ? `M${startX},${startY} L${startX},${endY + 16} L${endX},${endY}`
            : `M${startX},${startY} L${endX - 24},${startY} L${endX},${endY}`)
          const dot = connector.querySelector('circle')
          dot.setAttribute('cx', endX)
          dot.setAttribute('cy', endY)
        }
      }

      renderer.render(scene, camera)

      if (!hasStartedIntro) {
        hasStartedIntro = true
        setSceneReady(true)
        setPlanetPortraits(portraits)
      }
    }

    clampPlayer()
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      phonographLoadCancelled = true
      audioCancelled = true
      removeAudioUnlock()
      if (recordAudio) {
        recordAudio.pause()
        recordAudio.src = ''
      }
      if (recordObjectUrl) {
        URL.revokeObjectURL(recordObjectUrl)
      }
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      mount.removeEventListener('pointercancel', onBlur)
      mount.removeEventListener('pointerleave', onPointerLeave)
      mount.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointermove', onPointerHover)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', resize)
      motionPreference.removeEventListener('change', updateMotionPreference)

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      disposeScene(scene, renderer)
    }
  }, [closeDiscovery, revealDiscovery, setScopeActive])

  return (
    <main
      data-camera-mode={orbitPhase}
      className={`space-app ${scopeActiveState ? 'is-scoping' : ''} ${completedDiscovery ? 'scan-complete' : ''} ${
        ignited ? 'is-lit' : ''
      } ${sceneReady ? 'is-ready' : ''} ${sidebarOpen ? 'has-sidebar' : ''} ${activeDiscovery ? 'has-discovery' : ''}`}
      style={{
        '--scope-progress-color': focusedData?.color ?? '#f2f59f',
      }}
    >
      <div ref={mountRef} className="scene-mount" inert={!ignited} tabIndex={0} role="region" aria-label={orbitPhase === 'ground' ? 'Space exploration. Drag to look, use W A S D to move, and hold Space to scan. Use Field log to browse with a keyboard.' : 'Planetary orbit. Drag or use arrow keys to orbit. Press Escape to return to camp.'} />

      <div className="darkness" aria-hidden="true" onAnimationEnd={(event) => {
        if (event.animationName === 'darkness-ignition') setIgnited(true)
      }} />
      <div className="boot-title" aria-hidden="true" style={{ '--boot-characters': UPLINK_MESSAGE.length }}>
        <span className="boot-text">{UPLINK_MESSAGE}</span><span className="boot-cursor" />
      </div>
      <div className="vignette" aria-hidden="true" />

      <div ref={cursorRef} className={`reticle ${cursorPrompt ? 'is-showing-prompt' : ''}`} aria-hidden="true">
        <span className="reticle-prompt">{cursorPrompt}</span>
      </div>

      <nav className="hud-actions" inert={!ignited} aria-label="Exploration tools">
        <button className="mute-button audio-button" type="button" aria-pressed={audioMuted} aria-label={audioMuted ? 'Unmute music' : 'Mute music'} onClick={toggleAudioMuted}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3Z" />{audioMuted ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M16 8q5 4 0 8" />}</svg>
        </button>
        <button
          ref={directoryButtonRef}
          className="sections-button"
          type="button"
          aria-controls="field-log"
          aria-expanded={sidebarOpen}
          onClick={() => {
            setCompletedDiscovery(null)
            setSignPanelOpen(false)
            setScopeActive(false)
            setSidebarOpen((open) => !open)
          }}
        >
          Field log <span aria-hidden="true">↗</span>
        </button>

        <button
          className="scope-button"
          type="button"
          aria-pressed={scopeActiveState}
          disabled={orbitPhase === 'returning'}
          onClick={() => orbitTargetRef.current ? closeDiscovery() : setScopeActive(!scopeActiveState)}
        >
          <span className="scope-icon" aria-hidden="true" /> {orbitPhase === 'returning' ? 'Returning…' : activeDiscovery ? 'Return to camp' : 'Signalscope'}
        </button>
      </nav>

      <div className="scope-overlay" aria-hidden="true">
        <div className="scope-ring" />
        <svg ref={scopeSignalRef} className="scope-signal" viewBox="0 0 100 100">
          <g className="signal-half signal-half-left"><path d="M50 6a44 44 0 0 0 0 88" /></g>
          <g className="signal-half signal-half-right"><path d="M50 6a44 44 0 0 1 0 88" /></g>
          <circle ref={progressCircleRef} className="scope-progress" cx="50" cy="50" r="44" pathLength="1" transform="rotate(-90 50 50)" />
        </svg>
        <div className="scope-crosshair" />
      </div>

      {completedDiscovery && (
        <div key={completedDiscovery} className="discovery-confirmation" role="status" style={{ '--signal-color': DISCOVERY_BY_ID[completedDiscovery].color }} onAnimationEnd={() => setCompletedDiscovery(null)}>
          <span>Signal located</span><strong>{DISCOVERY_BY_ID[completedDiscovery].world}</strong>
        </div>
      )}

      {scopeActiveState && (
        <div className="signal-readout" style={{ '--signal-color': focusedData?.color ?? '#f7f2d6' }}>
          <span>SIGNAL</span>
          <strong>{focusedData?.world ?? 'NO LOCK'}</strong>
        </div>
      )}

      <aside id="explorer-guide" className={`sign-help-panel ${signPanelOpen ? 'is-open' : ''}`} aria-label="Explorer guide" aria-hidden={!signPanelOpen} inert={!signPanelOpen}>
        <button ref={helpCloseRef} className="sign-help-close" type="button" onClick={() => {
          setSignPanelOpen(false)
          directoryButtonRef.current?.focus({ preventScroll: true })
        }} aria-label="Close sign">
          ×
        </button>
        <span className="panel-eyebrow">FIELD MANUAL / 01</span>
        <h2>A little curiosity goes a long way.</h2>
        <p>Drag to look around. Use WASD or arrow keys to walk around the campfire.</p>
        <p>Hold Space or the right mouse button to scan. On touch screens, tap Signalscope, then drag to aim.</p>
        <p>Keep a planet in the center of the scope to travel into orbit. Drag or use arrow keys to explore, then close the analysis to return to camp. Field log takes you directly to any destination.</p>
        <p>Click the phonograph to change the music. Press Escape to close a panel.</p>
      </aside>

      <PortfolioSidebar
        open={sidebarOpen}
        activeId={activeDiscovery}
        discoveredIds={discoveredIds}
        portraits={planetPortraits}
        onSelect={revealDiscovery}
        onClose={() => {
          setSidebarOpen(false)
          directoryButtonRef.current?.focus({ preventScroll: true })
        }}
      >
        <div className="log-tools">
          <button className="help-button" type="button" aria-controls="explorer-guide" onClick={() => {
            setSidebarOpen(false)
            setSignPanelOpen(true)
          }}>Controls</button>
          <a href="/">Back to portfolio ↗</a>
        </div>
      </PortfolioSidebar>
      <svg ref={connectorRef} className="analysis-connector" aria-hidden="true" style={{ color: activeData?.color }}><path /><circle r="3" /></svg>
      <Panel panelRef={panelRef} discovery={activeData} closing={discoveryClosing} onClose={closeDiscovery} onExited={() => {
        setActiveDiscovery(null)
        setDiscoveryClosing(false)
      }} />
    </main>
  )
}
