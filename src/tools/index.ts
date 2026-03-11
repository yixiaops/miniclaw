/**
 * Tools 模块入口
 * 导出所有内置工具
 */
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { shellTool } from './shell.js';
import { webFetchTool } from './web-fetch.js';

export { readFileTool, writeFileTool, shellTool, webFetchTool };

/**
 * 获取所有内置工具列表
 */
export function getBuiltinTools() {
  return [
    readFileTool,
    writeFileTool,
    shellTool,
    webFetchTool
  ];
}