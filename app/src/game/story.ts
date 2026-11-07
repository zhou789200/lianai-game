import { CHAPTERS } from '../data/content'
import type { ChapterDef, GameState } from './types'

export function getChapter(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

export function getCurrentChapter(state: GameState): ChapterDef | undefined {
  return getChapter(state.chapterId)
}

/** 章节是否满足解锁条件（前置章节 + 关系值） */
export function chapterAvailable(state: GameState, chapter: ChapterDef): boolean {
  if (chapter.requiresChapter && !state.completedChapters.includes(chapter.requiresChapter)) {
    return false
  }
  if (typeof chapter.requiresRelationship === 'number') {
    const rel = state.relationships.find((r) => r.id === chapter.characterId)
    if (!rel || rel.value < chapter.requiresRelationship) return false
  }
  if (
    chapter.requiresStoryFlags?.some((flag) => !state.storyFlags.includes(flag))
  ) {
    return false
  }
  return true
}

/** 未满足的条件描述，用于给玩家真实反馈而不是一个灰按钮 */
export function chapterRequirementText(state: GameState, chapter: ChapterDef): string | null {
  if (chapter.requiresChapter && !state.completedChapters.includes(chapter.requiresChapter)) {
    const prev = getChapter(chapter.requiresChapter)
    return `需要先读完《${prev?.title ?? '上一章'}》`
  }
  if (typeof chapter.requiresRelationship === 'number') {
    const rel = state.relationships.find((r) => r.id === chapter.characterId)
    const cur = rel?.value ?? 0
    if (cur < chapter.requiresRelationship) {
      return `需要与${rel?.name ?? '他'}的关系达到 ${chapter.requiresRelationship}（当前 ${cur}）`
    }
  }
  if (
    chapter.requiresStoryFlags?.some((flag) => !state.storyFlags.includes(flag))
  ) {
    return '需要先完成相关剧情本内容'
  }
  return null
}

export function isChapterCompleted(state: GameState, chapterId: string): boolean {
  return state.completedChapters.includes(chapterId)
}

export { CHAPTERS }
