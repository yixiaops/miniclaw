/**
 * API 通道
 * HTTP REST API 接口
 */
import express, { Request, Response, NextFunction } from 'express';
import type { MiniclawAgent } from '../core/agent/index.js';
import type { Config } from '../core/config.js';

/**
 * API 通道类
 */
export class ApiChannel {
  private agent: MiniclawAgent;
  private config: Config;
  private app: express.Application;
  private server: any = null;
  private running = false;

  constructor(agent: MiniclawAgent, config: Config) {
    this.agent = agent;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 对话接口
    this.app.post('/chat', async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        
        if (!message) {
          res.status(400).json({ error: 'message is required' });
          return;
        }

        const response = await this.agent.chat(message);
        res.json({ 
          success: true, 
          content: response.content 
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // OpenAI 兼容接口
    this.app.post('/v1/chat/completions', async (req: Request, res: Response) => {
      try {
        const { messages, stream } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
          res.status(400).json({ error: 'messages is required' });
          return;
        }

        // 获取最后一条用户消息
        const lastMessage = messages.filter((m: any) => m.role === 'user').pop();
        if (!lastMessage) {
          res.status(400).json({ error: 'No user message found' });
          return;
        }

        const content = typeof lastMessage.content === 'string' 
          ? lastMessage.content 
          : lastMessage.content[0]?.text || '';

        if (stream) {
          // 流式响应
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const response = await this.agent.chat(content);
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: response.content } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          // 非流式响应
          const response = await this.agent.chat(content);
          res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: this.config.bailian.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: response.content
              },
              finish_reason: 'stop'
            }]
          });
        }
      } catch (error) {
        res.status(500).json({ 
          error: { 
            message: error instanceof Error ? error.message : 'Unknown error' 
          } 
        });
      }
    });
  }

  /**
   * 获取 Express app
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(
        this.config.server.port,
        this.config.server.host,
        () => {
          this.running = true;
          console.log(`API 服务器已启动: http://${this.config.server.host}:${this.config.server.port}`);
          resolve();
        }
      );
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.running = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 检查服务器是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }
}