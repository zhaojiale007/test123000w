// api/get-data.js

export default async function handler(req, res) {
  // --- 1. 安全检查 (与之前相同) ---
  const basicAuthUser = process.env.BASIC_AUTH_USERNAME;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;
  if (!basicAuthUser || !basicAuthPass) return res.status(500).json({ status: 'error', message: '服务器安全配置不完整。' });
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    return res.status(401).json({ status: 'error', message: '需要身份验证。' });
  }
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
  const [user, pass] = credentials.split(':');
  if (user !== basicAuthUser || pass !== basicAuthPass) {
    return res.status(403).json({ status: 'error', message: '禁止访问。' });
  }

  // --- 2. WebDAV 连接逻辑 ---
  const targetBaseUrl = process.env.TARGET_URL;
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;
  if (!targetBaseUrl || !targetUser || !targetPass) return res.status(500).json({ status: 'error', message: '目标服务器环境变量未完整设置。' });

  const configUrl = `${targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/'}config.json`;
  const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');

  try {
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: { 'Authorization': targetAuth, 'User-Agent': 'Vercel-Nav-App/2.0' }
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    if (response.status === 404) {
      // 返回一个更友好的默认空结构
      console.log('配置文件不存在，返回默认空结构。');
      return res.status(200).json({
        title: "我的云导航",
        links: [{id: "1", name: "Vercel", url: "https://vercel.com"}],
        clipboard: [{id: "1", title: "欢迎使用", text: "在这里添加你的备忘录！"}]
      });
    }

    const errorText = await response.text();
    return res.status(500).json({ status: 'error', message: '从 WebDAV 获取文件失败。', details: errorText });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: '访问 WebDAV 时发生网络错误。', details: error.message });
  }
}
