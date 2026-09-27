# 进展档案：ANU Schedule Builder（Crit 7）

最后更新：2026-09-27 晚。截止：**2026-09-30（周三）12:00，堪培拉时间**，交付物是部署在 `*.fly.dev` 上的网站。

## 现在的状态

- 代码都在 **`feat/schedule-builder`** 分支上，一共 11 个提交，**还没合并到 `main`，也还没 push**。
- `pnpm check` 全部通过：typecheck 0 错误，139 个测试通过（单元测试 + 对构建产物的 spec 测试 + axe 无障碍检查）。
- **还没提交**：`README.md` 和 `CLAUDE.md` 是草稿，等你审阅。
- 设计文档：`docs/superpowers/specs/2026-09-27-anu-schedule-builder-design.md`
- 实施计划：`docs/superpowers/plans/2026-09-27-anu-schedule-builder.md`（共 8 个任务）

## 已经做完的

### 计划内（Task 1–6）
| 提交 | 内容 |
|---|---|
| `0f441c9` | 删掉 starter 的 guestbook；测试拆成 unit / spec 两组 |
| `5caa7b7` | 解析教学周；生成所有不冲突的组合（冲突判断考虑教学周，最多 500 个） |
| `f89f3ca` | 周视图排版、翻页、空结果的提示、保存内容的校验 |
| `a341837` | 数据库表结构；启动时从 CSSA 的 2026 S2 数据导入 895 门课 |
| `aab4297` | 计划 / 加课 / 保存的接口，带输入校验 |
| `8c68104` | 计划页、周视图、已保存页、示例页、404 页 |

### 你后来提的（Task 6 之后）
| 提交 | 内容 |
|---|---|
| `212a93d` | 视觉改版：对比三个样稿后选了"C 的布局 + A 的配色" |
| `963b19d` | **搜索页**（仿 UMN）：学科 A–Z 目录、按年级筛选；可以搜代码、标题或学科名，比如 "computing" 能找到 COMP |
| `29ab520` | **课程卡片**：介绍、负责人、学分、官方链接；按活动分组列出所有班，每个班可以 **Only / Exclude**，排课时会遵守这些设置 |
| `10b41e8` | **字体**：真正加载 Inter，统一字号比例，调整行距 |
| `99a2ec7` | **UMN 式左侧导航栏**：搜索、我的课程（含班级设置）、课表组合、已保存 |

### 用到的数据文件
- `data/2026-S2.json`：CSSA 抓取的课表，895 门课。
- `data/subjects-2026.json`：89 个学科的名称和开课学院，来自 Programs and Courses，用 `node scripts/fetch-subjects.ts` 重新生成。
- `data/courses-2026.json`：课程介绍、负责人和学分，其中 892 门有介绍；用 `node scripts/fetch-course-info.ts` 重新生成，大约要 15 分钟。

## 过程中做的决定（Ruling）

- **Task 4**：启动时导入数据要等页面第一次访问数据库才会触发，不是一开机就跑。代价：部署后的第一个请求要多花时间解析 2 MB 的 JSON。
- **Task 6**：Astro 压缩 HTML 时会吃掉链接后面的空格，已修，并加了测试。
- **Task 6**：计划页在 375px 宽时被网格撑宽，已修。这类布局问题 jsdom 测不出来，只在浏览器里量过。
- **改版**：窄屏下隐藏的星期全称逃出了滚动容器，把页面撑宽，已修。同样只能在浏览器里验证。
- **搜索**：spec 原本只写了"按代码或标题搜索"，你指出应该做成 UMN 那种学科 + 年级的浏览方式，已补上。
- **课程卡片**：课表数据里没有每个班的授课老师，只能显示课程负责人（convener）。
- **课程卡片**：某个活动的班全被 Exclude 后，现在直接显示"无法排课"。以前这个活动会从课表里悄悄消失。
- **无障碍**：给计划相关页面补上 axe 检查，修了已保存页的标题层级和重复的区域名称。

## 下一步（按顺序）

1. **你审阅 `README.md` 和 `CLAUDE.md` 草稿**，改完我再提交。CLAUDE.md 算分时看的是你自己定的规则，建议认真过一遍。
2. **Task 8：部署到 Fly**，需要你先确认。部署后要在线上验证：加课、保存、刷新后还在。
3. **整个分支审查一次**：派一个新的 reviewer 看完整 diff，修掉 Critical / Important 级别的问题。
4. **合并回 `main`，然后 push**，这一步也需要你确认。
5. **PROCESS.md 和 `reflections/crit-7.md` 由你自己写。**
6. 可选：把 `public/mockups/` 里的样稿删掉。它们已加进 git 排除列表，不会被提交。

## 还没做（第二版候选）

屏蔽时间段、课表排序偏好（最少上课天数、最晚开始、最少空档）、其他学期、导出日历（ICS）。

## 明天接着做时要知道的

- **本地预览**：`pnpm dev --port 4400`，然后打开 http://localhost:4400/ 。4321 端口被别的 node 进程占着。
- Astro 7 的 dev server 是后台守护进程，停掉要用 `pnpm astro dev stop`。
- 测试用的计划：http://localhost:4400/plan/RJOLUn51CJqo1vy0 ，数据在本地 `.data/app.db`。
- 执行记录（ledger）在 `.superpowers/sdd/2026-09-27-anu-schedule-builder/progress.md`，这个目录被 git 忽略，只存在本地。
