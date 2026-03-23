# Tasks: Memory Search System

**Input**: Design documents from `/specs/003-memory-search/`
**Prerequisites**: spec.md (required), plan.md (required)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Core Search Infrastructure

**Purpose**: Create MemorySearchManager core class

### T001 [P] Create MemorySearchManager class

**File**: `src/core/memory/search.ts`

**Description**: Create the main MemorySearchManager class with basic structure.

**Implementation**:
```typescript
export interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: 'sessions' | 'memory';
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  sources?: ('sessions' | 'memory')[];
  sessionKey?: string;
}

export class MemorySearchManager {
  constructor(storageDir?: string);
  
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>;
  
  async readFile(params: { path: string; from?: number; lines?: number }): Promise<{ text: string; path: string }>;
}
```

**Acceptance**:
- [ ] Class compiles without errors
- [ ] search() returns empty array (placeholder)
- [ ] readFile() throws "not implemented" error (placeholder)

---

### T002 [P] Define interfaces and types

**File**: `src/core/memory/search.ts`

**Description**: Define all TypeScript interfaces for the search system.

**Interfaces**:
- `MemorySearchResult`
- `SearchOptions`
- `FileReadParams`
- `MemorySource`

**Acceptance**:
- [ ] All interfaces have JSDoc comments
- [ ] Types are exported from the module

---

## Phase 2: Session Search

**Purpose**: Implement conversation history search using SimpleMemoryStorage

### T003 Create SessionSearcher class

**File**: `src/core/memory/session-searcher.ts`

**Description**: Create SessionSearcher that wraps SimpleMemoryStorage.

**Implementation**:
```typescript
import { SimpleMemoryStorage } from './simple.js';

export class SessionSearcher {
  private storage: SimpleMemoryStorage;
  
  constructor(storage: SimpleMemoryStorage);
  
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>;
}
```

**Acceptance**:
- [ ] Class accepts SimpleMemoryStorage in constructor
- [ ] search() method signature matches interface

---

### T004 Implement session search logic

**File**: `src/core/memory/session-searcher.ts`

**Description**: Implement the actual search logic using SimpleMemoryStorage.

**Implementation**:
```typescript
async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
  const results: MemorySearchResult[] = [];
  const sessionKeys = await this.storage.listSessions();
  
  for (const sessionKey of sessionKeys) {
    // Filter by sessionKey if specified
    if (options?.sessionKey && sessionKey !== options.sessionKey) continue;
    
    const messages = await this.storage.load(sessionKey);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // Case-insensitive match
      if (msg.content.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          path: `sessions/${sessionKey}`,
          startLine: i,
          endLine: i,
          score: 1.0,
          snippet: msg.content,
          source: 'sessions'
        });
      }
    }
  }
  
  return results.slice(0, options?.maxResults ?? 10);
}
```

**Acceptance**:
- [ ] Uses storage.listSessions() and storage.load()
- [ ] Case-insensitive matching
- [ ] Respects maxResults limit
- [ ] Returns correct results with snippet

---

## Phase 3: Knowledge Base Search

**Purpose**: Implement knowledge base file search

### T005 [P] Create KnowledgeSearcher class

**File**: `src/core/memory/knowledge-searcher.ts`

**Description**: Create KnowledgeSearcher for searching .md files.

**Implementation**:
```typescript
export class KnowledgeSearcher {
  private memoryDir: string;
  
  constructor(memoryDir?: string);
  
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>;
  
  private async ensureDir(): Promise<void>;
  private async loadFiles(): Promise<Array<{ path: string; content: string; lines: string[] }>>;
}
```

**Acceptance**:
- [ ] Default directory is ~/.miniclaw/memory/
- [ ] ensureDir() creates directory if not exists

---

### T006 Implement knowledge file loading

**File**: `src/core/memory/knowledge-searcher.ts`

**Description**: Load all .md files from memory directory.

**Implementation**:
```typescript
private async loadFiles(): Promise<Array<{ path: string; content: string; lines: string[] }>> {
  await this.ensureDir();
  
  const files: Array<{ path: string; content: string; lines: string[] }> = [];
  const entries = await readdir(this.memoryDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const filePath = join(this.memoryDir, entry.name);
      const content = await readFile(filePath, 'utf-8');
      files.push({
        path: `memory/${entry.name}`,
        content,
        lines: content.split('\n')
      });
    }
  }
  
  return files;
}
```

**Acceptance**:
- [ ] Only reads .md files
- [ ] Handles missing directory gracefully
- [ ] Returns file path, content, and lines

---

### T007 Implement knowledge search logic

**File**: `src/core/memory/knowledge-searcher.ts`

**Description**: Search through knowledge base files.

**Implementation**:
```typescript
async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
  const results: MemorySearchResult[] = [];
  const files = await this.loadFiles();
  
  for (const file of files) {
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i];
      // Case-insensitive match
      if (line.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          path: file.path,
          startLine: i + 1,  // 1-indexed
          endLine: i + 1,
          score: 1.0,
          snippet: line,
          source: 'memory'
        });
      }
    }
  }
  
  return results.slice(0, options?.maxResults ?? 10);
}
```

**Acceptance**:
- [ ] Case-insensitive matching
- [ ] Line numbers are 1-indexed
- [ ] Respects maxResults limit

---

## Phase 4: Integrate MemorySearchManager

**Purpose**: Wire up SessionSearcher and KnowledgeSearcher

### T008 Integrate searchers into MemorySearchManager

**File**: `src/core/memory/search.ts`

**Description**: Complete MemorySearchManager implementation.

**Implementation**:
```typescript
export class MemorySearchManager {
  private sessionSearcher: SessionSearcher;
  private knowledgeSearcher: KnowledgeSearcher;
  
  constructor(storageDir?: string) {
    const dir = storageDir || join(process.env.HOME || '', '.miniclaw');
    const storage = new SimpleMemoryStorage(join(dir, 'sessions'));
    
    this.sessionSearcher = new SessionSearcher(storage);
    this.knowledgeSearcher = new KnowledgeSearcher(join(dir, 'memory'));
  }
  
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
    const sources = options?.sources || ['sessions', 'memory'];
    const results: MemorySearchResult[] = [];
    
    if (sources.includes('sessions')) {
      results.push(...await this.sessionSearcher.search(query, options));
    }
    
    if (sources.includes('memory')) {
      results.push(...await this.knowledgeSearcher.search(query, options));
    }
    
    // Sort by score (all are 1.0 for now, so order doesn't matter)
    return results.slice(0, options?.maxResults ?? 10);
  }
}
```

**Acceptance**:
- [ ] Searches both sources by default
- [ ] Respects sources filter
- [ ] Returns combined results

---

### T009 Implement readFile method

**File**: `src/core/memory/search.ts`

**Description**: Implement file reading for knowledge base files.

**Implementation**:
```typescript
async readFile(params: { path: string; from?: number; lines?: number }): Promise<{ text: string; path: string }> {
  const baseDir = join(process.env.HOME || '', '.miniclaw');
  const filePath = join(baseDir, params.path);
  
  // Security: ensure path is within baseDir
  if (!filePath.startsWith(baseDir)) {
    throw new Error('Invalid path: must be within ~/.miniclaw');
  }
  
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const from = params.from ?? 1;
  const count = params.lines ?? lines.length;
  
  const selectedLines = lines.slice(from - 1, from - 1 + count);
  
  return {
    text: selectedLines.join('\n'),
    path: params.path
  };
}
```

**Acceptance**:
- [ ] Reads files from ~/.miniclaw/
- [ ] Supports from and lines parameters
- [ ] Security: prevents path traversal

---

## Phase 5: Tool Registration

**Purpose**: Create and register memory_search and memory_get tools

### T010 [P] Create memory_search tool

**File**: `src/tools/memory-search.ts`

**Description**: Create the memory_search tool definition.

**Implementation**:
```typescript
import { Type, type Static } from '@sinclair/typebox';

const MemorySearchParamsSchema = Type.Object({
  query: Type.String({ description: 'Search query string' }),
  maxResults: Type.Optional(Type.Number({ description: 'Maximum number of results (default: 10)' })),
  sources: Type.Optional(Type.Array(Type.String({ enum: ['sessions', 'memory'] }))),
});

type MemorySearchParams = Static<typeof MemorySearchParamsSchema>;

export const memorySearchTool = {
  name: 'memory_search',
  label: '搜索记忆',
  description: '搜索对话历史和知识库。在回答关于之前工作、决策、日期、人物、偏好等问题前，必须先调用此工具。',
  parameters: MemorySearchParamsSchema,
  
  async execute(_toolCallId: string, params: MemorySearchParams) {
    const manager = new MemorySearchManager();
    const results = await manager.search(params.query, {
      maxResults: params.maxResults,
      sources: params.sources as ('sessions' | 'memory')[] | undefined,
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      details: { count: results.length }
    };
  }
};
```

**Acceptance**:
- [ ] Tool definition follows existing pattern
- [ ] Description is clear for Agent
- [ ] Returns JSON-formatted results

---

### T011 [P] Create memory_get tool

**File**: `src/tools/memory-get.ts`

**Description**: Create the memory_get tool definition.

**Implementation**:
```typescript
const MemoryGetParamsSchema = Type.Object({
  path: Type.String({ description: 'File path within ~/.miniclaw/' }),
  from: Type.Optional(Type.Number({ description: 'Starting line number (1-indexed)' })),
  lines: Type.Optional(Type.Number({ description: 'Number of lines to read' })),
});

export const memoryGetTool = {
  name: 'memory_get',
  label: '获取记忆内容',
  description: '从记忆文件中读取指定片段。配合 memory_search 使用，获取完整上下文。',
  parameters: MemoryGetParamsSchema,
  
  async execute(_toolCallId: string, params: Static<typeof MemoryGetParamsSchema>) {
    const manager = new MemorySearchManager();
    const result = await manager.readFile(params);
    
    return {
      content: [{ type: 'text', text: result.text }],
      details: { path: result.path }
    };
  }
};
```

**Acceptance**:
- [ ] Tool definition follows existing pattern
- [ ] Supports pagination with from/lines

---

### T012 Register tools in tools/index.ts

**File**: `src/tools/index.ts`

**Description**: Export new tools from the tools index.

**Implementation**:
```typescript
import { memorySearchTool } from './memory-search.js';
import { memoryGetTool } from './memory-get.js';

export function getBuiltinTools() {
  return [
    readFileTool,
    writeFileTool,
    shellTool,
    webFetchTool,
    memorySearchTool,  // 新增
    memoryGetTool,     // 新增
  ];
}
```

**Acceptance**:
- [ ] Tools are exported from index
- [ ] Tools are included in getBuiltinTools()

---

## Phase 6: Testing

**Purpose**: Achieve 80%+ test coverage

### T013 [P] Test MemorySearchManager

**File**: `tests/unit/core/memory/search.test.ts`

**Test cases**:
- search() returns results from both sources
- search() respects maxResults
- search() respects sources filter
- readFile() returns correct content
- readFile() supports pagination
- readFile() handles missing file

---

### T014 [P] Test SessionSearcher

**File**: `tests/unit/core/memory/session-searcher.test.ts`

**Test cases**:
- search() uses SimpleMemoryStorage
- search() is case-insensitive
- search() returns correct snippet
- search() handles empty sessions

---

### T015 [P] Test KnowledgeSearcher

**File**: `tests/unit/core/memory/knowledge-searcher.test.ts`

**Test cases**:
- search() reads .md files
- search() is case-insensitive
- search() creates directory if missing
- search() handles empty directory

---

### T016 [P] Test memory_search tool

**File**: `tests/unit/tools/memory-search.test.ts`

**Test cases**:
- Tool executes search
- Tool returns JSON result
- Tool handles errors gracefully

---

### T017 [P] Test memory_get tool

**File**: `tests/unit/tools/memory-get.test.ts`

**Test cases**:
- Tool reads file content
- Tool supports pagination
- Tool handles missing file

---

## Summary

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Core Infrastructure | T001-T002 | 30min |
| Phase 2: Session Search | T003-T004 | 40min |
| Phase 3: Knowledge Search | T005-T007 | 50min |
| Phase 4: Integration | T008-T009 | 40min |
| Phase 5: Tools | T010-T012 | 40min |
| Phase 6: Testing | T013-T017 | 50min |
| **Total** | **17 tasks** | **~4.5h** |

---

## Parallelization

Tasks that can run in parallel:
- T001, T002 (Phase 1)
- T005, T010, T011 (different files)
- T013, T014, T015, T016, T017 (all tests)