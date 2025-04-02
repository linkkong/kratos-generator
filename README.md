# Kratos Proto Generator

这是一个 VSCode 插件，用于快速生成 Kratos 框架的 proto 文件和配置文件。

## 功能

- 生成 Proto 客户端代码
- 生成 Service 服务端代码
- 生成配置文件
- 执行 wire 命令

## 要求

- VSCode 1.80.0 或更高版本
- 已安装 Kratos CLI 工具
- 已安装 wire 工具

## 安装

1. 克隆此仓库
2. 运行 `npm install` 安装依赖
3. 按 F5 启动调试模式
4. 在新打开的 VSCode 窗口中测试插件

## 使用方法

### 生成 Proto 和 Service 代码

1. 在 VSCode 中打开包含 proto 文件的项目
2. 在文件浏览器中找到任意 `.proto` 文件（不包括 `conf.proto`）
3. 右键点击文件，您将看到两个选项：
   - "生成 Proto 客户端" - 生成 proto 客户端代码
   - "生成 Service 服务端" - 生成 service 服务端代码
4. 选择需要的选项，等待命令执行完成

### 生成配置文件

1. 在 VSCode 中打开包含 `conf.proto` 文件的项目
2. 在文件浏览器中找到 `conf.proto` 文件
3. 右键点击文件，选择 "生成配置文件"
4. 等待 `make config` 命令执行完成

### 执行 Wire 命令

1. 在 VSCode 中打开项目
2. 在文件浏览器中找到 `cmd` 目录下的任意子目录
3. 右键点击目录，选择 "执行 wire"
4. 等待 wire 命令执行完成

## 注意事项

- 确保已正确安装 Kratos CLI 工具
- 生成 Proto 和 Service 代码时，确保 proto 文件不是 `conf.proto`
- 生成配置文件时，确保项目根目录下有 `Makefile` 且包含 `config` 目标
- 执行 wire 命令时，确保已安装 wire 工具
- 确保有足够的权限执行命令

## 命令说明

- `生成 Proto 客户端`: 在 proto 文件所在目录执行 `kratos proto client` 命令
- `生成 Service 服务端`: 在项目根目录执行 `kratos proto server` 命令，生成的文件保存在 `internal/service` 目录
- `生成配置文件`: 在项目根目录执行 `make config` 命令生成配置文件
- `执行 wire`: 在选中的 cmd 子目录下执行 `wire` 命令 