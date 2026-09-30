import { useEffect, useRef, useState } from 'react'
import { damp, nextGeneration } from './life.js'
import ExperienceList from './ExperienceEntry.jsx'

const projects = [
  {
    title: 'Reminiscence',
    detail: 'iPhone video to VR-ready Gaussian splats in under two minutes.',
    stack: 'PYTORCH / SWIFT / UNITY / FASTAPI',
    href: 'https://github.com/LargoLardo/reminiscence',
    image: '/reminiscence.png',
    highlights: [
      'Built a nine-stage pipeline that turns iPhone video into VR-ready Gaussian splats, connecting SwiftUI, FastAPI, COLMAP, FastGS, and Unity.',
      'Brought reconstruction time under two minutes by streamlining frame extraction, sparse reconstruction, training, and Unity prefab generation.',
    ],
  },
  {
    title: "Hold’em AI",
    detail: 'An MCCFR poker solver that learned to beat heuristic agents.',
    stack: 'NUMPY / REACT / FLASK',
    href: 'https://github.com/LargoLardo/lard_plays_poker',
    image: '/poker.png',
    highlights: [
      'Built a heads-up no-limit Texas Hold’em solver using external-sampling MCCFR with regret matching, training a policy that won more than 10 big blinds per hour against basic heuristics.',
      'Used Monte Carlo equity and potential calculations to group similar hands, reaching roughly 80% similarity to known solvers.',
      'Made training more than 10 times faster on an eight-core CPU with a multiprocessing chunk-and-merge pipeline.',
    ],
  },
  {
    title: 'Chess Engine',
    detail: 'A policy/value network paired with MCTS, trained through self-play.',
    stack: 'PYTORCH / MCTS / VITE',
    href: 'https://github.com/LargoLardo/lard_plays_chess',
    image: '/chess.png',
    highlights: [
      'Built a hybrid reinforcement- and supervised-learning chess engine from scratch, pairing a policy/value network with MCTS/PUCT search to reach expert-level 2000 Elo strength through self-play.',
      'Improved runtime search speed by more than eight times using lazy inference batching, transposition tables, and cached board encodings for deeper searches within a fixed time budget.',
    ],
  },
  {
    title: 'Advolve',
    detail: 'Evolving ad creatives with generative AI and predicted brain responses.',
    stack: 'NEXT.JS / PYTORCH / CLOUDFLARE / BASETEN',
    href: 'https://github.com/LargoLardo/advolve',
    image: '/advolve.jpg',
    highlights: [
      'Built with a team at Hack the North 2026, Advolve turns a product image and brief into generations of ad creatives through selection, crossover, and mutation.',
      'Uses TRIBE v2 to predict cortical responses and score candidates, guiding each round of creative evolution.',
      'An interactive family tree tracks each ad’s ancestry, traits, and scores, backed by durable Cloudflare workflows and GPU inference on Baseten.',
    ],
  },
]

const experience = [
  {
    title: 'Software Engineer',
    date: 'September 2026 — December 2026',
    detail: 'Incoming F26.',
    logo: '/shopify-cropped.png',
    company: 'Shopify',
    color: '#95bf47',
  },
  {
    title: 'Application Programmer',
    date: 'January 2026 — May 2026',
    detail: 'Automated QA for 1,000+ Cognos BI reports per hour and built data workflows across Redshift, AWS Lambda, and Python.',
    logo: '/govicon-cropped.png',
    company: 'Ontario Government',
    color: '#8fc43e',
  }
]

function LifeCanvas({ running, boardRef }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const runningRef = useRef(running)

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let frame
    let lastStep = 0

    const resize = () => {
      const cellSize = innerWidth < 700 ? 17 : 22
      const columns = Math.ceil(innerWidth / cellSize)
      const rows = Math.ceil(innerHeight / cellSize)
      const cells = new Uint8Array(columns * rows)
      for (let i = 0; i < cells.length; i += 1) cells[i] = Math.random() < 0.14 ? 1 : 0
      boardRef.current = { cells, columns, rows, cellSize }
      canvas.width = innerWidth * devicePixelRatio
      canvas.height = innerHeight * devicePixelRatio
      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      const gradient = context.createRadialGradient(
        innerWidth / 2, innerHeight / 2, 0,
        innerWidth / 2, innerHeight / 2, Math.hypot(innerWidth, innerHeight) / 2,
      )
      gradient.addColorStop(0.34, '#3f5f50')
      gradient.addColorStop(1, '#7bd88f')
      context.fillStyle = gradient
    }

    const draw = (time = 0) => {
      const state = boardRef.current
      if (!state) return
      if (runningRef.current && time - lastStep > 130) {
        state.cells = nextGeneration(state.cells, state.columns, state.rows)
        lastStep = time
      }
      context.clearRect(0, 0, innerWidth, innerHeight)
      for (let i = 0; i < state.cells.length; i += 1) {
        if (!state.cells[i]) continue
        const x = (i % state.columns) * state.cellSize
        const y = Math.floor(i / state.columns) * state.cellSize
        context.fillRect(x + 1, y + 1, state.cellSize - 2, state.cellSize - 2)
      }
      frame = requestAnimationFrame(draw)
    }

    resize()
    addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
    }
  }, [boardRef])

  const paint = (event) => {
    if (!drawingRef.current && event.type !== 'pointerdown') return
    const state = boardRef.current
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / state.cellSize)
    const y = Math.floor((event.clientY - rect.top) / state.cellSize)
    if (x >= 0 && x < state.columns && y >= 0 && y < state.rows) state.cells[y * state.columns + x] = 1
  }

  return (
    <canvas
      ref={canvasRef}
      className="life-canvas"
      aria-label="Interactive Conway's Game of Life. Click or drag to add living cells."
      onPointerDown={(event) => {
        drawingRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        paint(event)
      }}
      onPointerMove={paint}
      onPointerUp={() => { drawingRef.current = false }}
      onPointerCancel={() => { drawingRef.current = false }}
    />
  )
}

export default function MinimalPortfolio() {
  const [running, setRunning] = useState(true)
  const [activeProject, setActiveProject] = useState(null)
  const boardRef = useRef(null)
  const pageRef = useRef(null)
  const cardRef = useRef(null)
  const projectDialogRef = useRef(null)

  useEffect(() => {
    if (activeProject) {
      projectDialogRef.current.showModal()
      projectDialogRef.current.scrollTop = 0
    }
  }, [activeProject])

  useEffect(() => {
    const page = pageRef.current
    const card = cardRef.current
    const layers = card.querySelectorAll('[data-scroll-layer]')
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let target = page.scrollTop
    let positions = Array.from(layers, () => target)
    let frame

    const animate = () => {
      let moving = false
      positions = positions.map((position, index) => {
        const next = damp(position, target, 0.28 - index * 0.035)
        const inertia = Math.max(-140, Math.min(140, target - next))
        const parallax = Math.min(180, target * index * 0.03)
        layers[index].style.setProperty('--drag-y', `${parallax + inertia}px`)
        if (Math.abs(target - next) > 0.1) moving = true
        return next
      })
      frame = moving ? requestAnimationFrame(animate) : 0
    }

    const addMomentum = () => {
      target = page.scrollTop
      if (!reducedMotion && !frame) frame = requestAnimationFrame(animate)
    }

    if (!reducedMotion) frame = requestAnimationFrame(animate)
    page.addEventListener('scroll', addMomentum, { passive: true })
    return () => {
      page.removeEventListener('scroll', addMomentum)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <main className="minimal-portfolio" ref={pageRef}>
      <LifeCanvas running={running} boardRef={boardRef} />
      <div className="life-shade" />

      <section className="portfolio-card" ref={cardRef}>
        <header data-scroll-layer>
          <div className="title-row">
            <h1>Logan Zhao</h1>
            <a className="saturn-link" href="/current" aria-label="Enter Logan's immersive space portfolio">
              <span className="saturn-ring" />
              <span className="saturn-planet" />
              <span className="saturn-label">enter orbit</span>
            </a>
          </div>
          <p className="intro">One of the builders of all time for sure.</p>
          <nav className="top-links" aria-label="Contact links">
            <a href="mailto:logan.zhao@uwaterloo.ca">EMAIL</a>
            <a href="https://github.com/LargoLardo" target="_blank" rel="noreferrer">GITHUB</a>
            <a href="https://www.linkedin.com/in/logan-zhao-328653232" target="_blank" rel="noreferrer">LINKEDIN</a>
          </nav>
        </header>

        <div className="section-row" data-scroll-layer>
          <h2>ABOUT</h2>
          <p className="about-copy">
            Systems Design Engineering student <a className="waterloo-inline" href="https://uwaterloo.ca/future-students/programs/systems-design-engineering">@
              <img className="waterloo-crest" src="/uwaterloo-crest-cropped.png" alt="" />
              <span className="waterloo-wordmark">uwaterloo</span>
            </a>, working across machine learning, creative tools, and interactive systems.
          </p>
        </div>

        <div className="section-row" data-scroll-layer>
          <h2>EXPERIENCE</h2>
          <ExperienceList items={experience} />
        </div>

        <div className="section-row" data-scroll-layer>
          <h2>PROJECTS</h2>
          <div className="entries project-grid">
            {projects.map((project) => (
              <button
                key={project.title}
                type="button"
                className="entry project"
                aria-haspopup="dialog"
                aria-controls="project-dialog"
                onClick={() => setActiveProject(project)}
              >
                <img className="project-image" src={project.image} alt="" loading="lazy" decoding="async" />
                <span className="project-caption">
                  <span className="project-title">{project.title}<span aria-hidden="true">+</span></span>
                  <span className="project-detail">{project.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="section-row" data-scroll-layer>
          <h2>EDUCATION</h2>
          <div className="entries">
            <article className="entry">
              <div className="entry-heading"><h3>Systems Design Engineering, Waterloo</h3></div>
              <p>B.A.Sc. candidate · 3.9 GPA · President’s Scholarship of Distinction.</p>
            </article>
          </div>
        </div>
      </section>

      <dialog
        id="project-dialog"
        ref={projectDialogRef}
        className="project-dialog"
        aria-labelledby="project-dialog-title"
        aria-describedby="project-dialog-summary"
        onClose={() => setActiveProject(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        {activeProject && (
          <div className="project-dialog-content">
            <header className="project-dialog-header">
              <div>
                <h2 id="project-dialog-title">{activeProject.title}</h2>
                <p id="project-dialog-summary">{activeProject.detail}</p>
              </div>
              <button type="button" className="project-dialog-close" aria-label="Close project details" onClick={() => projectDialogRef.current.close()}>×</button>
            </header>
            <div className="project-dialog-body">
              <img className="project-dialog-image" src={activeProject.image} alt={`${activeProject.title} preview`} />
              <h3>What I built</h3>
              {activeProject.highlights.map((highlight) => <p key={highlight}>{highlight}</p>)}
              <h3>Built with</h3>
              <p className="project-stack">{activeProject.stack}</p>
              <a className="project-source" href={activeProject.href} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        )}
      </dialog>

      <div className="life-controls" aria-label="Game of Life controls">
        <button
          type="button"
          aria-label={running ? 'Pause Game of Life' : 'Play Game of Life'}
          title={running ? 'Pause Game of Life' : 'Play Game of Life'}
          onClick={() => setRunning((value) => !value)}
        >
          <span className={`life-toggle-icon ${running ? 'is-pause' : 'is-play'}`} aria-hidden="true" />
        </button>
      </div>
    </main>
  )
}
