// api/proxy.js
export default async function handler(req, res) {
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to get download link' });
    }

    const { href } = await response.json();
    
    // Проксируем сам файл
    const fileResponse = await fetch(href);
    const arrayBuffer = await fileResponse.arrayBuffer();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', fileResponse.headers.get('content-type') || 'application/octet-stream');
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}