/**
 * 任务去重模块
 *
 * 实现基于时间窗口和内容相似度的去重逻辑
 *
 * @module scheduler/dedup
 */

import type { ScheduledTask } from './types.js';

/** 默认时间窗口（30分钟） */
const DEFAULT_TIME_WINDOW_MS = 30 * 60 * 1000;

/** 默认相似度阈值 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/**
 * 计算字符串相似度
 *
 * 使用 Jaccard 相似度（关键词集合交集/并集）
 *
 * @param str1 - 字符串 1
 * @param str2 - 字符串 2
 * @returns 相似度 (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }

  // 分词并转为小写
  // 对于中文，按字符分割；对于英文，按空格分割
  const tokenize = (str: string): string[] => {
    const lower = str.toLowerCase();
    // 检查是否包含中文字符
    if (/[一-龥]/.test(lower)) {
      // 中文：按字符分割（忽略空格）
      return lower.replace(/\s+/g, '').split('');
    } else {
      // 英文：按空格分割
      return lower.split(/\s+/).filter((w) => w.length > 0);
    }
  };

  const words1 = tokenize(str1);
  const words2 = tokenize(str2);

  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  // 计算交集
  const intersection = new Set([...set1].filter((x) => set2.has(x)));

  // 计算并集
  const union = new Set([...set1, ...set2]);

  // Jaccard 相似度
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * 检查任务是否重复
 *
 * 判断条件：同一用户 + 时间窗口内 + 内容相似度达到阈值
 *
 * @param newTask - 新任务
 * @param existingTasks - 已存在的任务列表
 * @param timeWindowMs - 时间窗口（毫秒）
 * @param similarityThreshold - 相似度阈值
 * @returns 是否重复
 */
export function isDuplicateTask(
  newTask: ScheduledTask,
  existingTasks: ScheduledTask[],
  timeWindowMs: number = DEFAULT_TIME_WINDOW_MS,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD
): boolean {
  const duplicate = findDuplicateTask(
    newTask,
    existingTasks,
    timeWindowMs,
    similarityThreshold
  );
  return duplicate !== undefined;
}

/**
 * 查找重复任务
 *
 * 返回匹配的已存在任务
 *
 * @param newTask - 新任务
 * @param existingTasks - 已存在的任务列表
 * @param timeWindowMs - 时间窗口（毫秒）
 * @param similarityThreshold - 相似度阈值
 * @returns 匹配的任务或 undefined
 */
export function findDuplicateTask(
  newTask: ScheduledTask,
  existingTasks: ScheduledTask[],
  timeWindowMs: number = DEFAULT_TIME_WINDOW_MS,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD
): ScheduledTask | undefined {
  // 只检查同一用户的 pending 任务
  const userPendingTasks = existingTasks.filter(
    (task) =>
      task.userId === newTask.userId &&
      task.status === 'pending'
  );

  const newTime = new Date(newTask.executeTime).getTime();

  for (const existing of userPendingTasks) {
    const existingTime = new Date(existing.executeTime).getTime();
    const timeDiff = Math.abs(newTime - existingTime);

    // 时间差在窗口内
    if (timeDiff <= timeWindowMs) {
      const similarity = calculateSimilarity(
        newTask.summary,
        existing.summary
      );

      // 相似度达到阈值
      if (similarity >= similarityThreshold) {
        return existing;
      }
    }
  }

  return undefined;
}