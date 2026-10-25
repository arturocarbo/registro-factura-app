export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { imageBase64, mimeType } = req.body;
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'La API Key no está configurada en el servidor de Vercel.' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
    }

    const promptText = `Analiza esta imagen de factura o ticket de gasto. Extrae con absoluta precisión los datos y devuélvelos ÚNICAMENTE en formato JSON plano (sin texto adicional, sin bloques markdown de código), con esta estructura exacta:
{
  "lugar": "Nombre exacto del establecimiento",
  "fecha": "Fecha en formato YYYY-MM-DD",
  "montoTotal": 0.00,
  "iva": 0.00,
  "numeroFactura": "Número de factura, check o ticket",
  "categoria": "Comida",
  "comentarios": "Descripción del consumo"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `Error de Google AI: ${responseText}` });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: 'La respuesta de Google no tiene formato válido.' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'La IA no devolvió contenido analizable.' });
    }

    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error en serverless function:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
