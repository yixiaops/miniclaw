# Feature Specification: Memory Search System

**Feature Branch**: `003-memory-search`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "实现对话历史和知识库的搜索能力，让 Agent 可以搜索用户的历史对话和知识库文件"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Searches User's Historical Conversations (Priority: P1)

As an AI Agent, I want to search through historical conversation sessions so that I can recall past interactions and provide contextually relevant responses.

**Why this priority**: This is the core use case - enabling the Agent to remember and reference past conversations is the primary value proposition of the memory search system.

**Independent Test**: Can be fully tested by storing sample conversation sessions, executing search queries, and verifying correct results are returned.

**Acceptance Scenarios**:

1. **Given** multiple conversation sessions exist in `~/.miniclaw/sessions/*.json`, **When** the Agent calls `memory_search` with a query matching content in a past session, **Then** the relevant session snippets should be returned with correct path and line numbers
2. **Given** a conversation session with multi-turn dialogue, **When** the Agent searches for a specific topic discussed, **Then** all relevant message snippets from that session are returned
3. **Given** empty or no sessions exist, **When** the Agent calls `memory_search`, **Then** an empty result set is returned gracefully without errors

---

### User Story 2 - Agent Searches Knowledge Base Files (Priority: P1)

As an AI Agent, I want to search through knowledge base markdown files so that I can access curated information stored by the user.

**Why this priority**: Knowledge base search is equally critical as session search - both data sources complement each other to provide comprehensive memory retrieval.

**Independent Test**: Can be tested by creating sample `memory/*.md` files, executing search queries, and verifying correct results are returned.

**Acceptance Scenarios**:

1. **Given** markdown files exist in `~/.miniclaw/memory/`, **When** the Agent calls `memory_search` with a query matching content in a knowledge file, **Then** the relevant snippets are returned with correct path and line numbers
2. **Given** multiple knowledge files covering different topics, **When** the Agent searches with a broad query, **Then** results from all matching files are aggregated and ranked
3. **Given** the knowledge directory does not exist or is empty, **When** the Agent calls `memory_search`, **Then** an empty result set is returned gracefully without errors

---

### User Story 3 - Agent Retrieves Specific File Content (Priority: P2)

As an AI Agent, I want to retrieve specific lines from a file by path so that I can read the full context around a search result.

**Why this priority**: This is an essential supporting feature - after finding relevant snippets via search, the Agent needs to read surrounding context for better understanding.

**Independent Test**: Can be tested by creating files with known content, calling `memory_get` with specific paths, and verifying returned content matches expectations.

**Acceptance Scenarios**:

1. **Given** a knowledge file at `memory/preferences.md`, **When** the Agent calls `memory_get` with path `preferences.md`, **Then** the full file content is returned
2. **Given** a large file with 100 lines, **When** the Agent calls `memory_get` with `from=10` and `lines=20`, **Then** lines 10-29 are returned correctly
3. **Given** an invalid file path, **When** the Agent calls `memory_get`, **Then** an appropriate error is returned indicating the file was not found

---

### User Story 4 - Agent Combines Memory Sources (Priority: P3)

As an AI Agent, I want search results to include both conversation sessions and knowledge base files so that I can leverage all available memory sources in one query.

**Why this priority**: This is a valuable enhancement for comprehensive retrieval but builds on the core search functionality.

**Independent Test**: Can be tested by populating both sessions and memory files, executing a search, and verifying results from both sources are included.

**Acceptance Scenarios**:

1. **Given** both sessions and knowledge files contain relevant content, **When** the Agent calls `memory_search`, **Then** results from both sources are returned
2. **Given** search results from multiple sources, **When** the Agent reviews them, **Then** each result clearly indicates its source type (session or memory)
3. **Given** a query that only matches sessions but not memory files, **When** the Agent calls `memory_search`, **Then** only session results are returned without errors

---

### Edge Cases

- What happens when a search query contains special characters or regex patterns?
- How does the system handle very large files (>10MB) in the memory directory?
- What happens when a session file is corrupted or malformed JSON?
- How does the system handle concurrent read/write operations on session files?
- What happens when the storage directory permissions prevent reading?
- How does the system handle Unicode and multi-byte characters in search queries?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a `memory_search` tool that accepts a query string and returns matching snippets from conversation sessions and knowledge base files
- **FR-002**: The system MUST provide a `memory_get` tool that reads specific lines from a file given its path and optional line range parameters
- **FR-003**: The `memory_search` tool MUST search through all `~/.miniclaw/sessions/*.json` files for conversation history
- **FR-004**: The `memory_search` tool MUST search through all `~/.miniclaw/memory/*.md` files for knowledge base content
- **FR-005**: Search results MUST include the file path, line numbers (start and end), a snippet of matching content, and the source type
- **FR-006**: The system MUST use simple string matching (substring search) without vector embeddings or semantic search
- **FR-007**: The system MUST handle missing directories gracefully by returning empty results
- **FR-008**: The `memory_get` tool MUST support optional `from` (starting line number) and `lines` (number of lines to read) parameters
- **FR-009**: The system MUST integrate with the existing Gateway architecture and follow established patterns from OpenClaw's memory-tool.ts
- **FR-010**: The system MUST return results sorted by relevance (e.g., number of matches or match position)
- **FR-011**: The system MUST limit the number of results returned (default configurable, e.g., maxResults=10)
- **FR-012**: The system MUST handle file I/O errors gracefully and return appropriate error messages

### Key Entities

- **MemorySearchResult**: A single search result containing path, startLine, endLine, score, snippet, and source type
- **MemorySource**: An enum indicating the data source type - either "memory" (knowledge files) or "sessions" (conversation history)
- **SearchOptions**: Configuration for search including query string, maxResults limit, and optional minScore threshold
- **FileReadParams**: Parameters for reading files including path, optional from line number, and optional lines count
- **SessionFile**: JSON file format for storing conversation history with sessionKey and messages array
- **KnowledgeFile**: Markdown file in the memory directory containing curated knowledge

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `memory_search` tool correctly returns matching snippets from session files when given a query (measured by unit tests with sample session data)
- **SC-002**: `memory_search` tool correctly returns matching snippets from knowledge files when given a query (measured by unit tests with sample memory files)
- **SC-003**: `memory_get` tool returns correct file content when given a valid path (measured by unit tests)
- **SC-004**: `memory_get` tool returns correct line range when given `from` and `lines` parameters (measured by unit tests)
- **SC-005**: Search results include accurate line numbers that map to the original files (measured by unit tests verifying line number correctness)
- **SC-006**: The system handles missing directories and files gracefully without throwing unhandled exceptions (measured by error handling tests)
- **SC-007**: The system integrates with the Gateway architecture and follows established patterns (measured by code review against OpenClaw memory-tool.ts)
- **SC-008**: All tools return results in a format compatible with the Agent tool interface (measured by integration tests)

### Technical Quality Criteria

- **SC-009**: Code follows TypeScript best practices with proper type definitions
- **SC-010**: All public functions have JSDoc documentation
- **SC-011**: Unit test coverage for the memory search module is at least 80%
- **SC-012**: The implementation does not introduce external dependencies for vector search or embeddings