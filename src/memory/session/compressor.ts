/**
 * SessionCompressor - Session 消息分层压缩
 */

export interface CompressionConfig {
  maxFullMessages: number; // 完整保留条数（默认 50）
  maxSummaryBatches: number; // 摘要批次数（默认 15）
  batchSize: number; // 每批压缩条数（默认 10）
}

export interface Message {
  role: 'user' | 'assistant' | 'summary';
  content: string;
  metadata?: Record<string, any>;
}

export interface Session {
  messages: Message[];
}

export class SessionCompressor {
  private config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      maxFullMessages: config?.maxFullMessages ?? 50,
      maxSummaryBatches: config?.maxSummaryBatches ?? 15,
      batchSize: config?.batchSize ?? 10,
    };
  }

  async compress(session: Session): Promise<Session> {
    const messages = session.messages;

    if (messages.length <= this.config.maxFullMessages) {
      return session;
    }

    // 保留最近 50 条
    const fullMessages = messages.slice(-this.config.maxFullMessages);
    // 压缩旧消息
    const oldMessages = messages.slice(0, -this.config.maxFullMessages);
    const summaries = await this.compressBatches(oldMessages);

    // 限制摘要数量
    const limitedSummaries = summaries.slice(-this.config.maxSummaryBatches);

    return { messages: [...limitedSummaries, ...fullMessages] };
  }

  async compressBatches(messages: Message[]): Promise<Message[]> {
    const summaries: Message[] = [];

    for (let i = 0; i < messages.length; i += this.config.batchSize) {
      const batch = messages.slice(i, i + this.config.batchSize);
      summaries.push({
        role: 'summary',
        content: `Summary of messages ${i + 1}-${i + batch.length}`,
        metadata: { compressedFrom: batch.length },
      });
    }

    return summaries;
  }
}