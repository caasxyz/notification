# 发布到 GitHub Packages 指南

GitHub Packages 是 GitHub 提供的包管理服务，可以免费托管您的私有或公开包。

## 优势

- ✅ **无需额外账号**：使用 GitHub 账号即可
- ✅ **免费额度**：公开仓库完全免费，私有仓库有免费额度
- ✅ **集成紧密**：与 GitHub 仓库权限完全集成
- ✅ **自动认证**：GitHub Actions 中自动可用 GITHUB_TOKEN

## 配置步骤

### 1. 更新 SDK 的 package.json

在 `sdk/package.json` 中添加 publishConfig：

```json
{
  "name": "@caasxyz/notification-sdk",
  "version": "1.0.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

或者为了同时支持 npm 和 GitHub Packages，可以在发布时动态配置。

### 2. 本地发布到 GitHub Packages

#### 获取 Personal Access Token

1. 访问 https://github.com/settings/tokens/new
2. 创建新 token，勾选权限：
   - `write:packages` - 发布包
   - `read:packages` - 读取包
   - `delete:packages` - 删除包（可选）

#### 配置认证

```bash
# 方法 1：创建项目级 .npmrc
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# 方法 2：全局配置
npm login --scope=@caasxyz --registry=https://npm.pkg.github.com
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN
# Email: YOUR_EMAIL
```

#### 发布

```bash
cd sdk
npm publish --registry=https://npm.pkg.github.com
```

### 3. 通过 GitHub Actions 自动发布

使用我创建的 workflow 文件：`.github/workflows/publish-github-packages.yml`

触发方式：
- 创建标签：`git tag sdk-v1.0.0 && git push origin sdk-v1.0.0`
- 手动触发：在 Actions 页面手动运行

**注意**：GitHub Actions 中自动提供 `GITHUB_TOKEN`，无需额外配置！

## 使用发布的包

### 1. 配置认证

在使用包的项目中创建 `.npmrc`：

```bash
# 指定 @caasxyz scope 使用 GitHub Packages
@caasxyz:registry=https://npm.pkg.github.com

# 添加认证 token
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

或使用环境变量：
```bash
export NPM_TOKEN=YOUR_GITHUB_TOKEN
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc
```

### 2. 安装包

```bash
npm install @caasxyz/notification-sdk
```

### 3. 在 CI/CD 中使用

GitHub Actions 示例：
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@caasxyz'

- name: Install dependencies
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npm ci
```

## 查看已发布的包

1. 访问仓库主页
2. 右侧栏找到 "Packages" 部分
3. 或直接访问：https://github.com/caasxyz/notification/packages

## 版本管理

### 发布特定版本
```bash
# 发布正式版
npm version 1.0.0
npm publish

# 发布预发布版本
npm version 1.0.1-beta.1
npm publish --tag beta

# 发布下一版本
npm version 2.0.0-rc.1
npm publish --tag next
```

### 安装特定版本
```bash
# 安装最新版
npm install @caasxyz/notification-sdk

# 安装特定版本
npm install @caasxyz/notification-sdk@1.0.0

# 安装 beta 版本
npm install @caasxyz/notification-sdk@beta
```

## 常见问题

### 1. 认证失败
```
npm ERR! 401 Unauthorized
```
**解决**：检查 token 是否有 `write:packages` 权限

### 2. 找不到包
```
npm ERR! 404 Not Found - GET https://npm.pkg.github.com/@caasxyz%2fnotification-sdk
```
**解决**：
- 确保 `.npmrc` 配置正确
- 包名格式必须是 `@owner/package`
- owner 必须是 GitHub 用户名或组织名

### 3. 权限不足
```
npm ERR! 403 Forbidden
```
**解决**：
- 确保 token 有正确权限
- 确保你有仓库的写权限

## 私有包 vs 公开包

### 公开包（推荐）
- 任何人都可以查看和下载
- 完全免费
- 需要认证才能发布

### 私有包
- 只有授权用户可以访问
- 有免费额度限制
- 需要认证才能下载和发布

设置包的可见性：
1. 发布后访问包页面
2. Settings → Change visibility
3. 选择 Public 或 Private

## 重要说明

本项目的 SDK 仅通过 GitHub Packages 发布，不发布到 npm 公共仓库。

### 安装前准备

由于 SDK 仅通过 GitHub Packages 发布，安装前需要先配置认证：

```bash
# 1. 创建 .npmrc 文件配置认证
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# 2. 安装 SDK
npm install @caasxyz/notification-sdk
```

**注意**：需要有效的 GitHub Personal Access Token 才能安装。

## 总结

GitHub Packages 是一个很好的选择，特别是：
- 您不想注册 npm 账号
- 您的代码已经在 GitHub
- 您想要更好的权限控制
- 您需要私有包功能

立即开始：
1. 使用已创建的 GitHub Action workflow
2. 创建标签触发自动发布
3. 或在本地手动发布