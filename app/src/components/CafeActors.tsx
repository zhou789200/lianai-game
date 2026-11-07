import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export type CafeActorKind = 'barista' | 'cat'
export type CafeActorMode = 'idle' | 'work' | 'visit'
export type CafeActorPose = 'front' | 'side' | 'back'

export interface CafeActorCue {
  id: number
  actor: CafeActorKind
  targetId: string
  x: number
  y: number
  mode: Exclude<CafeActorMode, 'idle'>
  duration?: number
}

interface CafeActorsProps {
  cue: CafeActorCue | null
  onDrop: (actor: CafeActorKind, x: number, y: number) => void
}

interface ActorPosition {
  x: number
  y: number
}

interface DragState {
  actor: CafeActorKind
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  moved: boolean
}

const HOME: Record<CafeActorKind, ActorPosition> = {
  barista: { x: 46, y: 72 },
  cat: { x: 18, y: 84 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function CafeActors({ cue, onDrop }: CafeActorsProps) {
  const worldRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const reactionTimer = useRef<number | null>(null)
  const actionToken = useRef(0)
  const [positions, setPositions] = useState<Record<CafeActorKind, ActorPosition>>(HOME)
  const [poses, setPoses] = useState<Record<CafeActorKind, CafeActorPose>>({
    barista: 'front',
    cat: 'front',
  })
  const [modes, setModes] = useState<Record<CafeActorKind, CafeActorMode>>({
    barista: 'idle',
    cat: 'idle',
  })
  const [facing, setFacing] = useState<Record<CafeActorKind, 1 | -1>>({
    barista: 1,
    cat: 1,
  })
  const [reaction, setReaction] = useState<CafeActorKind | null>(null)
  const [dragging, setDragging] = useState<CafeActorKind | null>(null)

  useEffect(
    () => () => {
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!cue) return

    const token = actionToken.current + 1
    actionToken.current = token
    const startX = positions[cue.actor].x
    setFacing((current) => ({ ...current, [cue.actor]: cue.x >= startX ? 1 : -1 }))
    setPoses((current) => ({ ...current, [cue.actor]: 'side' }))
    setModes((current) => ({ ...current, [cue.actor]: cue.mode }))
    setPositions((current) => ({ ...current, [cue.actor]: { x: cue.x, y: cue.y } }))

    const settle = window.setTimeout(() => {
      if (actionToken.current !== token) return
      setPoses((current) => ({
        ...current,
        [cue.actor]: cue.mode === 'work' ? 'back' : 'front',
      }))
    }, 760)
    const finish = window.setTimeout(
      () => {
        if (actionToken.current !== token) return
        setModes((current) => ({ ...current, [cue.actor]: 'idle' }))
        setPoses((current) => ({ ...current, [cue.actor]: 'front' }))
      },
      cue.duration ?? 1800,
    )

    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(finish)
    }
    // A cue is intentionally consumed once by id; live positions must not restart its timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id])

  const updateFromPointer = (actor: CafeActorKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const rect = worldRef.current?.getBoundingClientRect()
    if (!drag || drag.actor !== actor || !rect) return

    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 24, 88)
    const moved =
      drag.moved ||
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5
    dragRef.current = { ...drag, x, y, moved }
    setPositions((current) => ({ ...current, [actor]: { x, y } }))
  }

  const startDrag = (
    actor: CafeActorKind,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    actionToken.current += 1
    const position = positions[actor]
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      actor,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: position.x,
      y: position.y,
      moved: false,
    }
    setDragging(actor)
    setPoses((current) => ({ ...current, [actor]: 'front' }))
    setModes((current) => ({ ...current, [actor]: 'idle' }))
  }

  const endDrag = (actor: CafeActorKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.actor !== actor) return

    if (!drag.moved) {
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
      setReaction(actor)
      reactionTimer.current = window.setTimeout(() => setReaction(null), 620)
    } else {
      setPositions((current) => ({ ...current, [actor]: { x: drag.x, y: drag.y } }))
      onDrop(actor, drag.x, drag.y)
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
      setReaction(actor)
      reactionTimer.current = window.setTimeout(() => setReaction(null), 620)
    }

    dragRef.current = null
    setDragging(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const renderActor = (actor: CafeActorKind) => {
    const position = positions[actor]
    const mode = modes[actor]

    return (
      <button
        key={actor}
        type="button"
        className={[
          'cafe-actor',
          `cafe-actor--${actor}`,
          mode !== 'idle' ? `is-${mode}` : '',
          reaction === actor ? 'is-reacting' : '',
          dragging === actor ? 'is-dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-actor={actor}
        data-mode={mode}
        aria-label={actor === 'barista' ? '移动店长' : '移动小猫布丁'}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        onPointerDown={(event) => startDrag(actor, event)}
        onPointerMove={(event) => updateFromPointer(actor, event)}
        onPointerUp={(event) => endDrag(actor, event)}
        onPointerCancel={(event) => endDrag(actor, event)}
      >
        <span className="cafe-actor__shadow" aria-hidden="true" />
        <img
          className="cafe-actor__sprite"
          src={`art/cafe-${actor}-${poses[actor]}.png`}
          alt=""
          draggable={false}
          style={{ '--actor-facing': facing[actor] } as CSSProperties}
        />
      </button>
    )
  }

  return (
    <div ref={worldRef} className="cafe-actors" aria-label="可拖动的店长与小猫">
      {renderActor('barista')}
      {renderActor('cat')}
    </div>
  )
}
