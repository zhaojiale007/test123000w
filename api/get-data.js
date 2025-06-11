// api/get-data.js

// 这是一个 Vercel Serverless 函数，用于获取配置文件
export default async function handler(req, res) {
  // --- 1. 安全检查：保护此 API ---
  const basicAuthUser = process.env.BASIC_AUTH_USERNAME;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

  if (!basicAuthUser || !basicAuthPass) {
    return res.status(500).json({ status: 'error', message: '服务器安全配置不完整。' });
  }

  // ... (此处省略与之前示例中完全相同的 Basic Auth 验证逻辑)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    return res.status(401).json({ status: 'error', message: '需要身份验证。' });
  }
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
  const [user, pass] = credentials.split(':');
  if (user !== basicAuthUser || pass !== basicAuthPass) {
    return res.status(403).json({ status: 'error', message: '禁止访问：用户名或密码错误。' });
  }


  // --- 2. WebDAV 连接逻辑 ---
  const targetBaseUrl = process.env.TARGET_URL; // e.g., https://your-dav-server.com/dav/mynav/
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;
  
  if (!targetBaseUrl || !targetUser || !targetPass) {
    return res.status(500).json({ status: 'error', message: '目标服务器环境变量未完整设置。' });
  }

  const configUrl = `${targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/'}config.json`;
  const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');

  try {
    console.log(`正在从 ${configUrl} 获取配置文件...`);
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Authorization': targetAuth,
        'User-Agent': 'Vercel-Nav-App/1.0'
      }
    });

    if (response.ok) { // 200 OK
      const data = await response.json();
      console.log('成功获取并解析了配置文件。');
      return res.status(200).json(data);
    }

    if (response.status === 404) {
      // 如果配置文件不存在，返回一个默认的空结构，方便前端初始化
      console.log('配置文件不存在，返回默认空结构。');
      return res.status(200).json({
        title: "我的导航页",
        links: [],
        clipboard: []
      });
    }

    // 其他错误
    const errorText = await response.text();
    console.error(`从 WebDAV 获取文件失败: ${response.status}`, errorText);
    return res.status(500).json({ status: 'error', message: '从 WebDAV 获取文件失败。', details: errorText });

  } catch (error) {
    console.error('访问 WebDAV 时发生网络错误:', error);
    return res.status(500).json({ status: 'error', message: '访问 WebDAV 时发生网络错误。', details: error.message });
  }
}