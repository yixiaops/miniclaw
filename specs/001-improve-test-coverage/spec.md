# Feature Specification: Improve Test Coverage

**Feature Branch**: `001-improve-test-coverage`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "提升测试覆盖率"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gateway Core Coverage Improvement (Priority: P1)

As a developer maintaining Miniclaw, I need comprehensive test coverage for the Gateway component so that I can confidently refactor and add features without introducing regressions.

**Why this priority**: Gateway is the central coordinator handling all message flows. At 65% coverage, it's below the 70% threshold and is critical to system reliability.

**Independent Test**: Can be fully tested by running the test suite and verifying Gateway coverage reports show 70%+ line coverage and 65%+ branch coverage.

**Acceptance Scenarios**:

1. **Given** the Gateway component with current 65% coverage, **When** additional unit tests are added for untested code paths, **Then** the coverage report shows 70%+ line coverage
2. **Given** the Gateway handles message routing, **When** all routing branches are tested including edge cases, **Then** branch coverage reaches 65%+
3. **Given** Gateway error handling paths, **When** error scenarios are tested, **Then** error branches show coverage in reports

---

### User Story 2 - Channel Module Coverage Improvement (Priority: P2)

As a developer, I need each channel module (CLI, API, Web, Feishu) to have adequate test coverage so that multi-channel access functionality is reliable.

**Why this priority**: Channel modules enable multi-channel access. CLI (48%) and API (40%) have critically low coverage, risking undetected bugs in user-facing interfaces.

**Independent Test**: Can be tested by running channel-specific test suites and verifying each module's coverage meets the 60% threshold.

**Acceptance Scenarios**:

1. **Given** CLI channel at 48% coverage, **When** tests are added for command parsing and output formatting, **Then** CLI coverage reaches 60%+
2. **Given** API channel at 40% coverage, **When** tests are added for HTTP endpoints and request validation, **Then** API coverage reaches 60%+
3. **Given** Web channel at 60% coverage, **When** WebSocket event handlers are fully tested, **Then** Web coverage maintains or exceeds 60%
4. **Given** Feishu channel at 59% coverage, **When** message handling and authentication are tested, **Then** Feishu coverage reaches 60%+

---

### User Story 3 - Overall Coverage Threshold Achievement (Priority: P3)

As a project maintainer, I need the overall test coverage to meet minimum thresholds so that the codebase quality is maintained and CI quality gates pass.

**Why this priority**: This is the aggregate goal that depends on P1 and P2 completion. Ensures the project meets defined quality standards.

**Independent Test**: Can be verified by running `npm run test:coverage` and checking the summary report.

**Acceptance Scenarios**:

1. **Given** all modules have improved coverage, **When** the full test suite runs, **Then** total line coverage is 75%+
2. **Given** all conditional branches are tested, **When** coverage is measured, **Then** branch coverage is 65%+
3. **Given** the CI pipeline runs, **When** coverage thresholds are checked, **Then** the build passes without coverage warnings

---

### Edge Cases

- What happens when tests fail to achieve target coverage for a specific module?
- How does the system handle coverage measurement for files with no testable code?
- What if coverage tools report different metrics across different runs?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tests MUST cover all public methods in the Gateway class
- **FR-002**: Tests MUST cover all error handling branches in message routing
- **FR-003**: Tests MUST cover CLI channel input parsing and output formatting
- **FR-004**: Tests MUST cover API channel HTTP request/response handling
- **FR-005**: Tests MUST cover Web channel WebSocket connection lifecycle
- **FR-006**: Tests MUST cover Feishu channel message parsing and response sending
- **FR-007**: Tests MUST cover session creation, retrieval, and cleanup logic
- **FR-008**: Tests MUST cover agent registration and lifecycle management
- **FR-009**: Tests MUST include edge cases for each covered module
- **FR-010**: Tests MUST be maintainable and follow existing test patterns in the project

### Key Entities

- **Test Suite**: Collection of test files organized by module, using Vitest framework
- **Coverage Report**: Generated report showing line, branch, function, and statement coverage percentages
- **Coverage Target**: Defined thresholds (75% total, 65% branches, 70% Gateway)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Total test coverage reaches 75% or higher as measured by Vitest coverage reporter
- **SC-002**: Branch coverage reaches 65% or higher across all modules
- **SC-003**: Gateway class coverage reaches 70% or higher
- **SC-004**: All channel modules (CLI, API, Web, Feishu) reach at least 60% coverage
- **SC-005**: All new tests pass without introducing regressions in existing tests
- **SC-006**: Coverage improvements are achieved without sacrificing test quality or readability

## Assumptions

- Existing test infrastructure (Vitest) is sufficient and does not need major changes
- Coverage measurements are consistent using the project's current configuration
- Tests will follow the existing patterns found in `tests/` directory
- Mock strategies for external dependencies (LLM API calls, file system) will follow existing conventions