# Kratos Proto Generator

这是一个 VSCode 插件，用于快速生成 Kratos 框架的 proto 文件和配置文件。

## 功能

- 生成 Proto 客户端代码
- 生成 Service 服务端代码
- 生成配置文件
- 执行 wire 命令
- **Go 接口和结构体跳转**：智能识别接口与实现的关系，支持双向跳转

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

![生成 Proto 和 Service 代码](https://raw.githubusercontent.com/linkkong/kratos-generator/main/img/proto.png)

### 生成配置文件

1. 在 VSCode 中打开包含 `conf.proto` 文件的项目
2. 在文件浏览器中找到 `conf.proto` 文件
3. 右键点击文件，选择 "生成配置文件"
4. 等待 `make config` 命令执行完成

![生成配置文件](https://raw.githubusercontent.com/linkkong/kratos-generator/main/img/conf.png)

### 执行 Wire 命令

1. 在 VSCode 中打开项目
2. 在文件浏览器中找到 `cmd` 目录下的任意子目录
3. 右键点击目录，选择 "执行 wire"
4. 等待 wire 命令执行完成

![执行 Wire 命令](https://raw.githubusercontent.com/linkkong/kratos-generator/main/img/wire.png)

### Go 接口和结构体跳转

这个功能可以帮助您在 Go 代码中快速在接口和实现之间跳转，提高开发效率。

#### 功能特点

- **智能识别**：自动识别接口与结构体的实现关系
- **双向跳转**：支持从接口跳转到实现，从实现跳转到接口
- **方法级跳转**：精确到具体方法的跳转
- **多实现支持**：一个接口多个实现时显示选择列表
- **实时更新**：监听文件变化，自动更新跳转关系

#### 使用方法

1. **在接口方法上**：
   - 代码上方会显示 `$(arrow-right) 跳转到实现` 或 `$(arrow-right) N 个实现`
   - 点击即可跳转到对应的结构体方法实现
   - 多个实现时会显示选择列表

2. **在结构体方法上**：
   - 代码上方会显示 `$(arrow-left) 跳转到接口` 或 `$(arrow-left) N 个接口`
   - 点击即可跳转到对应的接口方法定义

3. **右键菜单**：
   - 在方法名上右键选择"转到定义"也可以实现跳转

#### 配置选项

在 VS Code 设置中可以配置以下选项：

- `kratosProtoGenerator.enableGoJump`：启用/禁用 Go 跳转功能（默认：true）
- `kratosProtoGenerator.goJumpCacheSize`：缓存大小限制（默认：1000）

#### 示例

参考 `samples/go_jump_sample.go` 文件查看完整的使用示例。

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
