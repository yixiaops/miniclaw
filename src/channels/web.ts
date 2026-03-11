/**
 * WebChat 通道
 * Web 前端界面 + WebSocket 实时通信
 */
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import type { MiniclawAgent } from '../core/agent/index.js';
import type { Config } from '../core/config.js';

/**
 * WebChat 通道类
 */
export class WebChannel {
  private agent: MiniclawAgent;
  private config: Config;
  private app: express.Application;
  private server: any;
  private io: SocketIOServer | null = null;
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
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 主页
    this.app.get('/', (req: Request, res: Response) => {
      res.send(this.getHtmlPage());
    });

    // API: 发送消息
    this.app.post('/api/chat', async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'message is required' });
        }

        const response = await this.agent.chat(message);
        res.json({ success: true, content: response.content });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });
  }

  /**
   * 获取 HTML 页面
   */
  private getHtmlPage(): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Miniclaw Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #333; margin-bottom: 20px; }
    .chat-container { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); height: 60vh; overflow-y: auto; padding: 20px; }
    .message { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; max-width: 80%; }
    .user { background: #007aff; color: white; margin-left: auto; }
    .assistant { background: #f0f0f0; color: #333; }
    .input-container { display: flex; gap: 12px; margin-top: 20px; }
    input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    button { padding: 12px 24px; background: #007aff; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 Miniclaw</h1>
    <div class="chat-container" id="chat"></div>
    <div class="input-container">
      <input type="text" id="input" placeholder="输入消息..." />
      <button onclick="sendMessage()">发送</button>
    </div>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    
    function addMessage(content, isUser) {
      const div = document.createElement('div');
      div.className = 'message ' + (isUser ? 'user' : 'assistant');
      div.textContent = content;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }
    
    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;
      
      addMessage(message, true);
      input.value = '';
      
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const data = await res.json();
        addMessage(data.content || data.error, false);
      } catch (err) {
        addMessage('请求失败: ' + err.message, false);
      }
    }
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>`;
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
      this.server = createServer(this.app);
      
      // 初始化 Socket.IO
      this.io = new SocketIOServer(this.server, {
        cors: { origin: '*' }
      });

      // WebSocket 连接处理
      this.io.on('connection', (socket) => {
        console.log('WebSocket 连接:', socket.id);

        socket.on('chat', async (message: string) => {
          try {
            const response = await this.agent.chat(message);
            socket.emit('response', response.content);
          } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Unknown error');
          }
        });

        socket.on('disconnect', () => {
          console.log('WebSocket 断开:', socket.id);
        });
      });

      this.server.listen(
        this.config.server.port,
        this.config.server.host,
        () => {
          this.running = true;
          console.log(`WebChat 已启动: http://${this.config.server.host}:${this.config.server.port}`);
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
      if (this.io) {
        this.io.close();
      }
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
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }
}