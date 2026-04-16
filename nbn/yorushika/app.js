import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAq3fTUZvUscSi0V5I49TFL9SOLB5e1BfI",
  authDomain: "yorushika-comment.firebaseapp.com",
  projectId: "yorushika-comment",
  storageBucket: "yorushika-comment.firebasestorage.app",
  messagingSenderId: "424982794250",
  appId: "1:424982794250:web:64f52fdd4226cca00dcff3"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

let DATA = null;

const state = {
  view: "start", // start | quiz | result
  currentIndex: 0,
  answers: [],
  scores: { A: 0, B: 0, C: 0, D: 0 },
  result: null
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

async function loadData() {
  const res = await fetch("./yorushika.json", { cache: "no-store" });
  if (!res.ok) throw new Error("yorushika.json 加载失败");
  DATA = await res.json();
}

function calcOptionValue(optionIndex) {
  return DATA.options.length - optionIndex;
}

function matchSong() {
  const total = Object.values(state.scores).reduce((a, b) => a + b, 0);
  let best = DATA.songs[0];
  let bestFit = -Infinity;

  for (const s of DATA.songs) {
    let fit = 0;

    if (total >= s.totalMin && total <= s.totalMax) fit += 2;
    if (state.scores.A >= s.rangeA[0] && state.scores.A <= s.rangeA[1]) fit++;
    if (state.scores.B >= s.rangeB[0] && state.scores.B <= s.rangeB[1]) fit++;
    if (state.scores.C >= s.rangeC[0] && state.scores.C <= s.rangeC[1]) fit++;
    if (state.scores.D >= s.rangeD[0] && state.scores.D <= s.rangeD[1]) fit++;

    if (fit > bestFit) {
      bestFit = fit;
      best = s;
    }
  }

  return best;
}

function renderStart() {
  return `
    <div class="page">
      <section class="panel hero">
        <div class="eyebrow">Yorushika Test</div>
        <h1 class="hero-title">${escapeHtml(DATA.meta?.title || "你是哪一首ヨルシカ")}</h1>
        <p class="hero-subtitle">${escapeHtml(DATA.meta?.subtitle || "在夜与夏之间，找到属于你的歌")}</p>
        <button class="btn btn-primary" id="startBtn">开始测试</button>
      </section>
    </div>
  `;
}

function renderQuiz() {
  const q = DATA.questions[state.currentIndex];
  const total = DATA.questions.length;
  const selected = state.answers[state.currentIndex] ?? null;
  const progress = Math.round(((state.currentIndex + 1) / total) * 100);

  return `
    <div class="page">
      <section class="panel">
        <div class="quiz-top">
          <div class="progress-meta">第 ${state.currentIndex + 1} / ${total} 题</div>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <h2 class="question-text">${escapeHtml(q.text)}</h2>

        <div class="options">
          ${DATA.options.map((label, i) => {
            const isActive = selected === i;
            return `
              <button
                class="option-btn ${isActive ? "active" : ""}"
                data-option-index="${i}"
              >
                ${escapeHtml(label)}
              </button>
            `;
          }).join("")}
        </div>

        <div class="quiz-actions">
          <button class="btn btn-secondary" id="prevBtn" ${state.currentIndex === 0 ? "disabled" : ""}>上一题</button>
          <button class="btn btn-primary" id="nextBtn">${state.currentIndex === total - 1 ? "查看结果" : "下一题"}</button>
        </div>
      </section>
    </div>
  `;
}

function renderResult() {
  const r = state.result;

  return `
    <div class="page">
      <section class="panel result-panel">
        <div class="eyebrow">测试结果</div>
        <h2 class="result-title">${escapeHtml(r.name)}</h2>
        <p class="result-lyrics">${escapeHtml(r.lyrics || "")}</p>
        <p class="result-meaning">${escapeHtml(r.meaning || "")}</p>

        <div class="result-actions">
          <button class="btn btn-secondary" id="restartBtn">重新测试</button>
          <button class="btn btn-primary" id="shareBtn">生成分享卡片</button>
        </div>

        <canvas id="shareCanvas" width="900" height="1200" class="share-canvas" style="display:none;"></canvas>

        <div class="divider"></div>

        <section class="comment-section">
          <div class="comment-header">
            <h3>留言</h3>
            <p>写下你测出来的歌，或者留一句此刻的心情。</p>
          </div>

          <div class="comment-form">
            <input id="commentName" class="input" placeholder="你的名字" maxlength="30" />
            <textarea id="commentMsg" class="textarea" placeholder="写点什么..." maxlength="300"></textarea>
            <button class="btn btn-primary" id="commentSubmitBtn">提交留言</button>
          </div>

          <div id="comments" class="comments-list">
            <div class="comment-empty">留言加载中…</div>
          </div>
        </section>
      </section>
    </div>
  `;
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <style>
      :root{
        --bg:#f6f8fc;
        --panel:#ffffff;
        --line:#dbe3f0;
        --line-2:#e8eef7;
        --text:#1f2a44;
        --muted:#64748b;
        --blue:#2f5fd7;
        --blue-dark:#224bb0;
        --blue-soft:#eef4ff;
        --shadow:0 8px 30px rgba(25,45,90,.08);
        --radius:20px;
      }
      *{box-sizing:border-box}
      body{
        margin:0;
        background:var(--bg);
        color:var(--text);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Noto Sans SC","Helvetica Neue",Arial,sans-serif;
      }
      .page{
        max-width:760px;
        margin:0 auto;
        padding:32px 16px 56px;
      }
      .panel{
        background:var(--panel);
        border:1px solid var(--line-2);
        border-radius:var(--radius);
        box-shadow:var(--shadow);
        padding:28px;
      }
      .hero{
        padding:40px 28px;
      }
      .eyebrow{
        display:inline-block;
        color:var(--blue);
        background:var(--blue-soft);
        border:1px solid #d9e6ff;
        border-radius:999px;
        padding:6px 12px;
        font-size:13px;
        font-weight:600;
        margin-bottom:16px;
      }
      .hero-title{
        margin:0;
        font-size:34px;
        line-height:1.25;
        color:#183b8c;
      }
      .hero-subtitle{
        margin:12px 0 0;
        font-size:16px;
        line-height:1.7;
        color:var(--muted);
      }
      .quiz-top{
        margin-bottom:22px;
      }
      .progress-meta{
        font-size:14px;
        color:var(--muted);
        margin-bottom:10px;
      }
      .progress-track{
        width:100%;
        height:10px;
        border-radius:999px;
        background:#edf2fb;
        overflow:hidden;
      }
      .progress-fill{
        height:100%;
        border-radius:999px;
        background:var(--blue);
      }
      .question-text{
        margin:0 0 22px;
        font-size:24px;
        line-height:1.55;
        font-weight:700;
        color:#1a2f63;
      }
      .options{
        display:grid;
        gap:12px;
      }
      .option-btn{
        width:100%;
        border:1px solid var(--line);
        background:#fff;
        color:var(--text);
        border-radius:14px;
        padding:14px 16px;
        text-align:left;
        font-size:15px;
        cursor:pointer;
        transition:.18s ease;
      }
      .option-btn:hover{
        border-color:#bfd1f7;
        background:#f8fbff;
      }
      .option-btn.active{
        border-color:var(--blue);
        background:var(--blue-soft);
        color:#17387e;
        font-weight:600;
      }
      .quiz-actions,.result-actions{
        display:flex;
        gap:12px;
        margin-top:24px;
        flex-wrap:wrap;
      }
      .btn{
        border:none;
        border-radius:999px;
        padding:11px 18px;
        font-size:14px;
        font-weight:600;
        cursor:pointer;
        transition:.18s ease;
      }
      .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }
      .btn-primary{
        background:var(--blue);
        color:#fff;
      }
      .btn-primary:hover:not(:disabled){
        background:var(--blue-dark);
      }
      .btn-secondary{
        background:#eef2f8;
        color:#30415f;
      }
      .btn-secondary:hover:not(:disabled){
        background:#e3eaf4;
      }
      .result-title{
        margin:8px 0 10px;
        font-size:32px;
        color:#17387e;
      }
      .result-lyrics{
        margin:0;
        font-size:18px;
        line-height:1.8;
        color:#3d5073;
        white-space:pre-wrap;
      }
      .result-meaning{
        margin:18px 0 0;
        padding:16px;
        border-radius:16px;
        background:#f8fbff;
        border:1px solid #e2ebfb;
        color:#42536f;
        line-height:1.8;
      }
      .divider{
        height:1px;
        background:var(--line-2);
        margin:28px 0;
      }
      .comment-header h3{
        margin:0;
        font-size:22px;
        color:#193c90;
      }
      .comment-header p{
        margin:8px 0 0;
        color:var(--muted);
        line-height:1.7;
      }
      .comment-form{
        margin-top:18px;
      }
      .input,.textarea{
        width:100%;
        border:1px solid var(--line);
        background:#fff;
        color:var(--text);
        border-radius:14px;
        padding:13px 14px;
        font-size:15px;
        outline:none;
        transition:.18s ease;
      }
      .input:focus,.textarea:focus{
        border-color:#97b6ff;
        box-shadow:0 0 0 4px rgba(47,95,215,.08);
      }
      .textarea{
        min-height:108px;
        resize:vertical;
        margin-top:12px;
      }
      .comment-form .btn{
        margin-top:12px;
      }
      .comments-list{
        margin-top:20px;
        display:grid;
        gap:12px;
      }
      .comment-item{
        background:#fbfcff;
        border:1px solid #e6edf8;
        border-radius:16px;
        padding:14px 16px;
      }
      .comment-name{
        font-size:14px;
        font-weight:700;
        color:#20449a;
      }
      .comment-text{
        margin-top:6px;
        line-height:1.75;
        color:#34435f;
        white-space:pre-wrap;
        word-break:break-word;
      }
      .comment-empty{
        color:var(--muted);
        padding:6px 2px;
      }
      .share-canvas{
        width:100%;
        max-width:360px;
        margin-top:16px;
        border:1px solid #dde7f7;
        border-radius:18px;
      }
      @media (max-width:640px){
        .panel{padding:22px 18px}
        .hero-title{font-size:28px}
        .question-text{font-size:21px}
        .result-title{font-size:28px}
      }
    </style>
    ${state.view === "start" ? renderStart() : ""}
    ${state.view === "quiz" ? renderQuiz() : ""}
    ${state.view === "result" ? renderResult() : ""}
  `;

  bindEvents();

  if (state.view === "result") {
    loadComments();
  }
}

function bindEvents() {
  if (state.view === "start") {
    document.getElementById("startBtn")?.addEventListener("click", () => {
      state.view = "quiz";
      render();
    });
    return;
  }

  if (state.view === "quiz") {
    document.querySelectorAll("[data-option-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.answers[state.currentIndex] = Number(btn.dataset.optionIndex);
        render();
      });
    });

    document.getElementById("prevBtn")?.addEventListener("click", () => {
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
        render();
      }
    });

    document.getElementById("nextBtn")?.addEventListener("click", () => {
      const selected = state.answers[state.currentIndex];
      if (selected == null) {
        alert("先选一个答案。");
        return;
      }

      const currentQuestion = DATA.questions[state.currentIndex];
      const oldValue = state.answers[state.currentIndex + "_score_applied"];
      if (typeof oldValue === "number") {
        state.scores[currentQuestion.dim] -= oldValue;
      }

      const newValue = calcOptionValue(selected);
      state.scores[currentQuestion.dim] += newValue;
      state.answers[state.currentIndex + "_score_applied"] = newValue;

      if (state.currentIndex === DATA.questions.length - 1) {
        state.result = matchSong();
        state.view = "result";
      } else {
        state.currentIndex += 1;
      }

      render();
    });

    return;
  }

  if (state.view === "result") {
    document.getElementById("restartBtn")?.addEventListener("click", () => {
      state.view = "start";
      state.currentIndex = 0;
      state.answers = [];
      state.scores = { A: 0, B: 0, C: 0, D: 0 };
      state.result = null;
      render();
    });

    document.getElementById("commentSubmitBtn")?.addEventListener("click", addComment);
    document.getElementById("shareBtn")?.addEventListener("click", generateCard);
  }
}

async function addComment() {
  const nameEl = document.getElementById("commentName");
  const msgEl = document.getElementById("commentMsg");

  const name = nameEl.value.trim();
  const msg = msgEl.value.trim();

  if (!name || !msg) {
    alert("请填写完整。");
    return;
  }

  await addDoc(collection(db, "comments"), {
    name,
    msg,
    result: state.result?.name || "",
    time: Date.now()
  });

  nameEl.value = "";
  msgEl.value = "";
  await loadComments();
}

async function loadComments() {
  const box = document.getElementById("comments");
  if (!box) return;

  try {
    const q = query(collection(db, "comments"), orderBy("time", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = `<div class="comment-empty">还没有留言，来写第一条吧。</div>`;
      return;
    }

    box.innerHTML = snap.docs.map(doc => {
      const c = doc.data();
      const resultLine = c.result ? `<div class="comment-name">${escapeHtml(c.name)} · ${escapeHtml(c.result)}</div>` : `<div class="comment-name">${escapeHtml(c.name)}</div>`;
      return `
        <article class="comment-item">
          ${resultLine}
          <div class="comment-text">${escapeHtml(c.msg)}</div>
        </article>
      `;
    }).join("");
  } catch (err) {
    box.innerHTML = `<div class="comment-empty">留言加载失败：${escapeHtml(err.message)}</div>`;
  }
}

function generateCard() {
  const canvas = document.getElementById("shareCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.style.display = "block";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f7faff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#dfeafb";
  ctx.fillRect(60, 60, 780, 1080);

  ctx.fillStyle = "#20449a";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("Yorushika Test", 110, 180);

  ctx.fillStyle = "#1f2a44";
  ctx.font = "bold 72px sans-serif";
  wrapText(ctx, state.result?.name || "", 110, 320, 680, 88);

  ctx.fillStyle = "#4b5d7b";
  ctx.font = "36px sans-serif";
  wrapText(ctx, state.result?.lyrics || "", 110, 520, 680, 56);

  ctx.fillStyle = "#6b7c99";
  ctx.font = "28px sans-serif";
  ctx.fillText("与你最相似的歌", 110, 980);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = String(text).split("");
  let line = "";
  let drawY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const w = ctx.measureText(testLine).width;
    if (w > maxWidth && line) {
      ctx.fillText(line, x, drawY);
      line = chars[i];
      drawY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, drawY);
}

async function init() {
  try {
    await loadData();
    render();
  } catch (err) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<div style="padding:24px;color:#b42318;">初始化失败：${escapeHtml(err.message)}</div>`;
    }
  }
}

init();
