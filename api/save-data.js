// api/save-data.js

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

  // --- 2. 新的 WebDAV 保存逻辑 ---
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: '仅支持 POST 方法。' });
  }

  const targetBaseUrl = process.env.TARGET_URL;
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;
  
  if (!targetBaseUrl || !targetUser || !targetPass) {
    return res.status(500).json({ status: 'error', message: '目标服务器环境变量未完整设置。' });
  }

  const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');
  const newData = req.body; // Vercel 自动解析 JSON

  // 生成带时间戳的文件名，替换冒号以兼容更多文件系统
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const archiveFilename = `config_${timestamp}.json`;
  
  // 确保基础 URL 以斜杠结尾
  const baseUrl = targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/';
  
  const configUrl = `${baseUrl}config.json`;
  // 将存档文件放入 archive 子目录，保持根目录清洁
  const archiveUrl = `${baseUrl}archive/${archiveFilename}`; 
  
  const headers = {
    'Authorization': targetAuth,
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'Vercel-Dashboard-App/3.0'
  };

  try {
    const body = JSON.stringify(newData, null, 2); // 格式化 JSON 以便阅读

    // 1. 保存到存档文件 (WebDAV 的 PUT 请求会自动创建 archive 目录)
    console.log(`正在创建存档: ${archiveUrl}`);
    const archiveResponse = await fetch(archiveUrl, { method: 'PUT', headers, body });

    // 201 Created 或 204 No Content 都表示成功
    if (!(archiveResponse.status === 201 || archiveResponse.status === 204)) {
      throw new Error(`创建存档失败，状态码: ${archiveResponse.status}`);
    }
    console.log('存档创建成功。');

    // 2. 更新主配置文件
    console.log(`正在更新主配置: ${configUrl}`);
    const configResponse = await fetch(configUrl, { method: 'PUT', headers, body });

    if (!(configResponse.status === 201 || configResponse.status === 204)) {
      throw new Error(`更新主配置失败，状态码: ${configResponse.status}`);
    }
    console.log('主配置更新成功。');

    res.status(200).json({ status: 'success', message: '配置已保存并存档。' });

  } catch (error) {
    console.error('保存到 WebDAV 时发生错误:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
}
