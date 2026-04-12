// api/translate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Sadece POST' });

    const { word } = req.body;
    if (!word) return res.status(400).json({ error: 'Kelime eksik' });

    try {
        // Önce otomatik dilden Türkçeye çevirmeyi dene
        const r1 = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(word)}`);
        const d1 = await r1.json();
        
        // Eğer girilen kelime zaten Türkçeyse (algılanan dil 'tr' ise), İngilizceye çevir
        if (d1[2] === 'tr') {
            const r2 = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=en&dt=t&q=${encodeURIComponent(word)}`);
            const d2 = await r2.json();
            return res.status(200).json({ en: d2[0][0][0].toLowerCase(), tr: word }); 
        }
        
        // Değilse normal İngilizce -> Türkçe sonucunu dön
        return res.status(200).json({ en: word, tr: d1[0][0][0].toLowerCase() });

    } catch (error) {
        return res.status(500).json({ en: word, tr: "Hata" });
    }
}