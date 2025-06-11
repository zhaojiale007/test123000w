// api/test.js

// 这是一个 Vercel Serverless 函数
export default async function handler(req, res) {
  // --- 安全检查：保护这个 API 端点本身 ---
  // 从环境变量中获取用于访问此API的用户名和密码
  const basicAuthUser = process.env.BASIC_AUTH_USERNAME;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

  // 如果没有设置认证环境变量，返回错误
  if (!basicAuthUser || !basicAuthPass) {
    console.error("安全警告：BASIC_AUTH 环境变量未设置！");
    return res.status(500).json({ status: 'error', message: '服务器安全配置不完整。' });
  }

  // 检查客户端请求是否包含正确的 Authorization 头
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    return res.status(401).json({ status: 'error', message: '需要身份验证。' });
  }

  // 解码并验证凭据
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
  const [user, pass] = credentials.split(':');

  if (user !== basicAuthUser || pass !== basicAuthPass) {
    return res.status(403).json({ status: 'error', message: '禁止访问：用户名或密码错误。' });
  }

  // --- 连接测试逻辑 ---
  // 从环境变量中获取目标服务器的地址和凭据
  const targetUrl = process.env.TARGET_URL;
  const targetUser = process.env.TARGET_USERNAME;
  const targetPass = process.env.TARGET_PASSWORD;

  // 检查目标环境变量是否设置
  if (!targetUrl || !targetUser || !targetPass) {
    return res.status(500).json({ status: 'error', message: '目标服务器环境变量 (TARGET_URL, TARGET_USERNAME, TARGET_PASSWORD) 未设置。' });
  }

  try {
    // 准备用于目标服务器的 Authorization 头
    const targetAuth = 'Basic ' + Buffer.from(`${targetUser}:${targetPass}`).toString('base64');
    
    console.log(`正在尝试连接到: ${targetUrl}`);

    // 使用 fetch API 进行连接测试
    const response = await fetch(targetUrl, {
      method: 'GET', // 通常用 GET 或 HEAD 来测试连接
      headers: {
        'Authorization': targetAuth,
        'User-Agent': 'Vercel-Connection-Tester/1.0'
      }
    });

    // 检查响应状态码
    if (response.ok) { // status 在 200-299 之间
      console.log(`连接成功，状态码: ${response.status}`);
      res.status(200).json({
        status: 'success',
        message: `成功连接到 ${targetUrl}`,
        statusCode: response.status,
        statusText: response.statusText
      });
    } else {
      console.error(`连接失败，状态码: ${response.status}`);
      res.status(500).json({
        status: 'error',
        message: `连接到 ${targetUrl} 失败，服务器返回错误。`,
        statusCode: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    // 捕获网络错误，如 DNS 解析失败、连接被拒绝等
    console.error('连接测试时发生网络错误:', error);
    res.status(500).json({
      status: 'error',
      message: '发起连接时发生网络或底层错误。',
      errorDetails: error.message
    });
  }
}