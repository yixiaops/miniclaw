/**
 * 路径工具函数
 * 处理跨平台路径兼容问题
 */

/**
 * 规范化路径，处理 Git Bash / WSL 风格的 Unix 路径
 *
 * Windows 上 Git Bash 返回的路径格式: /c/Users/xxx
 * 需要转换为 Windows 格式: C:\Users\xxx
 *
 * Linux/macOS 不受影响，路径原样返回
 *
 * @param p - 原始路径字符串
 * @returns 规范化后的路径
 */
export function normalizePath(p: string): string {
  // 仅在 Windows 上启用转换
  if (process.platform !== 'win32') {
    return p;
  }

  // 匹配 Git Bash 风格路径: /X/...  (X 是单字母盘符，紧跟斜杠)
  // Linux /home 不匹配，因为 /h 后是 'ome' 而非 '/'
  const match = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (match) {
    const rest = match[2].replace(/\//g, '\\');
    return `${match[1].toUpperCase()}:\\${rest}`;
  }

  return p;
}
