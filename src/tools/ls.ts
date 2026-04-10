/**
 * 目录列表工具
 * 列出目录内容，显示文件和子目录信息
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const LSParamsSchema = Type.Object({
  path: Type.String({ description: '目录路径（必须绝对路径）' }),
  ignore: Type.Optional(Type.Array(Type.String(), { description: '忽略模式，如 node_modules, .git' }))
});

type LSParams = Static<typeof LSParamsSchema>;

/**
 * 文件/目录信息
 */
interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

/**
 * 工具详情类型
 */
export interface LSDetails {
  path: string;
  count: number;
  files: number;
  directories: number;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * ls 工具定义
 */
export const lsTool = {
  name: 'ls',
  label: '目录列表',
  description: '列出目录内容，显示文件和子目录信息（大小、修改时间）。支持忽略特定目录。',
  parameters: LSParamsSchema,

  /**
   * 执行目录列表
   */
  async execute(
    _toolCallId: string,
    params: LSParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: LSDetails }> {
    const { path, ignore = ['node_modules', '.git', 'dist'] } = params;

    try {
      // 读取目录内容
      const entries = readdirSync(path);

      // 过滤忽略的目录
      const filteredEntries = entries.filter(entry => !ignore.includes(entry));

      // 获取详细信息
      const infos: FileInfo[] = filteredEntries.map(entry => {
        const fullPath = join(path, entry);
        try {
          const stat = statSync(fullPath);
          return {
            name: entry,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.isFile() ? stat.size : undefined,
            modified: formatDate(stat.mtime)
          };
        } catch {
          return {
            name: entry,
            type: 'file' as const
          };
        }
      });

      // 排序：目录在前，文件在后，按名称排序
      infos.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      // 格式化输出
      const lines = infos.map(info => {
        const typeIcon = info.type === 'directory' ? '📁' : '📄';
        const sizeInfo = info.size ? ` (${formatSize(info.size)})` : '';
        const modInfo = info.modified ? ` - ${info.modified}` : '';
        return `${typeIcon} ${info.name}${sizeInfo}${modInfo}`;
      });

      const output = `目录: ${path}\n共 ${infos.length} 项 (${infos.filter(i => i.type === 'directory').length} 目录, ${infos.filter(i => i.type === 'file').length} 文件)\n\n${lines.join('\n')}`;

      return {
        content: [{ type: 'text', text: output }],
        details: {
          path,
          count: infos.length,
          directories: infos.filter(i => i.type === 'directory').length,
          files: infos.filter(i => i.type === 'file').length
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `读取目录失败: ${errorMsg}` }],
        details: { path, count: 0, directories: 0, files: 0 }
      };
    }
  }
};