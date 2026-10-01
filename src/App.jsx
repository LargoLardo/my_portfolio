import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './space.css'
import { makeMoonTexture, makePlanetTexture, makeParticleTexture, makeRingTexture, makeAtmosphereMaterial, makeFlameMaterial } from './spaceMaterials.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import phonographBinUrl from './assets/phonograph/scene.bin?url'
import phonographSceneUrl from './assets/phonograph/scene.gltf?url'
import phonographTextureUrl from './assets/phonograph/textures/Material_baseColor.png?url'

const PLAYER_RADIUS = 14.4
const CAMPFIRE_RADIUS = 1.05
const EYE_HEIGHT = 1.54
const UP = new THREE.Vector3(0, 1, 0)
const RECORD_TRACK_CONFIG_URL = '/record-player-tracks.json'
const CONTROLS_HINT_DURATION_MS = 30000
const SCOPE_IDLE_REMINDER_MS = 30000
const SIGN_READ_DISTANCE = 6.5
const PHONOGRAPH_INTERACT_DISTANCE = 6.5
const SCOPE_AUTO_OPEN_DURATION = 1
const MUSIC_FADE_SECONDS = 5

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
    radius: 4.6,
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
    radius: 4.2,
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
    world: 'Golden Seed',
    title: 'Experience',
    subtitle: 'Application Programmer, Ontario Government MPBSDP',
    color: '#f2f59f',
    hex: 0xf2f59f,
    visibilityBoost: 1.2,
    position: [4, 66, -78],
    radius: 2.2,
    palette: ['#19180d', '#55501d', '#b8a94a', '#fff6b0'],
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

const random = seededRandom(37)
const terrainCraters = Array.from({ length: 34 }, () => ({
  x: (random() - 0.5) * 92,
  z: (random() - 0.5) * 92,
  radius: 1.7 + random() * 6.5,
  depth: 0.08 + random() * 0.45,
}))

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function terrainHeight(x, z) {
  const ripples = Math.sin(x * 0.33 + z * 0.18) * 0.045 + Math.sin(z * 0.47) * 0.035
  const distance = Math.hypot(x, z)
  const ridge = smoothstep(14, 48, distance) * (1.6 + Math.sin(x * 0.12 + z * 0.08) * 1.2 + Math.sin(z * 0.18 - x * 0.07) * 0.7)
  let h = ripples + ridge

  for (const crater of terrainCraters) {
    const dx = x - crater.x
    const dz = z - crater.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < crater.radius) {
      const t = dist / crater.radius
      h -= Math.cos(t * Math.PI * 0.5) * crater.depth
      h += Math.exp(-Math.pow((t - 0.86) * 6, 2)) * crater.depth * 0.42
    }
  }

  const campFlatten = 1 - smoothstep(1.2, 6.2, Math.sqrt(x * x + z * z))
  return THREE.MathUtils.lerp(h, 0, campFlatten)
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

function Panel({ discovery, onClose }) {
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
    <aside className="discovery-panel" aria-label={discovery.title} style={{ '--accent': discovery.color }}>
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

function PortfolioSidebar({ open, activeId, onSelect, onClose }) {
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
                className={activeId === discovery.id ? 'is-active' : ''}
                type="button"
                key={discovery.id}
                onClick={() => onSelect(discovery.id)}
                style={{ '--accent': discovery.color }}
              >
                <span className="destination-orb" aria-hidden="true" />
                <span className="destination-name">{discovery.world}</span>
                <strong>{discovery.title}</strong>
                <small>{discovery.subtitle}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function App() {
  const mountRef = useRef(null)
  const directoryButtonRef = useRef(null)
  const helpButtonRef = useRef(null)
  const helpCloseRef = useRef(null)
  const cursorRef = useRef(null)
  const scopeActiveRef = useRef(false)
  const discoveredIdsRef = useRef(new Set())
  const discoveryEventsRef = useRef([])
  const cameraTargetRef = useRef(null)
  const [scopeActiveState, setScopeActiveState] = useState(false)
  const [scopeProximity, setScopeProximity] = useState(0)
  const scopeProximityRef = useRef(0)
  const [scopeHoldProgress, setScopeHoldProgress] = useState(0)
  const scopeHoldProgressRef = useRef(0)
  const [focusedTarget, setFocusedTarget] = useState(null)
  const [activeDiscovery, setActiveDiscovery] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ignited, setIgnited] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [scopeUseCount, setScopeUseCount] = useState(0)
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
      scopeHoldProgressRef.current = 0
      setScopeHoldProgress(0)
    }
    if (value) {
      setControlsVisible(false)
      setScopeUseCount((count) => count + 1)
    }
  }, [])

  const toggleAudioMuted = useCallback(() => {
    setAudioMuted((muted) => {
      const nextMuted = !muted
      audioMutedRef.current = nextMuted
      return nextMuted
    })
  }, [])

  const revealDiscovery = useCallback((id) => {
    if (!id) return

    const firstDiscovery = !discoveredIdsRef.current.has(id)
    if (firstDiscovery) {
      discoveredIdsRef.current.add(id)
      discoveryEventsRef.current.push({ id, firstDiscovery: true })
    }
    setActiveDiscovery(id)
  }, [])

  const selectDiscovery = useCallback(
    (id) => {
      cameraTargetRef.current = id
      setSidebarOpen(false)
      revealDiscovery(id)
    },
    [revealDiscovery],
  )

  useEffect(() => {
    if (signPanelOpen) helpCloseRef.current?.focus({ preventScroll: true })
  }, [signPanelOpen])

  useEffect(() => {
    if (!ignited || !controlsVisible) return undefined

    const hideTimer = window.setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_HINT_DURATION_MS)

    return () => window.clearTimeout(hideTimer)
  }, [controlsVisible, ignited])

  useEffect(() => {
    if (!ignited || controlsVisible || scopeActiveState) return undefined

    const reminderTimer = window.setTimeout(() => {
      setControlsVisible(true)
    }, SCOPE_IDLE_REMINDER_MS)

    return () => window.clearTimeout(reminderTimer)
  }, [controlsVisible, ignited, scopeActiveState, scopeUseCount])

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x030609)
    scene.fog = new THREE.FogExp2(0x070c12, 0.011)

    const camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.05, 220)
    camera.position.set(0, EYE_HEIGHT, 4.15)

    const ambient = new THREE.HemisphereLight(0x9eacc4, 0x302b23, 0.3)
    scene.add(ambient)
    const sunlight = new THREE.DirectionalLight(0xd5dded, 2.1)
    sunlight.position.set(-35, 45, 25)
    scene.add(sunlight)
    const particleTexture = makeParticleTexture()

    const moonMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(makeMoonTexture()),
      color: 0x918c80,
      roughness: 1,
      metalness: 0,
    })
    moonMaterial.map.wrapS = THREE.RepeatWrapping
    moonMaterial.map.wrapT = THREE.RepeatWrapping
    moonMaterial.map.repeat.set(7, 7)
    moonMaterial.map.colorSpace = THREE.SRGBColorSpace
    moonMaterial.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    moonMaterial.bumpMap = moonMaterial.map
    moonMaterial.bumpScale = 0.028

    const groundGeometry = new THREE.PlaneGeometry(120, 120, 176, 176)
    const groundPositions = groundGeometry.attributes.position
    for (let i = 0; i < groundPositions.count; i += 1) {
      const x = groundPositions.getX(i)
      const z = -groundPositions.getY(i)
      groundPositions.setZ(i, terrainHeight(x, z))
    }
    groundGeometry.computeVertexNormals()

    const ground = new THREE.Mesh(groundGeometry, moonMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const rocks = new THREE.Group()
    const rockGeometry = new THREE.IcosahedronGeometry(0.24, 1)
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x74756e, map: moonMaterial.map, roughness: 0.96 })
    const rockRand = seededRandom(244)

    for (let i = 0; i < 82; i += 1) {
      const angle = rockRand() * Math.PI * 2
      const radius = 4.2 + rockRand() * 44
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      if (Math.sqrt(x * x + z * z) < 7.2) continue

      const rock = new THREE.Mesh(rockGeometry, rockMaterial)
      const scale = 0.32 + rockRand() * 1.4
      rock.position.set(x, terrainHeight(x, z) + scale * 0.12, z)
      rock.rotation.set(rockRand() * Math.PI, rockRand() * Math.PI, rockRand() * Math.PI)
      rock.scale.set(scale * 1.25, scale * 0.7, scale)
      rock.castShadow = true
      rock.receiveShadow = true
      rocks.add(rock)
    }

    scene.add(rocks)

    const starGeometry = new THREE.BufferGeometry()
    const starCount = 1500
    const starRadiusConst = 70
    const starPositions = new Float32Array(starCount * 3)
    const starColors = new Float32Array(starCount * 3)
    const starRand = seededRandom(612)

    for (let i = 0; i < starCount; i += 1) {
      const theta = starRand() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.lerp(0.015, 0.985, starRand()))
      const radius = starRadiusConst + starRand() * starRadiusConst / 2
      const y = Math.cos(phi) * radius
      const x = Math.sin(phi) * Math.cos(theta) * radius
      const z = Math.sin(phi) * Math.sin(theta) * radius
      const brightness = 0.32 + starRand() * 0.5
      const cold = starRand() > 0.28

      starPositions[i * 3] = x
      starPositions[i * 3 + 1] = Math.abs(y) + 2
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
        size: 0.18,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    scene.add(stars)

    const anchorStarCount = 300
    const anchorStarRadiusConst = 100
    const anchorStarGeometry = new THREE.BufferGeometry()
    const anchorStarPositions = new Float32Array(anchorStarCount * 3)
    const anchorStarColors = new Float32Array(anchorStarCount * 3)
    const anchorRand = seededRandom(1717)

    for (let i = 0; i < anchorStarCount; i += 1) {
      const theta = anchorRand() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.lerp(0.08, 0.98, anchorRand()))
      const radius = anchorStarRadiusConst + anchorRand() * anchorStarRadiusConst / 2
      const y = Math.cos(phi) * radius
      const twinkle = 0.24 + anchorRand() * 0.28

      anchorStarPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      anchorStarPositions[i * 3 + 1] = Math.abs(y) + 4
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
        size: 0.38,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    scene.add(anchorStars)

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

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x85817a, map: moonMaterial.map, bumpMap: moonMaterial.map, bumpScale: 0.025, roughness: 1 })
    const stoneGeometry = new THREE.IcosahedronGeometry(0.18, 1)
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
      stone.position.set(Math.cos(angle) * 0.82, 0.11, Math.sin(angle) * 0.82)
      stone.scale.set(1.1, 0.72, 0.92)
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

    const signMetal = new THREE.MeshStandardMaterial({ color: 0x343d3b, roughness: 0.72, metalness: 0.45 })
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.15, 16), signMetal)
    signPost.position.set(0, 0.5, 0)
    signPost.castShadow = true
    signGroup.add(signPost)

    const signBoardGroup = new THREE.Group()
    signBoardGroup.position.set(0, 1, 0)
    signBoardGroup.rotation.z = -0.04
    signGroup.add(signBoardGroup)
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.72, 0.08), signMetal)
    housing.castShadow = true
    housing.receiveShadow = true
    signBoardGroup.add(housing)

    const label = document.createElement('canvas')
    label.width = 1024
    label.height = 384
    const labelContext = label.getContext('2d')
    labelContext.fillStyle = '#c9c7b4'
    labelContext.fillRect(0, 0, 1024, 384)
    labelContext.fillStyle = '#aa6338'
    labelContext.fillRect(0, 0, 20, 384)
    labelContext.fillStyle = '#363e39'
    labelContext.font = '24px monospace'
    labelContext.fillText('FIELD STATION 01 / EXPLORER GUIDE', 64, 65)
    labelContext.fillRect(64, 90, 890, 2)
    labelContext.font = 'bold 104px sans-serif'
    labelContext.fillText('LOOK UP.', 58, 217)
    labelContext.font = '28px monospace'
    labelContext.fillText('HOLD SPACE TO SCAN', 64, 302)
    labelContext.font = '18px monospace'
    labelContext.fillText('DRAG TO LOOK / WASD TO EXPLORE', 64, 345)
    const labelTexture = new THREE.CanvasTexture(label)
    labelTexture.colorSpace = THREE.SRGBColorSpace
    labelTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const signInteractionMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 0.63),
      new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.85, metalness: 0.1 }),
    )
    signInteractionMesh.geometry.computeBoundingBox()
    signInteractionMesh.position.z = 0.045
    signBoardGroup.add(signInteractionMesh)
    const boltGeometry = new THREE.SphereGeometry(0.022, 8, 6)
    for (const x of [-0.85, 0.85]) {
      for (const y of [-0.31, 0.31]) {
        const bolt = new THREE.Mesh(boltGeometry, signMetal)
        bolt.position.set(x, y, 0.045)
        signBoardGroup.add(bolt)
      }
    }

    const recordX = 1.7
    const recordZ = -1.6
    const recordPlayer = new THREE.Group()
    recordPlayer.position.set(recordX, terrainHeight(recordX, recordZ) + 0.02, recordZ)
    const toSpawn = new THREE.Vector3(-recordX, 0, 4.15 - recordZ).normalize()
    recordPlayer.rotation.y = Math.atan2(-toSpawn.x, -toSpawn.z) - Math.PI / 6
    recordPlayer.rotation.x = 0
    scene.add(recordPlayer)

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
          material.roughness = Math.max(material.roughness ?? 0.4, 0.56)
          material.metalness = material.metalness ?? 0
        })
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

    const fireLight = new THREE.PointLight(0xff8a2f, 0, 13.5, 1.7)
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
    const planetRings = []
    const planetDecorRings = []
    const skyGroup = new THREE.Group()
    scene.add(skyGroup)

    DISCOVERIES.forEach((discovery, index) => {
      const planetTexture = new THREE.CanvasTexture(makePlanetTexture(discovery.palette, index + 10, discovery.planetStyle))
      planetTexture.colorSpace = THREE.SRGBColorSpace
      planetTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(discovery.radius, 64, 48),
        new THREE.MeshStandardMaterial({
          map: planetTexture,
          bumpMap: planetTexture,
          bumpScale: discovery.planetStyle?.bands ? 0.015 : 0.065,
          roughness: 0.94,
          emissive: 0xffffff,
          emissiveMap: planetTexture,
          emissiveIntensity: 0.025,
          fog: false,
        }),
      )
      planet.position.set(...discovery.position)
      planet.userData.discoveryId = discovery.id
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

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(discovery.radius * 1.28, discovery.radius * 1.295, 96),
        new THREE.MeshBasicMaterial({ color: 0xf1c78b, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }),
      )
      ring.position.copy(planet.position)
      skyGroup.add(ring)
      planetRings.push(ring)

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
          map: makeRingTexture(index + 1), roughness: 1, transparent: true, opacity: 0.82,
          depthWrite: false, side: THREE.DoubleSide, fog: false,
        }))
        decorRing.position.copy(planet.position)
        decorRing.rotation.set(Math.PI / 2 + discovery.planetStyle.ringTilt, index * 0.48, index * 0.2)
        skyGroup.add(decorRing)
      }
      planetDecorRings.push(decorRing)
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

    const spawnDiscoveryBurst = (planet, index, firstDiscovery) => {
      if (!firstDiscovery) return

      const discovery = DISCOVERIES[index]
      const color = new THREE.Color(discovery.hex)
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

    const raycaster = new THREE.Raycaster()
    const center = new THREE.Vector2(0, 0)
    const pointerNdc = new THREE.Vector2()
    const cameraDirection = new THREE.Vector3()
    const targetDirection = new THREE.Vector3()
    const planetTint = new THREE.Color()
    const interactionCenter = new THREE.Vector3()
    const pressed = new Set()
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
    let cameraPanTarget = null
    let localFocus = null
    let scopeHoldTarget = null
    let scopeHoldElapsed = 0
    let scopeAutoOpenedTarget = null
    const scopeSparkTimes = new Map()
    let hasSetIgnited = false
    const startTime = performance.now()
    let lastTime = startTime
    let raf = 0

    const triggerScopeDiscovery = (id, elapsed) => {
      if (!id || !scopeActiveRef.current) return

      const lastSpark = scopeSparkTimes.get(id) ?? -Infinity
      if (elapsed - lastSpark < 1.2) return

      const firstDiscovery = !discoveredIdsRef.current.has(id)
      if (!firstDiscovery) return

      scopeSparkTimes.set(id, elapsed)
      discoveredIdsRef.current.add(id)
      discoveryEventsRef.current.push({ id, firstDiscovery: true })
    }

    const setFocus = (id, elapsed) => {
      if (localFocus === id) return
      triggerScopeDiscovery(id, elapsed)
      localFocus = id
      setFocusedTarget(id)
    }

    const setScopeHoldProgressValue = (value, force = false) => {
      const nextProgress = THREE.MathUtils.clamp(value, 0, 1)
      if (!force && Math.abs(nextProgress - scopeHoldProgressRef.current) < 0.012) return

      scopeHoldProgressRef.current = nextProgress
      setScopeHoldProgress(nextProgress)
    }

    const resetScopeHold = () => {
      scopeHoldTarget = null
      scopeHoldElapsed = 0
      scopeAutoOpenedTarget = null
      setScopeHoldProgressValue(0, scopeHoldProgressRef.current !== 0)
    }

    const updateScopeAutoOpen = (id, dt) => {
      if (!scopeActiveRef.current || !id) {
        resetScopeHold()
        return
      }

      if (scopeHoldTarget !== id) {
        scopeHoldTarget = id
        scopeHoldElapsed = 0
        scopeAutoOpenedTarget = null
        setScopeHoldProgressValue(0, scopeHoldProgressRef.current !== 0)
      }

      if (scopeAutoOpenedTarget === id) {
        setScopeHoldProgressValue(0, scopeHoldProgressRef.current !== 0)
        return
      }

      scopeHoldElapsed = Math.min(SCOPE_AUTO_OPEN_DURATION, scopeHoldElapsed + dt)
      const progress = scopeHoldElapsed / SCOPE_AUTO_OPEN_DURATION
      setScopeHoldProgressValue(progress, progress >= 1)

      if (progress >= 1) {
        scopeAutoOpenedTarget = id
        setScopeHoldProgressValue(0, true)
        revealDiscovery(id)
      }
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
      if (scopeActiveRef.current) return false

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
      if (scopeActiveRef.current) {
        if (localFocus) {
          scopeAutoOpenedTarget = localFocus
          setScopeHoldProgressValue(0, scopeHoldProgressRef.current !== 0)
          revealDiscovery(localFocus)
        }
        return
      }

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
      if (event.button === 2) {
        setScopeActive(true)
        return
      }

      if (event.button !== 0) return

      mount.focus({ preventScroll: true })
      drag.active = true
      drag.pointerId = event.pointerId
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved = 0
      cameraPanTarget = null
      mount.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event) => {
      if (!drag.active || drag.pointerId !== event.pointerId) return

      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved += Math.abs(dx) + Math.abs(dy)

      yaw -= dx * 0.003
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0028, -0.65, 1.18)
    }

    const onPointerLeave = () => {
      setSignPromptAvailable(false)
      setPhonographPromptAvailable(false)
    }

    const onPointerUp = (event) => {
      if (event.button === 2) {
        setScopeActive(false)
        return
      }

      if (!drag.active || drag.pointerId !== event.pointerId) return

      if (drag.moved < 7) {
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
      if (event.repeat) return
      if (event.code === 'Escape') {
        setActiveDiscovery(null)
        setSidebarOpen(false)
        setSignPanelOpen(false)
        setScopeActive(false)
        mount.focus({ preventScroll: true })
        return
      }
      if (event.target.closest('button, a, aside')) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      if (event.code === 'Space') {
        event.preventDefault()
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
      if (event.code === 'Space' && pressed.has('Space')) {
        event.preventDefault()
        setScopeActive(false)
      }
      pressed.delete(event.code)
    }

    const onBlur = () => {
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
      const firePulse = 0.85 + Math.sin(elapsed * 4.1) * 0.08 + Math.sin(elapsed * 7.7) * 0.035
      const scopeAmount = scopeActiveRef.current ? 1 : 0

      ambient.intensity = 0.24 + ignition * 0.08
      fireLight.intensity = ignition * (7.8 + firePulse * 2.2)
      lowGlow.intensity = ignition * (1.8 + firePulse)
      coalMaterial.emissiveIntensity = ignition * (0.5 + firePulse * 0.3)

      flameMeshes.forEach((flame, index) => {
        flame.material.uniforms.time.value = elapsed + index * 11
        flame.material.uniforms.opacity.value = ignition * (0.66 - index * 0.12)
        flame.rotation.y = Math.atan2(camera.position.x, camera.position.z)
        flame.scale.y = 0.94 + Math.sin(elapsed * 3.2 + index) * 0.06
      })

      if (recordDisc) {
        recordDisc.rotation.y += dt * 2.85
      }

      if (recordAudio) {
        const recordDistance = camera.position.distanceTo(recordPlayer.position)
        if (!recordAudio.paused) {
          recordFadeElapsed = Math.min(MUSIC_FADE_SECONDS, recordFadeElapsed + dt)
        }
        const fadeAmount = recordFadeElapsed / MUSIC_FADE_SECONDS
        const recordVolumeTarget =
          (audioMutedRef.current ? 0 : recordMaxVolume) *
          fadeAmount *
          THREE.MathUtils.clamp(1 - (recordDistance - 1) / 8, 0.1, 1)
        recordAudio.volume = THREE.MathUtils.lerp(recordAudio.volume, recordVolumeTarget, 1 - Math.exp(-dt * 3.4))
      }

      sparks.material.opacity = ignition * 0.88
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

      const requestedTargetId = cameraTargetRef.current
      if (requestedTargetId) {
        cameraTargetRef.current = null
        const planetIndex = DISCOVERIES.findIndex((discovery) => discovery.id === requestedTargetId)
        if (planetIndex >= 0) {
          targetDirection.copy(planetMeshes[planetIndex].position).sub(camera.position).normalize()
          cameraPanTarget = {
            yaw: Math.atan2(-targetDirection.x, -targetDirection.z),
            pitch: THREE.MathUtils.clamp(Math.asin(targetDirection.y), -0.65, 1.18),
          }
        }
      }

      if (cameraPanTarget) {
        const panEase = 1 - Math.exp(-dt * 2.8)
        const yawDelta = shortestAngleDelta(yaw, cameraPanTarget.yaw)
        yaw += yawDelta * panEase
        pitch = THREE.MathUtils.lerp(pitch, cameraPanTarget.pitch, panEase)

        if (Math.abs(yawDelta) < 0.004 && Math.abs(pitch - cameraPanTarget.pitch) < 0.004) {
          yaw = cameraPanTarget.yaw
          pitch = cameraPanTarget.pitch
          cameraPanTarget = null
        }
      }

      const lookEase = 1 - Math.exp(-dt * 22)
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

      camera.fov = THREE.MathUtils.lerp(camera.fov, scopeActiveRef.current ? 34 : 68, 1 - Math.exp(-dt * 9))
      camera.updateProjectionMatrix()

      stars.position.copy(camera.position)
      anchorStars.position.copy(camera.position)

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
          const lockAngle = Math.atan(DISCOVERIES[index].radius / distance) + 0.09
          const scanAngle = lockAngle * 3.8
          proximity = Math.max(proximity, THREE.MathUtils.clamp(1 - angle / scanAngle, 0, 1))

          if (!focusedId && angle < lockAngle && angle < bestAngle) {
            bestAngle = angle
            focusedId = planet.userData.discoveryId
          }
        })
      }
      if (Math.abs(proximity - scopeProximityRef.current) > 0.025) {
        scopeProximityRef.current = proximity
        setScopeProximity(proximity)
      }
      setFocus(focusedId, elapsed)
      updateScopeAutoOpen(focusedId, dt)

      planetMeshes.forEach((planet, index) => {
        const focused = focusedId === DISCOVERIES[index].id
        planet.userData.discoveryGlow = Math.max(0, planet.userData.discoveryGlow - dt * 1.2)
        const burstGlow = planet.userData.discoveryGlow
        const blend = 1 - Math.exp(-dt * 5)
        planet.scale.setScalar(THREE.MathUtils.lerp(planet.scale.x, focused ? 1.025 : 1, blend))
        const brightness = planet.userData.discovered ? 1 : 0.82
        planetTint.setRGB(brightness, brightness, brightness)
        planet.material.color.lerp(planetTint, blend)
        planet.rotation.y += dt * (0.012 + index * 0.002)
        const atmosphere = planet.userData.atmosphere
        atmosphere.scale.copy(planet.scale)
        atmosphere.material.uniforms.opacity.value = THREE.MathUtils.lerp(atmosphere.material.uniforms.opacity.value, 0.32 + Math.min(0.15, burstGlow * 0.06), blend)
        const ring = planetRings[index]
        ring.lookAt(camera.position)
        ring.material.opacity = THREE.MathUtils.lerp(ring.material.opacity, scopeAmount && focused ? 0.65 : 0, blend)
        const decorRing = planetDecorRings[index]
        if (decorRing) decorRing.scale.copy(planet.scale)
      })

      if (elapsed > 1.2 && !hasSetIgnited) {
        hasSetIgnited = true
        setIgnited(true)
      }

      renderer.render(scene, camera)
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

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      disposeScene(scene, renderer)
    }
  }, [revealDiscovery, setScopeActive])

  return (
    <main
      className={`space-app ${scopeActiveState ? 'is-scoping' : ''} ${scopeHoldProgress > 0 ? 'is-scope-locking' : ''} ${
        ignited ? 'is-lit' : ''
      } ${sidebarOpen ? 'has-sidebar' : ''}`}
      style={{
        '--scope-lock-scale': 1 - scopeProximity * 0.72,
        '--scope-lock-opacity': 0.24 + scopeProximity * 0.76,
        '--scope-open-progress': scopeHoldProgress,
        '--scope-progress-color': focusedData?.color ?? '#f2f59f',
      }}
    >
      <div ref={mountRef} className="scene-mount" tabIndex={0} role="region" aria-label="Space exploration. Drag to look, use W A S D to move, and hold Space to scan. Use Field log to browse with a keyboard." />

      <div className="darkness" aria-hidden="true" />
      <div className="boot-title" aria-hidden="true">
        ESTABLISHING UPLINK
      </div>
      <div className="vignette" aria-hidden="true" />

      <div ref={cursorRef} className={`reticle ${cursorPrompt ? 'is-showing-prompt' : ''}`} aria-hidden="true">
        <span className="reticle-prompt">{cursorPrompt}</span>
      </div>

      <header className="hud-brand">
        <a href="/" aria-label="Return to Logan Zhao's main portfolio">
          <span className="expedition-mark" aria-hidden="true">LZ</span>
          <span><small>AN EXPLORER'S PORTFOLIO</small><strong>Logan Zhao</strong></span>
          <span className="return-arrow" aria-hidden="true">↗</span>
        </a>
      </header>

      <nav className="hud-actions" aria-label="Exploration tools">
      <button
        ref={directoryButtonRef}
        className="sections-button"
        type="button"
        aria-controls="field-log"
        aria-expanded={sidebarOpen}
        onClick={() => {
          setActiveDiscovery(null)
          setSignPanelOpen(false)
          setScopeActive(false)
          setSidebarOpen((open) => !open)
        }}
      >
        <span aria-hidden="true">☷</span> Field log <small>08</small>
      </button>

      <button
        className="scope-button"
        type="button"
        aria-pressed={scopeActiveState}
        onClick={() => setScopeActive(!scopeActiveState)}
      >
        <span className="scope-icon" aria-hidden="true" /> Signalscope
      </button>
      </nav>

      <button ref={helpButtonRef} className="help-button" type="button" aria-label="Show exploration controls" aria-expanded={signPanelOpen} aria-controls="explorer-guide" onClick={() => setSignPanelOpen((open) => !open)}>?</button>

      <button
        className="audio-button"
        type="button"
        aria-pressed={audioMuted}
        aria-label={audioMuted ? 'Unmute music' : 'Mute music'}
        onClick={toggleAudioMuted}
      >
        <span className="sound-icon" aria-hidden="true">
          <span className="sound-icon-speaker" />
          <span className="sound-icon-wave sound-icon-wave-one" />
          <span className="sound-icon-wave sound-icon-wave-two" />
          <span className="sound-icon-slash" />
        </span>
      </button>

      <div className="scope-overlay" aria-hidden="true">
        <div className="scope-ring" />
        <div className="scope-lock-circle" />
        <div className="scope-completion-band" />
        <div className="scope-crosshair" />
      </div>

      {scopeActiveState && (
        <div className="signal-readout" style={{ '--signal-color': focusedData?.color ?? '#f7f2d6' }}>
          <span>SIGNAL</span>
          <strong>{focusedData?.world ?? 'NO LOCK'}</strong>
        </div>
      )}

      <div className={`controls-hud ${controlsVisible ? 'is-visible' : ''}`} aria-label="Controls">
        <p>FIELD STATION 01 <span> / </span> LOOK UP. STAY CURIOUS.</p>
        <div><span><kbd>DRAG</kbd> look around</span><span className="desktop-control"><kbd>W A S D</kbd> explore</span><span className="desktop-control"><kbd>SPACE</kbd> hold to scan</span><span className="touch-control">Tap Signalscope to scan a planet</span></div>
      </div>

      <aside id="explorer-guide" className={`sign-help-panel ${signPanelOpen ? 'is-open' : ''}`} aria-label="Explorer guide" aria-hidden={!signPanelOpen} inert={!signPanelOpen}>
        <button ref={helpCloseRef} className="sign-help-close" type="button" onClick={() => {
          setSignPanelOpen(false)
          helpButtonRef.current?.focus({ preventScroll: true })
        }} aria-label="Close sign">
          ×
        </button>
        <span className="panel-eyebrow">FIELD MANUAL / 01</span>
        <h2>A little curiosity goes a long way.</h2>
        <p>Drag to look around. Use WASD or arrow keys to walk around the campfire.</p>
        <p>Hold Space or the right mouse button to scan. On touch screens, tap Signalscope, then drag to aim.</p>
        <p>Keep a planet in the center of the scope to open its story. Field log takes you directly to any destination.</p>
        <p>Click the phonograph to change the music. Press Escape to close a panel.</p>
      </aside>

      <PortfolioSidebar
        open={sidebarOpen}
        activeId={activeDiscovery}
        onSelect={selectDiscovery}
        onClose={() => {
          setSidebarOpen(false)
          directoryButtonRef.current?.focus({ preventScroll: true })
        }}
      />
      <Panel discovery={activeData} onClose={() => setActiveDiscovery(null)} />
    </main>
  )
}
