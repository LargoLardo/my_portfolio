import { useEffect, useId, useRef, useState } from 'react'

function logoColor(image) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, 32, 32)
  const pixels = context.getImageData(0, 0, 32, 32).data
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, alpha] = pixels.slice(i, i + 4)
    const saturation = Math.max(r, g, b) - Math.min(r, g, b)
    if (alpha < 128 || saturation < 32) continue
    const amount = alpha * saturation
    red += r * amount
    green += g * amount
    blue += b * amount
    weight += amount
  }
  return weight ? `rgb(${Math.round(red / weight)} ${Math.round(green / weight)} ${Math.round(blue / weight)})` : null
}

function TerminalDescription({ text }) {
  const [length, setLength] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const start = performance.now()
    let frame
    const type = (now) => {
      const next = Math.min(text.length, Math.floor((now - start) / 12))
      setLength(next)
      if (next < text.length) frame = requestAnimationFrame(type)
    }
    frame = requestAnimationFrame(type)
    return () => cancelAnimationFrame(frame)
  }, [text])

  return (
    <p className="experience-description">
      <span className="experience-description-accessible">{text}</span>
      <span aria-hidden="true">{text.slice(0, length)}{length < text.length && <span className="terminal-cursor">█</span>}</span>
    </p>
  )
}

function ExperienceEntry({ item, onBurst }) {
  const [expanded, setExpanded] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const [color, setColor] = useState('#a7b3a8')
  const descriptionId = useId()
  return (
    <article className="entry job-entry" onPointerEnter={(event) => onBurst(color, event)} style={{ '--experience-color': color }}>
      <button
        type="button"
        className="experience-toggle"
        aria-expanded={expanded}
        aria-controls={descriptionId}
        onClick={() => {
          if (expanded) {
            setExpanded(false)
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) setShowDescription(false)
          } else {
            setShowDescription(true)
            setExpanded(true)
          }
        }}
      >
        <img className="company-logo" src={item.logo} alt="" onLoad={(event) => setColor(logoColor(event.currentTarget) || color)} />
        <span className="entry-heading">
          <span className="job-title"><span className="job-role">{item.title}</span><span>{item.company}</span></span>
          <time>{item.date}</time>
        </span>
      </button>
      <div
        className={`experience-reveal${expanded ? ' is-expanded' : ''}`}
        id={descriptionId}
        aria-hidden={!expanded}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows' && !expanded) setShowDescription(false)
        }}
      >
        <div>{showDescription && <TerminalDescription text={item.detail} />}</div>
      </div>
    </article>
  )
}

export default function ExperienceList({ items }) {
  const canvasRef = useRef(null)
  const burstRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const list = canvas.parentElement
    const context = canvas.getContext('2d')
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const cell = 26
    const radius = 180
    let width = 0
    let height = 0
    let frame = 0
    let bursts = []

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    const draw = (now) => {
      context.clearRect(0, 0, width, height)
      bursts = reducedMotion.matches ? [] : bursts.filter(({ started }) => now - started < 700)
      if (!bursts.length) {
        frame = 0
        return
      }

      const canvasRect = canvas.getBoundingClientRect()
      const listRect = list.getBoundingClientRect()
      const scale = width / canvasRect.width
      const gridX = (listRect.left - canvasRect.left) * scale
      const gridY = (listRect.top - canvasRect.top) * scale
      const minX = Math.max(0, Math.min(...bursts.map(({ x }) => x)) - radius)
      const maxX = Math.min(width, Math.max(...bursts.map(({ x }) => x)) + radius)
      const minY = Math.max(0, Math.min(...bursts.map(({ y }) => y)) - radius)
      const maxY = Math.min(height, Math.max(...bursts.map(({ y }) => y)) + radius)

      for (let row = Math.ceil((minY - gridY) / cell); gridY + row * cell < maxY; row += 1) {
        for (let column = Math.ceil((minX - gridX) / cell); gridX + column * cell < maxX; column += 1) {
          const squareX = gridX + column * cell
          const squareY = gridY + row * cell
          let brightness = 0
          let color

          for (const burst of bursts) {
            const distance = Math.hypot(squareX + cell / 2 - burst.x, squareY + cell / 2 - burst.y)
            if (distance >= radius) continue
            const age = now - burst.started - distance * 1.6
            if (age < 0 || age >= 400) continue
            const seed = Math.sin(column * 127.1 + row * 311.7 + burst.seed) * 43758.5453
            const noise = seed - Math.floor(seed)
            const falloff = 1 - distance / radius
            if (noise > 0.25 + falloff * 0.75) continue
            const alpha = (1 - age / 400) ** 1.5 * falloff ** 2.2 * (0.35 + noise * 0.65)
            if (alpha > brightness) {
              brightness = alpha
              color = burst.color
            }
          }

          if (brightness) {
            context.globalAlpha = brightness
            context.fillStyle = color
            context.fillRect(squareX, squareY, 18, 18)
          }
        }
      }
      frame = requestAnimationFrame(draw)
    }

    burstRef.current = (color, event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return
      const rect = canvas.getBoundingClientRect()
      const logo = event.currentTarget.querySelector('.company-logo').getBoundingClientRect()
      const scale = width / rect.width
      bursts.push({
        x: (logo.left + logo.width / 2 - rect.left) * scale,
        y: (logo.top + logo.height / 2 - rect.top) * scale,
        color,
        seed: Math.random() * 10000,
        started: performance.now(),
      })
      if (!frame) frame = requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      burstRef.current = null
    }
  }, [])

  return (
    <div className="entries experience-list">
      <canvas className="experience-pixels" ref={canvasRef} aria-hidden="true" />
      {items.map((item) => <ExperienceEntry key={item.company} item={item} onBurst={(color, event) => burstRef.current?.(color, event)} />)}
    </div>
  )
}
