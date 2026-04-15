/**
 * @fileoverview Embedding Service 接口定义
 *
 * 定义向量嵌入服务的核心接口。
 *
 * @module memory/embedding/interface
 */

/**
 * 嵌入向量类型
 */
export type EmbeddingVector = number[];

/**
 * Embedding Service 接口
 */
export interface IEmbeddingService {
  /**
   * 生成单个文本的嵌入向量
   *
   * @param text - 输入文本
   * @returns 嵌入向量
   */
  embed(text: string): Promise<EmbeddingVector>;

  /**
   * 批量生成嵌入向量
   *
   * @param texts - 输入文本数组
   * @returns 嵌入向量数组
   */
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;

  /**
   * 计算两个向量的相似度
   *
   * @param a - 向量 A
   * @param b - 向量 B
   * @returns 相似度（-1 到 1）
   */
  similarity(a: EmbeddingVector, b: EmbeddingVector): number;
}