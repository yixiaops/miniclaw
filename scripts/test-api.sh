#!/bin/bash
# 启动 miniclaw API 服务并发送测试请求

cd /root/job/miniclaw

# 启动服务
npm run start:api > /tmp/miniclaw-api.log 2>&1 &
API_PID=$!

# 等待服务启动（最多等待 30 秒）
echo "等待 API 服务启动..."
for i in {1..30}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "服务已启动 (第 ${i} 秒)"
    break
  fi
  sleep 1
done

# 发送测试请求
echo ""
echo "=== 测试 1: 重要信息 ==="
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我叫张三，电话是 13812345678", "channel": "test", "userId": "test-user"}' \
  2>&1

echo ""
echo ""
echo "=== 测试 2: 日常对话 ==="
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好，今天天气怎么样", "channel": "test", "userId": "test-user"}' \
  2>&1

# 停止服务
echo ""
echo ""
kill $API_PID 2>/dev/null
echo "服务已停止"

# 显示日志
echo ""
echo "=== 服务日志 ==="
tail -30 /tmp/miniclaw-api.log