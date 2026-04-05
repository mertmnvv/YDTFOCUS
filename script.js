// [+] DEĞİŞKENLER VE LOKAL HAFIZA
let myWords = JSON.parse(localStorage.getItem('ydtWords')) || [];
let wrongIds = JSON.parse(localStorage.getItem('wrongIds')) || []; 
let ydtStats = JSON.parse(localStorage.getItem('ydtStats')) || {
    streak: 0,
    lastDate: "",
    streakDate: "", // Serinin en son kazanıldığı gün
    dailyMinutes: 0,
    todayInitialReview: 0 // Günün başındaki toplam hedef
};
let activeSeconds = 0; 
let translationTimeout;

const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');
correctSound.volume = 0.3;
wrongSound.volume = 0.3;

let bankShowLimit = 10;
let currentArcTab = 'words';
let arcPage = 1;
const arcPerPage = 50;




// [+] CEFR SEVİYE TAHMİN ALGORİTMASI
function getCEFRLevel(word) {
    if (!word) return "A1";
    const cleanWord = word.trim();
    // Phrasal verbler (boşluk içerenler) genelde B2 seviye kabul edilir
    if (cleanWord.includes(" ")) return "B2"; 
    
    const len = cleanWord.length;
    if (len <= 4) return "A1";
    if (len === 5) return "A2";
    if (len >= 6 && len <= 7) return "B1";
    if (len >= 8 && len <= 9) return "B2";
    if (len >= 10 && len <= 11) return "C1";
    return "C2"; // 12 ve üzeri akademik kelimeler
}

// Seviyeye göre renk veren fonksiyon
function getCEFRColor(level) {
    if (level.includes("A")) return "#30d158"; // A1-A2: Yeşil
    if (level.includes("B")) return "#0a84ff"; // B1-B2: Mavi
    if (level.includes("C")) return "#bf5af2"; // C1-C2: Mor
    return "#8e8e93";
}

// Kelimeleri Güvenli Hale Getir
myWords = myWords.map(w => ({
    ...w, level: w.level || 0, nextReview: w.nextReview || Date.now(),
    correctCount: w.correctCount || 0, wrongCount: w.wrongCount || 0
}));
localStorage.setItem('ydtWords', JSON.stringify(myWords));


// =======================================================================
// [SON SÜRÜM] GROQ API (LLAMA 3.1) - GÜNCEL VE AKTİF MODEL
// =======================================================================
// =======================================================================
// [SON SÜRÜM] GROQ API - DİNAMİK KONU VE SEVİYE SEÇİMLİ MODEL
// =======================================================================
async function generateAIText() {
    const btn = document.getElementById('btnGenerateAI');
    const levelSelect = document.getElementById('aiLevelSelect');
    const topicSelect = document.getElementById('aiTopicSelect'); // YENİ EKLENDİ
    const inputArea = document.getElementById('readingInput');
    
    const level = levelSelect.value;
    const topic = topicSelect.value;
    const topicText = topicSelect.options[topicSelect.selectedIndex].text; // Menüdeki yazıyı almak için
    
    btn.disabled = true;
    btn.innerText = "⏳ Üretiliyor...";
    inputArea.value = `Llama 3.1 AI (${level} Seviye - ${topicText}) metni üretiyor, lütfen bekleyin...`;

    // KULLANICININ SEÇİMİNE GÖRE DİNAMİK PROMPT (KOMUT) OLUŞTURMA
    let prompt = "";
    if (topic === "story") {
        prompt = `Write a short fictional English story or adventure tale. Level: ${level} CEFR. Length: around 120-180 words. Focus on a character overcoming a challenge. Do NOT include any titles, markdown formatting, or conversational filler. ONLY return the pure English text paragraph.`;
    } else if (topic === "science") {
        prompt = `Write an English reading passage about a recent scientific discovery, space exploration, nature, or future technology. Level: ${level} CEFR. Length: around 120-180 words. Do NOT include any titles, markdown formatting, or translations. ONLY return the pure English text paragraph.`;
    } else if (topic === "exam") {
        prompt = `Write a highly academic English reading comprehension passage formatted exactly like a YDT, YDS, or TOEFL exam text. Level: ${level} CEFR. Topic: History, Sociology, Biology, or Psychology. Use advanced vocabulary, complex clauses, and formal tone. Length: 150-200 words. Do NOT include any titles or markdown. ONLY return the pure text paragraph.`;
    } else {
        // "general" seçeneği
        prompt = `Write a single English reading paragraph. Level: ${level} CEFR. Topic: Interesting historical facts, psychology, or daily life. Length: around 120-180 words. Do NOT include any titles, markdown formatting, or translations. ONLY return the pure English text paragraph.`;
    }

    // Senin Groq API Anahtarın
    const GROQ_API_KEY = "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"; 
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const fallbackTexts = {
        "A1": "Hello! My name is Alex. I live in a big city. I have a small cat...",
        "B2": "The rapid development of artificial intelligence is reshaping many industries..."
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", 
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const exactError = errorData.error?.message || JSON.stringify(errorData);
            alert("Groq API Hatası!\nSebep: " + exactError);
            throw new Error("Sunucu Hatası");
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices[0].message.content) {
            const text = data.choices[0].message.content;
            // Markdown karakterlerini (*) temizle ve ekrana bas
            inputArea.value = text.replace(/\*/g, '').trim(); 
        } else {
            throw new Error("API boş metin döndürdü.");
        }

    } catch (error) {
        console.warn("Groq Bağlantısı Sağlanamadı. Yedek metin veriliyor...", error);
        inputArea.value = fallbackTexts[level] || fallbackTexts["B2"];
    } finally {
        if (typeof processAnalysis === 'function') {
            processAnalysis(); // Metin gelince anında renklendir
        }
        btn.disabled = false;
        btn.innerText = "✨ AI Metin Üret";
        const quizArea = document.getElementById('aiReadingQuizSection');
        if(quizArea) quizArea.style.display = 'block';
    }
}
// =======================================================================  
function getDisplayLevel(internalLvl) {
    if (!internalLvl || internalLvl <= 0) return 0; // Lvl 0: Yeni
    if (internalLvl === 1) return 1;                // Lvl 1: 1. Gün
    if (internalLvl === 2 || internalLvl === 3) return 2; // Lvl 2: Pekişen (2 ve 3 günlük aralıklar)
    if (internalLvl === 4) return 3;                // Lvl 3: 1 Hafta (Gelişen)
    if (internalLvl >= 5) return 4;                 // Lvl 4: 14 Gün+ (Usta - Tam Öğrenilen)
}

function checkAndUpdateStats() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    
    if (ydtStats.lastDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

        if (ydtStats.streakDate !== yesterdayStr && ydtStats.streakDate !== todayStr) {
            ydtStats.streak = 0;
        }
        
        ydtStats.lastDate = todayStr;
        ydtStats.dailyMinutes = 0;
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        ydtStats.todayInitialReview = myWords.filter(w => w.nextReview <= todayEnd.getTime()).length;

        localStorage.setItem('ydtStats', JSON.stringify(ydtStats));
    }
}

// Akıllı Kronometre
setInterval(() => {
    if (!document.hidden) { 
        activeSeconds++;
        if (activeSeconds >= 60) { 
            activeSeconds = 0;
            ydtStats.dailyMinutes++;
            localStorage.setItem('ydtStats', JSON.stringify(ydtStats));
            const timeEl = document.getElementById('statTime');
            if (timeEl) {
                timeEl.innerText = ydtStats.dailyMinutes >= 60 
                    ? `${Math.floor(ydtStats.dailyMinutes / 60)} sa ${ydtStats.dailyMinutes % 60} dk` 
                    : `${ydtStats.dailyMinutes} dk`;
            }
        }
    }
}, 1000);


// [+] DASHBOARD VE LİSTE GÜNCELLEME SİSTEMİ
function updateDashboard() {
    if(!document.getElementById('statTotalWords')) return;
    
    checkAndUpdateStats(); // Güne başlangıç kontrolü
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayTimestamp = todayEnd.getTime();

    const total = myWords.length;
    // Öğrenilen sayısını Görsel Seviye 4 (Usta) olanlardan çek
    const learned = myWords.filter(w => getDisplayLevel(w.level) >= 4).length; 
    const toReview = myWords.filter(w => w.nextReview <= todayTimestamp).length;

    // --- %70 SERİ KAZANMA ALGORİTMASI ---
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    
    if (ydtStats.streakDate !== todayStr) {
        let initial = ydtStats.todayInitialReview || 0;
        let requiredToComplete = Math.ceil(initial * 0.7); 
        let completedToday = initial - toReview; 
        
        if ((initial === 0 && total > 0) || (initial > 0 && completedToday >= requiredToComplete)) {
            ydtStats.streak++;
            ydtStats.streakDate = todayStr;
            localStorage.setItem('ydtStats', JSON.stringify(ydtStats));
        }
    }

    let totalC = 0, totalW = 0;
    myWords.forEach(w => { totalC += w.correctCount; totalW += w.wrongCount; });
    const acc = (totalC + totalW) === 0 ? 0 : Math.round((totalC / (totalC + totalW)) * 100);

    // Kutu İstatistikleri
    document.getElementById('statTotalWords').innerText = total;
    document.getElementById('statLearned').innerText = learned;
    document.getElementById('statToReview').innerText = toReview;
    document.getElementById('statAccuracy').innerText = "%" + acc;

    const targetPercentage = total === 0 ? 0 : Math.min(100, Math.round((total / 2000) * 100));
    document.getElementById('targetCurrent').innerText = total;
    document.getElementById('targetProgressBar').style.width = targetPercentage + "%";

    // [+] YENİ HTML ID'LERİYLE KUSURSUZ SEVİYE HESABI
    const count0 = myWords.filter(w => getDisplayLevel(w.level) === 0).length;
    const count1 = myWords.filter(w => getDisplayLevel(w.level) === 1).length;
    const count2 = myWords.filter(w => getDisplayLevel(w.level) === 2).length;
    const count3 = myWords.filter(w => getDisplayLevel(w.level) === 3).length;
    const count4 = learned;

    if(document.getElementById('countLvl0')) document.getElementById('countLvl0').innerText = count0;
    if(document.getElementById('countLvl1')) document.getElementById('countLvl1').innerText = count1;
    if(document.getElementById('countLvl2')) document.getElementById('countLvl2').innerText = count2;
    if(document.getElementById('countLvl3')) document.getElementById('countLvl3').innerText = count3;
    if(document.getElementById('countLvl4')) document.getElementById('countLvl4').innerText = count4;

    if(document.getElementById('barLvl0')) document.getElementById('barLvl0').style.width = total === 0 ? "0%" : (count0 / total * 100) + "%";
    if(document.getElementById('barLvl1')) document.getElementById('barLvl1').style.width = total === 0 ? "0%" : (count1 / total * 100) + "%";
    if(document.getElementById('barLvl2')) document.getElementById('barLvl2').style.width = total === 0 ? "0%" : (count2 / total * 100) + "%";
    if(document.getElementById('barLvl3')) document.getElementById('barLvl3').style.width = total === 0 ? "0%" : (count3 / total * 100) + "%";
    if(document.getElementById('barLvl4')) document.getElementById('barLvl4').style.width = total === 0 ? "0%" : (count4 / total * 100) + "%";
    
    const streakEl = document.getElementById('statStreak');
    const timeEl = document.getElementById('statTime');
    if(streakEl) streakEl.innerText = ydtStats.streak;
    if(timeEl) {
        timeEl.innerText = ydtStats.dailyMinutes >= 60 
            ? `${Math.floor(ydtStats.dailyMinutes / 60)} sa ${ydtStats.dailyMinutes % 60} dk` 
            : `${ydtStats.dailyMinutes} dk`;
    }

    const attachPopup = (id, type) => {
        const el = document.getElementById(id);
        if(el && el.parentElement) {
            el.parentElement.style.cursor = "pointer";
            el.parentElement.onclick = () => showStatsDetail(type);
        }
    };
    
    attachPopup('statTotalWords', 'all');
    attachPopup('statLearned', 'learned');
    attachPopup('statToReview', 'review');
    
    attachPopup('countLvl0', 'lvl0');
    attachPopup('countLvl1', 'lvl1');
    attachPopup('countLvl2', 'lvl2');
    attachPopup('countLvl3', 'lvl3');
    attachPopup('countLvl4', 'learned');
}


// [+] POP-UP (MODAL) LİSTELEME
function showStatsDetail(type) {
    const modal = document.getElementById('statsModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    if(!modal || !body || !title) return;

    let list = []; const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    if(type === 'all') { title.innerText = "📚 Tüm Kelimeler"; list = [...myWords].reverse(); } 
    else if(type === 'learned') { title.innerText = "✅ Tam Öğrenilenler (Usta)"; list = myWords.filter(w => getDisplayLevel(w.level) >= 4); } 
    else if(type === 'review') { title.innerText = "⏱️ Bugün Tekrar Edilecekler"; list = myWords.filter(w => w.nextReview <= todayEnd.getTime()); } 
    else if(type === 'lvl0') { title.innerText = "🆕 Yeni Kelimeler"; list = myWords.filter(w => getDisplayLevel(w.level) === 0); } 
    else if(type === 'lvl1') { title.innerText = "🔥 1. Gün Kelimeleri"; list = myWords.filter(w => getDisplayLevel(w.level) === 1); }
    else if(type === 'lvl2') { title.innerText = "🔄 Pekişen Kelimeler"; list = myWords.filter(w => getDisplayLevel(w.level) === 2); }
    else if(type === 'lvl3') { title.innerText = "📈 1 Hafta Kelimeleri"; list = myWords.filter(w => getDisplayLevel(w.level) === 3); }

    body.innerHTML = list.length > 0 ? list.map(w => `
        <div class="bento-list-item">
            <div style="display:flex; align-items:center; gap:15px;">
                <button class="tts-btn" onclick="playSound('${w.word.replace(/'/g, "\\'")}', event)">🔊</button>
                <div style="text-align:left;">
                    <b style="color:var(--text); font-size:1.15rem; letter-spacing:-0.3px;">${w.word}</b><br>
                    <small style="color:var(--text-muted); font-size:0.9rem;">${w.meaning}</small>
                </div>
            </div>
            <span style="background: rgba(10, 132, 255, 0.15); color: var(--accent); padding: 6px 12px; border-radius: 12px; font-weight: 700; font-size: 0.8rem; flex-shrink: 0;">Lvl ${getDisplayLevel(w.level)}</span>
        </div>
    `).join('') : "<p style='text-align:center; color:var(--text-muted); padding:30px 0; font-weight:500; font-size: 1.1rem;'>Bu kategoride kelime bulunamadı.</p>";

    modal.style.display = 'block';
}

function closeStatsModal() { 
    const modal = document.getElementById('statsModal');
    if(modal) modal.style.display = 'none'; 
}


// =======================================================================
// [TAMİR EDİLDİ] SÖZLÜK AÇMA / KAPATMA SİSTEMİ
// =======================================================================

async function openEngEngDict(word) {
    const overlay = document.getElementById('dictOverlay');
    const content = document.getElementById('dictContent');
    
    // 1. Önce görünür yap (Display flex olmalı ki aşağı yaslansın)
    overlay.style.display = 'flex';
    
    // 2. Bir milisaniye bekle ve active class'ını ekle (Animasyonun çalışması için)
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);

    content.innerHTML = `<p style="text-align:center; padding:20px;">🔍 <b>${word}</b> yükleniyor...</p>`;

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        const entry = data[0];
        const def = entry.meanings[0].definitions[0];

        content.innerHTML = `
            <h3 style="color:var(--accent); margin-bottom:10px; font-size:1.4rem;">${entry.word}</h3>
            <p style="line-height:1.5;"><b>Definition:</b> ${def.definition}</p>
            ${def.example ? `<p style="margin-top:12px; padding:10px; background:rgba(255,255,255,0.05); border-left:3px solid var(--accent); font-style:italic; font-size:0.95rem;">" ${def.example} "</p>` : ''}
        `;
    } catch (e) {
        content.innerHTML = `<p style="text-align:center; color:var(--error); padding:20px;">❌ Tanım bulunamadı.</p>`;
    }
}

function closeDictModal(e) {
    // Eğer tıklama overlay'e (boşluğa) veya kapatma butonuna yapıldıysa
    const overlay = document.getElementById('dictOverlay');
    
    // Önce animasyonu geri sar (aşağı kaydır)
    overlay.classList.remove('active');
    
    // Animasyon (0.3s) bittikten sonra tamamen gizle
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}


function startSmartQuiz() {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayTimestamp = todayEnd.getTime();

    let reviewPool = myWords.filter(w => w.nextReview <= todayTimestamp);
    if(reviewPool.length === 0) {
        alert("Harika! Bugün (veya gece yarısından sonra) tekrar edilecek kelimen kalmadı.");
        return;
    }
    currentQuizMode = "smart";
    setupQuiz(reviewPool, reviewPool.length);
}

function playSound(text, event) {
    if(event) event.stopPropagation(); 
    if(!text || text === "Boş" || text === "Kelime") return;
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; window.speechSynthesis.speak(utterance);
}

function openGoogleTranslate() {
    const text = document.getElementById('readingInput').value;
    if(!text.trim()) { alert("Lütfen çevrilecek metni girin."); return; }
    const url = `https://translate.google.com/?sl=auto&tl=tr&text=${encodeURIComponent(text)}&op=translate`; window.open(url, '_blank');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const targetSection = document.getElementById(tabId + 'Section');
    if (targetSection) targetSection.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav'));
    const targetBtn = document.getElementById('btn-' + tabId);
    if (targetBtn) targetBtn.classList.add('active-nav');
    
    if(tabId === 'mistakes') renderMistakes();
    if(tabId === 'archive') renderArchive();
    if(tabId === 'dashboard') updateDashboard(); 
}

function showQuizSub(mode) {
    const areas = ['testArea', 'archiveQuizArea', 'phrasalQuizArea', 'mistakeQuizArea', 'flashArea', 'archiveFlashArea', 'smartQuizArea'];
    areas.forEach(a => {
        const el = document.getElementById(a);
        if (el) el.style.display = 'none';
    });
    const targetArea = document.getElementById(mode + 'Area') || document.getElementById(mode);
    if (targetArea) targetArea.style.display = (mode.includes('flash') || mode.includes('Flash')) ? 'flex' : 'block';
    if (mode === 'flash') prepareFlashcards();
    if (mode === 'archiveFlash') prepareArchiveFlashcards();

    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    const targetNav = document.getElementById('nav' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (targetNav) targetNav.classList.add('active');
}

function toggleAccordion(btn) { btn.parentElement.classList.toggle('active'); }
function toggleBankAccordion() { const container = document.getElementById('bankamContainer'); container.style.display = container.style.display === 'none' ? 'block' : 'none'; }
function showMoreBank() { bankShowLimit += 10; renderWords(); }
function switchArchiveTab(tab) { currentArcTab = tab; arcPage = 1; document.getElementById('navArcWords').classList.remove('active'); document.getElementById('navArcPhrasal').classList.remove('active'); document.getElementById(tab === 'words' ? 'navArcWords' : 'navArcPhrasal').classList.add('active'); renderArchive(); }
function prevArchivePage() { if (arcPage > 1) { arcPage--; renderArchive(); } }
function nextArchivePage() { let dataPool = currentArcTab === 'words' ? ydtArchiveData : (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []); if (arcPage < Math.ceil(dataPool.length / arcPerPage)) { arcPage++; renderArchive(); } }

function renderArchive() {
    const list = document.getElementById('archiveWordsList');
    let dataPool = currentArcTab === 'words' ? ydtArchiveData : (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []);
    if (!dataPool || dataPool.length === 0) { list.innerHTML = "<p>Bu kategori için veri bulunamadı.</p>"; return; }

    document.getElementById('archiveCountBadge').innerText = `${dataPool.length} Kayıt`;
    const totalPages = Math.ceil(dataPool.length / arcPerPage) || 1;
    document.getElementById('archivePageInfo').innerText = `Sayfa ${arcPage} / ${totalPages}`;

    const startIdx = (arcPage - 1) * arcPerPage;
    const currentData = dataPool.slice(startIdx, startIdx + arcPerPage);
    const currentStatusClass = currentArcTab === 'words' ? 'status-archive' : 'status-phrasal';

    let html = "";
    currentData.forEach(item => {
        const wordText = item.phrase || item.word;
        const bankItem = myWords.find(m => m.word.toLowerCase() === wordText.toLowerCase());
        const isLearned = bankItem && getDisplayLevel(bankItem.level) >= 4;
        const isAdded = !!bankItem;

        // CEFR Verilerini Al
        const cefrLvl = getCEFRLevel(wordText);
        const cefrCol = getCEFRColor(cefrLvl);

        html += `
            <div class="word-card archive-word-card ${currentStatusClass}">
                <div class="word-info">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <b>${wordText}</b>
                        <span class="cefr-badge" style="background: ${cefrCol}22; color: ${cefrCol}; border: 1px solid ${cefrCol}55;">${cefrLvl}</span>
                        <span class="tts-icon" onclick="playSound('${wordText.replace(/'/g, "\\'")}', event)">🔊</span>
                        ${isLearned ? `<span class="badge-learned-mini">✅ ÖĞRENİLDİ</span>` : ''}
                    </div>
                    <span class="meaning">${item.meaning}</span>
                    <span class="syn-badge">Eş: ${item.syn}</span>
                </div>
                <div>${isAdded ? `<span class="badge-primary">✔ Eklendi</span>` : `<button class="btn-add-archive" onclick="addFromArchive('${wordText}')">+ Ekle</button>`}</div>
            </div>`;
    });
    list.innerHTML = html;
}

function addFromArchive(wordText) {
    const data = ydtArchiveData.find(w => w.word === wordText) || (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs.find(p => p.phrase === wordText) : null);
    if(!data) return;
    if(myWords.some(w => w.word.toLowerCase() === wordText.toLowerCase())) { alert("Bu kelime zaten bankanızda mevcut!"); return; }
    
    myWords.push({ id: Date.now(), word: data.phrase || data.word, meaning: data.meaning, syn: data.syn, level: 0, nextReview: Date.now(), correctCount: 0, wrongCount: 0 });
    localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); renderArchive(); renderMistakes(); updateDashboard();
    if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
}

function processAnalysis() {
    const area = document.getElementById('displayArea');
    const text = document.getElementById('readingInput').value;
    if(!text.trim()) { area.innerHTML = ""; return; }
    area.innerHTML = "";
    
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

    sentences.forEach(sentenceText => {
        const sentenceSpan = document.createElement('span');
        sentenceSpan.className = "focus-sentence";
        sentenceSpan.onclick = function(e) {
            if(isFocusMode && !this.classList.contains('is-focused')) {
                e.stopPropagation();
                document.querySelectorAll('.focus-sentence').forEach(el => el.classList.remove('is-focused'));
                this.classList.add('is-focused');
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        const tokens = sentenceText.split(/(\s+)/);
        for (let i = 0; i < tokens.length; i++) {
            let word = tokens[i];
            if (!word.trim()) { sentenceSpan.appendChild(document.createTextNode(word)); continue; }

            let cleanWord = word.replace(/[^\p{L}]/gu, "").toLowerCase().trim();
            let foundPV = null; let skipTokens = 0;

            if (typeof ydtPhrasalVerbs !== 'undefined') {
                for (let pv of ydtPhrasalVerbs) {
                    const parts = pv.phrase.split(" ");
                    if (cleanWord === parts[0] && tokens[i+2] && tokens[i+2].replace(/[^\p{L}]/gu, "").toLowerCase().trim() === parts[1]) {
                        foundPV = pv; skipTokens = 2; break;
                    }
                }
            }

            const span = document.createElement('span');
            span.className = "hover-word";
            span.onclick = function(e) {
                if (isFocusMode) {
                    const parentSentence = this.closest('.focus-sentence');
                    if (!parentSentence.classList.contains('is-focused')) {
                        e.preventDefault(); e.stopPropagation(); 
                        document.querySelectorAll('.focus-sentence').forEach(el => el.classList.remove('is-focused'));
                        parentSentence.classList.add('is-focused');
                        parentSentence.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return; 
                    }
                }
                e.stopPropagation();
                fetchDetails(foundPV ? foundPV.phrase : cleanWord);
            };

            if (foundPV) {
                let fullText = ""; for (let j = 0; j <= skipTokens; j++) fullText += tokens[i + j];
                span.innerText = fullText; span.classList.add('is-archive'); i += skipTokens;
            } else {
                span.innerText = word;
                if (myWords.some(w => w.word.toLowerCase() === cleanWord)) span.classList.add('is-saved'); 
                else if (typeof ydtArchiveData !== 'undefined' && ydtArchiveData.some(w => w.word.toLowerCase() === cleanWord)) span.classList.add('is-data'); 
            }
            setupTooltip(span, foundPV ? foundPV.phrase : cleanWord);
            sentenceSpan.appendChild(span);
        }
        area.appendChild(sentenceSpan); area.appendChild(document.createTextNode(" "));
    });

    if(isFocusMode) setupFocusObserver(); 
}

function setupTooltip(span, target) {
    span.onmouseenter = (e) => {
        clearTimeout(translationTimeout);
        translationTimeout = setTimeout(async () => {
            const tip = document.getElementById('tooltip');
            tip.style.display = "block"; tip.style.left = e.pageX + "px"; tip.style.top = (e.pageY - 40) + "px";
            
            const myW = myWords.find(w => w.word.toLowerCase() === target);
            const pvW = (typeof ydtPhrasalVerbs !== 'undefined') ? ydtPhrasalVerbs.find(p => p.phrase === target) : null;
            const datW = (typeof ydtArchiveData !== 'undefined') ? ydtArchiveData.find(d => d.word.toLowerCase() === target) : null;

            if (myW) tip.innerText = "🏦 " + myW.meaning;
            else if (pvW) tip.innerText = "📚 " + pvW.meaning;
            else if (datW) tip.innerText = "📙 " + datW.meaning;
            else { const trans = await getSmartTranslation(target); tip.innerText = "🌐 " + trans.tr; }
        }, 250);
    };
    span.onmouseleave = () => { document.getElementById('tooltip').style.display = "none"; clearTimeout(translationTimeout); };
}

async function getSmartTranslation(word) {
    try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(word)}`);
        const d = await r.json();
        if (d[2] === 'tr') {
            const r2 = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=en&dt=t&q=${encodeURIComponent(word)}`);
            const d2 = await r2.json(); return { en: d2[0][0][0].toLowerCase(), tr: word }; 
        }
        return { en: word, tr: d[0][0][0].toLowerCase() };
    } catch { return { en: word, tr: "Hata" }; }
}

async function fetchDetails(word) {
    const wIn = document.getElementById('wordInput'); const mIn = document.getElementById('meaningInput'); const sIn = document.getElementById('synonymInput');
    let cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return;
    wIn.value = cleanWord; mIn.value = "Aranıyor..."; sIn.value = "-";

    const pvFind = (typeof ydtPhrasalVerbs !== 'undefined') ? ydtPhrasalVerbs.find(p => p.phrase === cleanWord) : null;
    if (pvFind) { mIn.value = pvFind.meaning; sIn.value = pvFind.syn; return; }
    const arcFind = (typeof ydtArchiveData !== 'undefined') ? ydtArchiveData.find(w => w.word.toLowerCase() === cleanWord) : null;
    if (arcFind) { mIn.value = arcFind.meaning; sIn.value = arcFind.syn; return; }
    const myWordFind = myWords.find(w => w.word.toLowerCase() === cleanWord);
    if (myWordFind) { mIn.value = myWordFind.meaning; sIn.value = myWordFind.syn; return; }

    try {
        const trans = await getSmartTranslation(cleanWord);
        if (trans.en !== cleanWord) { wIn.value = trans.en; mIn.value = trans.tr; cleanWord = trans.en; } else { mIn.value = trans.tr; }

        const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (dictRes.ok) {
            const dictData = await dictRes.json(); let syns = [];
            dictData[0].meanings.forEach(m => { if (m.synonyms && m.synonyms.length > 0) { syns = [...syns, ...m.synonyms.filter(s => !s.includes(" ") && s.length < 15)]; } });
            if (syns.length > 0) sIn.value = [...new Set(syns)].slice(0, 3).join(", ");
            else fetchDatamuseFallback(cleanWord, sIn); 
        } else { fetchDatamuseFallback(cleanWord, sIn); }
    } catch { sIn.value = "-"; }
}

async function fetchDatamuseFallback(word, sInElement) {
    try {
        const synRes = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
        const synData = await synRes.json();
        if (synData && synData.length > 0) sInElement.value = synData.filter(item => !item.word.includes(" ")).slice(0, 3).map(i => i.word).join(", ");
        else sInElement.value = "-";
    } catch { sInElement.value = "-"; }
}

function saveNewWord() {
    const w = document.getElementById('wordInput').value.trim(); const m = document.getElementById('meaningInput').value.trim(); const s = document.getElementById('synonymInput').value.trim();
    if (!w || !m) return;
    if (myWords.some(item => item.word.toLowerCase() === w.toLowerCase())) { alert("Bu kelime zaten bankanızda mevcut!"); return; }

    myWords.push({ id: Date.now(), word: w, meaning: m, syn: s || "-", level: 0, nextReview: Date.now(), correctCount: 0, wrongCount: 0 });
    localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); updateDashboard();
    ['wordInput','meaningInput','synonymInput'].forEach(id => document.getElementById(id).value = "");
    if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
}

function renderWords() {
    const listArea = document.getElementById('savedWordsList');
    if (!listArea) return;

    // Hem eski sayacı (varsa) hem de yeni yüzen butondaki sayacı güncelle
    const countLabel = document.getElementById('wordCount');
    if(countLabel) countLabel.innerText = myWords.length;
    
    const globalCountLabel = document.getElementById('globalBankCount');
    if(globalCountLabel) globalCountLabel.innerText = myWords.length;

    let html = "";
    let reversedWords = [...myWords].reverse();
    let wordsToShow = reversedWords.slice(0, bankShowLimit);

    wordsToShow.forEach(item => {
        if (!item || !item.word) return;

        const lowerW = item.word.toLowerCase().trim();
        const inArchive = (typeof ydtArchiveData !== 'undefined') && ydtArchiveData.some(a => a.word.toLowerCase().trim() === lowerW);
        const inPhrasal = (typeof ydtPhrasalVerbs !== 'undefined') && ydtPhrasalVerbs.some(p => p.phrase.toLowerCase().trim() === lowerW);
        const isWrongBefore = (typeof wrongIds !== 'undefined') && (wrongIds.includes(item.word) || wrongIds.includes(lowerW));
        const isLearned = getDisplayLevel(item.level) >= 4;

        let statusClass = "";
        if (inArchive && inPhrasal) statusClass = "status-both";
        else if (inArchive) statusClass = "status-archive";
        else if (inPhrasal) statusClass = "status-phrasal";

        // CEFR Verilerini Al
        const cefrLvl = getCEFRLevel(item.word);
        const cefrCol = getCEFRColor(cefrLvl);

        html += `
        <div class="word-card ${statusClass}">
            <div class="word-info">
                <div class="word-header-row">
                    <b onclick="openEngEngDict('${item.word.replace(/'/g, "\\'")}')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; color:var(--text);">${item.word}</b>
                    <span class="cefr-badge" style="background: ${cefrCol}22; color: ${cefrCol}; border: 1px solid ${cefrCol}55;">${cefrLvl}</span>
                    <span class="tts-icon" onclick="playSound('${item.word.replace(/'/g, "\\'")}', event)">🔊</span>
                    ${isLearned ? `<span class="badge-learned-mini">✅</span>` : ''}
                    ${(isWrongBefore && !isLearned) ? `<span class="badge-danger-mini">⚠️</span>` : ''}
                </div>
                <span class="meaning">${item.meaning}</span>
                ${item.syn && item.syn !== '-' ? `<span class="syn-badge">${item.syn}</span>` : ''}
            </div>
            <button class="del-btn" onclick="deleteWord(${item.id})" title="Sil">🗑️</button>
        </div>`;
    });

    listArea.innerHTML = html || "<p style='text-align:center; color:var(--text-muted);'>Bankan henüz boş.</p>";
    const btn = document.getElementById('showMoreBankBtn');
    if(btn) btn.style.display = myWords.length > bankShowLimit ? 'block' : 'none';
}

// =======================================================================
// [+] BANKADA ANLIK (CANLI) KELİME ARAMA FONKSİYONU
// =======================================================================
function filterWords(query) {
    const listArea = document.getElementById('savedWordsList');
    if (!listArea) return;

    const lowerQuery = query.toLowerCase().trim();
    
    // Eğer arama kutusu tamamen silinip boşaltıldıysa, bankanın standart görünümüne dön
    if (!lowerQuery) {
        renderWords();
        return;
    }

    // Arama yaparken limit koymuyoruz, bankadaki eşleşen TÜM kelimeleri getiriyoruz
    const filteredWords = [...myWords].reverse().filter(item => {
        return (item.word && item.word.toLowerCase().includes(lowerQuery)) ||
               (item.meaning && item.meaning.toLowerCase().includes(lowerQuery)) ||
               (item.syn && item.syn.toLowerCase().includes(lowerQuery));
    });

    let html = "";
    filteredWords.forEach(item => {
        const lowerW = item.word.toLowerCase().trim();
        const inArchive = (typeof ydtArchiveData !== 'undefined') && ydtArchiveData.some(a => a.word.toLowerCase().trim() === lowerW);
        const inPhrasal = (typeof ydtPhrasalVerbs !== 'undefined') && ydtPhrasalVerbs.some(p => p.phrase.toLowerCase().trim() === lowerW);
        const isWrongBefore = (typeof wrongIds !== 'undefined') && (wrongIds.includes(item.word) || wrongIds.includes(lowerW));
        const isLearned = getDisplayLevel(item.level) >= 4;

        let statusClass = "";
        if (inArchive && inPhrasal) statusClass = "status-both";
        else if (inArchive) statusClass = "status-archive";
        else if (inPhrasal) statusClass = "status-phrasal";

        // CEFR Seviyesini ve Rengini Çek
        const cefrLvl = typeof getCEFRLevel === "function" ? getCEFRLevel(item.word) : "A1";
        const cefrCol = typeof getCEFRColor === "function" ? getCEFRColor(cefrLvl) : "#30d158";

        html += `
        <div class="word-card ${statusClass}">
            <div class="word-info">
                <div class="word-header-row">
                    <b onclick="openEngEngDict('${item.word.replace(/'/g, "\\'")}')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; color:var(--text);">${item.word}</b>
                    <span class="cefr-badge" style="background: ${cefrCol}22; color: ${cefrCol}; border: 1px solid ${cefrCol}55;">${cefrLvl}</span>
                    <span class="tts-icon" onclick="playSound('${item.word.replace(/'/g, "\\'")}', event)">🔊</span>
                    ${isLearned ? `<span class="badge-learned-mini">✅</span>` : ''}
                    ${(isWrongBefore && !isLearned) ? `<span class="badge-danger-mini">⚠️</span>` : ''}
                </div>
                <span class="meaning">${item.meaning}</span>
                ${item.syn && item.syn !== '-' ? `<span class="syn-badge">${item.syn}</span>` : ''}
            </div>
            <button class="del-btn" onclick="deleteWord(${item.id})" title="Sil">🗑️</button>
        </div>`;
    });

    // Eğer eşleşen sonuç yoksa şık bir uyarı ver
    listArea.innerHTML = html || "<div style='text-align:center; padding:30px 10px; color:var(--text-muted);'>Aradığın kelime bankanda bulunamadı. 🔍</div>";
    
    // Arama modundayken "Daha Fazla Kelime Yükle" butonunu gizle
    const btn = document.getElementById('showMoreBankBtn');
    if (btn) btn.style.display = 'none';
}
// =======================================================================



function deleteWord(id) {
    myWords = myWords.filter(w => w.id !== id); localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); updateDashboard(); if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
}

let qIdx = 0, qSet = [], currentQuizMode = "";

function startQuiz() { 
    if(myWords.length < 4) return alert("Banka quizi için en az 4 kelimen olmalı!");
    currentQuizMode = "test"; 
    const countSelect = document.getElementById('bankQuizCount');
    let count = (countSelect && countSelect.value !== 'all') ? parseInt(countSelect.value) : myWords.length;
    if(count > myWords.length) count = myWords.length;
    setupQuiz(myWords, count); 
}

function startArchiveQuiz() {
    currentQuizMode = "archive"; const countSelect = document.getElementById('arcQuizCount');
    setupQuiz(ydtArchiveData, countSelect ? parseInt(countSelect.value) : 20);
}

function startPhrasalQuiz() {
    if(typeof ydtPhrasalVerbs === 'undefined') return alert("Veri eksik!");
    currentQuizMode = "phrasal"; const countSelect = document.getElementById('phrasalQuizCount');
    let count = countSelect ? parseInt(countSelect.value) : 20;
    if(countSelect && countSelect.value === 'all') count = ydtPhrasalVerbs.length;
    setupQuiz(ydtPhrasalVerbs, count);
}

function startMistakeQuiz() {
    currentQuizMode = "mistake"; let mistakes = [];
    wrongIds.forEach(w => {
        let found = myWords.find(m => m.word === w) || (typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.find(a => a.word === w) : null) || (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs.find(p => p.phrase === w) : null);
        if(found) mistakes.push(found);
    });
    if(mistakes.length < 4) return alert("Hata quizi için en az 4 hatalı kelimen olmalı!");
    const countSelect = document.getElementById('mistakeQuizCount');
    let count = (countSelect && countSelect.value !== 'all') ? parseInt(countSelect.value) : mistakes.length;
    setupQuiz(mistakes, count);
}

function setupQuiz(pool, count) {
    if (!pool || pool.length === 0) { alert("Gereken veri bulunamadı!"); return; }
    qIdx = 0; qSet = [];
    pool.forEach(w => {
        if (!w.word && !w.phrase) return; qSet.push({ ...w, askType: 'meaning' });
        if(w.syn && w.syn !== '-' && w.syn.trim() !== '') qSet.push({ ...w, askType: 'synonym' });
    });
    qSet = qSet.sort(() => 0.5 - Math.random()).slice(0, count);
    
    const prefixMap = { "test": "quiz", "archive": "arcQuiz", "phrasal": "phrasalQuiz", "mistake": "mistakeQuiz", "smart": "smartQuiz" };
    const prefix = prefixMap[currentQuizMode] || "quiz";

    const startScreen = document.getElementById(prefix + 'StartScreen'); const questionScreen = document.getElementById(prefix + 'QuestionScreen'); const progressCont = document.getElementById(prefix + 'ProgressContainer');
    if (startScreen) startScreen.style.display = 'none'; if (questionScreen) questionScreen.style.display = 'block'; if (progressCont) progressCont.style.display = 'block';
    
    loadQuest();
}

function loadQuest() {
    const prefixMap = { "test": "quiz", "archive": "arcQuiz", "phrasal": "phrasalQuiz", "mistake": "mistakeQuiz", "smart": "smartQuiz" };
    const prefix = prefixMap[currentQuizMode] || "quiz";

    if(qIdx >= qSet.length) {
        alert("Test Bitti! Gelişim sayfasına bakabilirsin.");
        document.getElementById(prefix + 'QuestionScreen').style.display = 'none';
        if(document.getElementById(prefix + 'ProgressContainer')) document.getElementById(prefix + 'ProgressContainer').style.display = 'none';
        document.getElementById(prefix + 'StartScreen').style.display = 'block';
        updateDashboard(); return; 
    }

    const progressBar = document.getElementById(prefix + 'ProgressBar');
    if(progressBar) progressBar.style.width = (qIdx / qSet.length) * 100 + "%";

    const wordDisplay = document.getElementById(prefix + 'WordDisplay');
    const optsDiv = document.getElementById(prefix + 'Options');
    if (!wordDisplay || !optsDiv) return;
    
    optsDiv.innerHTML = "";
    const colorId = Math.floor(Math.random() * 5); 
    const q = qSet[qIdx]; let ans = "";
    
    let pool = (currentQuizMode === "phrasal") ? (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []) : [...myWords, ...(typeof ydtArchiveData !== 'undefined' ? ydtArchiveData : [])];
    let poolForOpts = [];

    if(q.askType === 'synonym') {
        wordDisplay.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:5px;">Eş Anlamlısı nedir?</span>${q.phrase || q.word}`;
        ans = q.syn; poolForOpts = pool.filter(p => p.syn && p.syn !== '-' && p.syn !== ans).map(p => p.syn);
    } else {
        wordDisplay.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:5px;">Anlamı nedir?</span>${q.phrase || q.word}`;
        ans = q.meaning; poolForOpts = pool.filter(p => p.meaning !== ans).map(p => p.meaning);
    }
    
    let opts = [ans];
    if (poolForOpts.length < 3) poolForOpts = ["Result", "Development", "Focus", "Success", "Context", "Knowledge"];

    let attempts = 0;
    while(opts.length < 4 && attempts < 100) {
        attempts++; let r = poolForOpts[Math.floor(Math.random() * poolForOpts.length)];
        if(r && !opts.includes(r)) opts.push(r);
    }
    while(opts.length < 4) opts.push("---");

    opts.sort(() => 0.5 - Math.random()).forEach(o => {
        const b = document.createElement('div'); 
        b.className = `quiz-opt color-tint-${colorId}`; b.innerText = o; b.dataset.correct = (o === ans);

        b.onclick = () => {
            const allOpts = optsDiv.querySelectorAll('.quiz-opt');
            allOpts.forEach(opt => opt.style.pointerEvents = 'none');
            const currentW = q.phrase || q.word;
            let wordInBank = myWords.find(w => w.word === currentW);

            if(o === ans) {
                if(typeof correctSound !== 'undefined') { correctSound.pause(); correctSound.currentTime = 0; correctSound.play().catch(() => {}); }
                b.classList.add('correct-ans');
                
                // [+] YENİ: MATEMATİKSEL ALGORİTMA (1, 2, 3, 7, 14 Gün)
                if(currentQuizMode === "smart" && wordInBank) {
                    wordInBank.level = (wordInBank.level || 0) + 1;
                    
                    const intervals = [1, 2, 3, 7, 14, 30]; 
                    const daysToAdd = intervals[Math.min(wordInBank.level - 1, intervals.length - 1)] || 1;
                    
                    let targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + daysToAdd);
                    targetDate.setHours(0, 0, 0, 0); 
                    wordInBank.nextReview = targetDate.getTime();
                }
                if(currentQuizMode === "mistake") wrongIds = wrongIds.filter(id => id !== currentW);
            } else {
                if(typeof wrongSound !== 'undefined') { wrongSound.pause(); wrongSound.currentTime = 0; wrongSound.play().catch(() => {}); }
                b.classList.add('wrong-ans');
                allOpts.forEach(opt => { if (opt.dataset.correct === 'true') opt.classList.add('correct-ans'); });

                if(wordInBank) {
                    wordInBank.wrongCount++;
                    if(currentQuizMode === "smart") {
                        wordInBank.level = Math.max(0, (wordInBank.level || 0) - 2); 
                        wordInBank.nextReview = Date.now(); 
                    }
                }
                if(!wrongIds.includes(currentW)) wrongIds.push(currentW); 
            }
            
            localStorage.setItem('ydtWords', JSON.stringify(myWords));
            localStorage.setItem('wrongIds', JSON.stringify(wrongIds));
            if(typeof updateDashboard === 'function') updateDashboard();

            setTimeout(() => { qIdx++; loadQuest(); }, 1200);
        };
        optsDiv.appendChild(b);
    });
}

let fQueue = [], fIdx = 0;

function populateFlashQueue(sourceArray) {
    let queue = [];
    sourceArray.forEach(w => {
        queue.push({ ...w, askType: 'meaning', colorIdx: Math.floor(Math.random() * 5) });
        if(w.syn && w.syn !== "-" && w.syn.trim() !== "") queue.push({ ...w, askType: 'synonym', colorIdx: Math.floor(Math.random() * 5) });
    });
    return queue.sort(() => 0.5 - Math.random());
}

function prepareFlashcards() { 
    if(myWords.length === 0) { document.getElementById('flashFront').innerText = "Boş"; document.getElementById('flashBackMeaning').innerText = "Bankanda kelime yok."; return; }
    fQueue = populateFlashQueue(myWords); fIdx = 0; 
    updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); 
}

function prepareArchiveFlashcards() { 
    if(typeof ydtArchiveData === 'undefined' || ydtArchiveData.length === 0) return;
    fQueue = populateFlashQueue(ydtArchiveData); fIdx = 0; 
    updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); 
}

function updateFlash(cardId, frontId, backMId, backSId, currId, totId) {
    if(fQueue.length === 0) return;
    const w = fQueue[fIdx]; const cardEl = document.getElementById(cardId);
    cardEl.classList.remove('flipped');
    
    setTimeout(() => {
        const frontFace = cardEl.querySelector('.f-front'); const backFace = cardEl.querySelector('.f-back');
        for(let i=0; i<5; i++) { frontFace.classList.remove('color-tint-'+i); backFace.classList.remove('color-tint-'+i); }
        frontFace.classList.add('color-tint-' + w.colorIdx); backFace.classList.add('color-tint-' + w.colorIdx);

        const promptId = frontId === 'flashFront' ? 'flashFrontPrompt' : 'arcFlashFrontPrompt';
        const ttsId = frontId === 'flashFront' ? 'flashFrontTTS' : 'arcFlashFrontTTS';
        
        if(w.askType === 'synonym') {
            document.getElementById(promptId).innerText = "Şu kelimenin eş anlamlısı:"; document.getElementById(frontId).innerText = w.syn;
            document.getElementById(ttsId).onclick = (e) => playSound(w.syn.replace(/'/g, "\\'"), e);
            document.getElementById(backMId).innerText = w.phrase || w.word; document.getElementById(backSId).innerText = `Anlamı: ${w.meaning}`;
        } else {
            document.getElementById(promptId).innerText = ""; document.getElementById(frontId).innerText = w.phrase || w.word;
            document.getElementById(ttsId).onclick = (e) => playSound((w.phrase || w.word).replace(/'/g, "\\'"), e);
            document.getElementById(backMId).innerText = w.meaning; document.getElementById(backSId).innerText = w.syn && w.syn !== "-" ? "Eş: " + w.syn : "";
        }
        
        document.getElementById(currId).innerText = fIdx + 1; document.getElementById(totId).innerText = fQueue.length;
    }, 150);
}

function nextFlashcard() { if(fIdx < fQueue.length-1) { fIdx++; updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); } }
function previousFlashcard() { if(fIdx > 0) { fIdx--; updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); } }
function nextArchiveFlashcard() { if(fIdx < fQueue.length-1) { fIdx++; updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); } }
function previousArchiveFlashcard() { if(fIdx > 0) { fIdx--; updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); } }

function addCurrentArcFlashToBank(event) {
    if(event) event.stopPropagation(); if(fQueue.length === 0) return;
    const w = fQueue[fIdx]; addFromArchive(w.phrase || w.word); alert("Kelime Bankaya Eklendi!");
}

function renderMistakes() {
    const list = document.getElementById('mistakesList'); let html = "";
    if (!wrongIds || wrongIds.length === 0) { list.innerHTML = "<p>Harika! Şu an hiç hatan yok.</p>"; return; }

    wrongIds.forEach(wText => {
        let word = myWords.find(m => m.word === wText) || (typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.find(a => a.word === wText) : null) || (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs.find(p => p.phrase === wText) : null);
        if(word) {
            const wordText = word.phrase || word.word;
            const isAdded = myWords.some(m => m.word.toLowerCase() === wordText.toLowerCase());
            
            // CEFR Verilerini Al
            const cefrLvl = getCEFRLevel(wordText);
            const cefrCol = getCEFRColor(cefrLvl);
            
            html += `
            <div class="word-card status-error">
                <div class="word-info">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <b>${wordText}</b>
                        <span class="cefr-badge" style="background: ${cefrCol}22; color: ${cefrCol}; border: 1px solid ${cefrCol}55;">${cefrLvl}</span>
                        <span class="tts-icon" onclick="playSound('${wordText.replace(/'/g, "\\'")}', event)">🔊</span>
                    </div>
                    <span class="meaning">${word.meaning}</span><span class="syn-badge">Eş: ${word.syn || '-'}</span>
                </div>
                <div>${isAdded ? `<span class="badge-error">✘ Hatalı (Bankada)</span>` : `<button class="btn-add-archive" onclick="addFromArchive('${wordText}')">+ Bankaya Ekle</button>`}</div>
            </div>`;
        }
    });
    list.innerHTML = html;
}

function clearMistakes() { if(confirm("Sıfırla?")) { wrongIds = []; localStorage.setItem('wrongIds', "[]"); renderMistakes(); } }
function clearAll() { document.getElementById('displayArea').innerHTML = ""; document.getElementById('readingInput').value = ""; }

function exportData() {
    const data = JSON.stringify({ myWords, wrongIds });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ydt_focus_backup.json'; a.click();
}

function importData(event) {
    const file = event.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const imported = JSON.parse(e.target.result);
        const existingWords = new Set(myWords.map(w => w.word.toLowerCase()));
        imported.myWords.forEach(w => { if(!existingWords.has(w.word.toLowerCase())) myWords.push(w); });
        wrongIds = Array.from(new Set([...wrongIds, ...(imported.wrongIds || [])]));
        localStorage.setItem('ydtWords', JSON.stringify(myWords));
        localStorage.setItem('wrongIds', JSON.stringify(wrongIds));
        renderWords(); alert("Aktarıldı!");
    };
    reader.readAsText(file);
}

let isFocusMode = false;
function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    const area = document.getElementById('displayArea'); const btn = document.getElementById('btn-focus');
    if(isFocusMode) {
        area.classList.add('focus-active'); btn.innerHTML = "🎯 Odak: AÇIK";
        if(window.innerWidth <= 900) {
            setupFocusObserver();
            setTimeout(() => { const firstSentence = document.querySelector('.focus-sentence'); if(firstSentence) firstSentence.classList.add('is-focused'); }, 100);
        }
    } else {
        area.classList.remove('focus-active'); document.querySelectorAll('.focus-sentence').forEach(el => el.classList.remove('is-focused'));
        btn.innerHTML = "🎯 Odak: KAPALI";
    }
}

function setupFocusObserver() {
    const options = { root: document.querySelector('.scrollable-reading-box'), rootMargin: '-45% 0px -45% 0px', threshold: 0 };
    const observer = new IntersectionObserver((entries) => {
        if (!isFocusMode) return;
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.focus-sentence').forEach(s => s.classList.remove('is-focused'));
                entry.target.classList.add('is-focused');
            }
        });
    }, options);
    document.querySelectorAll('.focus-sentence').forEach(sent => observer.observe(sent));
}
// [+] MOBİL YUVARLAK MENÜ (RADIAL) KONTROLLERİ
let isRadialOpen = false;

function toggleMobileMenu() {
    const menu = document.getElementById('mobileRadialMenu');
    const fab = document.getElementById('mobileMenuFab');
    if(!menu || !fab) return;

    isRadialOpen = !isRadialOpen;
    
    if (isRadialOpen) {
        menu.classList.add('is-open');
        fab.style.transform = "translateX(-50%) scale(0)"; // Menü açılınca alttaki butonu gizle
    } else {
        menu.classList.remove('is-open');
        fab.style.transform = "translateX(-50%) scale(1)"; // Menü kapanınca butonu geri getir
    }
}

function handleRadialClick(tabId) {
    switchTab(tabId);     // İlgili sekmeye git
    toggleMobileMenu();   // Seçim yapıldıktan sonra menüyü estetikçe kapat
}
// [+] GLOBAL BANKA POP-UP AÇ/KAPAT
function toggleBankDrawer() {
    const drawer = document.getElementById('globalBankDrawer');
    drawer.classList.toggle('is-open');
    
    // Banka açıldığında arkadaki asıl sayfanın kaymasını engelle (Özellikle mobil için hayat kurtarır)
    if (drawer.classList.contains('is-open')) {
        document.body.classList.add('drawer-open');
    } else {
        document.body.classList.remove('drawer-open');
    }
}


// =======================================================================
// [GELİŞMİŞ] AI READING QUIZ - TEK SEFERLİK ÜRETİM VE HATA ANALİZİ
// =======================================================================
let currentReadingQuestions = []; // Soruları ve kanıt cümlelerini saklamak için

async function generateAIQuiz() {
    const text = document.getElementById('readingInput').value;
    const quizBtn = document.getElementById('btnCreateReadingQuiz'); 
    const quizList = document.getElementById('aiReadingQuizList');

    if (!text || text.length < 50) {
        alert("Önce bir metin üretmelisiniz!");
        return;
    }

    // [Özellik 1] Butonu tamamen gizle (Tek kullanım hakkı)
    quizBtn.style.display = 'none'; 
    
    quizList.innerHTML = "<p style='text-align:center; color:var(--accent); padding:20px;'>AI metni derinlemesine analiz ediyor ve soruları hazırlıyor...</p>";
    quizList.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // AI'ya sorunun hangi cümleyle alakalı olduğunu da soruyoruz
    const prompt = `Based on the text, create 3 multiple-choice questions. 
    Crucial: For each question, identify the EXACT sentence index from the text that contains the answer (0 for 1st sentence, 1 for 2nd...).
    Format your response ONLY as a JSON array: 
    [{"q": "Question?", "a": "A", "b": "B", "c": "C", "d": "D", "correct": "a", "evidenceIndex": 0}]
    Text: ${text}`;

    const GROQ_API_KEY = "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"; 

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.4
            })
        });

        const data = await response.json();
        const rawContent = data.choices[0].message.content;
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        currentReadingQuestions = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);

        renderReadingQuizFinal(currentReadingQuestions);

    } catch (error) {
        console.error("Quiz Hatası:", error);
        quizList.innerHTML = "<p style='color:var(--error); text-align:center; padding:20px;'>Hata oluştu. Buton tekrar aktif edildi.</p>";
        quizBtn.style.display = 'inline-block'; // Hata olursa butonu geri getir
    }
}

function renderReadingQuizFinal(questions) {
    const quizList = document.getElementById('aiReadingQuizList');
    let html = "";

    questions.forEach((item, index) => {
        html += `
            <div class="quiz-card" id="ai-q-card-${index}" style="margin-bottom:20px; background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:20px; border-radius:20px;">
                <div class="quiz-question" style="font-weight:700; margin-bottom:15px;">${index + 1}. ${item.q}</div>
                <div class="quiz-options" style="display:flex; flex-direction:column; gap:10px;">
                    <button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'a')">A) ${item.a}</button>
                    <button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'b')">B) ${item.b}</button>
                    <button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'c')">C) ${item.c}</button>
                    <button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'd')">D) ${item.d}</button>
                </div>
            </div>
        `;
    });
    quizList.innerHTML = html;
}

function checkReadingAnswer(btn, qIndex, selectedLetter) {
    const question = currentReadingQuestions[qIndex];
    const card = document.getElementById(`ai-q-card-${qIndex}`);
    const options = card.querySelectorAll('.quiz-opt');

    options.forEach(opt => opt.style.pointerEvents = 'none');

    if (selectedLetter === question.correct) {
        btn.classList.add('correct');
        if(typeof createConfetti === 'function') createConfetti(btn);
    } else {
        btn.classList.add('wrong');
        
        // [Özellik 2] Metindeki ilgili cümleyi bul ve KIRMIZI yap
        const allSentences = document.querySelectorAll('.focus-sentence');
        if (allSentences[question.evidenceIndex]) {
            // Önce varsa diğer vurguları temizle
            allSentences.forEach(s => s.style.background = "none");
            
            // İlgili cümleyi işaretle
            const evidence = allSentences[question.evidenceIndex];
            evidence.style.background = "rgba(255, 69, 58, 0.3)";
            evidence.style.borderBottom = "2px solid var(--error)";
            evidence.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 3 saniye sonra vurguyu hafiflet (Kullanıcı görsün diye)
            setTimeout(() => {
                evidence.style.transition = "all 2s";
                evidence.style.background = "rgba(255, 69, 58, 0.1)";
            }, 3000);
        }

        // Doğru şıkkı göster
        options.forEach(opt => {
            if (opt.innerText.toLowerCase().startsWith(question.correct + ")")) {
                opt.classList.add('correct');
            }
        });
    }
}
function createConfetti(target) {
    for(let i=0; i<10; i++) {
        const confetti = document.createElement('div');
        confetti.innerText = "🎉";
        confetti.style.position = 'fixed';
        confetti.style.left = target.getBoundingClientRect().left + 'px';
        confetti.style.top = target.getBoundingClientRect().top + 'px';
        confetti.style.fontSize = '20px';
        confetti.style.transition = 'all 1s ease-out';
        confetti.style.zIndex = '10000';
        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.style.transform = `translate(${(Math.random()-0.5)*200}px, ${(Math.random()-0.5)*200}px) rotate(${Math.random()*360}deg)`;
            confetti.style.opacity = '0';
        }, 50);

        setTimeout(() => confetti.remove(), 1000);
    }
}
window.onload = () => { renderWords(); updateDashboard(); renderMistakes(); if(typeof renderArchive === 'function') renderArchive(); };
