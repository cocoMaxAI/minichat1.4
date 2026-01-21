
# minichat1.1

基于微信小程序云开发构建的轻量级聊天小程序，覆盖聊天会话、好友管理、消息收发等核心社交场景，同时可作为微信云开发快速上手的实践项目。

## 项目介绍

minichat1.4 依托微信小程序云开发的三大核心能力（**云数据库**、**云存储**、**云函数**）实现，无需搭建独立服务器，天然支持微信用户身份鉴权。

### 核心功能

- 微信登录 & 用户信息管理
- 好友申请 / 同意 / 删除
- 聊天会话创建 & 消息收发 / 撤回
- 图片 / 文本消息支持（基于云存储实现文件管理）
- 聊天列表 / 好友列表 / 申请列表查询

---

## 环境准备

### 1. 基础工具

| 工具 | 说明 | 获取方式 |
|------|------|----------|
| 微信开发者工具 | 稳定版，建议 v1.06 及以上 | [下载地址](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) |
| 微信小程序账号 | 需开通云开发权限 | [小程序注册](https://mp.weixin.qq.com/wxopen/waregister?action=step1) |

### 2. 云开发环境创建

1. 登录微信开发者工具，进入「云开发」控制台
2. 创建新的云开发环境（记录「环境ID」，后续配置用）
3. 环境默认配置即可，无需额外修改

---

## 快速上手

### 1. 导入项目

1. 克隆/下载本仓库代码到本地
2. 打开微信开发者工具，选择「导入项目」，填写小程序 AppID，选择本地代码目录
3. 确认 `project.config.json` 中 `cloudfunctionRoot` 字段为 `cloudfunctions/`

### 2. 配置云环境ID

编辑 `miniprogram/envList.js` 文件：

```javascript
module.exports = {
  envList: [
    {
      envId: "your-env-id", // 替换为实际云环境ID
      alias: "minichat1.4"
    }
  ]
}
```

编辑 `miniprogram/app.js` 中云环境初始化代码：

```javascript
wx.cloud.init({
  env: "your-env-id", // 与 envList.js 一致
  traceUser: true
});
```

### 3. 部署云函数

**方式1：手动部署（推荐入门）**

1. 右键点击 `cloudfunctions/` 目录下的单个云函数
2. 选择「上传并部署：云端安装依赖」
3. 所有云函数部署完成后，即可运行小程序

**方式2：脚本批量部署**

```bash
chmod +x uploadCloudFunction.sh
./uploadCloudFunction.sh
```

### 4. 运行小程序

1. 在微信开发者工具中点击「编译」预览小程序
2. 首次运行需授权登录，登录后即可体验所有功能

---

## 目录结构

### 根目录

| 文件/目录 | 功能说明 |
|-----------|----------|
| `.gitignore` | Git忽略规则 |
| `README.md` | 项目说明文档 |
| `project.config.json` | 小程序全局公共配置 |
| `project.private.config.json` | 小程序私有配置（无需提交到仓库） |
| `uploadCloudFunction.sh` | 云函数批量上传部署脚本 |

### 小程序前端（miniprogram/）

| 文件/目录 | 功能说明 |
|-----------|----------|
| `app.js` / `app.json` / `app.wxss` | 全局逻辑、页面路由配置、全局样式 |
| `components/` | 自定义组件目录 |
| `envList.js` | 云环境配置文件 |
| `images/` | 静态资源目录 |
| `pages/` | 业务页面目录 |
| `utils/` | 工具类封装 |
| `sitemap.json` | 小程序索引配置 |

### 云函数后端（cloudfunctions/）

| 云函数名称 | 功能说明 |
|------------|----------|
| `login` | 小程序登录鉴权，获取微信用户 openid，初始化用户信息 |
| `updateUserInfo` | 更新用户个人信息（昵称、头像、个性签名） |
| `searchUsers` | 搜索用户（支持按昵称/微信号搜索） |
| `sendFriendRequest` | 发送好友申请 |
| `getFriendRequests` | 查询用户收到的好友申请 |
| `handleFriendRequest` | 处理好友申请（同意/拒绝） |
| `getFriends` | 查询用户已添加的好友列表 |
| `deleteFriend` | 删除好友 |
| `createChat` | 创建聊天会话 |
| `getChatList` | 查询用户所有聊天会话 |
| `sendMessage` | 发送聊天消息（文本/图片） |
| `getMessages` | 查询指定聊天会话的历史消息（支持分页） |
| `recallMessage` | 撤回消息 |
| `convertTempUrl` | 临时文件链接转永久链接 |
| `quickstartFunctions` | 云开发快速启动示例 |

---

## 核心功能说明

### 用户模块

- 基于微信登录态自动完成用户注册/登录，无需额外账号体系
- 支持用户信息修改（昵称、头像、个性签名）
- 基于 openid 唯一标识用户

### 好友模块

- **搜索用户**：通过 `searchUsers` 云函数实现用户检索
- **好友申请**：`sendFriendRequest` 发起申请，`getFriendRequests` 查询申请，`handleFriendRequest` 处理申请
- **好友管理**：`getFriends` 查询好友，`deleteFriend` 删除好友

### 聊天模块

- **会话创建**：`createChat` 创建单聊会话
- **消息收发**：`sendMessage` 发送文本/图片消息，`getMessages` 加载历史消息
- **消息撤回**：`recallMessage` 修改消息状态
- **聊天列表**：`getChatList` 按会话最后消息时间排序

---

## 注意事项

1. **云环境权限**
   - 云数据库集合（`users`/`chats`/`messages`/`friendRequests`）默认权限为「仅创建者可读写」，避免修改为「所有用户可读」
   - 云存储文件权限建议设置为「仅创建者可读写」

2. **云函数依赖**
   - 所有云函数需确保安装 `wx-server-sdk` 依赖
   - 部署时选择「云端安装依赖」自动处理
   - 本地调试需执行 `npm install wx-server-sdk`

3. **消息存储**
   - 聊天消息存储在云数据库 `messages` 集合
   - 建议根据业务需求添加消息分页/过期清理逻辑

4. **跨环境兼容**
   - `envList.js` 支持多环境配置
   - 开发/生产环境需分别配置对应云环境ID

---

## License

Copyright © 2012-2026 Tencent. All Rights Reserved.