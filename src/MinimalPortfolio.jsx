import { useEffect, useRef, useState } from 'react'
import { damp, nextGeneration } from './life.js'

const projects = [
  {
    title: 'Reminiscence',
    detail: 'iPhone video to VR-ready Gaussian splats in under two minutes.',
    stack: 'PYTORCH / SWIFT / UNITY / FASTAPI',
    href: 'https://github.com/LargoLardo/reminiscence',
    image: '/reminiscence.png',
  },
  {
    title: "Hold’em AI",
    detail: 'An MCCFR poker solver that learned to beat heuristic agents.',
    stack: 'NUMPY / REACT / FLASK',
    href: 'https://github.com/LargoLardo/lard_plays_poker',
    image: '/poker.png',
  },
  {
    title: 'Chess Engine',
    detail: 'A policy/value network paired with MCTS, trained through self-play.',
    stack: 'PYTORCH / MCTS / VITE',
    href: 'https://github.com/LargoLardo/lard_plays_chess',
    image: '/chess.png',
  },
]

const experience = [
  {
    title: 'Software Engineer',
    date: 'September 2026 — December 2026',
    detail: 'Incoming F26.',
    logo: '/shopify-cropped.png',
    company: 'Shopify',
  },
  {
    title: 'Application Programmer',
    date: 'January 2026 — May 2026',
    detail: 'Automated QA for 1,000+ Cognos BI reports per hour and built data workflows across Redshift, AWS Lambda, and Python.',
    logo: '/govicon-cropped.png',
    company: 'Ontario Government',
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
  const boardRef = useRef(null)
  const pageRef = useRef(null)
  const cardRef = useRef(null)

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
          <div className="entries">
            {experience.map((item) => (
              <article className="entry job-entry" key={item.title}>
                <img className="company-logo" src={item.logo} alt={`${item.company} logo`} />
                <div>
                  <div className="entry-heading">
                    <div className="job-title"><h3>{item.title}</h3><span>{item.company}</span></div>
                    <time>{item.date}</time>
                  </div>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="section-row" data-scroll-layer>
          <h2>PROJECTS</h2>
          <div className="entries">
            {projects.map((project, index) => (
              <a key={project.title} href={project.href} target="_blank" rel="noreferrer" className="entry project">
                {project.image
                  ? <img className="project-image" src={project.image} alt={`${project.title} preview`} loading="lazy" decoding="async" />
                  : <div className="project-placeholder" aria-label={`${project.title} image placeholder`}>PROJECT IMAGE / 0{index + 1}</div>}
                <div className="entry-heading"><h3>{project.title}</h3><span aria-hidden="true">↗</span></div>
                <p>{project.detail}</p>
                <small>{project.stack}</small>
              </a>
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
