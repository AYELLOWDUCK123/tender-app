const fs = require('fs');
const path = require('path');

const cssFile = path.join(__dirname, 'public', 'css', 'style.css');

// 读取 CSS 文件
let css = fs.readFileSync(cssFile, 'utf8');

// 简单替换：紫色 → 黄色
css = css.split('#667eea').join('#FFC107');
css = css.split('#764ba2').join('#FF9800');
css = css.split('rgba(102, 126, 234').join('rgba(255, 193, 7');
css = css.split('rgba(118, 75, 162').join('rgba(255, 152, 0');

// 写回文件
fs.writeFileSync(cssFile, css, 'utf8');

console.log('✅ CSS 主题色已替换为黄色！');
console.log('替换内容：');
console.log('  - #667eea → #FFC107');
console.log('  - #764ba2 → #FF9800');
console.log('  - rgba(102,126,234,*) → rgba(255,193,7,*)');
console.log('  - rgba(118,75,162,*) → rgba(255,152,0,*)');
