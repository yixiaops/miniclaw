#!/bin/bash
cd /root/job/miniclaw

# 检查是否已有飞书进程运行
EXISTING=$(pgrep -f "node.*dist/index.js.*feishu")
if [ -n "$EXISTING" ]; then
    echo "飞书渠道已在运行 (PID: $EXISTING)"
    echo "如需重启，请先执行: kill $EXISTING"
    exit 0
fi

# 启动飞书渠道
node dist/index.js feishu