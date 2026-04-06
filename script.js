// =======================================================================
// [1] DEĞİŞKENLER VE LOKAL HAFIZA (GLOBAL)
// =======================================================================
let myWords = JSON.parse(localStorage.getItem('ydtWords')) || [];
let wrongIds = JSON.parse(localStorage.getItem('wrongIds')) || []; 
let ydtStats = JSON.parse(localStorage.getItem('ydtStats')) || {
    streak: 0, lastDate: "", streakDate: "", dailyMinutes: 0, todayInitialReview: 0 
};
let activeSeconds = 0; 
let translationTimeout;

// Zero to Hero Özel Hafızası
let heroStats = JSON.parse(localStorage.getItem('heroStats')) || {
    'A1': { completed: 0, required: 10, unlocked: true, next: 'A2' },
    'A2': { completed: 0, required: 15, unlocked: false, next: 'B1' },
    'B1': { completed: 0, required: 20, unlocked: false, next: 'B2' },
    'B2': { completed: 0, required: 25, unlocked: false, next: 'C1' },
    'C1': { completed: 0, required: 30, unlocked: false, next: null }
};
let heroWords = JSON.parse(localStorage.getItem('heroWords')) || [];
let currentHeroLevel = ""; 
let currentHeroWords = []; 
let currentHeroScore = 0; 
let heroFinalScore = 0;   
let heroFinalQuestions = [];

const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');
correctSound.volume = 0.3; wrongSound.volume = 0.3;

let bankShowLimit = 10;
let currentArcTab = 'words';
let arcPage = 1;
const arcPerPage = 50;

// Kelimeleri Güvenli Hale Getir
myWords = myWords.map(w => ({
    ...w, level: w.level || 0, nextReview: w.nextReview || Date.now(),
    correctCount: w.correctCount || 0, wrongCount: w.wrongCount || 0
}));
localStorage.setItem('ydtWords', JSON.stringify(myWords));

// =======================================================================
// [2] YARDIMCI FONKSİYONLAR (CEFR, STATS, TİMER)
// =======================================================================
function getCEFRLevel(word) {
    if (!word) return "A1";
    const cleanWord = word.trim();
    if (cleanWord.includes(" ")) return "B2"; 
    const len = cleanWord.length;
    if (len <= 4) return "A1";
    if (len === 5) return "A2";
    if (len >= 6 && len <= 7) return "B1";
    if (len >= 8 && len <= 9) return "B2";
    if (len >= 10 && len <= 11) return "C1";
    return "C2"; 
}

function getCEFRColor(level) {
    if (level.includes("A")) return "#30d158"; 
    if (level.includes("B")) return "#0a84ff"; 
    if (level.includes("C")) return "#bf5af2"; 
    return "#8e8e93";
}

function getDisplayLevel(internalLvl) {
    if (!internalLvl || internalLvl <= 0) return 0; 
    if (internalLvl === 1) return 1;                
    if (internalLvl === 2 || internalLvl === 3) return 2; 
    if (internalLvl === 4) return 3;                
    if (internalLvl >= 5) return 4;                 
}

function checkAndUpdateStats() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (ydtStats.lastDate !== todayStr) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
        if (ydtStats.streakDate !== yesterdayStr && ydtStats.streakDate !== todayStr) ydtStats.streak = 0;
        ydtStats.lastDate = todayStr; ydtStats.dailyMinutes = 0;
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        ydtStats.todayInitialReview = myWords.filter(w => w.nextReview <= todayEnd.getTime()).length;
        localStorage.setItem('ydtStats', JSON.stringify(ydtStats));
    }
}

setInterval(() => {
    if (!document.hidden) { 
        activeSeconds++;
        if (activeSeconds >= 60) { 
            activeSeconds = 0; ydtStats.dailyMinutes++;
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

// =======================================================================
// [3] AÇIK DÜNYA: YAPAY ZEKA OKUMA VE ANALİZ
// =======================================================================
async function generateAIText() {
    const btn = document.getElementById('btnGenerateAI');
    const levelSelect = document.getElementById('aiLevelSelect');
    const topicSelect = document.getElementById('aiTopicSelect');
    const inputArea = document.getElementById('readingInput');
    const level = levelSelect.value; const topic = topicSelect.value;
    const topicText = topicSelect.options[topicSelect.selectedIndex].text; 
    
    btn.disabled = true; btn.innerText = "⏳ Üretiliyor...";
    inputArea.value = `Llama 3.1 AI (${level} Seviye - ${topicText}) metni üretiyor, lütfen bekleyin...`;

    let prompt = "";
    if (topic === "story") prompt = `Write a short fictional English story or adventure tale. Level: ${level} CEFR. Length: around 120-180 words. Focus on a character overcoming a challenge. Do NOT include any titles, markdown formatting, or conversational filler. ONLY return the pure English text paragraph.`;
    else if (topic === "science") prompt = `Write an English reading passage about a recent scientific discovery, space exploration, nature, or future technology. Level: ${level} CEFR. Length: around 120-180 words. Do NOT include any titles, markdown formatting, or translations. ONLY return the pure English text paragraph.`;
    else if (topic === "exam") prompt = `Write a highly academic English reading comprehension passage formatted exactly like a YDT, YDS, or TOEFL exam text. Level: ${level} CEFR. Topic: History, Sociology, Biology, or Psychology. Use advanced vocabulary, complex clauses, and formal tone. Length: 150-200 words. Do NOT include any titles or markdown. ONLY return the pure text paragraph.`;
    else prompt = `Write a single English reading paragraph. Level: ${level} CEFR. Topic: Interesting historical facts, psychology, or daily life. Length: around 120-180 words. Do NOT include any titles, markdown formatting, or translations. ONLY return the pure English text paragraph.`;

    const GROQ_API_KEY = "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"; 
    const url = "https://api.groq.com/openai/v1/chat/completions";

    try {
        const response = await fetch(url, {
            method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.7 })
        });
        if (!response.ok) throw new Error("Sunucu Hatası");
        const data = await response.json();
        
        if (data.choices && data.choices[0].message.content) {
            inputArea.value = data.choices[0].message.content.replace(/\*/g, '').trim(); 
        } else throw new Error("API boş metin döndürdü.");
    } catch (error) {
        inputArea.value = "Yapay zeka bağlantısı sağlanamadı. Lütfen tekrar deneyin.";
    } finally {
        if (typeof processAnalysis === 'function') processAnalysis(); 
        btn.disabled = false; btn.innerText = "✨ AI Metin Üret";
        const quizArea = document.getElementById('aiReadingQuizSection');
        if(quizArea) quizArea.style.display = 'block';
    }
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
        
        const tokens = sentenceText.split(/(\s+)/);
        for (let i = 0; i < tokens.length; i++) {
            let word = tokens[i];
            if (!word.trim()) { sentenceSpan.appendChild(document.createTextNode(word)); continue; }

            let cleanWord = word.replace(/[^\p{L}]/gu, "").toLowerCase().trim();
            if (cleanWord.length < 2) { sentenceSpan.appendChild(document.createTextNode(word)); continue; }

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
            span.onclick = function(e) { e.stopPropagation(); fetchDetails(foundPV ? foundPV.phrase : cleanWord); };

            if (foundPV) {
                let fullText = ""; for (let j = 0; j <= skipTokens; j++) fullText += tokens[i + j];
                span.innerText = fullText; span.classList.add('is-archive'); i += skipTokens;
            } else {
                span.innerText = word;
                const isSaved = myWords.some(w => w.word.toLowerCase() === cleanWord);
                if (isSaved) span.classList.add('is-saved'); 
                else {
                    const archiveItem = ydtArchiveData.find(w => (w.word || "").toLowerCase() === cleanWord);
                    if (archiveItem) {
                        const lvl = archiveItem.level;
                        if (!lvl || lvl.startsWith('B') || lvl.startsWith('C')) span.classList.add('is-data'); 
                    }
                }
            }
            setupTooltip(span, foundPV ? foundPV.phrase : cleanWord);
            sentenceSpan.appendChild(span);
        }
        area.appendChild(sentenceSpan); area.appendChild(document.createTextNode(" "));
    });
    if(isFocusMode) setupFocusObserver(); 
}

// =======================================================================
// [4] ZERO TO HERO MOTORU (YOL HARİTASI, DERSLER, KİLİTLER, BOSS)
// =======================================================================

function renderHeroRoadmap() {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    let totalRequired = 0; let totalCompleted = 0;

    levels.forEach(lvl => {
        const stats = heroStats[lvl];
        const node = document.getElementById('node' + lvl);
        if(!stats) return;

        totalRequired += stats.required; 
        totalCompleted += Math.min(stats.completed, stats.required);

        if(node) {
            const actionBtn = node.querySelector('.node-action');
            if (stats.unlocked) {
                node.classList.remove('locked'); node.classList.add('unlocked');
                if(actionBtn) {
                    actionBtn.classList.remove('locked-text');
                    const needsBossFight = stats.completed >= stats.required && (!stats.next || !heroStats[stats.next].unlocked);
                    const isFullyCompleted = stats.completed >= stats.required && stats.next && heroStats[stats.next].unlocked;

                    if (needsBossFight) {
                        actionBtn.innerHTML = `🏆 Sınava Gir (Boss Fight)`;
                        actionBtn.style.color = "#bf5af2"; 
                    } else if (isFullyCompleted) {
                        actionBtn.innerHTML = `✅ Tamamlandı (${stats.completed}/${stats.required})`;
                        actionBtn.style.color = "var(--primary)"; 
                    } else {
                        actionBtn.innerHTML = `Dersi Başlat ▶ (${stats.completed}/${stats.required})`;
                        actionBtn.style.color = "var(--accent)"; 
                    }
                }
            } else {
                node.classList.remove('unlocked'); node.classList.add('locked');
                if(actionBtn) actionBtn.innerHTML = "🔒 Kilitli";
            }
        }
    });

    const percent = totalRequired === 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100);
    const bar = document.getElementById('heroOverallBar');
    const pctText = document.getElementById('heroOverallPercent');
    if(bar) bar.style.width = percent + "%";
    if(pctText) pctText.innerText = "%" + percent;
}

async function startHeroLevel(level) {
    const stats = heroStats[level];
    currentHeroLevel = level;

    if (!stats.unlocked) { alert("Bu seviye kilitli!"); return; }

    if(typeof switchTab === 'function') switchTab('heroLesson');
    
    document.getElementById('heroLessonContent').style.display = 'none';
    document.getElementById('heroMiniQuizArea').style.display = 'none';
    document.getElementById('heroFinalExamArea').style.display = 'none';
    document.getElementById('heroLessonActions').style.display = 'none';
    document.getElementById('heroLessonLoading').style.display = 'block';

    const needsBossFight = stats.completed >= stats.required && (!stats.next || !heroStats[stats.next].unlocked);

    if (needsBossFight) {
        document.getElementById('heroLessonTitle').innerText = `🏆 ${level} Final Sınavı`;
        document.getElementById('heroLessonLoading').style.display = 'none';
        buildHeroFinalExam(level);
        return; 
    }

    document.getElementById('heroLessonTitle').innerText = `Level: ${level} (Ders ${stats.completed + 1}/${stats.required})`;
    const levelChar = level.charAt(0); 
    let pool = typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.filter(w => (w.level || "").startsWith(levelChar)) : [];
    
    currentHeroWords = pool.length > 0 
        ? pool.sort(() => 0.5 - Math.random()).slice(0, 5)
        : [{word: "learn", meaning: "öğrenmek"}, {word: "easy", meaning: "kolay"}];

    const wordListStr = currentHeroWords.map(w => w.word).join(", ");
    const meaningListStr = currentHeroWords.map(w => `${w.word} (${w.meaning})`).join(", ");

    const progressRatio = stats.completed / stats.required;
    let stageInstruction = "";

    if (progressRatio < 0.35) {
        stageInstruction = "EARLY STAGE: The student just started this level. Keep sentences short and clear. Use the simplest forms of this level's grammar.";
    } else if (progressRatio < 0.70) {
        stageInstruction = "MIDDLE STAGE: The student is getting used to this level. Combine some sentences naturally. Standard difficulty.";
    } else {
        stageInstruction = "LATE STAGE: The student is preparing for the Boss Fight. Make the text noticeably longer and more challenging. Give a slight preview of the next level's difficulty.";
    }

    let levelInstruction = "";
    if (level === "A1") {
        levelInstruction = "Level Rule: Strictly use 'to be' verbs (am/is/are/was/were) and simple present/past. Absolute beginner vocabulary. Write like you are explaining to a child.";
    } else if (level === "A2") {
        levelInstruction = "Level Rule: Use basic action verbs, present continuous, and simple story-telling grammar. Introduce basic prepositions.";
    } else if (level === "B1") {
        levelInstruction = "Level Rule: Focus on intermediate transitions (however, therefore, although, because, while). Introduce present perfect tense and basic passive voice.";
    } else if (level === "B2") {
        levelInstruction = "Level Rule: Focus on upper-intermediate YDT/YDS format. Heavily use relative clauses (which, who, that, whose) and advanced connectors (furthermore, moreover, despite). Formal academic tone.";
    } else {
        levelInstruction = "Level Rule: Highly advanced academic English. TOEFL/IELTS style complexity, inverted sentences, participle clauses, and heavy inferences. Sound like a university professor.";
    }

    const finalDifficultyInstruction = `CRITICAL RULES: ${levelInstruction} AND ${stageInstruction}`;

    const prompt = `You are the 'Zero to Hero' English Teacher. Level: ${level} CEFR. Target Vocabulary: ${wordListStr}.
    Task: Write an engaging reading paragraph (4-5 sentences) using ALL the target words. Write a short 3-line dialogue. Add a "Vocabulary Review" section at the end with these exact Turkish meanings: ${meaningListStr}. 
    ${finalDifficultyInstruction} No markdown asterisks.`;

    const GROQ_API_KEY = "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"; 

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.55, max_tokens: 800 })
        });
        if (!response.ok) throw new Error("API Bağlantı Hatası");

        const data = await response.json();
        document.getElementById('heroLessonLoading').style.display = 'none';
        const contentArea = document.getElementById('heroLessonContent');
        contentArea.style.display = 'block';
        
        renderHeroTextAnalysis(data.choices[0].message.content.trim(), contentArea, level);
        buildHeroMiniQuiz();

    } catch (error) {
        document.getElementById('heroLessonLoading').style.display = 'none';
        document.getElementById('heroLessonContent').style.display = 'block';
        document.getElementById('heroLessonContent').innerHTML = `<p style="color:var(--error);">Bağlantı hatası oluştu. Lütfen tekrar deneyin.</p>`;
    }
}

function renderHeroTextAnalysis(rawText, container, level) {
    container.innerHTML = ""; 
    const paragraphs = rawText.split('\n');
    const toBeVerbs = ["am", "is", "are", "was", "were"];
    const b1Transitions = ["however", "therefore", "although", "because", "while", "but", "so"];
    const b2Relatives = ["which", "who", "whom", "whose", "furthermore", "moreover", "despite", "whereas"];

    paragraphs.forEach(paraText => {
        if(!paraText.trim()) return;
        const pElement = document.createElement('p');
        pElement.style.marginBottom = "15px";

        const tokens = paraText.split(/(\s+)/);
        tokens.forEach(word => {
            if (!word.trim()) { pElement.appendChild(document.createTextNode(word)); return; }

            let cleanWord = word.replace(/[^\p{L}]/gu, "").toLowerCase().trim();
            const span = document.createElement('span');
            span.innerText = word;

            if (cleanWord.length >= 2) {
                span.className = "hover-word";
                
                if ((level === "A1" || level === "A2") && toBeVerbs.includes(cleanWord)) {
                    span.style.color = "#0a84ff"; span.style.fontWeight = "900"; span.style.borderBottom = "2px solid #0a84ff"; span.style.background = "rgba(10, 132, 255, 0.1)";
                } else if (level === "B1" && b1Transitions.includes(cleanWord)) {
                    span.style.color = "#ff9f0a"; span.style.fontWeight = "800"; span.style.borderBottom = "2px dashed #ff9f0a"; span.style.background = "rgba(255, 159, 10, 0.1)";
                } else if (level === "B2" && b2Relatives.includes(cleanWord)) {
                    span.style.color = "#ff375f"; span.style.fontWeight = "800"; span.style.borderBottom = "2px dashed #ff375f"; span.style.background = "rgba(255, 55, 95, 0.1)";
                } else if (heroWords.some(hw => hw.word.toLowerCase() === cleanWord)) {
                    span.style.color = "var(--primary)"; span.style.fontWeight = "bold";
                } else if ((level === "B1" || level === "B2" || level === "C1") && typeof ydtArchiveData !== 'undefined' && ydtArchiveData.some(w => (w.word || "").toLowerCase() === cleanWord)) {
                    span.classList.add('is-data'); 
                }

                span.onclick = (e) => { e.stopPropagation(); if(typeof fetchDetails === 'function') fetchDetails(cleanWord); };
                if(typeof setupTooltip === 'function') setupTooltip(span, cleanWord);
            }
            pElement.appendChild(span);
        });
        container.appendChild(pElement);
    });
}

function buildHeroMiniQuiz() {
    currentHeroScore = 0;
    const quizArea = document.getElementById('heroMiniQuizArea');
    const questionBox = document.getElementById('miniQuizQuestions');
    quizArea.style.display = 'block';
    questionBox.innerHTML = "";
    document.getElementById('heroLessonActions').style.display = 'none';

    const wrongMeanings = ydtArchiveData.map(w => w.meaning).sort(() => 0.5 - Math.random()).slice(0, 20);

    currentHeroWords.forEach((wordObj, index) => {
        let options = [wordObj.meaning, wrongMeanings[index*2], wrongMeanings[index*2 + 1]];
        options = options.sort(() => 0.5 - Math.random()); 

        let html = `
            <div class="quiz-card" id="mini-q-${index}" style="padding:15px; border-radius:15px;">
                <p style="font-weight:bold; font-size:1.1rem; margin-bottom:10px; color:#fff;">${index+1}. "${wordObj.word}" kelimesinin anlamı nedir?</p>
                <div style="display:grid; gap:8px;">
                    ${options.map(opt => `<button class="quiz-opt" onclick="checkHeroMiniQuiz(this, '${opt.replace(/'/g, "\\'")}', '${wordObj.meaning.replace(/'/g, "\\'")}', ${index})">${opt}</button>`).join('')}
                </div>
            </div>
        `;
        questionBox.innerHTML += html;
    });
}

function checkHeroMiniQuiz(btn, selected, correct, index) {
    const card = document.getElementById(`mini-q-${index}`);
    const options = card.querySelectorAll('.quiz-opt');
    options.forEach(opt => opt.style.pointerEvents = 'none'); 

    if (selected === correct) {
        btn.classList.add('correct-ans'); currentHeroScore++;
    } else {
        btn.classList.add('wrong-ans');
        options.forEach(opt => { if(opt.innerText === correct) opt.classList.add('correct-ans'); });
    }

    const answeredCount = document.querySelectorAll('#miniQuizQuestions .correct-ans').length + document.querySelectorAll('#miniQuizQuestions .wrong-ans').length;
    
    if (answeredCount === currentHeroWords.length) {
        if (currentHeroScore === currentHeroWords.length) {
            document.getElementById('heroLessonActions').style.display = 'block';
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else {
            alert(`Testi geçemedin! (${currentHeroScore}/${currentHeroWords.length}) Doğrulara iyi bak, test 3 saniye içinde yeniden başlıyor.`);
            setTimeout(() => { document.getElementById('heroLessonActions').style.display = 'none'; buildHeroMiniQuiz(); }, 3000); 
        }
    }
}

function completeHeroLesson() {
    if (!currentHeroLevel || !currentHeroWords.length) return;

    currentHeroWords.forEach(w => {
        const alreadyInHero = heroWords.some(hw => hw.word.toLowerCase() === w.word.toLowerCase());
        if (!alreadyInHero) {
            heroWords.push({
                id: "hero_" + Date.now() + Math.random(),
                word: w.word, meaning: w.meaning, level: currentHeroLevel, addedDate: Date.now()
            });
        }
    });

    localStorage.setItem('heroWords', JSON.stringify(heroWords));
    let stats = heroStats[currentHeroLevel];
    stats.completed += 1;
    localStorage.setItem('heroStats', JSON.stringify(heroStats));
    
    if (stats.completed >= stats.required) alert(`🎉 Harika! ${currentHeroLevel} derslerini bitirdin. Şimdi Final Sınavı (Boss Fight) zamanı!`);
    else alert(`✅ Ders tamamlandı! ${currentHeroWords.length} kelime Hero Çantasına eklendi.`);
    
    if (typeof switchTab === 'function') switchTab('hero');
    renderHeroRoadmap();
}

function buildHeroFinalExam(level) {
    heroFinalScore = 0;
    const examArea = document.getElementById('heroFinalExamArea');
    const questionBox = document.getElementById('finalExamQuestions');
    examArea.style.display = 'block';
    
    const learnedWords = heroWords.filter(w => w.level === level);
    if(learnedWords.length < 10) {
        alert("Sınav için çantanızda yeterli kelime yok. Lütfen dersleri tamamlayın.");
        switchTab('hero'); return;
    }

    heroFinalQuestions = learnedWords.sort(() => 0.5 - Math.random()).slice(0, 10);
    const wrongMeanings = ydtArchiveData.map(w => w.meaning).sort(() => 0.5 - Math.random()).slice(0, 40);

    let html = `
        <div style="text-align:center; margin-bottom:25px; padding: 20px; background: rgba(191, 90, 242, 0.1); border: 1px solid rgba(191, 90, 242, 0.3); border-radius: 20px;">
            <h3 style="color:#bf5af2; margin-bottom:10px; font-size:1.5rem;">🛡️ ${level} BOSS FIGHT</h3>
            <p style="color:var(--text); font-size:0.95rem;">Bir sonraki seviyenin kilidini kırmak için <b>10 sorudan en az 8'ini</b> doğru bilmelisin!</p>
        </div>
    `;

    heroFinalQuestions.forEach((wordObj, index) => {
        let options = [wordObj.meaning, wrongMeanings[index*3], wrongMeanings[index*3 + 1], wrongMeanings[index*3 + 2]];
        options = options.sort(() => 0.5 - Math.random());

        html += `
            <div class="quiz-card" id="final-q-${index}" style="border-left: 4px solid #bf5af2;">
                <p style="font-weight:bold; font-size:1.15rem; margin-bottom:15px; color:#fff;">
                    <span style="color:#bf5af2; margin-right:5px;">Soru ${index+1}:</span> "${wordObj.word}" kelimesinin anlamı nedir?
                </p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    ${options.map(opt => `<button class="quiz-opt" style="font-size:0.95rem;" onclick="checkHeroFinalExam(this, '${opt.replace(/'/g, "\\'")}', '${wordObj.meaning.replace(/'/g, "\\'")}', ${index})">${opt}</button>`).join('')}
                </div>
            </div>
        `;
    });
    
    questionBox.innerHTML = html;
}

function checkHeroFinalExam(btn, selected, correct, index) {
    const card = document.getElementById(`final-q-${index}`);
    const options = card.querySelectorAll('.quiz-opt');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    if (selected === correct) { btn.classList.add('correct-ans'); heroFinalScore++; } 
    else {
        btn.classList.add('wrong-ans');
        options.forEach(opt => { if(opt.innerText === correct) opt.classList.add('correct-ans'); });
    }

    const answeredCount = document.querySelectorAll('#finalExamQuestions .correct-ans').length + document.querySelectorAll('#finalExamQuestions .wrong-ans').length;
    
    if (answeredCount === heroFinalQuestions.length) {
        setTimeout(() => {
            if (heroFinalScore >= 8) {
                alert(`🏆 MUHTEŞEM! ${heroFinalScore}/10 yaptın. Yeni seviyenin kilidi kırıldı!`);
                let stats = heroStats[currentHeroLevel];
                if (stats.next && heroStats[stats.next]) {
                    heroStats[stats.next].unlocked = true;
                    localStorage.setItem('heroStats', JSON.stringify(heroStats));
                }
            } else {
                alert(`💥 Sınavı Geçemedin! (${heroFinalScore}/10). En az 8 doğru yapmalısın.`);
            }
            if (typeof switchTab === 'function') switchTab('hero');
            renderHeroRoadmap();
        }, 1500);
    }
}

function openHeroBank() {
    const listArea = document.getElementById('heroBankList');
    if(!listArea) return;

    if (!heroWords || heroWords.length === 0) {
        listArea.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);"><div style="font-size:3rem; margin-bottom:10px;">🎒</div><p>Çantan şu an boş. Dersleri tamamladıkça öğrendiğin kelimeler burada birikecek!</p></div>`;
    } else {
        listArea.innerHTML = [...heroWords].reverse().map(w => `
            <div class="bento-list-item" style="border-left: 4px solid var(--accent);">
                <div style="text-align:left;">
                    <b style="color:var(--text); font-size:1.15rem;">${w.word}</b><br>
                    <small style="color:#FFD60A; font-size:0.95rem; font-weight:500;">${w.meaning}</small>
                </div>
                <span style="background: rgba(191,90,242,0.15); color: #bf5af2; padding: 4px 10px; border-radius: 10px; font-size: 0.8rem; font-weight: bold;">${w.level}</span>
            </div>
        `).join('');
    }
    document.getElementById('heroBankModal').style.display = 'block';
}

function closeHeroBank() { document.getElementById('heroBankModal').style.display = 'none'; }


// =======================================================================
// [5] DİĞER AÇIK DÜNYA FONKSİYONLARI (Dashboard, Quiz, Translate)
// =======================================================================
function updateDashboard() {
    if(!document.getElementById('statTotalWords')) return;
    checkAndUpdateStats(); 
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayTimestamp = todayEnd.getTime();
    const total = myWords.length;
    const learned = myWords.filter(w => getDisplayLevel(w.level) >= 4).length; 
    const toReview = myWords.filter(w => w.nextReview <= todayTimestamp).length;

    const d = new Date(); const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (ydtStats.streakDate !== todayStr) {
        let initial = ydtStats.todayInitialReview || 0;
        let requiredToComplete = Math.ceil(initial * 0.7); 
        let completedToday = initial - toReview; 
        if ((initial === 0 && total > 0) || (initial > 0 && completedToday >= requiredToComplete)) {
            ydtStats.streak++; ydtStats.streakDate = todayStr;
            localStorage.setItem('ydtStats', JSON.stringify(ydtStats));
        }
    }

    let totalC = 0, totalW = 0;
    myWords.forEach(w => { totalC += w.correctCount; totalW += w.wrongCount; });
    const acc = (totalC + totalW) === 0 ? 0 : Math.round((totalC / (totalC + totalW)) * 100);

    document.getElementById('statTotalWords').innerText = total;
    document.getElementById('statLearned').innerText = learned;
    document.getElementById('statToReview').innerText = toReview;
    document.getElementById('statAccuracy').innerText = "%" + acc;

    const targetPercentage = total === 0 ? 0 : Math.min(100, Math.round((total / 2000) * 100));
    document.getElementById('targetCurrent').innerText = total;
    document.getElementById('targetProgressBar').style.width = targetPercentage + "%";

    const count0 = myWords.filter(w => getDisplayLevel(w.level) === 0).length;
    const count1 = myWords.filter(w => getDisplayLevel(w.level) === 1).length;
    const count2 = myWords.filter(w => getDisplayLevel(w.level) === 2).length;
    const count3 = myWords.filter(w => getDisplayLevel(w.level) === 3).length;
    
    if(document.getElementById('countLvl0')) document.getElementById('countLvl0').innerText = count0;
    if(document.getElementById('countLvl1')) document.getElementById('countLvl1').innerText = count1;
    if(document.getElementById('countLvl2')) document.getElementById('countLvl2').innerText = count2;
    if(document.getElementById('countLvl3')) document.getElementById('countLvl3').innerText = count3;
    if(document.getElementById('countLvl4')) document.getElementById('countLvl4').innerText = learned;

    if(document.getElementById('barLvl0')) document.getElementById('barLvl0').style.width = total === 0 ? "0%" : (count0 / total * 100) + "%";
    if(document.getElementById('barLvl1')) document.getElementById('barLvl1').style.width = total === 0 ? "0%" : (count1 / total * 100) + "%";
    if(document.getElementById('barLvl2')) document.getElementById('barLvl2').style.width = total === 0 ? "0%" : (count2 / total * 100) + "%";
    if(document.getElementById('barLvl3')) document.getElementById('barLvl3').style.width = total === 0 ? "0%" : (count3 / total * 100) + "%";
    if(document.getElementById('barLvl4')) document.getElementById('barLvl4').style.width = total === 0 ? "0%" : (learned / total * 100) + "%";
    
    const streakEl = document.getElementById('statStreak');
    if(streakEl) streakEl.innerText = ydtStats.streak;
}

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
                    <b style="color:var(--text); font-size:1.15rem;">${w.word}</b><br>
                    <small style="color:var(--text-muted); font-size:0.9rem;">${w.meaning}</small>
                </div>
            </div>
            <span style="background: rgba(10, 132, 255, 0.15); color: var(--accent); padding: 6px 12px; border-radius: 12px; font-weight: 700; font-size: 0.8rem;">Lvl ${getDisplayLevel(w.level)}</span>
        </div>
    `).join('') : "<p style='text-align:center; color:var(--text-muted); padding:30px 0;'>Kelime bulunamadı.</p>";
    modal.style.display = 'block';
}

function closeStatsModal() { const modal = document.getElementById('statsModal'); if(modal) modal.style.display = 'none'; }

async function openEngEngDict(word) {
    const overlay = document.getElementById('dictOverlay'); const content = document.getElementById('dictContent');
    overlay.style.display = 'flex'; setTimeout(() => overlay.classList.add('active'), 10);
    content.innerHTML = `<p style="text-align:center; padding:20px;">🔍 <b>${word}</b> yükleniyor...</p>`;
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) throw new Error();
        const data = await response.json(); const def = data[0].meanings[0].definitions[0];
        content.innerHTML = `<h3 style="color:var(--accent); margin-bottom:10px;">${data[0].word}</h3><p><b>Definition:</b> ${def.definition}</p>${def.example ? `<p style="margin-top:12px; font-style:italic;">" ${def.example} "</p>` : ''}`;
    } catch (e) { content.innerHTML = `<p style="color:var(--error); text-align:center;">❌ Tanım bulunamadı.</p>`; }
}
function closeDictModal() { const overlay = document.getElementById('dictOverlay'); overlay.classList.remove('active'); setTimeout(() => overlay.style.display = 'none', 300); }

function playSound(text, event) { if(event) event.stopPropagation(); if(!text) return; const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; window.speechSynthesis.speak(u); }
function openGoogleTranslate() { const text = document.getElementById('readingInput').value; if(!text.trim()) return; window.open(`https://translate.google.com/?sl=auto&tl=tr&text=${encodeURIComponent(text)}&op=translate`, '_blank'); }

function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const targetSection = document.getElementById(tabId + 'Section'); if (targetSection) targetSection.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav'));
    const targetBtn = document.getElementById('btn-' + tabId); if (targetBtn) targetBtn.classList.add('active-nav');
    
    const aiQuizArea = document.getElementById('aiReadingQuizSection');
    const readingInput = document.getElementById('readingInput');
    if (aiQuizArea) {
        if (tabId === 'reading' && readingInput && readingInput.value.trim().length > 50) aiQuizArea.style.display = 'block';
        else aiQuizArea.style.display = 'none';
    }
    
    if(tabId === 'mistakes') renderMistakes();
    if(tabId === 'archive') renderArchive();
    if(tabId === 'dashboard') updateDashboard(); 
    if(tabId === 'hero') renderHeroRoadmap();
}

function showQuizSub(mode) {
    ['testArea', 'archiveQuizArea', 'phrasalQuizArea', 'mistakeQuizArea', 'flashArea', 'archiveFlashArea', 'smartQuizArea'].forEach(a => { const el = document.getElementById(a); if (el) el.style.display = 'none'; });
    const targetArea = document.getElementById(mode + 'Area') || document.getElementById(mode);
    if (targetArea) targetArea.style.display = (mode.includes('flash') || mode.includes('Flash')) ? 'flex' : 'block';
    if (mode === 'flash') prepareFlashcards();
    if (mode === 'archiveFlash') prepareArchiveFlashcards();
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    const targetNav = document.getElementById('nav' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (targetNav) targetNav.classList.add('active');
}

function toggleAccordion(btn) { btn.parentElement.classList.toggle('active'); }
function toggleBankAccordion() { const c = document.getElementById('bankamContainer'); c.style.display = c.style.display === 'none' ? 'block' : 'none'; }
function showMoreBank() { bankShowLimit += 10; renderWords(); }
function switchArchiveTab(tab) { currentArcTab = tab; arcPage = 1; document.getElementById('navArcWords').classList.remove('active'); document.getElementById('navArcPhrasal').classList.remove('active'); document.getElementById(tab === 'words' ? 'navArcWords' : 'navArcPhrasal').classList.add('active'); renderArchive(); }
function prevArchivePage() { if (arcPage > 1) { arcPage--; renderArchive(); } }
function nextArchivePage() { let dataPool = currentArcTab === 'words' ? ydtArchiveData : (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []); if (arcPage < Math.ceil(dataPool.length / arcPerPage)) { arcPage++; renderArchive(); } }

function renderArchive() {
    const list = document.getElementById('archiveWordsList');
    let dataPool = currentArcTab === 'words' ? ydtArchiveData : (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []);
    if (!dataPool || dataPool.length === 0) { list.innerHTML = "<p>Veri bulunamadı.</p>"; return; }

    document.getElementById('archiveCountBadge').innerText = `${dataPool.length} Kayıt`;
    document.getElementById('archivePageInfo').innerText = `Sayfa ${arcPage} / ${Math.ceil(dataPool.length / arcPerPage)}`;
    
    const currentData = dataPool.slice((arcPage - 1) * arcPerPage, arcPage * arcPerPage);
    let html = "";
    currentData.forEach(item => {
        const wordText = item.phrase || item.word;
        const bankItem = myWords.find(m => m.word.toLowerCase() === wordText.toLowerCase());
        const cefrLvl = getCEFRLevel(wordText); const cefrCol = getCEFRColor(cefrLvl);

        html += `
            <div class="word-card archive-word-card ${currentArcTab === 'words' ? 'status-archive' : 'status-phrasal'}">
                <div class="word-info">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <b>${wordText}</b><span class="cefr-badge" style="background:${cefrCol}22; color:${cefrCol}; border:1px solid ${cefrCol}55;">${cefrLvl}</span>
                        <span class="tts-icon" onclick="playSound('${wordText.replace(/'/g, "\\'")}', event)">🔊</span>
                        ${bankItem && getDisplayLevel(bankItem.level) >= 4 ? `<span class="badge-learned-mini">✅</span>` : ''}
                    </div>
                    <span class="meaning">${item.meaning}</span><span class="syn-badge">Eş: ${item.syn}</span>
                </div>
                <div>${bankItem ? `<span class="badge-primary">✔</span>` : `<button class="btn-add-archive" onclick="addFromArchive('${wordText}')">+ Ekle</button>`}</div>
            </div>`;
    });
    list.innerHTML = html;
}

function addFromArchive(wordText) {
    const data = ydtArchiveData.find(w => w.word === wordText) || (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs.find(p => p.phrase === wordText) : null);
    if(!data) return;
    if(myWords.some(w => w.word.toLowerCase() === wordText.toLowerCase())) return alert("Zaten bankanızda mevcut!");
    myWords.push({ id: Date.now(), word: data.phrase || data.word, meaning: data.meaning, syn: data.syn, level: 0, nextReview: Date.now(), correctCount: 0, wrongCount: 0 });
    localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); renderArchive(); renderMistakes(); updateDashboard();
    if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
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
            if (myW) tip.innerText = "🏦 " + myW.meaning; else if (pvW) tip.innerText = "📚 " + pvW.meaning;
            else if (datW) tip.innerText = "📙 " + datW.meaning; else { const trans = await getSmartTranslation(target); tip.innerText = "🌐 " + trans.tr; }
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
    let cleanWord = word.toLowerCase().trim(); if (!cleanWord) return;
    wIn.value = cleanWord; mIn.value = "Aranıyor..."; sIn.value = "-";
    const pvFind = (typeof ydtPhrasalVerbs !== 'undefined') ? ydtPhrasalVerbs.find(p => p.phrase === cleanWord) : null;
    if (pvFind) { mIn.value = pvFind.meaning; sIn.value = pvFind.syn; return; }
    const arcFind = (typeof ydtArchiveData !== 'undefined') ? ydtArchiveData.find(w => w.word.toLowerCase() === cleanWord) : null;
    if (arcFind) { mIn.value = arcFind.meaning; sIn.value = arcFind.syn; return; }
    const myWordFind = myWords.find(w => w.word.toLowerCase() === cleanWord);
    if (myWordFind) { mIn.value = myWordFind.meaning; sIn.value = myWordFind.syn; return; }

    try {
        const trans = await getSmartTranslation(cleanWord);
        if (trans.en !== cleanWord) { wIn.value = trans.en; mIn.value = trans.tr; cleanWord = trans.en; } else mIn.value = trans.tr;
        const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (dictRes.ok) {
            const dictData = await dictRes.json(); let syns = [];
            dictData[0].meanings.forEach(m => { if (m.synonyms && m.synonyms.length > 0) syns = [...syns, ...m.synonyms.filter(s => !s.includes(" ") && s.length < 15)]; });
            if (syns.length > 0) sIn.value = [...new Set(syns)].slice(0, 3).join(", "); else fetchDatamuseFallback(cleanWord, sIn); 
        } else fetchDatamuseFallback(cleanWord, sIn);
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
    if (myWords.some(item => item.word.toLowerCase() === w.toLowerCase())) return alert("Bu kelime zaten bankanızda mevcut!");
    myWords.push({ id: Date.now(), word: w, meaning: m, syn: s || "-", level: 0, nextReview: Date.now(), correctCount: 0, wrongCount: 0 });
    localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); updateDashboard();
    ['wordInput','meaningInput','synonymInput'].forEach(id => document.getElementById(id).value = "");
    if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
}

function renderWords() {
    const listArea = document.getElementById('savedWordsList'); if (!listArea) return;
    const countLabel = document.getElementById('wordCount'); if(countLabel) countLabel.innerText = myWords.length;
    const globalCountLabel = document.getElementById('globalBankCount'); if(globalCountLabel) globalCountLabel.innerText = myWords.length;

    let html = "";
    let wordsToShow = [...myWords].reverse().slice(0, bankShowLimit);

    wordsToShow.forEach(item => {
        if (!item || !item.word) return;
        const lowerW = item.word.toLowerCase().trim();
        const inArchive = (typeof ydtArchiveData !== 'undefined') && ydtArchiveData.some(a => a.word.toLowerCase().trim() === lowerW);
        const inPhrasal = (typeof ydtPhrasalVerbs !== 'undefined') && ydtPhrasalVerbs.some(p => p.phrase.toLowerCase().trim() === lowerW);
        const isWrongBefore = wrongIds.includes(item.word) || wrongIds.includes(lowerW);
        const isLearned = getDisplayLevel(item.level) >= 4;

        let statusClass = "";
        if (inArchive && inPhrasal) statusClass = "status-both";
        else if (inArchive) statusClass = "status-archive";
        else if (inPhrasal) statusClass = "status-phrasal";

        const cefrLvl = getCEFRLevel(item.word); const cefrCol = getCEFRColor(cefrLvl);

        html += `
        <div class="word-card ${statusClass}">
            <div class="word-info">
                <div class="word-header-row">
                    <b onclick="openEngEngDict('${item.word.replace(/'/g, "\\'")}')" style="cursor:pointer; text-decoration:underline;">${item.word}</b>
                    <span class="cefr-badge" style="background: ${cefrCol}22; color: ${cefrCol};">${cefrLvl}</span>
                    <span class="tts-icon" onclick="playSound('${item.word.replace(/'/g, "\\'")}', event)">🔊</span>
                    ${isLearned ? `<span class="badge-learned-mini">✅</span>` : ''}
                    ${(isWrongBefore && !isLearned) ? `<span class="badge-danger-mini">⚠️</span>` : ''}
                </div>
                <span class="meaning">${item.meaning}</span>
                ${item.syn && item.syn !== '-' ? `<span class="syn-badge">${item.syn}</span>` : ''}
            </div>
            <button class="del-btn" onclick="deleteWord(${item.id})">🗑️</button>
        </div>`;
    });

    listArea.innerHTML = html || "<p style='text-align:center; color:var(--text-muted);'>Bankan henüz boş.</p>";
    const btn = document.getElementById('showMoreBankBtn');
    if(btn) btn.style.display = myWords.length > bankShowLimit ? 'block' : 'none';
}

function filterWords(query) {
    const listArea = document.getElementById('savedWordsList'); if (!listArea) return;
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) { renderWords(); return; }

    const filteredWords = [...myWords].reverse().filter(item => (item.word && item.word.toLowerCase().includes(lowerQuery)) || (item.meaning && item.meaning.toLowerCase().includes(lowerQuery)));
    let html = "";
    filteredWords.forEach(item => {
        const lowerW = item.word.toLowerCase().trim();
        const inArchive = (typeof ydtArchiveData !== 'undefined') && ydtArchiveData.some(a => a.word.toLowerCase().trim() === lowerW);
        const cefrLvl = getCEFRLevel(item.word); const cefrCol = getCEFRColor(cefrLvl);
        html += `
        <div class="word-card ${inArchive ? 'status-archive' : ''}">
            <div class="word-info">
                <div class="word-header-row">
                    <b>${item.word}</b><span class="cefr-badge" style="background:${cefrCol}22; color:${cefrCol};">${cefrLvl}</span>
                    <span class="tts-icon" onclick="playSound('${item.word.replace(/'/g, "\\'")}', event)">🔊</span>
                </div>
                <span class="meaning">${item.meaning}</span>
            </div>
            <button class="del-btn" onclick="deleteWord(${item.id})">🗑️</button>
        </div>`;
    });
    listArea.innerHTML = html || "<div style='text-align:center; padding:30px; color:var(--text-muted);'>Sonuç bulunamadı.</div>";
    const btn = document.getElementById('showMoreBankBtn'); if (btn) btn.style.display = 'none';
}

function deleteWord(id) {
    myWords = myWords.filter(w => w.id !== id); localStorage.setItem('ydtWords', JSON.stringify(myWords));
    renderWords(); updateDashboard(); if(document.getElementById('readingSection').classList.contains('active')) processAnalysis();
}

// Quiz & Flashcard Core (Open World)
let qIdx = 0, qSet = [], currentQuizMode = "";
function startQuiz() { if(myWords.length < 4) return alert("En az 4 kelime!"); currentQuizMode = "test"; const s = document.getElementById('bankQuizCount'); setupQuiz(myWords, s && s.value !== 'all' ? parseInt(s.value) : myWords.length); }
function startArchiveQuiz() { currentQuizMode = "archive"; const s = document.getElementById('arcQuizCount'); setupQuiz(ydtArchiveData, s ? parseInt(s.value) : 20); }
function startPhrasalQuiz() { if(typeof ydtPhrasalVerbs === 'undefined') return alert("Veri eksik!"); currentQuizMode = "phrasal"; const s = document.getElementById('phrasalQuizCount'); setupQuiz(ydtPhrasalVerbs, s && s.value !== 'all' ? parseInt(s.value) : ydtPhrasalVerbs.length); }
function startMistakeQuiz() { currentQuizMode = "mistake"; let mistakes = []; wrongIds.forEach(w => { let f = myWords.find(m => m.word === w) || (typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.find(a => a.word === w) : null); if(f) mistakes.push(f); }); if(mistakes.length < 4) return alert("En az 4 hata!"); const s = document.getElementById('mistakeQuizCount'); setupQuiz(mistakes, s && s.value !== 'all' ? parseInt(s.value) : mistakes.length); }
function startSmartQuiz() { const end = new Date(); end.setHours(23, 59, 59, 999); let pool = myWords.filter(w => w.nextReview <= end.getTime()); if(pool.length === 0) return alert("Tekrar edilecek kelime yok!"); currentQuizMode = "smart"; setupQuiz(pool, pool.length); }

function setupQuiz(pool, count) {
    if (!pool || pool.length === 0) return alert("Veri bulunamadı!");
    qIdx = 0; qSet = [];
    pool.forEach(w => { if (w.word || w.phrase) { qSet.push({ ...w, askType: 'meaning' }); if(w.syn && w.syn !== '-') qSet.push({ ...w, askType: 'synonym' }); } });
    qSet = qSet.sort(() => 0.5 - Math.random()).slice(0, count);
    const prefixMap = { "test": "quiz", "archive": "arcQuiz", "phrasal": "phrasalQuiz", "mistake": "mistakeQuiz", "smart": "smartQuiz" };
    const prefix = prefixMap[currentQuizMode] || "quiz";
    ['StartScreen', 'QuestionScreen', 'ProgressContainer'].forEach(s => { const el = document.getElementById(prefix + s); if(el) el.style.display = s === 'StartScreen' ? 'none' : 'block'; });
    loadQuest();
}

function loadQuest() {
    const prefix = ({ "test": "quiz", "archive": "arcQuiz", "phrasal": "phrasalQuiz", "mistake": "mistakeQuiz", "smart": "smartQuiz" })[currentQuizMode] || "quiz";
    if(qIdx >= qSet.length) {
        alert("Test Bitti!");
        ['QuestionScreen', 'ProgressContainer'].forEach(s => { const el = document.getElementById(prefix + s); if(el) el.style.display = 'none'; });
        const start = document.getElementById(prefix + 'StartScreen'); if(start) start.style.display = 'block';
        updateDashboard(); return; 
    }
    const bar = document.getElementById(prefix + 'ProgressBar'); if(bar) bar.style.width = (qIdx / qSet.length) * 100 + "%";
    const wordDisplay = document.getElementById(prefix + 'WordDisplay'); const optsDiv = document.getElementById(prefix + 'Options');
    optsDiv.innerHTML = ""; const colorId = Math.floor(Math.random() * 5); const q = qSet[qIdx]; let ans = "";
    let pool = currentQuizMode === "phrasal" ? (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs : []) : [...myWords, ...(typeof ydtArchiveData !== 'undefined' ? ydtArchiveData : [])];
    let poolForOpts = [];

    if(q.askType === 'synonym') {
        wordDisplay.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:5px;">Eş Anlamlısı nedir?</span>${q.phrase || q.word}`;
        ans = q.syn; poolForOpts = pool.filter(p => p.syn && p.syn !== '-' && p.syn !== ans).map(p => p.syn);
    } else {
        wordDisplay.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:5px;">Anlamı nedir?</span>${q.phrase || q.word}`;
        ans = q.meaning; poolForOpts = pool.filter(p => p.meaning !== ans).map(p => p.meaning);
    }
    
    let opts = [ans]; if (poolForOpts.length < 3) poolForOpts = ["Result", "Development", "Focus", "Success"];
    let attempts = 0; while(opts.length < 4 && attempts < 100) { attempts++; let r = poolForOpts[Math.floor(Math.random() * poolForOpts.length)]; if(r && !opts.includes(r)) opts.push(r); }
    while(opts.length < 4) opts.push("---");

    opts.sort(() => 0.5 - Math.random()).forEach(o => {
        const b = document.createElement('div'); b.className = `quiz-opt color-tint-${colorId}`; b.innerText = o; b.dataset.correct = (o === ans);
        b.onclick = () => {
            const allOpts = optsDiv.querySelectorAll('.quiz-opt'); allOpts.forEach(opt => opt.style.pointerEvents = 'none');
            const currentW = q.phrase || q.word; let wordInBank = myWords.find(w => w.word === currentW);
            if(o === ans) {
                if(typeof correctSound !== 'undefined') { correctSound.pause(); correctSound.currentTime = 0; correctSound.play().catch(()=>{}); }
                b.classList.add('correct-ans');
                if(currentQuizMode === "smart" && wordInBank) {
                    wordInBank.level = (wordInBank.level || 0) + 1;
                    const intervals = [1, 2, 3, 7, 14, 30]; 
                    const daysToAdd = intervals[Math.min(wordInBank.level - 1, intervals.length - 1)] || 1;
                    let targetDate = new Date(); targetDate.setDate(targetDate.getDate() + daysToAdd); targetDate.setHours(0,0,0,0); 
                    wordInBank.nextReview = targetDate.getTime();
                }
                if(currentQuizMode === "mistake") wrongIds = wrongIds.filter(id => id !== currentW);
            } else {
                if(typeof wrongSound !== 'undefined') { wrongSound.pause(); wrongSound.currentTime = 0; wrongSound.play().catch(()=>{}); }
                b.classList.add('wrong-ans'); allOpts.forEach(opt => { if (opt.dataset.correct === 'true') opt.classList.add('correct-ans'); });
                if(wordInBank) { wordInBank.wrongCount++; if(currentQuizMode === "smart") { wordInBank.level = Math.max(0, (wordInBank.level || 0) - 2); wordInBank.nextReview = Date.now(); } }
                if(!wrongIds.includes(currentW)) wrongIds.push(currentW); 
            }
            localStorage.setItem('ydtWords', JSON.stringify(myWords)); localStorage.setItem('wrongIds', JSON.stringify(wrongIds));
            if(typeof updateDashboard === 'function') updateDashboard();
            setTimeout(() => { qIdx++; loadQuest(); }, 1200);
        };
        optsDiv.appendChild(b);
    });
}

let fQueue = [], fIdx = 0;
function populateFlashQueue(sourceArray) { let q = []; sourceArray.forEach(w => { q.push({ ...w, askType: 'meaning', colorIdx: Math.floor(Math.random() * 5) }); if(w.syn && w.syn !== "-") q.push({ ...w, askType: 'synonym', colorIdx: Math.floor(Math.random() * 5) }); }); return q.sort(() => 0.5 - Math.random()); }
function prepareFlashcards() { if(myWords.length === 0) return; fQueue = populateFlashQueue(myWords); fIdx = 0; updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); }
function prepareArchiveFlashcards() { if(typeof ydtArchiveData === 'undefined' || ydtArchiveData.length === 0) return; fQueue = populateFlashQueue(ydtArchiveData); fIdx = 0; updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); }
function updateFlash(cardId, frontId, backMId, backSId, currId, totId) {
    if(fQueue.length === 0) return; const w = fQueue[fIdx]; const cardEl = document.getElementById(cardId); cardEl.classList.remove('flipped');
    setTimeout(() => {
        const f = cardEl.querySelector('.f-front'); const b = cardEl.querySelector('.f-back');
        for(let i=0; i<5; i++) { f.classList.remove('color-tint-'+i); b.classList.remove('color-tint-'+i); }
        f.classList.add('color-tint-' + w.colorIdx); b.classList.add('color-tint-' + w.colorIdx);
        const pId = frontId === 'flashFront' ? 'flashFrontPrompt' : 'arcFlashFrontPrompt'; const tId = frontId === 'flashFront' ? 'flashFrontTTS' : 'arcFlashFrontTTS';
        if(w.askType === 'synonym') { document.getElementById(pId).innerText = "Eş anlamlısı:"; document.getElementById(frontId).innerText = w.syn; document.getElementById(bId).innerText = w.phrase || w.word; document.getElementById(backSId).innerText = `Anlamı: ${w.meaning}`; } 
        else { document.getElementById(pId).innerText = ""; document.getElementById(frontId).innerText = w.phrase || w.word; document.getElementById(backMId).innerText = w.meaning; document.getElementById(backSId).innerText = w.syn && w.syn !== "-" ? "Eş: " + w.syn : ""; }
        document.getElementById(tId).onclick = (e) => playSound((w.phrase || w.word || w.syn).replace(/'/g, "\\'"), e);
        document.getElementById(currId).innerText = fIdx + 1; document.getElementById(totId).innerText = fQueue.length;
    }, 150);
}
function nextFlashcard() { if(fIdx < fQueue.length-1) { fIdx++; updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); } }
function previousFlashcard() { if(fIdx > 0) { fIdx--; updateFlash('fCard', 'flashFront', 'flashBackMeaning', 'flashBackSynonym', 'flashCurrentIndex', 'flashTotalCount'); } }
function nextArchiveFlashcard() { if(fIdx < fQueue.length-1) { fIdx++; updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); } }
function previousArchiveFlashcard() { if(fIdx > 0) { fIdx--; updateFlash('arcFCard', 'arcFlashFront', 'arcFlashBackMeaning', 'arcFlashBackSynonym', 'arcFlashCurrentIndex', 'arcFlashTotalCount'); } }
function addCurrentArcFlashToBank(e) { if(e) e.stopPropagation(); if(fQueue.length > 0) { addFromArchive(fQueue[fIdx].phrase || fQueue[fIdx].word); alert("Eklendi!"); } }

function renderMistakes() {
    const list = document.getElementById('mistakesList'); let html = "";
    if (!wrongIds || wrongIds.length === 0) { list.innerHTML = "<p>Harika! Hata yok.</p>"; return; }
    wrongIds.forEach(wText => {
        let word = myWords.find(m => m.word === wText) || (typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.find(a => a.word === wText) : null) || (typeof ydtPhrasalVerbs !== 'undefined' ? ydtPhrasalVerbs.find(p => p.phrase === wText) : null);
        if(word) {
            const wordText = word.phrase || word.word; const isAdded = myWords.some(m => m.word.toLowerCase() === wordText.toLowerCase());
            const cefrLvl = getCEFRLevel(wordText); const cefrCol = getCEFRColor(cefrLvl);
            html += `<div class="word-card status-error"><div class="word-info"><div style="display:flex; align-items:center; gap:8px;"><b>${wordText}</b><span class="cefr-badge" style="background:${cefrCol}22; color:${cefrCol};">${cefrLvl}</span><span class="tts-icon" onclick="playSound('${wordText.replace(/'/g, "\\'")}', event)">🔊</span></div><span class="meaning">${word.meaning}</span></div><div>${isAdded ? `<span class="badge-error">✘ Bankada</span>` : `<button class="btn-add-archive" onclick="addFromArchive('${wordText}')">+ Ekle</button>`}</div></div>`;
        }
    });
    list.innerHTML = html;
}
function clearMistakes() { if(confirm("Sıfırla?")) { wrongIds = []; localStorage.setItem('wrongIds', "[]"); renderMistakes(); } }
function clearAll() { document.getElementById('displayArea').innerHTML = ""; document.getElementById('readingInput').value = ""; }
function exportData() { const blob = new Blob([JSON.stringify({ myWords, wrongIds })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ydt_focus_backup.json'; a.click(); }
function importData(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (e) => { const imported = JSON.parse(e.target.result); const existingWords = new Set(myWords.map(w => w.word.toLowerCase())); imported.myWords.forEach(w => { if(!existingWords.has(w.word.toLowerCase())) myWords.push(w); }); wrongIds = Array.from(new Set([...wrongIds, ...(imported.wrongIds || [])])); localStorage.setItem('ydtWords', JSON.stringify(myWords)); localStorage.setItem('wrongIds', JSON.stringify(wrongIds)); renderWords(); alert("Aktarıldı!"); }; reader.readAsText(file); }

let isFocusMode = false;
function toggleFocusMode() {
    isFocusMode = !isFocusMode; const area = document.getElementById('displayArea'); const btn = document.getElementById('btn-focus');
    if(isFocusMode) { area.classList.add('focus-active'); btn.innerHTML = "🎯 Odak: AÇIK"; if(window.innerWidth <= 900) { setupFocusObserver(); setTimeout(() => { const first = document.querySelector('.focus-sentence'); if(first) first.classList.add('is-focused'); }, 100); } } 
    else { area.classList.remove('focus-active'); document.querySelectorAll('.focus-sentence').forEach(el => el.classList.remove('is-focused')); btn.innerHTML = "🎯 Odak: KAPALI"; }
}
function setupFocusObserver() { const observer = new IntersectionObserver((entries) => { if (!isFocusMode) return; entries.forEach(entry => { if (entry.isIntersecting) { document.querySelectorAll('.focus-sentence').forEach(s => s.classList.remove('is-focused')); entry.target.classList.add('is-focused'); } }); }, { root: document.querySelector('.scrollable-reading-box'), rootMargin: '-45% 0px -45% 0px', threshold: 0 }); document.querySelectorAll('.focus-sentence').forEach(sent => observer.observe(sent)); }

let isRadialOpen = false;
function toggleMobileMenu() { 
    const menu = document.getElementById('mobileRadialMenu'); 
    const fab = document.getElementById('mobileMenuFab'); 
    if(!menu || !fab) return; 

    isRadialOpen = !isRadialOpen; 
    if (isRadialOpen) { 
        menu.classList.add('is-open'); 
        fab.style.transform = "translateX(-50%) scale(0)"; 
    } else { 
        menu.classList.remove('is-open'); 
        fab.style.transform = "translateX(-50%) scale(1)"; 
    } 
}
function handleRadialClick(tabId) { switchTab(tabId); toggleMobileMenu(); }
function toggleBankDrawer() { const drawer = document.getElementById('globalBankDrawer'); drawer.classList.toggle('is-open'); if (drawer.classList.contains('is-open')) document.body.classList.add('drawer-open'); else document.body.classList.remove('drawer-open'); }

// Open World AI Quiz Generator
let currentReadingQuestions = []; 
async function generateAIQuiz() {
    const text = document.getElementById('readingInput').value; const quizBtn = document.getElementById('btnCreateReadingQuiz'); const quizList = document.getElementById('aiReadingQuizList');
    if (!text || text.length < 50) return alert("Önce bir metin üretmelisiniz!");
    quizBtn.style.display = 'none'; quizList.innerHTML = "<p style='text-align:center; color:var(--accent); padding:20px;'>AI metni analiz ediyor...</p>"; quizList.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prompt = `Based on the text, create 3 multiple-choice questions. Crucial: For each question, identify the EXACT sentence index from the text that contains the answer (0 for 1st sentence, 1 for 2nd...). Format your response ONLY as a JSON array: [{"q": "Question?", "a": "A", "b": "B", "c": "C", "d": "D", "correct": "a", "evidenceIndex": 0}] Text: ${text}`;
    const GROQ_API_KEY = "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"; 
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.4 }) });
        const data = await response.json(); const rawContent = data.choices[0].message.content; const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        currentReadingQuestions = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent); renderReadingQuizFinal(currentReadingQuestions);
    } catch (error) { quizList.innerHTML = "<p style='color:var(--error); text-align:center;'>Hata oluştu.</p>"; quizBtn.style.display = 'inline-block'; }
}
function renderReadingQuizFinal(questions) { const quizList = document.getElementById('aiReadingQuizList'); let html = ""; questions.forEach((item, index) => { html += `<div class="quiz-card" id="ai-q-card-${index}" style="margin-bottom:20px; background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:20px; border-radius:20px;"><div class="quiz-question" style="font-weight:700; margin-bottom:15px;">${index + 1}. ${item.q}</div><div class="quiz-options" style="display:flex; flex-direction:column; gap:10px;"><button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'a')">A) ${item.a}</button><button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'b')">B) ${item.b}</button><button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'c')">C) ${item.c}</button><button class="quiz-opt" onclick="checkReadingAnswer(this, ${index}, 'd')">D) ${item.d}</button></div></div>`; }); quizList.innerHTML = html; }
function checkReadingAnswer(btn, qIndex, selectedLetter) {
    const question = currentReadingQuestions[qIndex]; const card = document.getElementById(`ai-q-card-${qIndex}`); const options = card.querySelectorAll('.quiz-opt');
    options.forEach(opt => opt.style.pointerEvents = 'none');
    if (selectedLetter === question.correct) { btn.classList.add('correct'); if(typeof createConfetti === 'function') createConfetti(btn); } 
    else {
        btn.classList.add('wrong'); const allSentences = document.querySelectorAll('.focus-sentence');
        if (allSentences[question.evidenceIndex]) {
            allSentences.forEach(s => s.style.background = "none"); const evidence = allSentences[question.evidenceIndex];
            evidence.style.background = "rgba(255, 69, 58, 0.3)"; evidence.style.borderBottom = "2px solid var(--error)"; evidence.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { evidence.style.transition = "all 2s"; evidence.style.background = "rgba(255, 69, 58, 0.1)"; }, 3000);
        }
        options.forEach(opt => { if (opt.innerText.toLowerCase().startsWith(question.correct + ")")) opt.classList.add('correct'); });
    }
}
function createConfetti(target) { for(let i=0; i<10; i++) { const confetti = document.createElement('div'); confetti.innerText = "🎉"; confetti.style.position = 'fixed'; confetti.style.left = target.getBoundingClientRect().left + 'px'; confetti.style.top = target.getBoundingClientRect().top + 'px'; confetti.style.fontSize = '20px'; confetti.style.transition = 'all 1s ease-out'; confetti.style.zIndex = '10000'; document.body.appendChild(confetti); setTimeout(() => { confetti.style.transform = `translate(${(Math.random()-0.5)*200}px, ${(Math.random()-0.5)*200}px) rotate(${Math.random()*360}deg)`; confetti.style.opacity = '0'; }, 50); setTimeout(() => confetti.remove(), 1000); } }


// =======================================================================
// [6] HERO PATH ENGINE (TAM ENTEGRE - ZERO TO HERO)
// =======================================================================

function renderHeroRoadmap() {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    let totalRequired = 0; let totalCompleted = 0;

    levels.forEach(lvl => {
        const stats = heroStats[lvl];
        const node = document.getElementById('node' + lvl);
        if(!stats) return;

        totalRequired += stats.required; 
        totalCompleted += Math.min(stats.completed, stats.required);

        if(node) {
            const actionBtn = node.querySelector('.node-action');
            if (stats.unlocked) {
                node.classList.remove('locked'); node.classList.add('unlocked');
                if(actionBtn) {
                    actionBtn.classList.remove('locked-text');
                    const needsBossFight = stats.completed >= stats.required && (!stats.next || !heroStats[stats.next].unlocked);
                    const isFullyCompleted = stats.completed >= stats.required && stats.next && heroStats[stats.next].unlocked;

                    if (needsBossFight) {
                        actionBtn.innerHTML = `🏆 Sınava Gir (Boss Fight)`;
                        actionBtn.style.color = "#bf5af2"; 
                    } else if (isFullyCompleted) {
                        actionBtn.innerHTML = `✅ Tamamlandı (${stats.completed}/${stats.required})`;
                        actionBtn.style.color = "var(--primary)"; 
                    } else {
                        actionBtn.innerHTML = `Dersi Başlat ▶ (${stats.completed}/${stats.required})`;
                        actionBtn.style.color = "var(--accent)"; 
                    }
                }
            } else {
                node.classList.remove('unlocked'); node.classList.add('locked');
                if(actionBtn) actionBtn.innerHTML = "🔒 Kilitli";
            }
        }
    });

    const percent = totalRequired === 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100);
    const bar = document.getElementById('heroOverallBar');
    const pctText = document.getElementById('heroOverallPercent');
    if(bar) bar.style.width = percent + "%";
    if(pctText) pctText.innerText = "%" + percent;
}

async function startHeroLevel(level) {
    const stats = heroStats[level];
    currentHeroLevel = level;

    if (!stats.unlocked) { alert("Bu seviye kilitli!"); return; }

    if(typeof switchTab === 'function') switchTab('heroLesson');
    
    document.getElementById('heroLessonContent').style.display = 'none';
    document.getElementById('heroMiniQuizArea').style.display = 'none';
    document.getElementById('heroFinalExamArea').style.display = 'none';
    document.getElementById('heroLessonActions').style.display = 'none';
    document.getElementById('heroLessonLoading').style.display = 'block';

    const needsBossFight = stats.completed >= stats.required && (!stats.next || !heroStats[stats.next].unlocked);
    if (needsBossFight) {
        document.getElementById('heroLessonTitle').innerText = `🏆 ${level} Final Sınavı`;
        document.getElementById('heroLessonLoading').style.display = 'none';
        buildHeroFinalExam(level);
        return; 
    }

    document.getElementById('heroLessonTitle').innerText = `Level: ${level} (Ders ${stats.completed + 1}/${stats.required})`;
    const levelChar = level.charAt(0); 
    let pool = typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.filter(w => (w.level || "").startsWith(levelChar)) : [];
    
    currentHeroWords = pool.length > 0 
        ? pool.sort(() => 0.5 - Math.random()).slice(0, 5)
        : [{word: "challenge", meaning: "zorluk"}, {word: "improve", meaning: "geliştirmek"}];

    const wordListStr = currentHeroWords.map(w => w.word).join(", ");
    const meaningListStr = currentHeroWords.map(w => `${w.word} (${w.meaning})`).join(", ");

    const progressRatio = stats.completed / stats.required;
    let stageInstruction = progressRatio < 0.35 ? "EARLY STAGE: Use very simple forms." 
                       : progressRatio < 0.70 ? "MIDDLE STAGE: Standard difficulty for this level." 
                       : "LATE STAGE: Make it challenging. Preview next level's grammar slightly.";

    let levelInstruction = "";
    if (level === "A1") levelInstruction = "Rule: Strictly use 'to be' verbs (am/is/are/was/were). Absolute beginner. Explain like to a child.";
    else if (level === "A2") levelInstruction = "Rule: Basic action verbs, present continuous. Simple story-telling.";
    else if (level === "B1") levelInstruction = "Rule: Use transitions (however, therefore). Basic passive voice.";
    else if (level === "B2") levelInstruction = "Rule: Upper-intermediate. Relative clauses (which, who) and advanced connectors.";
    else levelInstruction = "Rule: Highly advanced academic English. TOEFL/IELTS style complexity.";

    const prompt = `You are the 'Zero to Hero' English Teacher. Level: ${level} CEFR. Target Vocabulary: ${wordListStr}.
    Task: Write an engaging paragraph (4-5 sentences) using ALL target words. Write a 3-line dialogue. Add a "Vocabulary Review" section at the end with these exact Turkish meanings: ${meaningListStr}. 
    CRITICAL RULES: ${levelInstruction} AND ${stageInstruction}. No markdown asterisks.`;

    const GROQ_API_KEY = "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"; 

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.55, max_tokens: 800 })
        });
        if (!response.ok) throw new Error("API Bağlantı Hatası");

        const data = await response.json();
        document.getElementById('heroLessonLoading').style.display = 'none';
        const contentArea = document.getElementById('heroLessonContent');
        contentArea.style.display = 'block';
        
        renderHeroTextAnalysis(data.choices[0].message.content.trim(), contentArea, level);
        buildHeroMiniQuiz();

    } catch (error) {
        document.getElementById('heroLessonLoading').style.display = 'none';
        document.getElementById('heroLessonContent').style.display = 'block';
        document.getElementById('heroLessonContent').innerHTML = `<p style="color:var(--error);">Bağlantı hatası oluştu. Lütfen tekrar deneyin.</p>`;
    }
}

function renderHeroTextAnalysis(rawText, container, level) {
    container.innerHTML = ""; 
    const paragraphs = rawText.split('\n');
    const toBeVerbs = ["am", "is", "are", "was", "were"];
    const b1Transitions = ["however", "therefore", "although", "because", "while", "but", "so"];
    const b2Relatives = ["which", "who", "whom", "whose", "furthermore", "moreover", "despite", "whereas"];

    paragraphs.forEach(paraText => {
        if(!paraText.trim()) return;
        const pElement = document.createElement('p');
        pElement.style.marginBottom = "15px";

        const tokens = paraText.split(/(\s+)/);
        tokens.forEach(word => {
            if (!word.trim()) { pElement.appendChild(document.createTextNode(word)); return; }

            let cleanWord = word.replace(/[^\p{L}]/gu, "").toLowerCase().trim();
            const span = document.createElement('span');
            span.innerText = word;

            if (cleanWord.length >= 2) {
                span.className = "hover-word";
                
                if ((level === "A1" || level === "A2") && toBeVerbs.includes(cleanWord)) {
                    span.style.color = "#0a84ff"; span.style.fontWeight = "900"; span.style.borderBottom = "2px solid #0a84ff"; span.style.background = "rgba(10, 132, 255, 0.1)";
                } else if (level === "B1" && b1Transitions.includes(cleanWord)) {
                    span.style.color = "#ff9f0a"; span.style.fontWeight = "800"; span.style.borderBottom = "2px dashed #ff9f0a"; span.style.background = "rgba(255, 159, 10, 0.1)";
                } else if (level === "B2" && b2Relatives.includes(cleanWord)) {
                    span.style.color = "#ff375f"; span.style.fontWeight = "800"; span.style.borderBottom = "2px dashed #ff375f"; span.style.background = "rgba(255, 55, 95, 0.1)";
                } else if (heroWords.some(hw => hw.word.toLowerCase() === cleanWord)) {
                    span.style.color = "var(--primary)"; span.style.fontWeight = "bold";
                } else if ((level === "B1" || level === "B2" || level === "C1") && typeof ydtArchiveData !== 'undefined' && ydtArchiveData.some(w => (w.word || "").toLowerCase() === cleanWord)) {
                    span.classList.add('is-data'); 
                }
                span.onclick = (e) => { e.stopPropagation(); if(typeof fetchDetails === 'function') fetchDetails(cleanWord); };
                if(typeof setupTooltip === 'function') setupTooltip(span, cleanWord);
            }
            pElement.appendChild(span);
        });
        container.appendChild(pElement);
    });
}

function buildHeroMiniQuiz() {
    currentHeroScore = 0;
    const quizArea = document.getElementById('heroMiniQuizArea');
    const questionBox = document.getElementById('miniQuizQuestions');
    quizArea.style.display = 'block';
    questionBox.innerHTML = "";
    document.getElementById('heroLessonActions').style.display = 'none';

    const wrongMeanings = typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.map(w => w.meaning).sort(() => 0.5 - Math.random()).slice(0, 20) : ["Yanlış 1", "Yanlış 2", "Yanlış 3"];

    currentHeroWords.forEach((wordObj, index) => {
        let options = [wordObj.meaning, wrongMeanings[index*2], wrongMeanings[index*2 + 1]].sort(() => 0.5 - Math.random());
        let html = `
            <div class="quiz-card" id="mini-q-${index}" style="padding:15px; border-radius:15px;">
                <p style="font-weight:bold; font-size:1.1rem; margin-bottom:10px; color:#fff;">${index+1}. "${wordObj.word}" kelimesinin anlamı nedir?</p>
                <div style="display:grid; gap:8px;">
                    ${options.map(opt => `<button class="quiz-opt" onclick="checkHeroMiniQuiz(this, '${opt.replace(/'/g, "\\'")}', '${wordObj.meaning.replace(/'/g, "\\'")}', ${index})">${opt}</button>`).join('')}
                </div>
            </div>
        `;
        questionBox.innerHTML += html;
    });
}

function checkHeroMiniQuiz(btn, selected, correct, index) {
    const card = document.getElementById(`mini-q-${index}`);
    const options = card.querySelectorAll('.quiz-opt');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    if (selected === correct) { btn.classList.add('correct-ans'); currentHeroScore++; } 
    else {
        btn.classList.add('wrong-ans');
        options.forEach(opt => { if(opt.innerText === correct) opt.classList.add('correct-ans'); });
    }

    const answeredCount = document.querySelectorAll('#miniQuizQuestions .correct-ans').length + document.querySelectorAll('#miniQuizQuestions .wrong-ans').length;
    if (answeredCount === currentHeroWords.length) {
        if (currentHeroScore === currentHeroWords.length) {
            document.getElementById('heroLessonActions').style.display = 'block';
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else {
            alert(`Testi geçemedin! (${currentHeroScore}/${currentHeroWords.length}) Doğrulara iyi bak, test 3 saniye içinde yeniden başlıyor.`);
            setTimeout(() => { document.getElementById('heroLessonActions').style.display = 'none'; buildHeroMiniQuiz(); }, 3000);
        }
    }
}

function completeHeroLesson() {
    currentHeroWords.forEach(w => {
        if (!heroWords.some(hw => hw.word.toLowerCase() === w.word.toLowerCase())) {
            heroWords.push({ id: "hero_" + Date.now() + Math.random(), word: w.word, meaning: w.meaning, level: currentHeroLevel, addedDate: Date.now() });
        }
    });

    localStorage.setItem('heroWords', JSON.stringify(heroWords));
    let stats = heroStats[currentHeroLevel];
    stats.completed += 1;
    localStorage.setItem('heroStats', JSON.stringify(heroStats));

    if (stats.completed >= stats.required) alert(`🎉 Harika! ${currentHeroLevel} derslerini bitirdin. Şimdi Final Sınavı zamanı!`);
    else alert(`✅ Ders tamamlandı! Öğrendiğin kelimeler Hero Çantasına eklendi.`);

    if (typeof switchTab === 'function') switchTab('hero');
    renderHeroRoadmap();
}

function buildHeroFinalExam(level) {
    heroFinalScore = 0;
    const examArea = document.getElementById('heroFinalExamArea');
    const questionBox = document.getElementById('finalExamQuestions');
    examArea.style.display = 'block';
    
    const learnedWords = heroWords.filter(w => w.level === level);
    if(learnedWords.length < 10) {
        alert("Sınav için Hero çantanızda yeterli kelime yok!");
        if (typeof switchTab === 'function') switchTab('hero'); 
        return;
    }

    heroFinalQuestions = learnedWords.sort(() => 0.5 - Math.random()).slice(0, 10);
    const wrongMeanings = typeof ydtArchiveData !== 'undefined' ? ydtArchiveData.map(w => w.meaning).sort(() => 0.5 - Math.random()).slice(0, 40) : ["Yanlış", "Yanlış", "Yanlış"];

    let html = `
        <div style="text-align:center; margin-bottom:25px; padding: 20px; background: rgba(191, 90, 242, 0.1); border: 1px solid rgba(191, 90, 242, 0.3); border-radius: 20px;">
            <h3 style="color:#bf5af2; margin-bottom:10px; font-size:1.5rem;">🛡️ ${level} BOSS FIGHT</h3>
            <p style="color:var(--text); font-size:0.95rem;">Bir sonraki seviyenin kilidini kırmak için <b>10 sorudan en az 8'ini</b> doğru bilmelisin!</p>
        </div>
    `;

    heroFinalQuestions.forEach((wordObj, index) => {
        let options = [wordObj.meaning, wrongMeanings[index*3], wrongMeanings[index*3 + 1], wrongMeanings[index*3 + 2]].sort(() => 0.5 - Math.random());
        html += `
            <div class="quiz-card" id="final-q-${index}" style="border-left: 4px solid #bf5af2;">
                <p style="font-weight:bold; font-size:1.15rem; margin-bottom:15px; color:#fff;">
                    <span style="color:#bf5af2; margin-right:5px;">Soru ${index+1}:</span> "${wordObj.word}" kelimesinin anlamı nedir?
                </p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    ${options.map(opt => `<button class="quiz-opt" style="font-size:0.95rem;" onclick="checkHeroFinalExam(this, '${opt.replace(/'/g, "\\'")}', '${wordObj.meaning.replace(/'/g, "\\'")}', ${index})">${opt}</button>`).join('')}
                </div>
            </div>
        `;
    });
    questionBox.innerHTML = html;
}

function checkHeroFinalExam(btn, selected, correct, index) {
    const card = document.getElementById(`final-q-${index}`);
    const options = card.querySelectorAll('.quiz-opt');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    if (selected === correct) { btn.classList.add('correct-ans'); heroFinalScore++; } 
    else {
        btn.classList.add('wrong-ans');
        options.forEach(opt => { if(opt.innerText === correct) opt.classList.add('correct-ans'); });
    }

    const answeredCount = document.querySelectorAll('#finalExamQuestions .correct-ans').length + document.querySelectorAll('#finalExamQuestions .wrong-ans').length;
    if (answeredCount === heroFinalQuestions.length) {
        setTimeout(() => {
            if (heroFinalScore >= 8) {
                alert(`🏆 MUHTEŞEM! ${heroFinalScore}/10 yaptın. Yeni seviyenin kilidi kırıldı!`);
                let stats = heroStats[currentHeroLevel];
                if (stats.next && heroStats[stats.next]) {
                    heroStats[stats.next].unlocked = true;
                    localStorage.setItem('heroStats', JSON.stringify(heroStats));
                }
            } else {
                alert(`💥 Sınavı Geçemedin! (${heroFinalScore}/10). En az 8 doğru yapmalısın.`);
            }
            if (typeof switchTab === 'function') switchTab('hero');
            renderHeroRoadmap();
        }, 1000);
    }
}

function openHeroBank() {
    const listArea = document.getElementById('heroBankList');
    if(!listArea) return;

    if (!heroWords || heroWords.length === 0) {
        listArea.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);"><div style="font-size:3rem; margin-bottom:10px;">🎒</div><p>Çantan şu an boş. Dersleri tamamladıkça öğreneceksin!</p></div>`;
    } else {
        listArea.innerHTML = [...heroWords].reverse().map(w => `
            <div class="bento-list-item" style="border-left: 4px solid var(--accent);">
                <div style="text-align:left;">
                    <b style="color:var(--text); font-size:1.15rem;">${w.word}</b><br>
                    <small style="color:#FFD60A; font-size:0.95rem; font-weight:500;">${w.meaning}</small>
                </div>
                <span style="background: rgba(191,90,242,0.15); color: #bf5af2; padding: 4px 10px; border-radius: 10px; font-size: 0.8rem; font-weight: bold;">${w.level}</span>
            </div>
        `).join('');
    }
    document.getElementById('heroBankModal').style.display = 'block';
}

function closeHeroBank() { document.getElementById('heroBankModal').style.display = 'none'; }


// =======================================================================
// [7] UYGULAMA BAŞLATILIRKEN VE GLOBAL ERİŞİM İZİNLERİ
// =======================================================================
window.startHeroLevel = startHeroLevel;
window.completeHeroLesson = completeHeroLesson;
window.openHeroBank = openHeroBank;
window.closeHeroBank = closeHeroBank;
window.checkHeroMiniQuiz = checkHeroMiniQuiz;
window.checkHeroFinalExam = checkHeroFinalExam;

/// =======================================================================
// [NİHAİ - HATASIZ] YDT SİMÜLASYON MOTORU
// =======================================================================
// =======================================================================
// [NİHAİ - HATASIZ] YDT SİMÜLASYON MOTORU
// =======================================================================
let examInterval; 
let examTimeLeft = 120 * 60; 
let currentExamIdx = 0;
let examAnswers = [];

async function startFullExam() {
    if(!confirm("Gerçek sınav simülasyonu başlıyor. Hazır mısın?")) return;
    
    document.getElementById('examWelcomeContent').style.display = 'none';
    document.getElementById('examActiveScreen').style.display = 'block';
    
    currentExamIdx = 0;
    examAnswers = [];
    examTimeLeft = 120 * 60;

    if(examInterval) clearInterval(examInterval);
    examInterval = setInterval(updateTimer, 1000);
    
    loadExamQuestion();
}

function updateTimer() {
    examTimeLeft--;
    if(examTimeLeft <= 0) { finishExamEarly(); return; }
    const mins = Math.floor(examTimeLeft / 60);
    const secs = examTimeLeft % 60;
    const timerEl = document.getElementById('examTimer');
    if(timerEl) timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function loadExamQuestion(retryCount = 0) {
    const qBox = document.getElementById('examQuestionBox');
    const badge = document.getElementById('examProgressBadge');
    if (!qBox) return;
    if (badge) badge.innerText = `Soru ${currentExamIdx + 1}`;
    
    qBox.innerHTML = `<div class="centered" style="text-align:center; padding:20px;"><p>⏳ AI Profesyonel YDT Sorusu Hazırlıyor...</p></div>`;

    // Soru tiplerine göre talimatlar...
    let specificInstruction = "Choose the word or expression that best completes the sentence.";

    const prompt = `Generate Question #${currentExamIdx + 1} for YDT. Strictly academic English. JSON format: {"question":"...", "a":"...", "b":"...", "c":"...", "d":"...", "e":"...", "correct":"a"}`;
    const GROQ_API_KEY = "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";

    try {
        await new Promise(res => setTimeout(res, 600));
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.3 })
        });

        if (response.status === 429 && retryCount < 3) return loadExamQuestion(retryCount + 1);
        const data = await response.json();
        const qData = JSON.parse(data.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);
        
        renderExamQuestion(qData);
    } catch (e) {
        qBox.innerHTML = `<button class="btn-primary" onclick="loadExamQuestion()">Hata! Tekrar Dene</button>`;
    }
}
function renderExamQuestion(q) {
    const qBox = document.getElementById('examQuestionBox');
    qBox.innerHTML = `
        <div class="question-text" style="font-size: 1.2rem; line-height: 1.7; margin-bottom: 25px; color:#fff;">
            ${q.question}
        </div>
        <div class="quiz-options">
            ${['a','b','c','d','e'].map(letter => `
                <button class="quiz-opt" onclick='submitExamAnswer("${letter}", "${q.correct}", ${JSON.stringify(q).replace(/'/g, "&apos;")})'>
                    <span style="font-weight: 900; margin-right: 10px; color: var(--accent);">${letter.toUpperCase()}.</span> ${q[letter]}
                </button>
            `).join('')}
        </div>
    `;
}

function submitExamAnswer(selected, correct, fullData) {
    // ANALİZ İÇİN 'qIdx' OLARAK KAYDEDİYORUZ
    examAnswers.push({ qIdx: currentExamIdx, selected, correct, fullData });
    currentExamIdx++;
    if(currentExamIdx < 80) loadExamQuestion(); else finishExamEarly();
}

function confirmFinishExam() {
    if(confirm("Sınavı bitirip sonuçları görmek istiyor musun?")) finishExamEarly();
}

function finishExamEarly() {
    if (examInterval) clearInterval(examInterval);
    
    const correctCount = examAnswers.filter(a => a.selected === a.correct).length;
    const wrongCount = examAnswers.length - correctCount;
    const net = (correctCount - (wrongCount * 0.25)).toFixed(2);

    document.getElementById('examActiveScreen').style.display = 'none';
    document.getElementById('examResultContent').style.display = 'block';

    document.getElementById('resCorrect').innerText = correctCount;
    document.getElementById('resWrong').innerText = wrongCount;
    document.getElementById('resNet').innerText = net;

    const reportBox = document.getElementById('examQuestionReport');
    reportBox.innerHTML = "";

    for (let i = 0; i < 80; i++) {
        const userAnswer = examAnswers.find(a => a.qIdx === i || a.q === i);
        const reportDiv = document.createElement('div');
        reportDiv.className = "report-item";
        
        if (userAnswer) {
            const isCorrect = userAnswer.selected === userAnswer.correct;
            reportDiv.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            reportDiv.onclick = () => showQuestionDetail(userAnswer);
            reportDiv.innerHTML = `
                <div>Soru ${i + 1} <small>(Analiz)</small></div>
                <span>${isCorrect ? '✅' : '❌'}</span>
            `;
        } else {
            reportDiv.innerHTML = `<div>Soru ${i + 1}</div> <span>⚪ Boş</span>`;
        }
        reportBox.appendChild(reportDiv);
        // ÖNEMLİ: Altındaki o hatalı reportDiv.innerHTML satırını sakın ekleme!
    }
}
function showQuestionDetail(ans) {
    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
    modal.innerHTML = `
        <div style="background:#1c1c1e; padding:25px; border-radius:24px; max-width:500px; width:100%; border:1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color:var(--accent); margin-bottom:15px;">Soru ${ans.qIdx+1} Analizi</h3>
            <div style="margin-bottom:20px; line-height:1.5; color:#fff; max-height:200px; overflow-y:auto;">${ans.fullData.question}</div>
            <div style="background:rgba(255,69,58,0.1); padding:10px; border-radius:10px; margin-bottom:10px;"><b>Senin Cevabın:</b> ${ans.selected.toUpperCase()}) ${ans.fullData[ans.selected]}</div>
            <div style="background:rgba(48,209,88,0.1); padding:10px; border-radius:10px;"><b>Doğru Cevap:</b> ${ans.correct.toUpperCase()}) ${ans.fullData[ans.correct]}</div>
            <button class="btn-primary" style="width:100%; margin-top:20px;" onclick="this.parentElement.parentElement.remove()">Kapat</button>
        </div>`;
    document.body.appendChild(modal);
}

window.startFullExam = startFullExam;
window.confirmFinishExam = confirmFinishExam;


function startExamTimer() {
    examTimer = setInterval(() => {
        examTimeLeft--;
        let mins = Math.floor(examTimeLeft / 60);
        let secs = examTimeLeft % 60;
        document.getElementById('examTimer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if(examTimeLeft <= 0) finishExamEarly();
    }, 1000);
}

async function loadExamQuestion(retryCount = 0) {
    const qBox = document.getElementById('examQuestionBox');
    const badge = document.getElementById('examProgressBadge');
    
    if (!qBox) return;
    if (badge) badge.innerText = `Soru ${currentExamIdx + 1}`;
    
    qBox.innerHTML = `
        <div class="centered" style="text-align:center; padding:20px;">
            <p>⏳ ÖSYM Soru Havuzu Analiz Ediliyor...</p>
            ${retryCount > 0 ? `<p style="color:var(--accent); font-size:0.8rem;">API Yoğunluğu: Tekrar deneniyor (${retryCount}/3)...</p>` : ''}
        </div>`;

    // --- [PDF ANALİZİNE DAYALI] ÖSYM RESMİ SORU DİZİLİMİ ---
    let qType = "";
    let specificInstruction = "";

    if (currentExamIdx < 5) {
        qType = "Vocabulary (Noun, Verb, Adj, Adv)";
        specificInstruction = "Choose the word or expression that best completes the sentence.";
    } else if (currentExamIdx < 15) {
        qType = "Grammar (Tenses, Prepositions, Conjunctions)";
        specificInstruction = "Choose the word or expression that best completes the sentence.";
    } else if (currentExamIdx < 20) {
        qType = "Cloze Test";
        specificInstruction = "Choose the word or expression that best completes the sentence in the given passage.";
    } else if (currentExamIdx < 28) {
        qType = "Sentence Completion";
        specificInstruction = "Choose the expression that best completes the given sentence.";
    } else if (currentExamIdx < 33) {
        qType = "English-Turkish Translation";
        specificInstruction = "Choose the Turkish translation that is closest in meaning to the given English sentence.";
    } else if (currentExamIdx < 38) {
        qType = "Turkish-English Translation";
        specificInstruction = "Verilen Türkçe cümleye anlamca en yakın İngilizce cümleyi bulunuz.";
    } else if (currentExamIdx < 53) {
        qType = "Reading Comprehension (Academic Passages)";
        specificInstruction = "Answer the question according to the passage provided.";
    } else if (currentExamIdx < 58) {
        qType = "Dialogue Completion";
        specificInstruction = "Choose the expression that best completes the dialogue.";
    } else if (currentExamIdx < 63) {
        qType = "Restatement (Closest Meaning)";
        specificInstruction = "Choose the sentence that is closest in meaning to the given sentence.";
    } else if (currentExamIdx < 68) {
        qType = "Paragraph Completion";
        specificInstruction = "Choose the sentence that best completes the given paragraph.";
    } else if (currentExamIdx < 75) {
        qType = "Situation Response";
        specificInstruction = "Choose the expression that best fits the given situation.";
    } else {
        qType = "Irrelevant Sentence (Meaning Continuity)";
        specificInstruction = "Cümleler sırasıyla okunduğunda parçanın anlam bütünlüğünü bozan cümleyi bulunuz.";
    }

    // --- [KRİTİK] ÖSYM TARZI PROMPT (PDF DNA'SIYLA) ---
    const prompt = `You are an expert examiner for the Turkish YDT (English) exam. Use the logic from the 2023-2025 PDF booklets.
    TASK: Generate Question #${currentExamIdx + 1} for an 80-question simulation.
    
    SECTION RULES:
    - CATEGORY: ${qType}
    - INSTRUCTION: ${specificInstruction}
    - DIFFICULTY: High Academic (B2-C1). 
    - LANGUAGE: Strictly Academic English (except for Turkish translation options in questions 28-38).
    
    SPECIAL FORMATTING RULES:
    1. For 'Irrelevant Sentence' (76-80), provide exactly 5 sentences marked as (I), (II), (III), (IV), and (V).
    2. For 'Translation' (28-38), ensure exact structural equivalence (subject-verb mapping).
    3. Use authentic academic contexts (Science, History, Philosophy, Social Issues).
    
    FORMAT: ONLY return a JSON object:
    {"question": "...", "a": "...", "b": "...", "c": "...", "d": "...", "e": "...", "correct": "a/b/c/d/e"}`;

    const GROQ_API_KEY = "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";

    try {
        // İstekler arasına 600ms suni gecikme (429'u önlemek için)
        await new Promise(res => setTimeout(res, 600));

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ 
                model: "llama-3.1-8b-instant", 
                messages: [{ role: "user", content: prompt }], 
                temperature: 0.3 
            })
        });

        // 429 Hatası Durumunda Retry (Tekrar Dene)
        if (response.status === 429 && retryCount < 3) {
            console.warn(`429 Hatası: ${retryCount + 1}. deneme başlıyor...`);
            return loadExamQuestion(retryCount + 1);
        }

        if (!response.ok) throw new Error(`HTTP Hata: ${response.status}`);

        const data = await response.json();
        const jsonMatch = data.choices[0].message.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON Formatı Bozuk");
        
        const qData = JSON.parse(jsonMatch[0]);
        qData.question = `<i style="color:var(--accent); font-size:0.85rem; font-weight:700; text-transform:uppercase;">${specificInstruction}</i><br><br>${qData.question}`;

        renderExamQuestion(qData);
    } catch (e) {
        console.error("Sınav Motoru Hatası:", e);
        qBox.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="color:var(--error); font-weight:800;">Bağlantı Kesildi veya Kota Doldu</p>
                <p style="font-size:0.8rem; margin:10px 0;">${e.message}</p>
                <button class="btn-primary" onclick="loadExamQuestion()">İsteği Tekrarla</button>
            </div>`;
    }
}



// Yanlışlıkla basmaları önlemek için onay kutusu
function confirmFinishExam() {
    const solvedCount = examAnswers.length;
    const remainingCount = 80 - solvedCount;
    
    let message = `Sınavı bitirmek istediğine emin misin?\n\n`;
    message += `✅ Çözülen: ${solvedCount}\n`;
    message += `⚪ Kalan: ${remainingCount}\n\n`;
    message += `Sınav sonlandırılacak ve analiz raporun hazırlanacak.`;

    if (confirm(message)) {
        finishExamEarly(); // Mevcut raporlama fonksiyonunu tetikler
    }
}

function renderExamQuestion(q) {
    const qBox = document.getElementById('examQuestionBox');
    qBox.innerHTML = `
        <div class="question-text" style="font-size: 1.2rem; line-height: 1.7; margin-bottom: 25px;">
            ${q.question}
        </div>
        <div class="quiz-options">
            ${['a','b','c','d','e'].map(letter => `
                <button class="quiz-opt" onclick='submitExamAnswer("${letter}", "${q.correct}", ${JSON.stringify(q).replace(/'/g, "&apos;")})'>
                    <span style="font-weight: 900; margin-right: 10px; color: var(--accent);">${letter.toUpperCase()}.</span> ${q[letter]}
                </button>
            `).join('')}
        </div>
    `;
}

function submitExamAnswer(selected, correct, fullData) {
    // Analiz ekranı için fullData'yı da kaydediyoruz
    examAnswers.push({ qIdx: currentExamIdx, selected, correct, fullData });
    currentExamIdx++;
    
    if(currentExamIdx < 80) {
        loadExamQuestion();
    } else {
        finishExamEarly();
    }
}
function finishExamEarly() {
    if (examInterval) clearInterval(examInterval);
    
    const solvedCount = examAnswers.length;
    const correctCount = examAnswers.filter(a => a.selected === a.correct).length;
    const wrongCount = solvedCount - correctCount;
    const net = (correctCount - (wrongCount * 0.25)).toFixed(2);

    document.getElementById('examActiveScreen').style.display = 'none';
    document.getElementById('examResultContent').style.display = 'block';

    document.getElementById('resCorrect').innerText = correctCount;
    document.getElementById('resWrong').innerText = wrongCount;
    document.getElementById('resNet').innerText = net;

    const reportBox = document.getElementById('examQuestionReport');
    reportBox.innerHTML = "";

    for (let i = 0; i < 80; i++) {
        const userAnswer = examAnswers.find(a => a.qIdx === i || a.q === i);
        const reportDiv = document.createElement('div');
        reportDiv.className = "report-item";
        
        if (userAnswer) {
            const isCorrect = userAnswer.selected === userAnswer.correct;
            reportDiv.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            // TIKLAMA ÖZELLİĞİ: Burası detay sayfasını tetikler
            reportDiv.onclick = () => showQuestionDetail(userAnswer);
            
            reportDiv.innerHTML = `
                <div style="text-align:left;">
                    <b>Soru ${i + 1}</b>
                    <small style="display:block; font-size:0.7rem; color:var(--accent);">Analiz için tıkla</small>
                </div>
                <span>${isCorrect ? '✅' : '❌'}</span>
            `;
        } else {
            reportDiv.style.opacity = "0.5";
            reportDiv.innerHTML = `<div>Soru ${i + 1}</div> <span>⚪ Boş</span>`;
        }
        reportBox.appendChild(reportDiv);
    }
}

function showQuestionDetail(ans) {
    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
    
    // Şık metinlerini alalım
    const userText = ans.fullData[ans.selected];
    const correctText = ans.fullData[ans.correct];

    modal.innerHTML = `
        <div style="background:#1c1c1e; padding:30px; border-radius:30px; max-width:550px; width:100%; border:1px solid rgba(255,255,255,0.1); box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color:var(--accent); margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px;">Soru ${ans.qIdx + 1} Analizi</h3>
            
            <p style="color:#fff; line-height:1.6; margin-bottom:25px; font-size:1.05rem;">${ans.fullData.question}</p>
            
            <div style="display:grid; gap:12px;">
                <div style="background:rgba(255,69,58,0.15); padding:15px; border-radius:15px; border:1px solid rgba(255,69,58,0.2);">
                    <small style="color:#ff453a; font-weight:800; display:block; margin-bottom:5px; text-transform:uppercase;">Senin Cevabın</small>
                    <span style="color:#fff;"><b>${ans.selected.toUpperCase()})</b> ${userText}</span>
                </div>
                
                <div style="background:rgba(48,209,88,0.15); padding:15px; border-radius:15px; border:1px solid rgba(48,209,88,0.2);">
                    <small style="color:#30d158; font-weight:800; display:block; margin-bottom:5px; text-transform:uppercase;">Doğru Cevap</small>
                    <span style="color:#fff;"><b>${ans.correct.toUpperCase()})</b> ${correctText}</span>
                </div>
            </div>
            
            <button class="btn-primary" style="width:100%; margin-top:25px; padding:15px; border-radius:15px; font-weight:700;" onclick="this.parentElement.parentElement.remove()">Analizi Kapat</button>
        </div>`;
    document.body.appendChild(modal);
}

window.onload = () => { 
    if(typeof renderWords === 'function') renderWords(); 
    if(typeof updateDashboard === 'function') updateDashboard(); 
    if(typeof renderMistakes === 'function') renderMistakes(); 
    if(typeof renderArchive === 'function') renderArchive(); 
    if(typeof renderHeroRoadmap === 'function') renderHeroRoadmap(); 
};