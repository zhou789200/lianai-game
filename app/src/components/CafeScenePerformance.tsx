import type { CSSProperties } from 'react'
import { GameIcon } from './GameIcon'
import '../styles/cafe-show.css'

export type CafeSceneCueKind =
  | 'arrival'
  | 'order'
  | 'serving'
  | 'cleaning'
  | 'pet'
  | 'romance'

export interface CafeSceneCue {
  id: number
  kind: CafeSceneCueKind
  icon?: string
  label?: string
}

export function CafeScenePerformance({ cue }: { cue: CafeSceneCue | null }): JSX.Element | null {
  if (!cue) return null

  return (
    <div className="cafe-scene-performance" aria-hidden="true">
      <div
        key={cue.id}
        className={`cafe-scene cafe-scene--${cue.kind}`}
        data-cue-kind={cue.kind}
        style={{ '--cue-id': cue.id } as CSSProperties}
      >
        <SceneCue cue={cue} />
      </div>
    </div>
  )
}

function SceneCue({ cue }: { cue: CafeSceneCue }) {
  switch (cue.kind) {
    case 'arrival':
      return (
        <div className="cafe-arrival">
          <span className="cafe-arrival__dust cafe-arrival__dust--a" />
          <span className="cafe-arrival__dust cafe-arrival__dust--b" />
          <span className="cafe-arrival__dust cafe-arrival__dust--c" />
          <span className="cafe-arrival__figure cafe-arrival__figure--back">
            <GameIcon name={cue.icon ?? 'Smile'} size={21} />
          </span>
          <span className="cafe-arrival__figure cafe-arrival__figure--front">
            <GameIcon name={cue.icon ?? 'Smile'} size={24} />
            <i />
          </span>
          <SceneLabel label={cue.label} />
        </div>
      )

    case 'order':
      return (
        <div className="cafe-order-show">
          <span className="cafe-order-show__person">
            <GameIcon name="Smile" size={25} />
          </span>
          <span className="cafe-order-show__reaction">
            <GameIcon name="Sparkles" size={14} />
          </span>
          <span className="cafe-order-show__bubble">
            <GameIcon name={cue.icon ?? 'ClipboardList'} size={18} />
            <SceneLabel label={cue.label} />
          </span>
          <i className="cafe-order-show__paper cafe-order-show__paper--a" />
          <i className="cafe-order-show__paper cafe-order-show__paper--b" />
          <i className="cafe-order-show__paper cafe-order-show__paper--c" />
        </div>
      )

    case 'serving':
      return (
        <div className="cafe-serving">
          <span className="cafe-serving__trail">
            <i />
            <i />
            <i />
          </span>
          <span className="cafe-serving__dish">
            <GameIcon name={cue.icon ?? 'Cake'} size={20} />
            <SceneLabel label={cue.label} />
          </span>
          <span className="cafe-serving__ripple" />
          <span className="cafe-serving__burst">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="cafe-serving__coin">
            <GameIcon name="Coins" size={16} />
          </span>
        </div>
      )

    case 'cleaning':
      return (
        <div className="cafe-cleaning">
          <span className="cafe-cleaning__streak" />
          <span className="cafe-cleaning__cup">
            <GameIcon name={cue.icon ?? 'Droplets'} size={20} />
            <SceneLabel label={cue.label} />
          </span>
          <span className="cafe-cleaning__foam">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      )

    case 'pet':
      return (
        <div className="cafe-pet">
          <span className="cafe-pet__ledge" />
          <span className="cafe-pet__figure">
            <i className="cafe-pet__ear cafe-pet__ear--left" />
            <i className="cafe-pet__ear cafe-pet__ear--right" />
            <GameIcon name={cue.icon ?? 'PawPrint'} size={26} />
            <i className="cafe-pet__tail" />
          </span>
          <span className="cafe-pet__prints">
            <i>
              <GameIcon name="PawPrint" size={10} />
            </i>
            <i>
              <GameIcon name="PawPrint" size={10} />
            </i>
            <i>
              <GameIcon name="PawPrint" size={10} />
            </i>
          </span>
          <SceneLabel label={cue.label} />
        </div>
      )

    case 'romance':
      return (
        <div className="cafe-romance">
          <span className="cafe-romance__glow" />
          <span className="cafe-romance__path" />
          <span className="cafe-romance__token cafe-romance__token--1">
            <GameIcon name={cue.icon ?? 'Heart'} size={18} />
          </span>
          <span className="cafe-romance__token cafe-romance__token--2">
            <GameIcon name="Flower2" size={16} />
          </span>
          <span className="cafe-romance__token cafe-romance__token--3">
            <GameIcon name="Heart" size={13} />
          </span>
          <span className="cafe-romance__token cafe-romance__token--4">
            <GameIcon name="Sparkles" size={12} />
          </span>
          <span className="cafe-romance__token cafe-romance__token--5">
            <GameIcon name="Heart" size={16} />
          </span>
          <span className="cafe-romance__token cafe-romance__token--6">
            <GameIcon name="Flower2" size={13} />
          </span>
          <SceneLabel label={cue.label} />
        </div>
      )
  }
}

function SceneLabel({ label }: { label?: string }) {
  const text = shortLabel(label)
  if (!text) return null
  return <span className="cafe-scene__label">{text}</span>
}

function shortLabel(label?: string): string {
  const text = label?.trim() ?? ''
  return Array.from(text).slice(0, 7).join('')
}
