# Kratos Proto Generator

这是一个 VSCode 插件，用于快速生成 Kratos 框架的 proto 文件。

## 功能

- 在 VSCode 文件浏览器中右键点击 `api` 目录下的 `.proto` 文件
- 选择 "Generate Proto" 选项
- 插件会自动在文件所在目录执行 `kratos proto client` 命令

## 要求

- VSCode 1.80.0 或更高版本
- 已安装 Kratos CLI 工具

## 安装

1. 克隆此仓库
2. 运行 `npm install` 安装依赖
3. 按 F5 启动调试模式
4. 在新打开的 VSCode 窗口中测试插件

## 使用方法

1. 在 VSCode 中打开包含 proto 文件的项目
2. 在文件浏览器中找到 `api` 目录下的 `.proto` 文件
3. 右键点击文件，选择 "Generate Proto"
4. 等待命令执行完成

## 注意事项

- 确保已正确安装 Kratos CLI 工具
- 确保 proto 文件位于 `api` 目录下
- 确保有足够的权限执行命令 