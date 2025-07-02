// Go跳转功能示例文件
// 在接口方法上会显示"跳转到实现"
// 在结构体方法上会显示"跳转到接口"

package main

import "fmt"

// UserService 用户服务接口
type UserService interface {
	GetUser(id int) (*User, error)
	CreateUser(user *User) error
	UpdateUser(user *User) error
	DeleteUser(id int) error
}

// User 用户结构体
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UserServiceImpl 用户服务实现
type UserServiceImpl struct {
	users map[int]*User
}

// NewUserService 创建用户服务实例
func NewUserService() UserService {
	return &UserServiceImpl{
		users: make(map[int]*User),
	}
}

// GetUser 获取用户 - 点击此方法名应该能跳转到接口定义
func (s *UserServiceImpl) GetUser(id int) (*User, error) {
	user, exists := s.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

// CreateUser 创建用户 - 点击此方法名应该能跳转到接口定义
func (s *UserServiceImpl) CreateUser(user *User) error {
	if user == nil {
		return fmt.Errorf("user cannot be nil")
	}
	s.users[user.ID] = user
	return nil
}

// UpdateUser 更新用户 - 点击此方法名应该能跳转到接口定义
func (s *UserServiceImpl) UpdateUser(user *User) error {
	if user == nil {
		return fmt.Errorf("user cannot be nil")
	}
	if _, exists := s.users[user.ID]; !exists {
		return fmt.Errorf("user not found")
	}
	s.users[user.ID] = user
	return nil
}

// DeleteUser 删除用户 - 点击此方法名应该能跳转到接口定义
func (s *UserServiceImpl) DeleteUser(id int) error {
	if _, exists := s.users[id]; !exists {
		return fmt.Errorf("user not found")
	}
	delete(s.users, id)
	return nil
}

// MockUserService 另一个用户服务实现
type MockUserService struct{}

// GetUser Mock实现 - 点击此方法名应该能跳转到接口定义
func (m *MockUserService) GetUser(id int) (*User, error) {
	return &User{ID: id, Name: "Mock User", Email: "mock@example.com"}, nil
}

// CreateUser Mock实现 - 点击此方法名应该能跳转到接口定义
func (m *MockUserService) CreateUser(user *User) error {
	return nil
}

// UpdateUser Mock实现 - 点击此方法名应该能跳转到接口定义
func (m *MockUserService) UpdateUser(user *User) error {
	return nil
}

// DeleteUser Mock实现 - 点击此方法名应该能跳转到接口定义
func (m *MockUserService) DeleteUser(id int) error {
	return nil
}

func main() {
	service := NewUserService()

	user := &User{
		ID:    1,
		Name:  "张三",
		Email: "zhangsan@example.com",
	}

	// 使用服务
	service.CreateUser(user)
	foundUser, _ := service.GetUser(1)
	fmt.Printf("Found user: %+v\n", foundUser)
}
