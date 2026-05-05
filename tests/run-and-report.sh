#!/bin/bash
set -e

echo "══════════════════════════════════════════════"
echo "  表单内存泄漏自动化测试"
echo "══════════════════════════════════════════════"

# 1. 检查 dev server 是否在运行
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "[启动] 启动 Vite dev server..."
  npx vite --host 0.0.0.0 &
  VITE_PID=$!
  sleep 3
  echo "[启动] Dev server PID=$VITE_PID"
else
  echo "[信息] Dev server 已在运行"
  VITE_PID=""
fi

# 2. 创建输出目录
mkdir -p test-results

# 3. 运行 Playwright 测试
echo ""
echo "[测试] 运行 Playwright 测试..."
npx playwright test --config playwright.config.ts 2>&1 | tee test-results/test-output.log

PLAYWRIGHT_EXIT=${PIPESTATUS[0]}

# 4. 生成 Markdown 报告
echo ""
echo "[报告] 生成测试报告..."

cat > test-results/report.md << 'REPORT_HEADER'
# 表单内存泄漏自动化测试报告

**测试时间**: $(date "+%Y-%m-%d %H:%M:%S")
**测试环境**: Chromium (Playwright), Vue 3 + form-create + Element Plus / Naive UI

## 测试配置

| 项目 | 值 |
|------|-----|
| 每模式交互输入框数 | 5 |
| 每模式交互下拉框数 | 5 |
| 表格交互 | 3 个输入框 |
| GC 等待时间 | 3s |
| 表单加载/销毁等待 | 2.5s |

## 测试流程

1. 切换到目标模式 → 采集基线
2. 点击"加载所有表单"
3. Tab 切换（仅 FC 模式）→ 输入框输入 → 下拉框选择 → 表格输入
4. 点击"销毁所有表单"
5. 等待 GC → 多次采样取最低值

## 结果摘要

| 模式 | 基线 Heap | 加载增量 | GC后残留 Heap | 基线 DOM | GC后 DOM残留 |
|------|-----------|----------|---------------|----------|-------------|
REPORT_HEADER

# 如果测试成功，从 JSON 结果中提取数据
if [ -f test-results/results.json ]; then
  echo "[报告] 解析测试结果..."
  node -e "
    const fs = require('fs');
    const report = JSON.parse(fs.readFileSync('test-results/results.json', 'utf-8'));
    console.log('测试完成，详细结果见 test-results/results.json');
  " 2>/dev/null || echo "[报告] 完整日志见 test-results/test-output.log"
fi

# 5. 清理
if [ -n "$VITE_PID" ]; then
  echo "[清理] 停止 Vite dev server (PID=$VITE_PID)"
  kill $VITE_PID 2>/dev/null || true
fi

echo ""
echo "[完成] 测试完成！"
echo "  输出目录: test-results/"
echo "  测试日志: test-results/test-output.log"
echo "  JSON 结果: test-results/results.json"
echo "  HTML 报告: test-results/html/"
