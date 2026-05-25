// tests/unit/scheduler/watcher.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { SchedulerWatcher } from '../../../src/scheduler/watcher.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { SchedulerManager } from '../../../src/scheduler/manager.js';
import type { ScheduledTask } from '../../../src/scheduler/types.js';

describe('SchedulerWatcher', () => {
  let taskStore: TaskStore;
  let schedulerManager: SchedulerManager;
  let watcher: SchedulerWatcher;

  beforeEach(() => {
    taskStore = new TaskStore('/tmp/test-tasks.json');
    schedulerManager = new SchedulerManager(taskStore);
  });

  afterEach(() => {
    watcher?.stop();
  });

  it('should create instance with required options', () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
    });
    expect(watcher).toBeDefined();
  });

  it('should have start method', () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
    });
    expect(watcher.start).toBeDefined();
    expect(typeof watcher.start).toBe('function');
  });

  it('should have stop method', () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
    });
    expect(watcher.stop).toBeDefined();
    expect(typeof watcher.stop).toBe('function');
  });

  it('should have isWatching method', () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
    });
    expect(watcher.isWatching).toBeDefined();
    expect(typeof watcher.isWatching).toBe('function');
    expect(watcher.isWatching()).toBe(false);
  });
});

describe('SchedulerWatcher - file watching', () => {
  let tempDir: string;
  let taskFilePath: string;
  let taskStore: TaskStore;
  let schedulerManager: SchedulerManager;
  let watcher: SchedulerWatcher;

  beforeEach(async () => {
    tempDir = join(tmpdir(), 'scheduler-watcher-test-' + Date.now());
    await mkdir(tempDir, { recursive: true });
    taskFilePath = join(tempDir, 'scheduled-tasks.json');

    // 创建空任务文件
    await writeFile(taskFilePath, JSON.stringify({ tasks: [] }));

    taskStore = new TaskStore(taskFilePath);
    schedulerManager = new SchedulerManager(taskStore);
  });

  afterEach(async () => {
    watcher?.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should start watching file', async () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });

    await watcher.start();

    // 验证监听启动
    expect(watcher.isWatching()).toBe(true);
  });

  it('should stop watching on stop()', async () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });

    await watcher.start();
    watcher.stop();

    expect(watcher.isWatching()).toBe(false);
  });

  it('should not start if file does not exist', async () => {
    const nonExistentPath = join(tempDir, 'non-existent.json');
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: nonExistentPath,
    });

    await watcher.start();

    expect(watcher.isWatching()).toBe(false);
  });
});

describe('SchedulerWatcher - change detection', () => {
  let tempDir: string;
  let taskFilePath: string;
  let taskStore: TaskStore;
  let schedulerManager: SchedulerManager;
  let watcher: SchedulerWatcher;

  const createTask = (id: string, executeTime: string): ScheduledTask => ({
    taskId: id,
    userId: 'test-user',
    channel: 'cli',
    content: 'test content',
    summary: 'test summary',
    executeTime,
    taskType: 'recurring',
    actionType: 'reminder',
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });

  beforeEach(async () => {
    tempDir = join(tmpdir(), 'scheduler-watcher-test-' + Date.now());
    await mkdir(tempDir, { recursive: true });
    taskFilePath = join(tempDir, 'scheduled-tasks.json');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [] }));
    taskStore = new TaskStore(taskFilePath);
    schedulerManager = new SchedulerManager(taskStore);
  });

  afterEach(async () => {
    watcher?.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should detect added task via processChange', async () => {
    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });
    await watcher.start();

    // 添加任务到文件
    const newTask = createTask('task-1', '0 9 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [newTask] }));

    // 手动触发变化处理（绕过 chokidar）
    await watcher.processChange();

    expect(schedulerManager.getScheduledCount()).toBe(1);
    expect(schedulerManager.getScheduledTaskIds()).toContain('task-1');
  });

  it('should detect removed task via processChange', async () => {
    // 初始有一个任务
    const task = createTask('task-1', '0 9 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [task] }));
    taskStore = new TaskStore(taskFilePath);
    schedulerManager = new SchedulerManager(taskStore);

    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });
    await watcher.start();
    // 手动调度初始任务（因为 ignoreInitial: true）
    schedulerManager.scheduleTask(task);

    // 删除任务
    await writeFile(taskFilePath, JSON.stringify({ tasks: [] }));

    // 手动触发变化处理
    await watcher.processChange();

    expect(schedulerManager.getScheduledCount()).toBe(0);
  });

  it('should detect modified task via processChange', async () => {
    const task = createTask('task-1', '0 9 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [task] }));
    taskStore = new TaskStore(taskFilePath);
    schedulerManager = new SchedulerManager(taskStore);

    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });
    await watcher.start();
    schedulerManager.scheduleTask(task);

    // 修改执行时间
    const modifiedTask = createTask('task-1', '30 15 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [modifiedTask] }));

    // 手动触发变化处理
    await watcher.processChange();

    expect(schedulerManager.getScheduledCount()).toBe(1);
    expect(schedulerManager.getScheduledTaskIds()).toContain('task-1');
  });

  it('should handle multiple changes via processChange', async () => {
    // 初始有两个任务
    const task1 = createTask('task-1', '0 9 * * *');
    const task2 = createTask('task-2', '0 10 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [task1, task2] }));
    taskStore = new TaskStore(taskFilePath);
    schedulerManager = new SchedulerManager(taskStore);

    watcher = new SchedulerWatcher({
      taskStore,
      schedulerManager,
      filePath: taskFilePath,
    });
    await watcher.start();
    schedulerManager.scheduleTask(task1);
    schedulerManager.scheduleTask(task2);

    // 添加一个、删除一个、修改一个
    const modifiedTask1 = createTask('task-1', '30 15 * * *');
    const newTask3 = createTask('task-3', '0 11 * * *');
    await writeFile(taskFilePath, JSON.stringify({ tasks: [modifiedTask1, newTask3] }));

    // 手动触发变化处理
    await watcher.processChange();

    // 应该有 2 个调度（task-1 和 task-3）
    expect(schedulerManager.getScheduledCount()).toBe(2);
    expect(schedulerManager.getScheduledTaskIds()).toContain('task-1');
    expect(schedulerManager.getScheduledTaskIds()).toContain('task-3');
    expect(schedulerManager.getScheduledTaskIds()).not.toContain('task-2');
  });
});