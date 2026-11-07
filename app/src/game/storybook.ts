import { STORYBOOK_CHAPTERS } from '../data/content'
import type { GameState, StoryBranchDef, StorybookChapterDef } from './types'

export function getStorybookChapter(id: string): StorybookChapterDef | undefined {
  return STORYBOOK_CHAPTERS.find((chapter) => chapter.id === id)
}

export function getCurrentStorybookChapter(state: GameState): StorybookChapterDef | undefined {
  return getStorybookChapter(state.storyChapterId)
}

export function getStorybookBranch(
  chapter: StorybookChapterDef | undefined,
  branchId: string | null,
): StoryBranchDef | undefined {
  if (!chapter || !branchId) return undefined
  for (const beat of chapter.beats) {
    if (beat.type !== 'choice') continue
    const option = beat.options.find((item) => item.branch?.id === branchId)
    if (option?.branch) return option.branch
  }
  return undefined
}

export function getActiveStorybookBranch(state: GameState): StoryBranchDef | undefined {
  return getStorybookBranch(getCurrentStorybookChapter(state), state.storyBranchId)
}

export function storybookTotalBeats(
  chapter: StorybookChapterDef,
  state: GameState,
): number {
  const branch = getStorybookBranch(chapter, state.storyBranchId)
  return chapter.beats.length + (branch?.beats.length ?? 0)
}

export function storybookProgress(
  chapter: StorybookChapterDef,
  state: GameState,
): number {
  const branch = getStorybookBranch(chapter, state.storyBranchId)
  const rawProgress = branch
    ? state.storyChapterBeat + 1 + Math.min(state.storyBranchBeat, branch.beats.length)
    : state.storyChapterBeat
  return Math.min(rawProgress, storybookTotalBeats(chapter, state))
}

export function storybookChapterAvailable(
  state: GameState,
  chapter: StorybookChapterDef,
): boolean {
  if (chapter.requiresChapter && !state.storyCompletedChapters.includes(chapter.requiresChapter)) {
    return false
  }
  if (chapter.requiresStoryFlags?.some((flag) => !state.storyFlags.includes(flag))) {
    return false
  }
  return true
}

export function storybookChapterRequirementText(
  state: GameState,
  chapter: StorybookChapterDef,
): string | null {
  if (chapter.requiresChapter && !state.storyCompletedChapters.includes(chapter.requiresChapter)) {
    const previous = getStorybookChapter(chapter.requiresChapter)
    return `需要先读完《${previous?.title ?? '上一章'}》`
  }
  if (chapter.requiresStoryFlags?.some((flag) => !state.storyFlags.includes(flag))) {
    return '需要先在前面做出对应的剧情选择'
  }
  return null
}

export { STORYBOOK_CHAPTERS }
