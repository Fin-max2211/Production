/**
 * ============================================================
 * app.js — Main Application Logic (Redesigned)
 * ============================================================
 * ⚠️ SECURITY: ใช้ addEventListener + textContent เท่านั้น
 * ============================================================
 */

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
var currentQuestion = 0;
var userName = '';
var isMuted = false;
var collectedItems = [];
var selectedAnswers = [];
var personalityScores = { C: 0, P: 0, F: 0, L: 0 };

// Sub-question state
var isInSubQuestion = false;
var subQuestionData = null;
var parentSelectionIndex = -1;

// Background Music
// 📝 เปลี่ยน path เพลงได้ที่นี่ (รองรับ .mp3, .ogg, .wav)
var BGM_PATH = 'assets/audio/Filo Starquez - Park Vibes (freetouse.com).mp3';
var bgAudio = null;

// ══════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ══════════════════════════════════════════════════════════════
var DEFAULT_OPTION_EMOJIS = ['😤', '😌', '🤔', '😊'];

var OPTION_COLOR_CLASSES = ['opt-color-0', 'opt-color-1', 'opt-color-2', 'opt-color-3'];

var REVEAL_GRADIENTS = [
    'linear-gradient(180deg, #8b0000 0%, #c62828 35%, #e53935 100%)',
    'linear-gradient(180deg, #0a1660 0%, #1565c0 35%, #1976d2 100%)',
    'linear-gradient(180deg, #1a5c10 0%, #2e7d32 35%, #43a047 100%)',
    'linear-gradient(180deg, #7a6b08 0%, #a89920 40%, #c4b530 100%)'
];




// ══════════════════════════════════════════════════════════════
// IMAGE FALLBACK HANDLER (CSP-safe, no inline onload)
// ══════════════════════════════════════════════════════════════
function setupImageFallbacks() {
    var pairs = [
        { imgId: 'img-logo', fallbackId: 'fallback-logo', display: 'inline' },
        { imgId: 'img-hero', fallbackId: 'fallback-hero', display: 'block' },
        { imgId: 'img-qicon', fallbackId: 'fallback-qicon', display: 'inline' }
    ];

    pairs.forEach(function (pair) {
        var img = document.getElementById(pair.imgId);
        var fallback = document.getElementById(pair.fallbackId);
        if (!img || !fallback) return;

        function showImg() {
            img.style.display = pair.display;
            fallback.style.display = 'none';
        }

        function showFallback() {
            img.style.display = 'none';
            fallback.style.display = '';
        }

        // Check if already loaded (cached)
        if (img.complete) {
            if (img.naturalWidth > 0) {
                showImg();
            } else {
                showFallback();
            }
        } else {
            // Not yet loaded — listen for events
            img.addEventListener('load', showImg);
            img.addEventListener('error', showFallback);
        }
    });
}


// ══════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {

    // Setup image fallbacks (CSP-safe)
    setupImageFallbacks();

    // 🎵 เริ่มเล่นเพลงทันทีที่โหลดหน้าเว็บ
    // ถ้า browser บล็อก autoplay → เล่นอัตโนมัติเมื่อผู้ใช้คลิก/แตะครั้งแรก
    startBGM();
    function onFirstInteraction() {
        startBGM();
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
    }
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    // ปุ่ม START (cover page มี input + start รวมกัน)
    var btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', function () {
            submitName();
        });
    }

    // ปุ่ม Next Question (reveal page)
    var btnNextQ = document.getElementById('btn-next-q');
    if (btnNextQ) {
        btnNextQ.addEventListener('click', function () {
            nextQuestion();
        });
    }

    // (ลบปุ่ม Summary Next แล้ว — Summary เป็นหน้าสุดท้าย)

    // ปุ่ม Download Result as JPG
    var btnDownload = document.getElementById('btn-summary-download');
    if (btnDownload) {
        btnDownload.addEventListener('click', function () {
            downloadResultAsJPG();
        });
    }

    // ปุ่ม Submit Suggestion
    var btnSubmitSuggest = document.getElementById('btn-submit-suggest');
    if (btnSubmitSuggest) {
        btnSubmitSuggest.addEventListener('click', function () {
            submitSuggestion();
        });
    }

    // ปุ่ม Mute ทั้งหมด
    var muteButtons = document.querySelectorAll('.mute-btn');
    muteButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            toggleMute();
        });
    });

    // Input ชื่อ — Enter = Submit
    var usernameInput = document.getElementById('input-username');
    if (usernameInput) {
        usernameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitName();
            }
        });
        usernameInput.addEventListener('input', function () {
            this.classList.remove('error');
            document.getElementById('error-username').textContent = '';
        });
    }

    console.log('[APP] ✅ Initialized');
});


// ══════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════
function goTo(pageId) {
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function (s) {
        s.classList.remove('active');
    });

    var target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
        target.style.animation = 'none';
        target.offsetHeight;
        target.style.animation = '';
        target.scrollTop = 0;
    }
}


// ══════════════════════════════════════════════════════════════
// MUTE
// ══════════════════════════════════════════════════════════════
function toggleMute() {
    isMuted = !isMuted;
    var iconSrc = isMuted ? 'assets/icon/turn-off.png' : 'assets/icon/turn-on.png';
    var icons = document.querySelectorAll('.sound-icon-img');
    icons.forEach(function (el) {
        el.src = iconSrc;
    });

    // ควบคุมเพลง background
    if (bgAudio) {
        if (isMuted) {
            bgAudio.pause();
        } else {
            bgAudio.play().catch(function () { });
        }
    }
}


// ══════════════════════════════════════════════════════════════
// IMAGE RENDERING
// ══════════════════════════════════════════════════════════════
function renderImage(container, imgValue, altText) {
    var isFilePath = imgValue && (
        imgValue.includes('/') ||
        imgValue.includes('.png') ||
        imgValue.includes('.jpg') ||
        imgValue.includes('.webp') ||
        imgValue.includes('.svg') ||
        imgValue.includes('.gif')
    );

    if (isFilePath) {
        container.textContent = '';
        var img = document.createElement('img');
        img.src = imgValue;
        img.alt = altText || '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'inherit';
        img.onerror = function () {
            container.textContent = '🖼️';
        };
        container.appendChild(img);
    } else {
        container.textContent = imgValue || '🖼️';
    }
}


// ══════════════════════════════════════════════════════════════
// COVER → SUBMIT NAME & START QUIZ
// ══════════════════════════════════════════════════════════════
function submitName() {
    var input = document.getElementById('input-username');
    var errorEl = document.getElementById('error-username');
    userName = input.value.trim();

    if (!userName) {
        input.classList.add('error');
        errorEl.textContent = 'กรุณากรอกชื่อก่อนนะ!';
        input.focus();
        return;
    }

    if (userName.length > 30) {
        userName = userName.substring(0, 30);
    }

    // Reset state
    currentQuestion = 0;
    collectedItems = [];
    selectedAnswers = [];
    personalityScores = { C: 0, P: 0, F: 0, L: 0 };

    // เริ่มเล่นเพลง background ตอนกด START
    startBGM();

    renderQuestion();
    goTo('page-question');
}


// ══════════════════════════════════════════════════════════════
// BACKGROUND MUSIC
// ══════════════════════════════════════════════════════════════
function startBGM() {
    if (isMuted) return;

    // สร้าง Audio element ถ้ายังไม่มี
    if (!bgAudio) {
        bgAudio = new Audio(BGM_PATH);
        bgAudio.loop = true;      // เล่นวนซ้ำ
        bgAudio.volume = 0.4;     // ความดัง 40% (ปรับได้)
    }

    bgAudio.currentTime = 0;
    bgAudio.play().catch(function (err) {
        console.log('[BGM] Cannot autoplay:', err.message);
    });
}


// ══════════════════════════════════════════════════════════════
// QUESTION PAGE
// ══════════════════════════════════════════════════════════════
function renderQuestion() {
    var q = QUESTIONS[currentQuestion];

    // Reset sub-question state
    isInSubQuestion = false;
    subQuestionData = null;
    parentSelectionIndex = -1;

    // Counter
    document.getElementById('q-counter').textContent =
        (currentQuestion + 1) + '/' + QUESTIONS.length;

    // Reset card: show text, hide emoji
    var cardEmoji = document.getElementById('q-card-emoji');
    var qTextEl = document.getElementById('q-text');
    if (cardEmoji) cardEmoji.style.display = 'none';
    if (qTextEl) qTextEl.style.display = '';

    // Question text
    qTextEl.textContent = q.text;

    // Prompt (use custom if exists, else default)
    var promptEl = document.getElementById('q-prompt');
    promptEl.textContent = q.prompt || 'คุณจะ...';
    promptEl.className = 'q-prompt';

    // Options
    renderOptions(q.options, q.optionEmojis);
}


// ══════════════════════════════════════════════════════════════
// SUB-QUESTION (2-step question)
// Supports two patterns:
//   1. subQuestion  (single object) — shared sub-question for all options (Q2 style)
//   2. subQuestions  (array)        — different sub-question per option  (Q4 style)
// ══════════════════════════════════════════════════════════════
function renderSubQuestion(parentQ, selectedIndex) {
    // Determine which sub-question data to use
    var sub;
    var isPerOption = false;
    if (parentQ.subQuestions) {
        // Array: each parent option has its own sub-question
        sub = parentQ.subQuestions[selectedIndex];
        isPerOption = true;
    } else {
        // Single: shared sub-question for all options
        sub = parentQ.subQuestion;
    }

    isInSubQuestion = true;
    subQuestionData = sub;
    parentSelectionIndex = selectedIndex;

    // Counter stays the same
    document.getElementById('q-counter').textContent =
        (currentQuestion + 1) + '/' + QUESTIONS.length;

    var cardEmoji = document.getElementById('q-card-emoji');
    var qTextEl = document.getElementById('q-text');

    if (isPerOption && sub.text) {
        // Per-option style: show new text in card, hide emoji
        if (cardEmoji) cardEmoji.style.display = 'none';
        if (qTextEl) {
            qTextEl.textContent = sub.text;
            qTextEl.style.display = '';
            // Re-trigger animation
            qTextEl.style.animation = 'none';
            qTextEl.offsetHeight;
            qTextEl.style.animation = '';
        }
    } else {
        // Shared style: show emoji in card, hide text
        if (cardEmoji) {
            cardEmoji.textContent = sub.images[selectedIndex] || '🐾';
            cardEmoji.style.display = 'block';
            cardEmoji.style.animation = 'none';
            cardEmoji.offsetHeight;
            cardEmoji.style.animation = '';
        }
        if (qTextEl) qTextEl.style.display = 'none';
    }

    // Prompt — multi-line
    var promptEl = document.getElementById('q-prompt');
    promptEl.textContent = sub.prompt || 'คุณจะ...';
    promptEl.className = 'q-prompt q-prompt-multiline';

    // Options
    renderOptions(sub.options, sub.optionEmojis);

    // Re-trigger page animation
    var page = document.getElementById('page-question');
    if (page) {
        page.style.animation = 'none';
        page.offsetHeight;
        page.style.animation = '';
    }
}


// ══════════════════════════════════════════════════════════════
// RENDER OPTIONS (shared helper)
// ══════════════════════════════════════════════════════════════
function renderOptions(options, optionEmojis) {
    var grid = document.getElementById('q-options');
    grid.textContent = '';

    var emojis = optionEmojis || DEFAULT_OPTION_EMOJIS;

    options.forEach(function (opt, idx) {
        var btn = document.createElement('button');
        btn.className = 'option-btn ' + OPTION_COLOR_CLASSES[idx % 4];

        var emojiSpan = document.createElement('span');
        emojiSpan.className = 'option-emoji';
        emojiSpan.textContent = emojis[idx] || '😊';

        var textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        textSpan.textContent = opt;

        btn.appendChild(emojiSpan);
        btn.appendChild(textSpan);

        btn.setAttribute('aria-label', 'เลือก: ' + opt);
        btn.addEventListener('click', function () {
            selectAnswer(idx);
        });

        grid.appendChild(btn);
    });
}


// ══════════════════════════════════════════════════════════════
// SELECT ANSWER → REVEAL
// ══════════════════════════════════════════════════════════════
function selectAnswer(optionIndex) {
    var q = QUESTIONS[currentQuestion];

    // ── Check: does this question have a sub-question and we haven't entered it yet? ──
    if (!isInSubQuestion && (q.subQuestion || q.subQuestions)) {
        // Don't score yet — show the sub-question
        renderSubQuestion(q, optionIndex);
        return;
    }

    // ── Get the active question data (sub-question or main question) ──
    var activeQ = isInSubQuestion ? subQuestionData : q;
    var reward = activeQ.rewards[optionIndex];

    selectedAnswers.push(optionIndex);
    collectedItems.push(reward);

    // Track personality type
    var types = activeQ.types || q.types;
    if (types && types[optionIndex]) {
        var pType = types[optionIndex];
        if (personalityScores[pType] !== undefined) {
            personalityScores[pType]++;
        }
    }

    // Set reveal page background color
    var revealPage = document.getElementById('page-reveal');
    revealPage.style.background = REVEAL_GRADIENTS[optionIndex % 4];

    // Update counter
    document.getElementById('reveal-counter').textContent =
        (currentQuestion + 1) + '/' + QUESTIONS.length;

    // Subtitle
    document.getElementById('reveal-subtitle').textContent =
        activeQ.revealSubtitle || q.revealSubtitle || 'ชีวิตธรรมศาสตร์ในแบบของคุณต้อง...';

    // Answer name
    document.getElementById('reveal-item-name').textContent = reward.name;

    // Emoji
    var revealImgEl = document.getElementById('reveal-item-img');
    renderImage(revealImgEl, reward.img, reward.name);

    // Description
    document.getElementById('reveal-item-desc').textContent = reward.desc;

    // Extra text (optional bonus message)
    var extraTextEl = document.getElementById('reveal-extra-text');
    if (reward.extraText) {
        extraTextEl.textContent = reward.extraText;
        extraTextEl.style.display = 'block';
    } else {
        extraTextEl.textContent = '';
        extraTextEl.style.display = 'none';
    }

    // Next button text — ทุกข้อเป็น NEXT เสมอ (รวมข้อสุดท้าย)
    var nextBtn = document.getElementById('btn-next-q');
    nextBtn.textContent = 'NEXT';

    // Reset sub-question state before navigating
    isInSubQuestion = false;
    subQuestionData = null;
    parentSelectionIndex = -1;

    goTo('page-reveal');
}


// ══════════════════════════════════════════════════════════════
// NEXT QUESTION
// ══════════════════════════════════════════════════════════════
function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < QUESTIONS.length) {
        renderQuestion();
        goTo('page-question');
    } else {
        // คำถามครบแล้ว → ไปหน้า Suggestion ก่อนดูผลลัพธ์
        goTo('page-suggest');
    }
}


// ══════════════════════════════════════════════════════════════
// SUMMARY PAGE
// ══════════════════════════════════════════════════════════════
function renderSummary() {
    // Determine dominant personality type
    var maxType = 'C';
    var maxCount = 0;
    var typeKeys = ['C', 'P', 'F', 'L'];
    for (var i = 0; i < typeKeys.length; i++) {
        if (personalityScores[typeKeys[i]] > maxCount) {
            maxCount = personalityScores[typeKeys[i]];
            maxType = typeKeys[i];
        }
    }

    var result = PERSONALITY_RESULTS[maxType];

    // Subtitle
    document.getElementById('result-subtitle').textContent =
        'ชีวิตในธรรมศาสตร์ของคุณ คือ...';

    // Title (supports multi-line via \n)
    document.getElementById('result-title').textContent = result.title;

    // Main emoji/image
    var emojiEl = document.getElementById('result-emoji');
    emojiEl.textContent = result.emoji || '🌟';
    // Try loading image; fallback to emoji on error
    if (result.img && result.img.includes('/')) {
        var mainImg = new Image();
        mainImg.onload = function () {
            emojiEl.textContent = '';
            mainImg.style.maxWidth = '120px';
            mainImg.style.maxHeight = '120px';
            mainImg.style.objectFit = 'contain';
            emojiEl.appendChild(mainImg);
        };
        mainImg.src = result.img;
    }

    // Description
    document.getElementById('result-desc').textContent = result.desc;

    // Item label
    document.getElementById('result-item-label').textContent =
        result.itemLabel || 'ไอเทมที่ควรพกติดตัวไว้คือ...';

    // Item emoji/image
    var itemEmojiEl = document.getElementById('result-item-emoji');
    itemEmojiEl.textContent = result.itemEmoji || '📦';
    // Try loading image; fallback to emoji on error
    if (result.itemImg && result.itemImg.includes('/')) {
        var itemImg = new Image();
        itemImg.onload = function () {
            itemEmojiEl.textContent = '';
            itemImg.style.maxWidth = '100px';
            itemImg.style.maxHeight = '100px';
            itemImg.style.objectFit = 'contain';
            itemEmojiEl.appendChild(itemImg);
        };
        itemImg.src = result.itemImg;
    }

    // Item name
    document.getElementById('result-item-name').textContent = result.itemName;

    // Item description
    document.getElementById('result-item-desc').textContent = result.itemDesc;

    console.log('[RESULT] Personality scores:', JSON.stringify(personalityScores), '=> Type:', maxType);
}


// ══════════════════════════════════════════════════════════════
// DOWNLOAD RESULT AS JPG
// ══════════════════════════════════════════════════════════════
function downloadResultAsJPG() {
    var btn = document.getElementById('btn-summary-download');
    if (!btn || btn.classList.contains('downloading')) return;

    btn.classList.add('downloading');

    var layoutEl = document.querySelector('#page-summary .result-layout');
    if (!layoutEl) {
        btn.classList.remove('downloading');
        return;
    }

    // Hide buttons during capture
    var btnGroup = layoutEl.querySelector('.result-btn-group');
    if (btnGroup) btnGroup.style.display = 'none';

    // ─── Fix 1: backdrop-filter + transparent bg ───
    // html2canvas ไม่รองรับ backdrop-filter → ใส่ background ทึบชั่วคราว
    var origBg = layoutEl.style.background;
    var origBackdrop = layoutEl.style.backdropFilter;
    var origWebkitBackdrop = layoutEl.style.webkitBackdropFilter;
    layoutEl.style.background = 'linear-gradient(180deg, #e8eef8 0%, #d4dff2 50%, #c5d5ed 100%)';
    layoutEl.style.backdropFilter = 'none';
    layoutEl.style.webkitBackdropFilter = 'none';

    // ─── Fix 2: ปิด CSS Animations ทั้งหมด ───
    // html2canvas clone DOM → animation restart จาก opacity:0 → เนื้อหาหายหมด
    // ต้องปิด animation ก่อน capture
    layoutEl.style.animation = 'none';
    var allChildren = layoutEl.querySelectorAll('*');
    allChildren.forEach(function (el) {
        el.style.animation = 'none';
    });

    html2canvas(layoutEl, {
        backgroundColor: '#dce6f5',
        scale: 2,
        useCORS: true,
        logging: false
    }).then(function (canvas) {
        // Restore ทุกอย่าง
        layoutEl.style.background = origBg;
        layoutEl.style.backdropFilter = origBackdrop;
        layoutEl.style.webkitBackdropFilter = origWebkitBackdrop;
        layoutEl.style.animation = '';
        allChildren.forEach(function (el) {
            el.style.animation = '';
        });
        if (btnGroup) btnGroup.style.display = '';

        // Convert to JPG and download
        var link = document.createElement('a');
        var safeName = userName.replace(/[^a-zA-Z0-9ก-๙]/g, '_') || 'result';
        link.download = 'TU_Life_' + safeName + '.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();

        btn.classList.remove('downloading');
    }).catch(function (err) {
        console.error('[Download Error]', err);
        // Restore styles on error too
        layoutEl.style.background = origBg;
        layoutEl.style.backdropFilter = origBackdrop;
        layoutEl.style.webkitBackdropFilter = origWebkitBackdrop;
        layoutEl.style.animation = '';
        allChildren.forEach(function (el) {
            el.style.animation = '';
        });
        if (btnGroup) btnGroup.style.display = '';
        btn.classList.remove('downloading');
        alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่');
    });
}


// ══════════════════════════════════════════════════════════════
// SUBMIT SUGGESTION → ส่งข้อมูลทั้งหมด + suggestion → ไปหน้า Summary
// ══════════════════════════════════════════════════════════════
function submitSuggestion() {
    var suggestion = document.getElementById('input-suggestion').value.trim();

    // Determine personality result
    var maxType = 'C';
    var maxCount = 0;
    var typeKeys = ['C', 'P', 'F', 'L'];
    for (var i = 0; i < typeKeys.length; i++) {
        if (personalityScores[typeKeys[i]] > maxCount) {
            maxCount = personalityScores[typeKeys[i]];
            maxType = typeKeys[i];
        }
    }
    var resultData = PERSONALITY_RESULTS[maxType];

    var payload = {
        username: userName,
        answers: selectedAnswers,
        items: collectedItems.map(function (item) { return item.name; }),
        suggestion: suggestion,
        personalityType: maxType,
        personalityName: resultData.title.replace(/\n/g, ' '),
        personalityScores: personalityScores
    };

    var submitBtn = document.getElementById('btn-submit-suggest');
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังโหลด...';

    fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.success) {
                console.log('[API] ✅ Data saved successfully');
                renderSummary();
                goTo('page-summary');
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.message || 'กรุณาลองใหม่'));
                submitBtn.disabled = false;
                submitBtn.textContent = 'ดูผลลัพธ์ 🎉';
            }
        })
        .catch(function (error) {
            console.error('[API Error]', error);
            alert('ไม่สามารถเชื่อมต่อ Server ได้ กรุณาลองใหม่');
            submitBtn.disabled = false;
            submitBtn.textContent = 'ดูผลลัพธ์ 🎉';
        });
}
