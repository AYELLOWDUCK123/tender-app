const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { execFileSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// 引入数据管理器
const {
  initDataFiles,
  createUser,
  findUserByUsername,
  findUserByPhone,
  findUserById,
  addTender,
  getUserTenders,
  updateTenderStatus,
  assignTenderToAllUsers,
  readData,
  TENCENT_DOC,
  syncTenderToTencentDoc
} = require('./data-manager');

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'tender-app-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// 初始化数据文件
initDataFiles();

// 添加测试数据（如果为空）- 已由 data-manager 的 initDataFiles 处理
function addTestData() {
  try {
    const usersFile = path.join(__dirname, 'data', 'users.json');
    const tendersFile = path.join(__dirname, 'data', 'tenders.json');
    
    if (!fs.existsSync(usersFile) || !fs.existsSync(tendersFile)) {
      console.log('数据文件由 initDataFiles 创建，跳过 addTestData');
      return;
    }
    
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const tenders = JSON.parse(fs.readFileSync(tendersFile, 'utf8'));

    // 添加测试用户
    if (users.length === 0) {
      createUser({
        username: 'test',
        phone: '13800138000',
        password: '123456',
        company_name: '测试工程公司'
      });
      console.log('测试用户已创建: test / 123456');
    }

    // 添加测试招标数据
    if (tenders.length === 0) {
      const testTenders = [
        { title: 'XX市2026年路面改造工程', budget: 280, region: '江苏', project_type: '路面', publish_date: '2026-06-08', deadline: '2026-06-25', qualifications: '市政公用工程施工总承包一级', match_score: 95, source_url: 'https://example.com/tender/001' },
        { title: 'XX高速公路桥墩加固项目', budget: 350, region: '浙江', project_type: '桥墩', publish_date: '2026-06-07', deadline: '2026-06-23', qualifications: '桥梁工程专业承包一级', match_score: 88, source_url: 'https://example.com/tender/002' },
        { title: 'XX新区市政道路建设工程', budget: 180, region: '上海', project_type: '市政', publish_date: '2026-06-09', deadline: '2026-06-22', qualifications: '市政公用工程施工总承包二级及以上', match_score: 92, source_url: 'https://example.com/tender/003' },
        { title: 'XX大桥维修加固工程', budget: 420, region: '江苏', project_type: '桥梁', publish_date: '2026-06-06', deadline: '2026-06-28', qualifications: '桥梁工程专业承包一级', match_score: 78, source_url: 'https://example.com/tender/004' },
        { title: 'XX工业园区路面铺设项目', budget: 150, region: '浙江', project_type: '路面', publish_date: '2026-06-09', deadline: '2026-06-20', qualifications: '市政公用工程施工总承包三级及以上', match_score: 98, source_url: 'https://example.com/tender/005' }
      ];
      testTenders.forEach(t => { const td = addTender(t); assignTenderToAllUsers(td.id); });
      console.log('已创建 5 条测试招标数据');
    }
  } catch (e) {
    console.log('addTestData 跳过:', e.message);
  }
}

// ========== 认证中间件 ==========
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/');
  }
}

// ========== 路由 ==========

// 登录页面
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// 仪表板页面
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 注册 API
app.post('/api/register', (req, res) => {
  const { username, phone, password, company_name } = req.body;

  if (!password || password.length < 6) {
    return res.json({ success: false, message: '密码至少6位' });
  }

  const result = createUser({ username, phone, password, company_name });
  res.json(result);
});

// 登录 API
app.post('/api/login', (req, res) => {
  const { username, phone, password } = req.body;

  let user;
  if (username) {
    // 优先按用户名查找，如果找不到且 username 是手机号格式，则按手机号查找
    user = findUserByUsername(username);
    if (!user && /^1\d{10}$/.test(username)) {
      user = findUserByPhone(username);
    }
  } else if (phone) {
    user = findUserByPhone(phone);
  } else {
    return res.json({ success: false, message: '请输入用户名或手机号' });
  }

  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.json({ success: false, message: '密码错误' });
  }

  req.session.userId = user.id;
  req.session.username = user.username || user.phone;
  res.json({ success: true, message: '登录成功' });
});

// 登出 API
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 获取当前用户信息
app.get('/api/user', requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  if (!user) {
    return res.json({ success: false });
  }
  res.json({ success: true, user });
});

// 获取招标列表（按用户隔离 + 时间逆序 + 筛选）
app.get('/api/tenders', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { status, region, project_type, keyword } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (region) filters.region = region;
  if (project_type) filters.project_type = project_type;
  if (keyword) filters.keyword = keyword;

  const data = getUserTenders(userId, filters);
  res.json({ success: true, data });
});

// 更新招标状态
app.post('/api/tenders/:id/status', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const tenderId = parseInt(req.params.id);
  const { status, remark } = req.body;

  const result = updateTenderStatus(userId, tenderId, status, remark);
  res.json(result);
});

// 管理员：添加招标信息
app.post('/api/admin/tenders', (req, res) => {
  const { title, budget, region, project_type, publish_date, deadline, submit_start_date, submit_deadline, bid_open_time, qualifications, match_score, source_url, section_summary } = req.body;

  const tender = addTender({
    title, budget, region, project_type,
    publish_date, deadline, submit_start_date, submit_deadline, bid_open_time,
    qualifications, match_score, source_url, section_summary
  });

  assignTenderToAllUsers(tender.id);
  
  res.json({ success: true, message: '添加成功', tenderId: tender.id });
});


// 启动服务器
addTestData();

app.listen(PORT, '0.0.0.0', () => {
  console.log('服务器启动成功！');
  console.log('本地访问: http://localhost:' + PORT);
  console.log('测试账号: test / 123456');
});
