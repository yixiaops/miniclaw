/**
 * @fileoverview CLI 命令处理模块
 * @module channels/cli-commands
 * @author Miniclaw Team
 * @created 2026-03-11
 */

import { globalLifecycle } from '../core/lifecycle.js';
import type { MiniclawAgent } from '../core/agent/index.js';

/**
 * CLI 命令定义
 */
export interface CliCommand {
  /** 命令名称（不含 /） */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令处理函数 */
  handler: (args: string, agent?: MiniclawAgent) => Promise<void> | void;
}

/**
 * 支持的 CLI 命令列表
 */
export const CLI_COMMANDS: Record<string, CliCommand> = {
  exit: {
    name: 'exit',
    description: '退出应用',
    handler: async () => {
      await globalLifecycle.shutdown();
    }
  },
  quit: {
    name: 'quit',
    description: '退出应用',
    handler: async () => {
      await globalLifecycle.shutdown();
    }
  },
  help: {
    name: 'help',
    description: '显示帮助信息',
    handler: () => {
      console.log('\n可用的命令:');
      console.log('  /exit, /quit  - 退出应用');
      console.log('  /help         - 显示帮助信息');
      console.log('  /reset        - 重置对话');
      console.log('  /model [name] - 查看或切换模型');
      console.log('  /clear        - 清屏');
      console.log('');
    }
  },
  reset: {
    name: 'reset',
    description: '重置对话',
    handler: (_args: string, agent?: MiniclawAgent) => {
      if (agent) {
        agent.reset();
        console.log('对话已重置');
      }
    }
  },
  model: {
    name: 'model',
    description: '查看或切换模型',
    handler: (args: string, agent?: MiniclawAgent) => {
      if (agent) {
        const modelConfig = agent.getModelConfig();
        if (args.trim()) {
          // 切换模型
          const newModel = args.trim();
          agent.setModel(newModel);
          console.log(`模型已切换为: ${newModel}`);
        } else {
          // 显示当前模型
          console.log(`当前模型: ${modelConfig.model}`);
          console.log(`Provider: ${modelConfig.provider}`);
          console.log(`API: ${modelConfig.baseUrl}`);
        }
      }
    }
  },
  clear: {
    name: 'clear',
    description: '清屏',
    handler: () => {
      console.clear();
    }
  }
};

/**
 * 处理 CLI 命令
 * 
 * @param input - 用户输入
 * @param agent - Agent 实例（可选，用于某些命令）
 * @returns 是否是有效命令（true 表示已处理，false 表示不是命令）
 * 
 * @example
 * ```ts
 * const isCommand = await handleCliCommand('/exit');
 * if (!isCommand) {
 *   // 当作普通消息处理
 *   await agent.chat(input);
 * }
 * ```
 */
export async function handleCliCommand(input: string, agent?: MiniclawAgent): Promise<boolean> {
  // 检查是否是命令（以 / 开头）
  if (!input.startsWith('/')) {
    return false;
  }

  // 解析命令和参数
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const commandName = spaceIndex > 0 
    ? trimmed.slice(1, spaceIndex).toLowerCase() 
    : trimmed.slice(1).toLowerCase();
  const args = spaceIndex > 0 ? trimmed.slice(spaceIndex + 1) : '';

  // 查找命令
  const command = CLI_COMMANDS[commandName];

  if (command) {
    await command.handler(args, agent);
    return true;
  }

  // 未知命令
  console.log(`未知命令: /${commandName}`);
  console.log('输入 /help 查看可用命令');
  return true;
}