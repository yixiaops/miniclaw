module.exports = {
  apps: [{
    name: 'miniclaw',
    script: 'dist/index.js',
    args: 'feishu',
    restart_delay: 1000,
    max_restarts: 5,
    max_memory_restart: '500M',
    wait_ready: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: false,
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    env: {
      NODE_ENV: 'production'
    }
  }]
};