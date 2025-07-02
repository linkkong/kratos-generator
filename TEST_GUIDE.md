# Go跳转功能测试指南

## 准备工作

1. **启动扩展调试**
   - 在VS Code中打开这个项目
   - 按 `F5` 启动扩展调试模式
   - 这会打开一个新的VS Code窗口（Extension Development Host）

2. **准备测试文件**
   - 在新窗口中打开 `samples/go_jump_sample.go` 文件
   - 或者创建一个新的Go文件进行测试

## 测试步骤

### 第一步：检查扩展是否激活

1. 打开Go文件后，按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）打开命令面板
2. 输入 "Go跳转" 查看是否有相关命令
3. 检查开发者控制台（`Help` > `Toggle Developer Tools`）的Console标签页
4. 应该能看到类似这样的调试信息：
   ```
   [GoJump] 文件 xxx.go: 找到 1 个接口, 2 个结构体
   [GoJump] 接口 UserService: 4 个方法
   ```

### 第二步：查看CodeLens

1. 在Go文件中，查看接口方法和结构体方法的上方
2. **重要**：只有在真正找到匹配的实现/接口时才会显示提示！
3. 应该能看到类似这样的提示：
   - 接口定义上方：`$(symbol-class) 跳转到实现: StructName` 或 `$(symbol-class) N 个实现`
   - 接口方法上方：`$(arrow-right) 跳转到实现` 或 `$(arrow-right) N 个实现`
   - 结构体方法上方：`$(arrow-left) 跳转到接口` 或 `$(arrow-left) N 个接口`

### 第三步：测试跳转功能

1. **从接口跳转到实现**：
   - 点击接口方法上方的 "查找实现" 链接
   - 应该能跳转到对应的结构体方法实现

2. **从实现跳转到接口**：
   - 点击结构体方法上方的 "查找接口" 链接
   - 应该能跳转到对应的接口方法定义

## 问题排查

### 如果看不到CodeLens提示

1. **检查配置**：
   - 按 `Ctrl+,`（Mac: `Cmd+,`）打开设置
   - 搜索 "kratosProtoGenerator.enableGoJump"
   - 确保设置为 `true`

2. **检查语言**：
   - 确保文件的语言模式设置为 "Go"
   - 可以在VS Code右下角状态栏查看/修改

3. **查看调试信息**：
   - 打开开发者控制台：`Help` > `Toggle Developer Tools`
   - 切换到Console标签页
   - 查找以 `[GoJump]` 开头的日志信息

### 常见调试信息

成功运行时应该看到：
- `[GoJump] CodeLens开始处理文件: xxx.go` - 文件开始处理
- `[GoJump] 找到接口: UserService` - 成功识别接口
- `[GoJump] 找到结构体: UserServiceImpl` - 成功识别结构体
- `[GoJump] 找到 N 个实现关系` - 找到接口实现匹配
- `[GoJump] 为接口方法创建CodeLens: UserService.GetUser (2个实现)` - 为有实现的方法创建CodeLens
- `[GoJump] 接口方法无实现，跳过: SomeInterface.SomeMethod` - 跳过没有实现的方法
- `[GoJump] 为接口定义创建CodeLens: UserService (2个实现)` - 为接口本身创建CodeLens

### 如果仍然无法看到

1. **重新编译**：
   ```bash
   npm run compile
   ```

2. **重启调试会话**：
   - 停止当前调试会话
   - 重新按 `F5` 启动

3. **手动触发**：
   - 在命令面板中执行 "刷新Go跳转缓存"
   - 或者修改并保存Go文件来触发重新解析

## 测试用例

### 基本测试用例

在 `samples/go_jump_sample.go` 中：

1. **UserService接口**：
   - `GetUser` 方法应该能跳转到 `UserServiceImpl.GetUser` 和 `MockUserService.GetUser`
   - `CreateUser` 方法应该能跳转到对应的实现
   - `UpdateUser` 方法应该能跳转到对应的实现
   - `DeleteUser` 方法应该能跳转到对应的实现

2. **UserServiceImpl结构体**：
   - 所有方法都应该能跳转回 `UserService` 接口

3. **MockUserService结构体**：
   - 所有方法都应该能跳转回 `UserService` 接口

### 创建自定义测试

创建一个新的Go文件，内容如下：

```go
package test

type Writer interface {
    Write(data []byte) error
}

type FileWriter struct{}

func (f *FileWriter) Write(data []byte) error {
    return nil
}
```

应该能看到：
- `Writer.Write` 方法上有 "查找实现" 提示
- `FileWriter.Write` 方法上有 "查找接口" 提示
- 点击可以相互跳转

## 成功标准

功能正常工作的标准：

1. ✅ Go文件打开后能看到调试信息
2. ✅ 接口方法上方显示 "查找实现" 提示
3. ✅ 结构体方法上方显示 "查找接口" 提示
4. ✅ 点击提示能够跳转到对应位置
5. ✅ 多个实现时显示选择列表
6. ✅ 单个实现时直接跳转

## 联系信息

如果测试过程中遇到问题，请提供：
1. VS Code版本信息
2. 开发者控制台的完整日志
3. 测试的Go代码内容
4. 具体的错误现象描述 