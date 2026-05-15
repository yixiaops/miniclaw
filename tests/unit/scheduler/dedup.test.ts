/**
 * Dedup 模块单元测试
 *
 * 测试任务去重逻辑（时间窗口 + 内容相似度）
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSimilarity,
  isDuplicateTask,
  findDuplicateTask,
} from '../../../src/scheduler/dedup.js';
import { ScheduledTask } from '../../../src/scheduler/types.js';

const createTask = (
  id: string,
  summary: string,
  executeTime: string,
  userId: string = 'test-user'
): ScheduledTask => ({
  taskId: id,
  userId,
  channel: 'cli',
  content: `任务: ${summary}`,
  summary,
  executeTime,
  taskType: 'one-time',
  actionType: 'reminder',
  status: 'pending',
  createdAt: '2026-05-15T10:00:00Z',
  retryCount: 0,
});

describe('calculateSimilarity', () => {
  it('should return 1 for identical strings', () => {
    const similarity = calculateSimilarity('开会提醒', '开会提醒');
    expect(similarity).toBe(1);
  });

  it('should return high similarity for similar content', () => {
    const similarity = calculateSimilarity('开会提醒', '开会');
    expect(similarity).toBeGreaterThanOrEqual(0.5); // 交集2/并集4 = 0.5
  });

  it('should return 0 for completely different strings', () => {
    const similarity = calculateSimilarity('开会', '周报');
    expect(similarity).toBe(0);
  });

  it('should handle empty strings', () => {
    const similarity = calculateSimilarity('', '');
    expect(similarity).toBe(0);
  });

  it('should be case-insensitive', () => {
    const similarity = calculateSimilarity('Meeting', 'meeting');
    expect(similarity).toBe(1);
  });
});

describe('isDuplicateTask', () => {
  const existingTasks: ScheduledTask[] = [
    createTask('task-1', '开会', '2026-05-16T09:00:00Z'),
    createTask('task-2', '周报', '2026-05-17T10:00:00Z'),
  ];

  it('should return true for duplicate task (same time + similar content)', () => {
    const newTask = createTask('new', '开会', '2026-05-16T09:15:00Z');
    const isDuplicate = isDuplicateTask(newTask, existingTasks);
    expect(isDuplicate).toBe(true);
  });

  it('should return false for different time', () => {
    // 超出时间窗口（60分钟后）
    const newTask = createTask('new', '开会', '2026-05-16T10:00:00Z');
    const isDuplicate = isDuplicateTask(newTask, existingTasks);
    expect(isDuplicate).toBe(false);
  });

  it('should return false for different content', () => {
    const newTask = createTask('new', '吃饭', '2026-05-16T09:00:00Z');
    const isDuplicate = isDuplicateTask(newTask, existingTasks);
    expect(isDuplicate).toBe(false);
  });

  it('should return false for different user', () => {
    const newTask = createTask('new', '开会', '2026-05-16T09:00:00Z', 'other-user');
    const isDuplicate = isDuplicateTask(newTask, existingTasks);
    expect(isDuplicate).toBe(false);
  });

  it('should respect custom time window', () => {
    // 15分钟差异，默认30分钟窗口内
    const newTask = createTask('new', '开会', '2026-05-16T09:15:00Z');
    const isDuplicate = isDuplicateTask(newTask, existingTasks, 30 * 60 * 1000);
    expect(isDuplicate).toBe(true);

    // 自定义10分钟窗口，超出
    const isDuplicateSmall = isDuplicateTask(newTask, existingTasks, 10 * 60 * 1000);
    expect(isDuplicateSmall).toBe(false);
  });
});

describe('findDuplicateTask', () => {
  const existingTasks: ScheduledTask[] = [
    createTask('task-1', '开会', '2026-05-16T09:00:00Z'),
    createTask('task-2', '周报', '2026-05-17T10:00:00Z'),
  ];

  it('should return the duplicate task if found', () => {
    const newTask = createTask('new', '开会', '2026-05-16T09:15:00Z');
    const duplicate = findDuplicateTask(newTask, existingTasks);
    expect(duplicate?.taskId).toBe('task-1');
  });

  it('should return undefined if no duplicate found', () => {
    const newTask = createTask('new', '吃饭', '2026-05-18T10:00:00Z');
    const duplicate = findDuplicateTask(newTask, existingTasks);
    expect(duplicate).toBeUndefined();
  });
});