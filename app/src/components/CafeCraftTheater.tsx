import type { CSSProperties } from 'react'
import { GameIcon } from './GameIcon'
import type { MaterialId, StationId, StepKind } from '../game/cafeTypes'
import '../styles/cafe-craft-theater.css'

export interface CafeCraftTheaterProps {
  stepId: string
  kind: StepKind
  station?: StationId
  material?: MaterialId
  inputs?: MaterialId[]
  orderIcon: string
  orderName: string
  active: boolean
  processing: boolean
}

const DEFAULT_STATION: Record<StepKind, StationId> = {
  load: 'machine',
  process: 'machine',
  assemble: 'assembly',
  choose: 'assembly',
  plate: 'tray',
}

const STATION_ICON: Record<StationId, string> = {
  machine: 'Coffee',
  oven: 'Flame',
  assembly: 'CookingPot',
  tray: 'Utensils',
  sink: 'Droplets',
}

const MATERIAL_ICON: Record<MaterialId, string> = {
  cup: 'Coffee',
  milk: 'Droplets',
  coffeeBean: 'Bean',
  ice: 'IceCreamCone',
  syrup: 'Droplets',
  soda: 'CupSoda',
  croissant: 'Croissant',
  butter: 'Cake',
  garnish: 'Leaf',
  espresso: 'Coffee',
  foam: 'Droplets',
  latte: 'Coffee',
  pastry: 'Croissant',
  cooler: 'CupSoda',
}

const MATERIAL_TONE: Record<MaterialId, string> = {
  cup: 'porcelain',
  milk: 'milk',
  coffeeBean: 'coffee',
  ice: 'ice',
  syrup: 'citrus',
  soda: 'soda',
  croissant: 'butter',
  butter: 'butter',
  garnish: 'leaf',
  espresso: 'coffee',
  foam: 'milk',
  latte: 'coffee',
  pastry: 'butter',
  cooler: 'citrus',
}

const CHOICE_TONES = ['citrus', 'butter', 'leaf'] as const

function resolveStation(kind: StepKind, station?: StationId): StationId {
  return station ?? DEFAULT_STATION[kind]
}

function resolveMaterial(kind: StepKind, material: MaterialId | undefined, inputs?: MaterialId[]): MaterialId {
  if (material) return material
  if (kind === 'assemble') return inputs?.[0] ?? 'espresso'
  if (kind === 'plate') return 'latte'
  return 'cup'
}

function resolveInputs(kind: StepKind, sourceMaterial: MaterialId, inputs?: MaterialId[]): MaterialId[] {
  if (inputs && inputs.length > 0) return inputs.slice(0, 2)
  if (kind === 'assemble') return ['espresso', 'foam']
  return [sourceMaterial]
}

export function CafeCraftTheater({
  stepId,
  kind,
  station,
  material,
  inputs,
  orderIcon,
  orderName,
  active,
  processing,
}: CafeCraftTheaterProps): JSX.Element {
  const resolvedStation = resolveStation(kind, station)
  const sourceMaterial = resolveMaterial(kind, material, inputs)
  const sourceInputs = resolveInputs(kind, sourceMaterial, inputs)
  const sourceTone = MATERIAL_TONE[sourceMaterial]

  const sceneStyle = {
    '--theater-source-count': sourceInputs.length,
  } as CSSProperties

  return (
    <div
      className={`cafe-craft-theater cafe-craft-theater--${kind} cafe-craft-theater--${resolvedStation}${
        active ? ' is-active' : ''
      }${processing ? ' is-processing' : ''}${!active && !processing ? ' is-idle' : ''}`}
      data-step-id={stepId}
      data-step-kind={kind}
      data-station={resolvedStation}
      data-order-name={orderName}
      aria-hidden="true"
    >
      <div key={stepId} className="cafe-craft-theater__stage" style={sceneStyle}>
        <span className="cafe-craft-theater__grid" />
        <span className="cafe-craft-theater__wash" />
        <span className="cafe-craft-theater__beam" />

        <span className="cafe-craft-theater__source">
          {kind === 'choose'
            ? CHOICE_TONES.map((tone, index) => (
                <i
                  key={tone}
                  className={`cafe-craft-theater__choice cafe-tone--${tone}`}
                  style={{ '--theater-index': index } as CSSProperties}
                />
              ))
            : sourceInputs.map((input, index) => (
                <span
                  key={`${input}-${index}`}
                  className={`cafe-craft-theater__puck cafe-tone--${MATERIAL_TONE[input]}${
                    index > 0 ? ' cafe-craft-theater__puck--second' : ''
                  }`}
                  style={{ '--theater-index': index } as CSSProperties}
                >
                  <GameIcon name={MATERIAL_ICON[input]} size={16} strokeWidth={2.1} />
                  <i />
                </span>
              ))}
        </span>

        <span className="cafe-craft-theater__device">
          <span className="cafe-craft-theater__machine">
            <i className="cafe-craft-theater__machine-top" />
            <i className="cafe-craft-theater__machine-door" />
            <i className="cafe-craft-theater__machine-window" />
            <i className="cafe-craft-theater__machine-knob" />
            <span className="cafe-craft-theater__machine-icon">
              <GameIcon name={STATION_ICON[resolvedStation]} size={17} strokeWidth={2.1} />
            </span>
          </span>

          <span className={`cafe-craft-theater__vessel cafe-tone--${sourceTone}`}>
            <i className="cafe-craft-theater__vessel-cup" />
            <i className="cafe-craft-theater__vessel-fill" />
            <span className="cafe-craft-theater__vessel-icon">
              <GameIcon name={MATERIAL_ICON[sourceMaterial]} size={14} strokeWidth={2.1} />
            </span>
          </span>

          <span className="cafe-craft-theater__process-fx">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="cafe-craft-theater__heat">
            <i />
            <i />
            <i />
          </span>
          <span className="cafe-craft-theater__splash">
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>

        <span className="cafe-craft-theater__output">
          <i className="cafe-craft-theater__tray" />
          <span className="cafe-craft-theater__finished">
            <GameIcon name={orderIcon} size={20} strokeWidth={2} />
          </span>
          <span className="cafe-craft-theater__burst">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>

        <span className="cafe-craft-theater__sparks">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="cafe-craft-theater__flash" />
      </div>
    </div>
  )
}
