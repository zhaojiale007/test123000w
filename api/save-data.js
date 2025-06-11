// api/save-data.js

export default async function handler(req, res) {
  // --- 1. 安全检查 (与 get-data.js 相同) ---
  const basicAuthUser = process.env.BASIC_AUTH_USERNAME;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;
  if (!basicAuthUser || !basicAuthPass) return res.status(500).json({ status: 'error', message: '服务器安全配置不完整。' });
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) return res.status(401).json({ status: 'error', message: '需要身份验证。' });
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
  const [user, pass] = credentials.split(':');
  if (user !== basicAuthUser || pass !== basicAuthPass) return res.status(403).json({ status: 'error', message: '禁止访问。' });

  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: '仅支持 POST 方法。' });
  }

  // --- 2. WebDAV 保存逻辑 ---
  const targetBaseUrl = process.env.TARGET_URL;
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;
  if (!targetBaseUrl || !targetUser || !targetPass) return res.status(500).json({ status: 'error', message: '目标服务器环境变量未完整设置。' });

  const configUrl = `${targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/'}config.json`;
  const backupUrl = `${targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/'}config.backup.json`;
  const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');
  
  const newData = req.body; // Vercel 自动解析 JSON

  try {
    // --- 自动备份 ---
    try {
      const currentConfigResponse = await fetch(configUrl, { headers: { 'Authorization': targetAuth } });
      if (currentConfigResponse.ok) {
        const currentConfig = await currentConfigResponse.text();
        await fetch(backupUrl, {
          method: 'PUT',
          headers: { 'Authorization': targetAuth, 'Content-Type': 'application/json' },
          body: currentConfig
        });
        console.log('成功创建配置文件备份。');
      }
    } catch(backupError) {
      console.warn('创建备份时出错 (可能是首次运行)，已忽略:', backupError.message);
    }
    
    // --- 写入新配置 ---
    console.log(`正在写入新配置到 ${configUrl}`);
    const response = await fetch(configUrl, {
      method: 'PUT',
      headers: {
        'Authorization': targetAuth,
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'Vercel-Nav-App/1.0'
      },
      body: JSON.stringify(newData, null, 2) // 格式化 JSON 以便阅读
    });

    if (response.status === 201 || response.status === 204) {
      console.log('新配置保存成功。');
      res.status(200).json({ status: 'success', message: '配置已成功保存。' });
    } else {
      const errorText = await response.text();
      console.error(`写入 WebDAV 失败: ${response.status}`, errorText);
      res.status(500).json({ status: 'error', message: '写入 WebDAV 失败。', details: errorText });
    }

  } catch (error) {
    console.error('保存到 WebDAV 时发生网络错误:', error);
    res.status(500).json({ status: 'error', message: '保存到 WebDAV 时发生网络错误。', details: error.message });
  }
}