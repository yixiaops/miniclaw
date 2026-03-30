/**
 * Tools 模块入口
 * 导出所有内置工具
 */
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { shellTool } from './shell.js';
import { webFetchTool } from './web-fetch.js';
import { webSearchTool } from './web-search.js';
import { memorySearchTool } from './memory-search.js';
import { memoryGetTool } from './memory-get.js';

export { readFileTool, writeFileTool, shellTool, webFetchTool, webSearchTool, memorySearchTool, memoryGetTool };

/**
 * 获取所有内置工具列表
 */
export function getBuiltinTools() {
  return [
    readFileTool,
    writeFileTool,
    shellTool,
    webFetchTool,
    webSearchTool,
    memorySearchTool,
    memoryGetTool
  ];
}