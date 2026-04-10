/**
 * 内容搜索工具
 * 基于 ripgrep (rg) 的内容搜索
 */
import { execSync } from 'child_process';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const GrepParamsSchema = Type.Object({
  pattern: Type.String({ description: '搜索的正则表达式模式' }),
  path: Type.Optional(Type.String({ description: '搜索路径，默认当前工作目录' })),
  output_mode: Type.Optional(Type.Union([
    Type.Literal('content'),
    Type.Literal('files_with_matches'),
    Type.Literal('count')
  ], { description: '输出模式: content(显示内容), files_with_matches(仅文件名), count(计数)' })),
  '-i': Type.Optional(Type.Boolean({ description: '忽略大小写' })),
  '-n': Type.Optional(Type.Boolean({ description: '显示行号' })),
  glob: Type.Optional(Type.String({ description: '文件过滤模式，如 *.ts' })),
  head_limit: Type.Optional(Type.Number({ description: '限制输出数量' }))
});

type GrepParams = Static<typeof GrepParamsSchema>;

/**
 * 工具详情类型
 */
export interface GrepDetails {
  pattern: string;
  path?: string;
  matches: number;
}

/**
 * grep 工具定义
 */
export const grepTool = {
  name: 'grep',
  label: '内容搜索',
  description: '使用 ripgrep 搜索文件内容。支持正则表达式、忽略大小写、显示行号等选项。',
  parameters: GrepParamsSchema,

  /**
   * 执行内容搜索
   */
  async execute(
    _toolCallId: string,
    params: GrepParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: GrepDetails }> {
    const {
      pattern,
      path,
      output_mode = 'content',
      '-i': ignoreCase,
      '-n': showLineNumber,
      glob,
      head_limit
    } = params;

    try {
      // 构建 rg 命令参数
      const args: string[] = [];

      // 输出模式
      switch (output_mode) {
        case 'files_with_matches':
          args.push('-l'); // 只显示文件名
          break;
        case 'count':
          args.push('-c'); // 显示计数
          break;
        case 'content':
          // 默认模式，显示内容
          break;
      }

      // 其他选项
      if (ignoreCase) args.push('-i');
      if (showLineNumber) args.push('-n');
      if (glob) args.push('-g', glob);

      // 搜索路径
      const searchPath = path || process.cwd();

      // 构建命令
      const command = `rg ${args.join(' ')} "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`;

      // 执行命令
      const result = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: searchPath
      });

      // 处理输出
      let output = result.trim();

      // 限制输出数量
      if (head_limit && output_mode === 'content') {
        const lines = output.split('\n');
        if (lines.length > head_limit) {
          output = lines.slice(0, head_limit).join('\n') + `\n... (共 ${lines.length} 行，已截断)`;
        }
      }

      // 计算匹配数
      const matchCount = output_mode === 'count'
        ? parseInt(output.split('\n').pop()?.split(':').pop() || '0', 10)
        : output.split('\n').length;

      return {
        content: [{ type: 'text', text: output || '未找到匹配内容' }],
        details: {
          pattern,
          path,
          matches: matchCount
        }
      };
    } catch (err) {
      // rg 没有匹配时返回退出码 1，但这不是错误
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Command failed') || errorMsg.includes('non-zero exit code')) {
        return {
          content: [{ type: 'text', text: '未找到匹配内容' }],
          details: { pattern, path, matches: 0 }
        };
      }
      return {
        content: [{ type: 'text', text: `内容搜索失败: ${errorMsg}` }],
        details: { pattern, path, matches: 0 }
      };
    }
  }
};