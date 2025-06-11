// api/get-data.js

export default async function handler(req, res) {
  // --- 1. 新的单一密码安全检查 ---
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return res.status(500).json({ status: 'error', message: '服务器安全配置不完整 (APP_PASSWORD 未设置)。' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Protected Area"');
    return res.status(401).json({ status: 'error', message: '需要身份验证。' });
  }

  const submittedPassword = authHeader.split(' ')[1];
  if (submittedPassword !== appPassword) {
    return res.status(403).json({ status: 'error', message: '禁止访问：密码错误。' });
  }

  // --- 2. WebDAV 连接逻辑 ---
  const targetBaseUrl = process.env.TARGET_URL;
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
        'User-Agent': 'Vercel-Dashboard-App/3.0'
      }
    });

    if (response.ok) { // 200 OK
      const data = await response.json();
      console.log('成功获取并解析了配置文件。');
      return res.status(200).json(data);
    }

    if (response.status === 404) {
      // 如果配置文件不存在，返回一个默认的、包含基础设置的结构
      console.log('配置文件不存在，返回默认结构。');
      return res.status(200).json({
        "meta": {
          "title": "我的云端控制台",
          "favicon": "https://raw.githubusercontent.com/PKM-er/Blue-topaz-examples/main/icons/MdiBook-open-variant.svg"
        },
        "settings": {
          "theme": "light",
          "layout": "columns",
          "accentColor": "#007aff",
          "font": "sans-serif",
          "backgroundImage": "",
          "sidebarWidth": "240px"
        },
        "blocks": [
          {
            "id": "block-1",
            "type": "links",
            "title": "示例链接",
            "icon": "🔗",
            "data": [
              { "id": "l1", "name": "Vercel", "url": "https://vercel.com" }
            ]
          }
        ]
      });
    }

    // 其他错误
    const errorText = await response.text();
    console.error(`从 WebDAV 获取文件失败: ${response.status}`, errorText);
    return res.status(500).json({ status: 'error', message: `从 WebDAV 获取文件失败: ${response.status}`, details: errorText });

  } catch (error) {
    console.error('访问 WebDAV 时发生网络错误:', error);
    return res.status(500).json({ status: 'error', message: '访问 WebDAV 时发生网络错误。', details: error.message });
  }
}
