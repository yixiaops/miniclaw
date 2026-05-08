#!/bin/bash
# PM2 启动脚本 for miniclaw
# 首次运行需要: pm2 install pm2-logrotate

echo "启动 miniclaw..."
pm2 start config/ecosystem.config.cjs

echo "保存 PM2 进程列表..."
pm2 save

echo ""
echo "开机自启设置（仅需运行一次）："
echo "  pm2 startup"
echo "  然后按提示执行生成的命令"