// api/proxy.js
export default async function handler(req, res) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Respond to preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Декодируем URL
    const decodedUrl = decodeURIComponent(url);
    console.log('Proxying request to:', decodedUrl);
    
    const response = await fetch(decodedUrl, {
      headers: {
        'Authorization': req.headers.authorization || '',
      },
    });

    if (!response.ok) {
      console.error('Proxy error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch', 
        status: response.status,
        statusText: response.statusText
      });
    }

    // Получаем данные как ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Устанавливаем правильные заголовки
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', arrayBuffer.byteLength);
    
    // Отправляем бинарные данные
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}