/**
 * Tools 模块入口
 * 导出所有内置工具
 */
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { shellTool } from './shell';
import { webFetchTool } from './web-fetch';

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