// api/groq.js dosyası
export default async function handler(req, res) {
    // Sadece senin sitenden gelen POST isteklerini kabul et
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Sadece POST istekleri kabul edilir' });
    }

    // Frontend'den (script.js) gönderdiğimiz mesajı/promptu al
    const body = req.body;

    try {
        // İŞTE SİHİR BURADA: API anahtarını Vercel'in gizli kasasından çekiyoruz!
        const API_KEY = process.env.GROQ_API_KEY;

        // Groq'a asıl isteği atan yer burası (Güvenli Sunucu)
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        // Groq'tan gelen cevabı senin script.js dosyana geri gönder
        return res.status(200).json(data);
        
    } catch (error) {
        return res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
}