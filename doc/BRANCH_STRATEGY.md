# Miniclaw 分支策略

## 概述

本项目采用 **GitHub Flow** 分支策略，适合单人开发、持续迭代的个人项目。

## 分支结构

```
master (主分支，始终可部署)
   │
   ├── feature/xxx  (功能分支)
   │      └── PR → 合并到 master → 删除分支
   │
   └── fix/xxx       (修复分支)
          └── PR → 合并到 master → 删除分支
```

## 分支类型

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能开发 | `feature/add-memory-system` |
| `fix/` | Bug 修复 | `fix/issue-1-write-file-append` |
| `refactor/` | 代码重构 | `refactor/simplify-router` |
| `docs/` | 文档更新 | `docs/update-readme` |
| `test/` | 测试相关 | `test/improve-coverage` |
| `chore/` | 杂项（配置、依赖等） | `chore/update-deps` |

## 工作流程

### 1. 创建分支

```bash
# 确保在 master 且最新
git checkout master
git pull origin master

# 创建新分支
git checkout -b feature/your-feature-name
```

### 2. 开发与提交

```bash
# 开发代码...
git add .
git commit -m "feat: 添加某功能"
```

**提交信息规范（Conventional Commits）：**

| 前缀 | 说明 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档 |
| `refactor:` | 重构 |
| `test:` | 测试 |
| `chore:` | 杂项 |

### 3. 推送并创建 PR

```bash
git push origin feature/your-feature-name
gh pr create --title "feat: 添加某功能" --body "描述..."
```

### 4. 合并后清理

```bash
# PR 合并后，切换回 master
git checkout master
git pull origin master

# 删除本地分支
git branch -d feature/your-feature-name

# 删除远程分支（如果还存在）
git push origin --delete feature/your-feature-name

# 清理过期的远程引用
git fetch --prune
```

## 规则

1. **master 始终可部署** — 主分支保持稳定
2. **从 master 拉取分支** — 所有新分支基于 master
3. **通过 PR 合并** — 不直接推送到 master
4. **合并后删除分支** — 保持分支列表整洁
5. **CI 检查必须通过** — 测试、代码检查、覆盖率

## 分支清理命令

定期清理已合并的分支：

```bash
# 查看所有分支
git branch -a

# 删除本地已合并分支
git branch -d <branch-name>

# 删除远程分支
git push origin --delete <branch-name>

# 批量清理本地已合并分支（排除 master）
git branch --merged master | grep -v '^\*\|master' | xargs -r git branch -d

# 清理远程引用
git fetch --prune
```

## 常见问题

### Q: 分支名太长怎么办？
A: 使用简短但描述性的名称，如 `feature/memory` 而非 `feature/add-memory-support-for-agents`

### Q: 多个功能同时开发怎么办？
A: 每个功能独立分支，互不影响。合并顺序按优先级。

### Q: 发现合并后有 bug 怎么办？
A: 创建新的 `fix/` 分支修复，不重新打开已合并的分支。

---

*最后更新: 2026-03-23*