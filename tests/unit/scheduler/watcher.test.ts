// tests/unit/scheduler/watcher.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchedulerWatcher } from '../../../src/scheduler/watcher.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { SchedulerManager } from '../../../src/scheduler/manager.js';

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
});