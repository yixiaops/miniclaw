/**
 * @fileoverview 敏感信息检测实现
 *
 * 检测并过滤敏感信息，防止隐私泄露。
 *
 * @module memory/write/sensitive-detector
 */

/**
 * 敏感信息模式
 */
interface SensitivePattern {
  /** 模式名称 */
  name: string;
  /** 正则表达式 */
  pattern: RegExp;
  /** 描述 */
  description: string;
}

/**
 * 敏感信息检测器
 *
 * 检测密码、密钥、Token 等敏感信息。
 *
 * @example
 * ```ts
 * const detector = new SensitiveDetector();
 * const isSensitive = detector.detect('My password is secret123');
 * ```
 */
export class SensitiveDetector {
  /** 敏感信息模式列表 */
  private patterns: SensitivePattern[];
  /** 最后检测到的原因 */
  private lastReason: string = '';

  /**
   * 创建敏感信息检测器
   */
  constructor() {
    this.patterns = [
      {
        name: 'password',
        pattern: /password\s*(?:[=:]|is)\s*\S+/i,
        description: '包含密码信息'
      },
      {
        name: 'password-simple',
        pattern: /密码\s*[是为：]\s*\S+/,
        description: '包含密码信息（中文）'
      },
      {
        name: 'api-key',
        pattern: /api[_-]?key\s*[=:]\s*\S+/i,
        description: '包含 API Key'
      },
      {
        name: 'api-key-sk',
        pattern: /sk-[a-zA-Z0-9]{20,}/,
        description: '包含 OpenAI API Key'
      },
      {
        name: 'token',
        pattern: /token\s*[=:]\s*\S+/i,
        description: '包含 Token'
      },
      {
        name: 'bearer-token',
        pattern: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
        description: '包含 Bearer Token'
      },
      {
        name: 'jwt',
        pattern: /eyJ[a-zA-Z0-9\-._~+/]+=*\.(eyJ[a-zA-Z0-9\-._~+/]+=*)\.[a-zA-Z0-9\-._~+/]+=*/,
        description: '包含 JWT Token'
      },
      {
        name: 'aws-key',
        pattern: /AKIA[A-Z0-9]{16}/,
        description: '包含 AWS Access Key'
      },
      {
        name: 'aws-secret',
        pattern: /aws[_-]?secret[_-]?key\s*[=:]\s*\S+/i,
        description: '包含 AWS Secret Key'
      },
      {
        name: 'secret-key',
        pattern: /secret[_-]?key\s*[=:]\s*\S+/i,
        description: '包含 Secret Key'
      },
      {
        name: 'private-key',
        pattern: /private[_-]?key\s*[=:]\s*\S+/i,
        description: '包含 Private Key'
      },
      {
        name: 'ssh-key',
        pattern: /ssh-rsa\s+[a-zA-Z0-9+/=]+/,
        description: '包含 SSH Key'
      },
      {
        name: 'database-url',
        pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^\s]+@[^\s]+/i,
        description: '包含数据库连接字符串'
      },
      {
        name: 'credit-card',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
        description: '包含信用卡号'
      }
    ];
  }

  /**
   * 检测内容是否包含敏感信息
   *
   * @param content - 待检测内容
   * @returns 是否包含敏感信息
   */
  detect(content: string): boolean {
    this.lastReason = '';

    for (const { name, pattern, description } of this.patterns) {
      if (pattern.test(content)) {
        this.lastReason = `${description}（检测到 ${name} 模式）`;
        return true;
      }
    }

    return false;
  }

  /**
   * 获取最后检测到的原因
   *
   * @returns 检测原因
   */
  getReason(): string {
    return this.lastReason;
  }

  /**
   * 获取所有敏感信息模式
   *
   * @returns 模式列表
   */
  getPatterns(): SensitivePattern[] {
    return this.patterns;
  }

  /**
   * 添加自定义模式
   *
   * @param pattern - 自定义模式
   */
  addPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern);
  }
}