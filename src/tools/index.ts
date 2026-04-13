/**
 * Tools 模块入口
 * 导出所有内置工具和工具过滤功能
 */
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { shellTool } from './shell.js';
import { webFetchTool } from './web-fetch.js';
import { webSearchTool } from './web-search.js';
import { memorySearchTool } from './memory-search.js';
import { memoryGetTool } from './memory-get.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { lsTool } from './ls.js';
import { editTool } from './edit.js';
import { multiEditTool } from './multi-edit.js';

// 导出工具过滤功能
export {
  filterToolsByPolicy,
  resolveEffectiveToolList,
  validateToolNames,
  BUILTIN_TOOL_NAMES,
  type ToolPolicy,
  type FilterStats,
  type EffectiveToolList
} from './filter.js';

export {
  readFileTool,
  writeFileTool,
  shellTool,
  webFetchTool,
  webSearchTool,
  memorySearchTool,
  memoryGetTool,
  globTool,
  grepTool,
  lsTool,
  editTool,
  multiEditTool
};

/**
 * 获取所有内置工具列表
 */
export function getBuiltinTools() {
  return [
    // 核心工具 (P0)
    readFileTool,
    writeFileTool,
    shellTool,
    globTool,
    grepTool,
    lsTool,
    editTool,
    multiEditTool,

    // 重要工具 (P1)
    webFetchTool,
    webSearchTool,
    memorySearchTool,
    memoryGetTool
  ];
}