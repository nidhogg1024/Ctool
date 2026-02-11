# Ctool - 程序开发常用工具（增强版）

基于 [baiy/Ctool](https://github.com/baiy/Ctool) 的增强维护版本，持续修复社区反馈的问题并添加新功能。

原项目近一年更新极少（2025 年仅 2 次 commit），100+ issue 处于无人处理状态。本仓库积极响应社区需求，保持活跃更新。

**在线体验**：https://nidhogg1024.github.io/Ctool/

使用过程中的任何问题或需要新工具，欢迎提交 [Issue](https://github.com/nidhogg1024/Ctool/issues)

## 相比原版的增强

### 新增工具
- **Chmod 权限计算器** — 可视化勾选矩阵生成八进制权限（rwx ↔ 755）
- **密码生成器** — 自定义字符集、长度、批量生成，密码强度可视化
- **User-Agent 解析器** — 解析浏览器、操作系统、设备、引擎信息
- **Stacktrace 格式化** — 支持 Java/Python/JS/Go/C#/Ruby/PHP/Rust 等多语言堆栈解析，自动从 JSON 日志（GCP 等）提取堆栈和元信息，Sentry 风格 UI
- **配置格式互转** — 10 种格式一键互转（JSON/YAML/TOML/XML/CSV/Properties/HTML Table/Query String/PHP Array/PHP Serialize）
- **JSON Transform** — 用 JavaScript + lodash 表达式对 JSON 数据做变换（groupBy、sortBy、filter 等）
- **IPv4 反掩码输入** — 支持直接输入通配符掩码（反掩码），自动转换为子网掩码计算
- **URL 全字符编码** — 对所有字符（含未保留字符）进行百分号编码
- **Base58 编码/解码** — 新增 Base58 工具
- **多行数字统计** — 多行数字求和、平均值等
- **SQL 具名参数填充** — 支持 `:name` 风格的具名参数

### 改进
- **JSON 工具 UX 重构** — 转实体类改为内联面板，语言按热门程度分层展示；新增格式转换快捷跳转
- **工具分类重构** — 7 个语义化分类（加密/安全、编解码、数据处理、文本工具、网络/Web、开发辅助、生成器），消灭"其他"分类和工具重复
- **randomString 安全性提升** — 底层换用 `crypto.getRandomValues()`
- **构建版本号自动化** — 从 Git tag 自动获取，无需手动维护
- 时区选择器支持搜索过滤
- 文本对比语言选择可搜索
- 界面缩放设置，适配不同显示器和浏览器缩放
- 网络带宽换算
- 升级 Tauri v1 → v2，支持 macOS 26（Tahoe）

### Bug 修复
- CRC16 Modbus 校验结果字节序错误
- 正则表达式「常用」选择覆盖而非追加
- Base64 解码不兼容 URL 编码的输入
- JSON 压缩多出空格、转义格式化出错
- 解密工具缺少 Hex 输出格式
- 时间戳/时区页面崩溃、日期计算精度问题
- 进制转换大写十六进制输入失败
- PHP array() 语法转 JSON 不支持

## 先睹为快

![](images/v2.0.0.png)

## 安装使用

### 在线版

https://nidhogg1024.github.io/Ctool/

### 桌面客户端（macOS / Windows）

- [点击下载](https://github.com/nidhogg1024/Ctool/releases)

> **macOS 用户注意**：首次打开可能提示"已损坏，无法打开"，这是因为应用未经 Apple 签名。请在终端执行以下命令后重新打开：
>
> ```bash
> # DMG 文件（下载后执行）
> xattr -cr ~/Downloads/ctool_tauri_mac_arm64.dmg
>
> # 如果安装到 Applications 后仍提示，再执行
> xattr -cr /Applications/ctool.app
> ```

### 浏览器扩展

原版扩展商店链接（由原作者维护，不含增强功能）：

- [Chrome 应用商店](https://chrome.google.com/webstore/detail/ipfcebkfhpkjeikaammlkcnalknjahmh)
- [微软 Edge 应用商店](https://microsoftedge.microsoft.com/addons/detail/cihekagpnnadjjplgljkmkpcfiopfplc)
- [火狐 Firefox 应用商店](https://addons.mozilla.org/zh-CN/firefox/addon/ctool/)

> 增强版浏览器扩展可从 [Releases](https://github.com/nidhogg1024/Ctool/releases) 下载 zip 文件手动加载

## 开发

```bash
# 安装依赖
pnpm install

# 开发调试
pnpm run dev

# 编译核心文件
pnpm run build

# 打包桌面端（需要 Rust 环境，无法交叉编译，请在对应操作系统下运行）
pnpm --filter ctool-adapter-tauri run platform-release

# 打包浏览器扩展
pnpm --filter ctool-adapter-chrome run platform-release
pnpm --filter ctool-adapter-edge run platform-release
pnpm --filter ctool-adapter-firefox run platform-release
```

> 打包文件存放位置: `/_release`

## 更新日志

详见 [Releases](https://github.com/nidhogg1024/Ctool/releases)

## 功能列表

| 分类 | 功能 | 说明 | 离线 |
|------|------|------|:----:|
| **加密/安全** | 哈希 | `md5`, `sha1`, `sha256`, `sha512`, `sm3`, 批量处理, 支持文件 | √ |
| | HMAC | `md5`, `sha1`, `sha256`, `sha512` | √ |
| | 加密/解密 | `AES`, `DES`, `RC4`, `Rabbit`, `TripleDes`, `sm2`, `sm4` | √ |
| | RSA | 公钥加密, 私钥解密 | √ |
| | 签名/验签 | 数字签名验证 | √ |
| | Bcrypt | 加密, 验证 | √ |
| | 密码生成器 | 自定义字符集, 强度可视化, 批量生成 | √ |
| **编解码** | BASE64 | 编码, 解码, 支持文件 | √ |
| | URL编码 | 编码, 解码, 全字符编码 | √ |
| | Unicode | 双向转换, emoji, html实体, css实体 | √ |
| | JWT | header, payload 解码/编码 | √ |
| | Hex/String | 十六进制 ↔ 字符串 | √ |
| | HTML编码 | 实体编码/解码 | √ |
| | Gzip | 压缩, 解压 | √ |
| | ASN.1 | DER/PEM 结构解析 | √ |
| | Punycode | 编码, 解码 | √ |
| | Base58 | 编码, 解码 | √ |
| **数据处理** | JSON工具 | 格式化, 校验, 压缩, 转义, Transform, JSONPath, 转实体类 | √ |
| | 配置格式互转 | JSON/YAML/TOML/XML/CSV/Properties 等 10 种格式 | √ |
| | 序列化转换 | json, xml, yaml, phpArray, phpSerialize, properties | √ |
| | 进制转换 | 2-64 进制 | √ |
| | ASCII转换 | 十进制, 十六进制, 八进制, 二进制, 字符串 | √ |
| | ARM/HEX | 互转 | × |
| | MongoDB ObjectId | 解析时间戳、机器标识等 | √ |
| **文本工具** | 文本处理 | 大小写, 中英文标点, 简繁转换, 替换, 统计, 去重, 排序 | √ |
| | 汉字转拼音 | 声调, 首字母, 分隔符 | √ |
| | 变量名转换 | camelCase, PascalCase, snake_case, kebab-case 等 | √ |
| | 文本差异对比 | 行, 单词, CSS | √ |
| | 正则表达式 | 匹配, 查找, 替换 | √ |
| | 中文数字 | 阿拉伯数字 ↔ 中文大小写数字 | √ |
| | 代码格式化 | js, ts, html, css, less, scss, graphql, vue, xml, yaml, sql, 压缩 | √ |
| **网络/Web** | IP地址查询 | 运营商, 城市 | × |
| | URL解析 | 协议, 域名, 路径, 参数, 锚点 | √ |
| | WebSocket | 在线调试 | × |
| | HTTP Snippet | cURL/Fetch/Axios/Python 等 HTTP 客户端代码生成 | √ |
| | User-Agent解析 | 浏览器, 操作系统, 设备, 引擎 | √ |
| | Docker Compose | docker run 转 docker-compose | √ |
| **开发辅助** | Crontab | 规则校验, 执行时间预览 | √ |
| | SQL参数填充 | Mybatis 参数填充, 具名参数 | √ |
| | Stacktrace格式化 | Java/Python/JS/Go/C#/Ruby/PHP/Rust, JSON 日志提取 | √ |
| | Chmod计算器 | rwx 勾选矩阵 ↔ 八进制权限 | √ |
| | 数据校验 | BCC, CRC, LRC | √ |
| | 颜色转换 | HEX, RGB, HSL, HSV | √ |
| | 单位换算 | 长度, 面积, 体积, 质量, 温度, 压力, 功率, 速度, 数据存储等 | √ |
| | 时间工具 | 时间戳转换, 时区, 计算器 | √ |
| **生成器** | 二维码 | 生成, 解析 | √ |
| | 条形码 | 生成 | √ |
| | 随机字符串 | 批量, 特殊字符, crypto 安全随机 | √ |
| | UUID | 在线生成 | √ |
| | 原码/反码/补码 | 生成 | √ |
| | IP网络计算器 | 子网掩码换算, 反掩码/通配符输入 | √ |
| | 数字计算器 | 大数计算, 表达式求值 | √ |

## 致谢

感谢原作者 [baiy](https://github.com/baiy) 创建了这个优秀的工具集。
