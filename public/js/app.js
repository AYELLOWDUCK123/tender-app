// 全局变量
let allTenders = [];
let currentUser = null;
let selectedStatuses = new Set(['']); // 多选状态筛选，默认选中"全部"

// 状态筛选切换 - 多选
function toggleStatusFilter(el) {
    const status = el.getAttribute('data-status');
    
    // "全部"特殊处理
    if (status === '') {
        selectedStatuses.clear();
        selectedStatuses.add('');
    } else {
        // 如果当前选中"全部"，先清除
        if (selectedStatuses.has('')) {
            selectedStatuses.clear();
        }
        
        // 切换当前状态
        if (selectedStatuses.has(status)) {
            selectedStatuses.delete(status);
        } else {
            selectedStatuses.add(status);
        }
        
        // 如果全部取消，自动选中"全部"
        if (selectedStatuses.size === 0) {
            selectedStatuses.add('');
        }
    }
    
    // 更新UI
    document.querySelectorAll('.status-filter-tag').forEach(tag => {
        const s = tag.getAttribute('data-status');
        if ((s === '' && selectedStatuses.has('')) || (s !== '' && selectedStatuses.has(s))) {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
    
    loadTenders();
}

// 切换登录/注册标签页
function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
});

// 检查登录状态
async function checkLogin() {
    try {
        const res = await apiGet('/api/user');
        if (res.success) {
            currentUser = res.user;
            // 如果在登录页面，跳转到仪表板
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                window.location.href = '/dashboard';
            } else {
                // 在仪表板页面，显示用户信息
                const userNameEl = document.getElementById('userName');
                if (userNameEl) {
                    userNameEl.textContent = currentUser.username || currentUser.phone || '用户';
                }
                loadTenders();
            }
        } else {
            // 如果不在登录页面，跳转到登录页面
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        }
    } catch (e) {
        console.log('未登录');
        // 如果不在登录页面，跳转到登录页面
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    }
}

// 登录
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showMessage('请输入用户名/手机号和密码', 'error');
        return;
    }

    try {
        const res = await apiPost('/api/login', { username, password });
        if (res.success) {
            // 登录成功，跳转到仪表板页面
            window.location.href = '/dashboard';
        } else {
            showMessage(res.message || '登录失败', 'error');
        }
    } catch (e) {
        showMessage('网络错误，请重试', 'error');
    }
}

// 登出
async function logout() {
    try {
        await apiPost('/api/logout', {});
    } catch (e) {}
    currentUser = null;
    // 跳转到登录页面
    window.location.href = '/';
}

// 加载招标列表
async function loadTenders() {
    const listEl = document.getElementById('tenderList');
    listEl.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>加载中...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        const region = document.getElementById('filterRegion').value;
        const type = document.getElementById('filterType').value;
        const keyword = document.getElementById('searchKeyword').value.trim();

        // 多选状态筛选
        if (!selectedStatuses.has('')) {
            selectedStatuses.forEach(s => params.append('status', s));
        }
        
        if (region) params.append('region', region);
        if (type) params.append('type', type);
        if (keyword) params.append('keyword', keyword);

        const res = await apiGet('/api/tenders?' + params.toString());
        if (res.success) {
            allTenders = res.data;
            renderTenders();
        } else {
            listEl.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
        }
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state"><p>网络错误</p></div>';
    }
}

// 渲染招标卡片
function renderTenders() {
    const listEl = document.getElementById('tenderList');

    if (allTenders.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>暂无招标信息</p>
                <p style="font-size:12px;margin-top:5px;">符合筛选条件的招标项目将在这里显示</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    allTenders.forEach(t => {
        const card = createTenderCard(t);
        listEl.appendChild(card);
    });
}

// 创建招标卡片 - 优化布局：标签样式 + 时间一行显示
function createTenderCard(t) {
    const card = document.createElement('div');
    card.className = 'tender-card';
    card.setAttribute('data-id', t.id);

    const statusClass = 'status-' + t.user_status;
    const budgetColor = t.budget > 300 ? '#f44336' : '#ff9800';
    const matchColor = t.match_score >= 90 ? '#4caf50' : t.match_score >= 80 ? '#ff9800' : '#999';

    // 状态按钮
    const statusBtns = getStatusButtons(t.user_status, t.id);

    // 时间格式化
    const tenderTime = (t.publish_date || '--') + ' 到 ' + (t.deadline || '--');
    const submitTime = (t.submit_start_date || '--') + ' 到 ' + (t.submit_deadline || '--');
    const bidOpenTime = t.bid_open_time || '--';

    card.innerHTML = `
        <!-- 卡片头部：标题 + 状态标签 + 查看原文 -->
        <div class="card-header">
            <div class="title-row">
                <span class="tender-title">${escHtml(t.title)}</span>
                <span class="tender-status ${statusClass}">${escHtml(t.user_status)}</span>
                ${t.source_url ? `<a href="${escHtml(t.source_url)}" target="_blank" class="view-source-btn"><svg class="source-icon" viewBox="0 0 24 24" fill="#FF9800"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>查看原文</a>` : ''}
            </div>
        </div>

        <!-- 标签区域：地区、类型、匹配度、预算 -->
        <div class="tender-tags">
            <span class="tender-tag tag-region"><svg class="tag-icon" viewBox="0 0 24 24" fill="#FFC107"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${escHtml(t.region)}</span>
            <span class="tender-tag tag-type"><svg class="tag-icon" viewBox="0 0 24 24" fill="#FFC107"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>${escHtml(t.project_type)}</span>
            <span class="tender-tag tag-match"><svg class="tag-icon" viewBox="0 0 24 24" fill="${matchColor}"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>${t.match_score}分</span>
            <span class="tender-tag tag-budget"><svg class="tag-icon" viewBox="0 0 24 24" fill="${budgetColor}"><path d="M11.8 10.9c-2.34-1.95-4.71-4.44-4.71-6.7C7.09 2.63 9.06 1 11.51 1c1.95 0 3.49 1.14 3.49 3.21 0 2.93-4.09 5.71-4.71 6.69zM13 20.5c-1.29 1.09-3.36 2.5-5 2.5-2.76 0-5.06-2.29-5.06-5.12 0-2.57 2.36-4.29 4.72-6.03 2.14 1.57 3.69 3.25 4.69 4.67 1.01-1.43 2.56-3.12 4.7-4.7 2.36 1.74 4.71 3.46 4.71 6.03 0 2.83-2.3 5.12-5.06 5.12-1.64 0-3.71-1.41-5-2.5z"/></svg>${t.budget}万</span>
        </div>

        <!-- 标段摘要 -->
        ${t.section_summary ? `
        <div class="section-summary"><svg class="qual-icon" viewBox="0 0 24 24" fill="#888"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${escHtml(t.section_summary)}</div>
        ` : ''}

        <!-- 时间信息：一行显示 -->
        <div class="time-info">
            <div class="time-item">
                <svg class="time-icon" viewBox="0 0 24 24" fill="#999"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                <span class="time-label">招标时间：</span>
                <span class="time-value">${escHtml(tenderTime)}</span>
            </div>
            ${t.submit_start_date || t.submit_deadline ? `
            <div class="time-item">
                <svg class="time-icon" viewBox="0 0 24 24" fill="#999"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>
                <span class="time-label">提交时间：</span>
                <span class="time-value">${escHtml(submitTime)}</span>
            </div>
            ` : ''}
            ${t.bid_open_time ? `
            <div class="time-item">
                <svg class="time-icon" viewBox="0 0 24 24" fill="#9c27b0"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
                <span class="time-label">开标时间：</span>
                <span class="time-value" style="color:#9c27b0;">${escHtml(bidOpenTime)}</span>
            </div>
            ` : ''}
        </div>

        <!-- 资质要求 -->
        ${t.qualifications ? `
        <div class="card-divider"></div>
        <div style="font-size:12px;color:#888;margin-bottom:5px;"><svg class="qual-icon" viewBox="0 0 24 24" fill="#888"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>资质要求</div>
        <div style="font-size:13px;color:#555;line-height:1.5;">${escHtml(t.qualifications)}</div>
        ` : ''}

        <!-- 操作按钮 -->
        <div class="status-actions">${statusBtns}</div>
    `;

    return card;
}

// 获取状态操作按钮
function getStatusButtons(currentStatus, tenderId) {
    const allStatuses = ['新推送', '已查看', '感兴趣', '决定投标', '已投标', '已放弃'];
    const currentIdx = allStatuses.indexOf(currentStatus);
    
    // 只显示相邻状态和"已放弃"选项
    let options = [];
    if (currentIdx < allStatuses.length - 1) {
        options.push(allStatuses[currentIdx + 1]);
    }
    if (currentStatus !== '已放弃' && currentStatus !== '已投标') {
        options.push('已放弃');
    }
    // 允许回退到上一个状态
    if (currentIdx > 0) {
        options.push(allStatuses[currentIdx - 1]);
    }

    return options.map(s => {
        const colors = {
            '已查看': '#FF9800',
            '感兴趣': '#4CAF50',
            '决定投标': '#E91E63',
            '已投标': '#9C27B0',
            '已放弃': '#999',
            '新推送': '#FFC107'
        };
        const c = colors[s] || '#ddd';
        return `<button class="status-btn" onclick="updateStatus(${tenderId}, '${s}')"
                style="border-color:${c};color:${c};background:${c}12">${s}</button>`;
    }).join('');
}

// 更新状态
async function updateStatus(tenderId, newStatus) {
    try {
        const res = await apiPost(`/api/tenders/${tenderId}/status`, { status: newStatus });
        if (res.success) {
            loadTenders();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (e) {
        alert('网络错误');
    }
}

// 搜索防抖
let searchTimer = null;
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadTenders();
    }, 500);
}

// ========== API请求封装 ==========
async function apiGet(url) {
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
}

async function apiPost(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    return res.json();
}

// HTML转义
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 显示消息
function showMessage(msg, type) {
    const el = document.getElementById('message');
    if (!el) return;
    el.textContent = msg;
    el.className = 'message ' + type;
    setTimeout(() => { el.className = 'message'; }, 3000);
}

// 注册功能
async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const company = document.getElementById('reg-company').value.trim();

    // 验证：用户名和手机号至少填一个
    if (!username && !phone) {
        showMessage('请填写用户名或手机号（至少填一个）', 'error');
        return;
    }

    if (!password || password.length < 6) {
        showMessage('密码至少6位', 'error');
        return;
    }

    try {
        const res = await apiPost('/api/register', { username, phone, password, company_name: company });
        if (res.success) {
            showMessage('注册成功，请登录', 'success');
            switchTab('login');
        } else {
            showMessage(res.message || '注册失败', 'error');
        }
    } catch (e) {
        showMessage('网络错误，请重试', 'error');
    }
}
