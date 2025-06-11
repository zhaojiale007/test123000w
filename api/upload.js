// api/upload.js

// 这是一个处理文件上传的 Vercel Serverless 函数
export default async function handler(req, res) {
  // --- 1. 安全检查：与 test.js 完全相同的 API 保护 ---
  const basicAuthUser = process.env.BASIC_AUTH_USERNAME;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

  if (!basicAuthUser || !basicAuthPass) {
    return res.status(500).json({ status: 'error', message: '服务器安全配置不完整。' });
  }

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

  // --- 2. 上传逻辑 ---
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: '仅支持 POST 方法。' });
  }

  // 从请求头获取文件名
  const filename = req.headers['x-filename'];
  if (!filename) {
    return res.status(400).json({ status: 'error', message: '缺少 X-Filename 请求头。' });
  }

  // 从环境变量获取目标服务器信息
  const targetBaseUrl = process.env.TARGET_URL;
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;

  if (!targetBaseUrl || !targetUser || !targetPass) {
    return res.status(500).json({ status: 'error', message: '目标服务器环境变量未完整设置。' });
  }

  // 构造上传到 WebDAV 的完整 URL
  const targetUrl = `${targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/'}${encodeURIComponent(filename)}`;

  try {
    // 准备用于目标服务器的 Authorization 头
    const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');
    
    console.log(`正在上传文件 '${filename}' 到: ${targetUrl}`);

    // 使用 fetch API 将接收到的文件流(req.body) PUT 到目标服务器
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Authorization': targetAuth,
        'Content-Type': req.headers['content-type'] || 'application/octet-stream', // 使用原始请求的 Content-Type
        'User-Agent': 'Vercel-Uploader/1.0'
      },
      body: req.body // 直接转发请求体
    });

    // 检查 WebDAV 服务器的响应
    // 201 Created 表示成功创建新文件
    // 204 No Content 表示成功覆盖现有文件
    if (response.status === 201 || response.status === 204) {
      console.log(`上传成功，状态码: ${response.status}`);
      res.status(200).json({
        status: 'success',
        message: `文件 '${filename}' 成功上传到 ${targetBaseUrl}`,
        statusCode: response.status,
        statusText: response.statusText
      });
    } else {
      console.error(`上传失败，状态码: ${response.status}`);
      // 尝试读取对方返回的错误信息
      const errorBody = await response.text();
      res.status(500).json({
        status: 'error',
        message: `上传到 WebDAV 服务器失败。`,
        statusCode: response.status,
        statusText: response.statusText,
        errorDetails: errorBody
      });
    }
  } catch (error) {
    console.error('上传时发生网络错误:', error);
    res.status(500).json({
      status: 'error',
      message: '发起上传请求时发生网络或底层错误。',
      errorDetails: error.message
    });
  }
}