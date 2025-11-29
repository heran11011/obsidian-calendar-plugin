[English](./README_EN.md) | **简体中文**

<h1 align="center">Calendar (中文增强版)</h1>

<p align="center">
  专为中文 Obsidian 用户打造的日历插件。<br>
  支持<b>精准汉字计数</b>、<b>自定义满分点数</b>，以及<b>混合统计模式</b>。
</p>

---

## 🌟 为什么会有这个版本？

原版 Calendar 插件是 Obsidian 社区的神器，但它对中文用户不够友好：它只通过空格来计算单词数。这意味着我们写了长篇大论的中文日记，日历上却往往只有可怜的一颗小圆点。

**本插件旨在解决这个问题，并增加了更多人性化的自定义选项。**

## ✨ 核心功能

### 1. 🇨🇳 中文精准计数
不再只是数空格！本插件内置了专门针对中文优化的算法：
- **汉字**：1 个字 = 1 计数。
- **英文/数字**：连续的字母/数字 = 1 计数。
- **智能过滤**：自动忽略标点符号、YAML 文档属性 (`---...---`) 和 Markdown 符号。

### 2. 🎛️ 只有你能定义的“满分”
每个人每天的产出量不同，固定的“5 颗点”满分标准太死板。
- 新增 **"满分点数 (Max Dots)"** 滑块。
- 支持设置 **1 到 10** 颗圆点上限。
- 你可以定义属于自己的“完美一天”。

### 3. 🔄 双模切换
- 在设置面板中，你可以随时开启或关闭“中文精准计数”模式。
- 关闭时，逻辑与原版插件完全一致（无缝兼容）。

---

## 🚀 安装方法

不对不对，下面教的不对，先别弄，等我更新，，，，，，忘记有人可能没用过calender这个插件了，，明天更新

### 方法一：手动安装（推荐方式）
1. 前往 [Releases](https://github.com/heran11011/obsidian-calendar-plugin/releases) 页面。
2. 下载 `main.js`, `manifest.json`, `styles.css` 三个文件。
3. 在你的 Obsidian 库中，进入 `.obsidian/plugins/` 目录。
4. 如果原来你已经使用calende插件，请你直接复制上面的三个文件到calender这个插件，然后粘贴替换原来插件的这三个文件
5. 新建文件夹 `calendar-chinese-enhanced`，将三个文件放入。
7. 重启 Obsidian 并启用。


### 方法二：使用 BRAT 插件 
这是最简单的自动更新方式：
1. 在 Obsidian 社区插件市场安装 **BRAT**。
2. 在 BRAT 设置中点击 `Add Beta plugin`。
3. 输入本仓库地址：`https://github.com/heran11011/obsidian-calendar-plugin`
4. 启用插件即可。


---

## ⚙️ 推荐设置

为了获得最佳体验，建议安装后进行如下设置：

1. **开启中文精准计数**：✅ 开启
2. **Words per dot (每颗点的字数)**：建议设置为 **200** 左右（因为去掉了标点水分，建议比平时设低一点）。
3. **满分点数 (Max Dots)**：
   - 喜欢成就感？设为 **3** 或 **5**。
   - 喜欢记录肝度？设为 **10**。

---

## 🙏 致谢
本插件 Fork 自 [Liam Cain](https://github.com/liamcain) 的杰作 [Calendar Plugin](https://github.com/liamcain/obsidian-calendar-plugin)。感谢原作者的开源精神！
