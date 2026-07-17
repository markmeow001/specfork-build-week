# SpecFork 專案進度報告

更新日期：2026-07-16（America/Vancouver）

## 1. 專案定位

SpecFork 是一個為 AI 輔助軟體開發設計的需求歧義測試工具。

核心命題：

> 程式碼可以通過測試，但團隊可能仍然實作了不同的產品。

SpecFork 會把同一張產品需求交給三個獨立解讀，建立三份合理但互不相容的行為合約，執行測試並比較可觀察結果。如果三個分支都通過自己的測試，卻產生不同結果，系統會顯示：

```text
CODE STATUS: GREEN
SPEC STATUS: RED
```

接著，SpecFork 只提出一個資訊價值最高的澄清問題，讓需求收斂成可交給 coding agent 的明確規格。

## 2. 專案位置與開源狀態

專案是一個全新、獨立建立的 repository，沒有使用原本的 AI Social Trend Platform：

```text
/Users/joshhung/Documents/specfork-build-week
```

目前已加入 MIT License，可以公開開源。

目前公開交付：

- GitHub：https://github.com/markmeow001/specfork-build-week
- Demo：https://specfork-build-week.holykinds.chatgpt.site
- Repository 已採 MIT License 並公開；
- 公開 Demo 刻意不設定 `OPENAI_API_KEY`，完整流程使用明確標示的 Demo Mode。

## 3. 已完成的產品流程

目前網站已完成以下互動閉環：

1. 使用者輸入產品 ticket。
2. GPT-5.6 或 Demo Mode 產生三個合理但互相衝突的解讀。
3. 顯示三個分支的意圖、行為、合約與分歧點。
4. 顯示 `CODE GREEN / SPEC RED`。
5. 執行受控 behavior probes，比較三個分支的實際結果。
6. 顯示真實 Git worktree 與 hardened container 的執行證據。
7. 提出一個澄清問題。
8. 使用者選擇答案後，產生收斂規格與 `SPEC GREEN`。

網站支援：

- Desktop 與 mobile responsive layout；
- 無 API Key 的完整 Demo Mode；
- 有 API Key 時的 GPT-5.6 Responses API 分析；
- Live Model 與 Demo Mode 的清楚標示；
- 複製 resolved spec；
- 伺服器端 API Key，瀏覽器不接觸憑證。

## 4. 已完成的真實 Git Worktree Runner

本機 Runner 會：

1. 建立臨時 Git repository。
2. 建立三個獨立 worktree 與 branch。
3. 將三份通過政策的 patch 分別寫入三個 worktree。
4. 產生各自的 commit SHA。
5. 計算每份 patch 的 SHA-256。
6. 在獨立容器中執行合約測試與共同 behavior probes。
7. 記錄每個分支的輸出、耗時與衝突。
8. 執行完成後刪除臨時 repository 與 containers。

目前可信任 fixture 的三個實作分別代表：

- Agent A：匯出所有可存取資料，CSV、忽略 filter、立即下載。
- Agent B：匯出目前 filtered results，CSV、保留 filter、大型資料改用 background job。
- Agent C：匯出畫面可見報表，PDF、包含 charts、先顯示 preview。

三個分支都能通過自己的合約，但共同 probes 會發現 10 個可觀察衝突（衝突清單由 Runner 逐欄比對三個分支的實際輸出即時推導，並非寫死；涵蓋 normal 與 large 兩種情境下的 scope、format、filter、delivery、includesCharts）。

## 5. Hardened Container 安全邊界

每次執行 patch 的 container 都套用：

- 官方 Node 22 Alpine image，使用固定 digest；
- `--network none`；
- 清空 HTTP、HTTPS 與 ALL proxy variables；
- read-only root filesystem；
- read-only source mount；
- drop all Linux capabilities；
- `no-new-privileges`；
- 0.5 CPU；
- 96 MB container memory；
- 64 MB Node heap；
- 64 PIDs；
- 5 秒 host timeout；
- credential-free temporary HOME；
- `finally` 強制刪除逾時 container。

負向安全測試已實際確認：

- 無法寫入 source mount；
- 無法寫入 container root filesystem；
- 無法連線外部 HTTPS；
- effective Linux capabilities 為零；
- `no-new-privileges` 為 1；
- 無限迴圈 patch 會被終止；
- 逾時後沒有 SpecFork container 殘留。

## 6. Model Patch Gate

模型產生的 patch 在執行前必須通過伺服器端與本機 Runner 的雙重檢查。

目前政策：

- 只能修改 `export-service.mjs`；
- 最大 5,000 UTF-8 bytes；
- 必須提供 `exportReport` 合約；
- 只能 import `./report-data.mjs`；
- 禁止 filesystem；
- 禁止 process 與 environment access；
- 禁止 network access；
- 禁止 `eval`、`Function` 與 dynamic import；
- 禁止 `require`；
- 禁止 global constructor 技巧。

惡意測試已確認會拒絕：

- 路徑跳脫，例如 `../server.mjs`；
- `node:fs`；
- `process.env`；
- 非白名單 import；
- 以 unicode escape 混淆的識別碼，例如 `eval`（會被標記 `obfuscated-source`）；
- 以別名繞過的裸引用，例如 `const p = process`。

即使有人在輸入 JSON 偽造 `accepted: true`，本機 Runner 仍會重新執行政策檢查。

**信任邊界說明（重要）**：這個 patch gate 是**針對意外與粗糙嘗試的快速前置過濾器，不是安全邊界**。任何以原始碼字串比對為基礎的 denylist，原則上都可能被有決心的攻擊者繞過。真正隔離不可信任程式碼的是**強化容器**（`--network none`、read-only、`--cap-drop ALL`、非 root、digest-pinned image），這才是唯一的信任邊界；不可信任的 patch 只會在容器內執行。伺服器端與 Runner 端共用同一份 gate 實作（`scripts/patch-policy.mjs`），避免兩份邏輯漂移。

## 7. 行為正規化

第一次 Live GPT 執行已成功完成以下階段：

```text
OpenAI API → GPT-5.6 patch → policy gate → worktree → container
```

但第一個 Live patch 使用較完整的回傳格式，例如：

- `rowCount`；
- `mimeType`；
- `filename`；
- `filterApplied`。

舊測試要求內部欄位必須逐字等於 `scope`、`format`、`filter`、`delivery` 與 `includesCharts`，因此出現測試失敗。這是測試過度綁定內部資料格式，而不是 API Key、OpenAI API、policy gate 或 container 失敗。

目前已加入 observable behavior normalization：

- `rowCount: 4` 可以正規化成 `scope: 4`；
- `mimeType: "text/csv"` 可以正規化成 `format: "csv"`；
- `filterApplied: false` 可以正規化成 `filter: "ignored"`；
- `filename` 或 download signal 可以正規化成交付方式。

真正的 scope、format、filter、delivery 或 chart behavior 不一致仍然會失敗。

修正後，Demo fixture、完整 build、整合測試與無限迴圈清理測試均已通過。

## 8. Live GPT 目前進度

目前精確狀態：

- OpenAI API Key 已由使用者設定；
- OpenAI HTTPS 連線成功；
- GPT-5.6 成功回傳三份 patch；
- patch 通過安全政策；
- Live patch 成功進入 worktree 與 hardened container；
- 第一次執行因舊版欄位格式測試失敗；
- 行為正規化修正已完成並通過 Demo 驗證；
- **2026-07-17 修正後的 Live GPT 完整鏈路已重新執行成功。**

最新 Live Run 可確認：

- `status: completed`、`source: gpt-5.6`；
- 3/3 model patches 通過 policy gate，0 rejected；
- 三個 patch 分別寫入獨立 Git worktree 並產生 commit 與 SHA-256；
- 三個 hardened containers 的 contract tests 全部通過；
- 共推導出 10 個 observable conflicts；
- containers 使用 network disabled、read-only root、all capabilities dropped、
  `no-new-privileges` 與既定 CPU／memory／PID／timeout 限制。

重新驗證指令：

```bash
cd "/Users/joshhung/Documents/specfork-build-week"
set -a
source .env.local
set +a
npm run demo:agent-runner
```

成功條件：

```json
{
  "status": "completed",
  "source": "gpt-5.6"
}
```

## 9. 目前驗證結果

目前已通過：

- production build；
- lint，零警告；
- `npm test` 共 16 個 automated tests；
- 3 個本機 Git worktree tests；
- 3 個 hardened container contract tests；
- sandbox boundary attack test；
- malicious patch rejection test；
- infinite-loop timeout and cleanup test；
- 修正後的 GPT-5.6 Live patch → gate → worktree → container 完整鏈路。

常用驗證指令：

```bash
npm test
npm run lint
npm run verify:sandbox
npm run test:sandbox
npm run verify:runner-timeout
npm run demo:agent-runner
```

## 10. 尚未完成的範圍

以下功能目前沒有完成，也不應向評審表示已完成：

- 任意 GitHub repository 輸入；
- clone 或執行不可信任 repository；
- dependency allowlist 與 lockfile intake policy；
- secret scanning；
- remote disposable runner infrastructure；
- remote Codex coding agents；
- GitHub、Linear 或 Jira integration；
- 自動建立 Pull Request；
- accounts、billing 與 persistent projects；

目前唯一可執行 repository 是專案內附的 trusted reports-export fixture。

## 11. 建議下一步

### P0：完成一次修正後的 Live Run（已完成）

`npm run demo:agent-runner` 已確認輸出同時包含：

- `status: completed`；
- `source: gpt-5.6`；
- OpenAI request ID；
- 3 個 accepted patches；
- 3 個 branch commit SHA；
- 3 個 patch SHA-256；
- 3 個 passed contract results；
- 10 個 observable conflicts（由 Runner 逐欄比對三分支輸出即時推導）。

### P1：GitHub 與開源交付（已完成）

- 已建立並推送公開 GitHub repository；
- 已確認 MIT License、README 安裝流程與 `.env.local` ignore；
- 已確認 production build 不包含本機 OpenAI Key；
- architecture 與 threat-model 圖可作為提交素材的後續加強項。

### P2：評審 Demo

- 已部署並實測可操作的公開網站；
- 錄製 90 秒至 3 分鐘 Demo；
- 展示 `CODE GREEN / SPEC RED`；
- 展示 Live GPT patch、policy gate、worktree、container 與行為衝突；
- 回答一個澄清問題並顯示規格收斂；
- 在 README 與影片清楚區分 Live、Demo 與 Recorded Evidence。

## 12. 一句話總結目前做到哪裡

SpecFork 已經從概念展示進展成一個具備 GPT-5.6 Live patch generation、真實 Git worktrees、模型 patch 安全閘門、hardened Docker execution、行為比較、公開 Demo 與規格收斂的可執行開發者工具；目前主要剩餘工作是製作評審影片與提交素材，而不是補核心技術鏈路。
