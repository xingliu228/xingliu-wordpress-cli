# xingliu-wordpress-cli

WordPress REST API 通用命令行工具 — 支持 JWT / Application Password 双认证，多站点随心切换。

## 安装

```bash
npm i -g xingliu-wordpress-cli
```

## 登录

### JWT 认证（推荐 — 需安装插件）

```bash
xingliu-wp login -s https://your-site.com -u admin -p password -n mysite
```

支持插件: [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/) / Simple JWT Login

### Application Password（WP 5.6+ 原生）

```bash
xingliu-wp app-auth -s https://your-site.com -u admin -a "abcd efgh ijkl mnop qrst uvwx" -n mysite
```

## 多站点管理

```bash
# 添加多个站点
xingliu-wp login -s https://site-a.com -u admin -p xxx -n siteA
xingliu-wp login -s https://site-b.com -u admin -p xxx -n siteB

# 列出所有站点
xingliu-wp profiles list

# 切换站点
xingliu-wp profiles use siteA

# 查看当前
xingliu-wp profiles current
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `login` | JWT 登录 |
| `app-auth` | Application Password 登录 |
| `logout` | 登出当前站点 |
| `check` | 检查 Token 状态 |
| `info` | 站点 API 信息 |
| `posts` | 文章管理 (list/get/create/update/delete) |
| `pages` | 页面管理 |
| `media` | 媒体管理 (含上传) |
| `categories` | 分类管理 |
| `tags` | 标签管理 |
| `comments` | 评论管理 |
| `users` | 用户管理 |
| `settings` | 站点设置 |
| `search` | 全站搜索 |
| `profiles` | 多站点配置管理 (list/use/remove/current) |

所有命令支持 `--json` 参数输出原始 JSON。

## 常用示例

```bash
# 列出最近文章
xingliu-wp posts list -n 10

# 搜索
xingliu-wp search "AI" -t post -n 10

# 创建草稿
xingliu-wp posts create -t "测试" --status draft

# 查看分类
xingliu-wp categories list

# JSON 输出
xingliu-wp posts list -n 5 --json | jq .
```

## 配置存储

配置文件保存在 `~/.xingliu-wp/`（Token 本地加密存储，不上传云端）。

## License

MIT
