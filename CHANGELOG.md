# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.0.8 (2025-01-27)

### Features

* **重新实现Go接口跳转功能**：全新架构的Go Interface和Struct相互跳转功能
  - **智能CodeLens提示**：在接口方法和结构体方法上显示可点击的跳转提示
  - **双向跳转支持**：
    - 接口方法 → 所有实现该方法的结构体方法
    - 结构体方法 → 对应的接口方法定义
  - **多实现支持**：一个接口有多个实现时显示选择列表
  - **Definition Provider**：支持右键"转到定义"功能
  - **智能缓存系统**：
    - 自动检测文件修改，智能刷新缓存
    - 可配置缓存大小限制
    - 支持手动刷新缓存命令
  - **新增配置选项**：
    - `kratosProtoGenerator.enableGoJump`：启用/禁用Go跳转功能
    - `kratosProtoGenerator.goJumpCacheSize`：配置缓存大小
  - **文件监听**：自动监听Go文件变化，实时更新跳转关系
  - **性能优化**：并行解析多个文件，提升大项目性能
  - **完整的类型系统**：精确匹配方法签名（参数类型、返回值类型）
  - 包含完整的示例代码和使用说明

### 0.0.7 (2025-01-27)

### Changes

* **移除Go导航功能**：完全删除Go Interface和Struct导航相关功能
  - 删除所有Go导航相关源文件：`goNavigationDecorations.ts`、`goNavigationProvider.ts`、`goCodeLens.ts`、`goCodeParser.ts`
  - 删除相关命令注册和配置项
  - 移除文档和示例文件
  - 清理README中的相关内容
  - 简化扩展功能，专注于Proto文件生成和gRPC客户端功能

### 0.0.6 (2025-01-27)

### Features

* **装订线导航按钮**：重大UI改进，将Go导航功能升级为装订线区域的可点击按钮
  - **装订线图标按钮**：在装订线区域（行号左侧）显示蓝色箭头图标，类似VS Code运行/调试按钮的样式
  - **可点击图标**：支持直接点击装订线区域的图标进行跳转，操作更加直观
  - **优化图标设计**：使用SVG设计的圆形蓝色背景箭头图标，提升视觉体验
  - **智能悬停提示**：鼠标悬停显示详细信息，如"Writer 有 2 个实现"
  - **移除命令依赖**：简化架构，装订线点击直接处理跳转逻辑，无需额外命令注册
  - **保留双模式支持**：仍支持装饰器模式（默认）和CodeLens模式切换
  - **更新文档**：全面更新README说明新的装订线按钮使用方式
  - 支持类型级和方法级的双重导航关系显示
  - 优化点击检测逻辑，确保装订线区域点击响应准确

### 0.0.5 (2025-04-27)

### Features

* **新功能**: 添加 Go Interface 和 Struct 导航功能，支持方法级导航
  - **新增装饰器模式**：在编辑器行首显示彩色箭头图标，类似断点位置
  - **支持双显示模式**：装饰器模式（默认）和 CodeLens 模式，可在设置中切换
  - 支持从 interface 跳转到所有实现它的 struct
  - 支持从 struct 跳转到它实现的所有 interface  
  - **新增方法级导航**：支持从 interface 方法跳转到具体实现，从 struct 方法跳转到 interface 方法定义
  - 装饰器模式：点击行首箭头图标区域跳转，悬停显示详细信息
  - CodeLens 模式：点击行首文本提示跳转
  - 多个目标时显示选择列表，单个目标时直接跳转
  - 支持右键菜单和命令面板调用
  - 自动监听 Go 文件变化，智能缓存刷新
  - 添加配置选项 `kratosProtoGenerator.goNavigationStyle`
  - 添加了完整的功能文档和使用示例

### 0.0.4 (2025-04-27)


### Features

* 改进命令执行方式，使用终端显示完整输出，修复proto命令路径问题，版本更新到0.0.3 ([ee426f0](https://github.com/linkkong/kratos-generator/commit/ee426f01cbe1b797665850e55027c4a5ff7bed43))
* 添加执行 wire 命令功能，优化菜单显示条件 ([4ae49be](https://github.com/linkkong/kratos-generator/commit/4ae49be6908443b357a086e39ccec76b9f48caba))
* 优化 wire 命令执行逻辑，支持在任意 cmd 目录下执行 ([664364d](https://github.com/linkkong/kratos-generator/commit/664364d011ea5032f6ab871a819739ac925ef97e))
* update README and package.json, add images ([56e52bd](https://github.com/linkkong/kratos-generator/commit/56e52bd9f4572a97c8ec76390ee361ab1b6d65c0))
