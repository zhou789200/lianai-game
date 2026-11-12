export interface LocalStoryMemory {
  title?: string
  memoryAnchors?: string[]
  clue?: string
}

export interface LocalStoryRequest {
  storySeed?: string
  petName?: string
  storyTurn?: number
  memories?: LocalStoryMemory[]
}

export interface LocalStoryBeat {
  type: 'narration' | 'dialogue'
  speaker?: string
  text: string
}

export interface LocalStoryChoice {
  id: string
  text: string
  reply: string
  consequence: string
}

export interface LocalStory {
  id: string
  source: 'local'
  degraded: boolean
  title: string
  subtitle: string
  scene: string
  beats: LocalStoryBeat[]
  choices: LocalStoryChoice[]
  memoryAnchors: string[]
  clue: string
}

export function buildLocalStory(
  request?: LocalStoryRequest,
  degraded?: boolean,
  at?: number,
): LocalStory

export const LOCAL_STORY_BANK: ReadonlyArray<unknown>
