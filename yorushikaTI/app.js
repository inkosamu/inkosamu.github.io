
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
  view: "start",
  currentIndex: 0,
  answers: [],
  scores: { A: 0, B: 0, C: 0, D: 0 },
  result: null,
  resultMeta: null
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

function computeScoresFromAnswers() {
  const scores = { A: 0, B: 0, C: 0, D: 0 };
  DATA.questions.forEach((q, idx) => {
    const ans = state.answers[idx];
    if (typeof ans === "number") {
      scores[q.dim] += calcOptionValue(ans);
    }
  });
  state.scores = scores;
  return scores;
}

function normalizeDimensionScore(raw, dim) {
  const count = DATA.questions.filter(q => q.dim === dim).length || 1;
  const max = count * DATA.options.length;
  return Math.round((raw / max) * 100);
}

function matchSong() {
  const scores = computeScoresFromAnswers();
  const normalized = {
    A: normalizeDimensionScore(scores.A, "A"),
    B: normalizeDimensionScore(scores.B, "B"),
    C: normalizeDimensionScore(scores.C, "C"),
    D: normalizeDimensionScore(scores.D, "D")
  };

  let bestSong = DATA.songs[0];
  let bestDistance = Infinity;

  for (const song of DATA.songs) {
    const p = song.profile || { A: 50, B: 50, C: 50, D: 50 };
    const distance =
      Math.abs(normalized.A - p.A) +
      Math.abs(normalized.B - p.B) +
      Math.abs(normalized.C - p.C) +
      Math.abs(normalized.D - p.D);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestSong = song;
    }
  }

  state.resultMeta = { normalized, distance: bestDistance };
  return bestSong;
}

function renderStart() {
  const questionCount = DATA.questions.length;
  const songCount = DATA.songs.length;
  return `
    <div class="page">
      <section class="panel hero">
        <div class="badge">Yorushika Character Quiz</div>
        <h1 class="hero-title">${escapeHtml(DATA.meta?.title || "你是哪一首ヨルシカ")}</h1>
        <p class="hero-subtitle">${escapeHtml(DATA.meta?.subtitle || "")}</p>

        <div class="hero-meta">
          <div class="meta-card">
            <div class="meta-label">题目数量</div>
            <div class="meta-value">${questionCount} 题</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">匹配曲目</div>
            <div class="meta-value">${songCount} 首</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">风格基调</div>
            <div class="meta-value">${escapeHtml(DATA.meta?.tone || "夜、夏、回忆与未说出口的话")}</div>
          </div>
        </div>

        <div class="actions-row">
          <button class="btn btn-primary" id="startBtn">开始测试</button>
        </div>
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
        <div class="topbar">
          <div class="topbar-left" style="flex:1;">
            <div class="progress-label">第 ${state.currentIndex + 1} / ${total} 题</div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
          </div>
        </div>

        <h2 class="question">${escapeHtml(q.text)}</h2>

        <div class="options">
          ${DATA.options.map((label, i) => `
            <button class="option-btn ${selected === i ? "active" : ""}" data-option-index="${i}">
              ${escapeHtml(label)}
            </button>
          `).join("")}
        </div>

        <div class="quiz-actions">
          <button class="btn btn-secondary" id="prevBtn" ${state.currentIndex === 0 ? "disabled" : ""}>上一题</button>
          <button class="btn btn-primary" id="nextBtn">${state.currentIndex === total - 1 ? "查看结果" : "下一题"}</button>
        </div>
      </section>
    </div>
  `;
}

function traitRow(label, value) {
  return `
    <div class="trait-row">
      <div class="trait-name">${escapeHtml(label)}</div>
      <div class="trait-track"><div class="trait-fill" style="width:${value}%"></div></div>
      <div class="trait-score">${value}</div>
    </div>
  `;
}

function renderResult() {
  const r = state.result;
  const n = state.resultMeta?.normalized || { A: 0, B: 0, C: 0, D: 0 };
  return `
    <div class="page">
      <section class="panel">
        <div class="badge">测试结果</div>
        <h2 class="result-title">${escapeHtml(r.name)}</h2>
        <div class="result-sub">${escapeHtml(r.subtitle || "与你当前心境最接近的一首歌")}</div>

        <div class="result-lyrics">${escapeHtml(r.lyrics || "")}</div>

        <div class="analysis-grid">
          <article class="analysis-card">
            <h3>结果解析</h3>
            <p>${escapeHtml(r.analysis || "")}</p>
          </article>

          <article class="analysis-card">
            <h3>你的倾向</h3>
            <div class="traits">
              ${traitRow("怀旧", n.A)}
              ${traitRow("压抑", n.B)}
              ${traitRow("孤独", n.C)}
              ${traitRow("流动", n.D)}
            </div>
          </article>
        </div>

        <div class="result-actions">
          <button class="btn btn-secondary" id="restartBtn">重新测试</button>
          <button class="btn btn-primary" id="shareBtn">生成分享卡片</button>
        </div>

        <div class="share-wrap" id="shareWrap">
          <canvas id="shareCanvas" width="900" height="1200" class="share-canvas"></canvas>
        </div>

        <section class="comment-section">
          <div class="comment-head">
            <h3>留言区</h3>
            <p>可以留下你的名字，以及你此刻最想说的一句短句。</p>
          </div>

          <div class="comment-form">
            <input id="commentName" class="input" placeholder="你的名字" maxlength="30" />
            <textarea id="commentMsg" class="textarea" placeholder="写点什么..." maxlength="300"></textarea>
            <button class="btn btn-primary" id="commentSubmitBtn">提交留言</button>
          </div>

          <div id="comments" class="comments-list">
            <div class="comment-empty">留言加载中…</div>
          </div>

          <div class="footer-note">评论会保存到数据库，有任何问题和2194635742@qq.com反馈。</div>
        </section>
      </section>
    </div>
  `;
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  if (state.view === "start") {
    app.innerHTML = renderStart();
  } else if (state.view === "quiz") {
    app.innerHTML = renderQuiz();
  } else {
    app.innerHTML = renderResult();
  }

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
      state.resultMeta = null;
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
      return `
        <article class="comment-item">
          <div class="comment-top">
            <div class="comment-name">${escapeHtml(c.name)}</div>
            <div class="comment-result">${escapeHtml(c.result || "")}</div>
          </div>
          <div class="comment-text">${escapeHtml(c.msg)}</div>
        </article>
      `;
    }).join("");
  } catch (err) {
    box.innerHTML = `<div class="comment-empty">留言加载失败：${escapeHtml(err.message)}</div>`;
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = String(text).split("");
  let line = "";
  let drawY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && line) {
      ctx.fillText(line, x, drawY);
      line = chars[i];
      drawY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, drawY);
}

function generateCard() {
  const wrap = document.getElementById("shareWrap");
  const canvas = document.getElementById("shareCanvas");
  if (!wrap || !canvas) return;

  wrap.classList.add("visible");

  const ctx = canvas.getContext("2d");
  const result = state.result;
  const normalized = state.resultMeta?.normalized || { A: 0, B: 0, C: 0, D: 0 };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f6f9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e7efff";
  ctx.fillRect(70, 70, 760, 1060);

  ctx.fillStyle = "#2b58bf";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText("Yorushika Test", 120, 180);

  ctx.fillStyle = "#203153";
  ctx.font = "bold 68px sans-serif";
  wrapText(ctx, result?.name || "", 120, 320, 660, 86);

  ctx.fillStyle = "#52627e";
  ctx.font = "34px sans-serif";
  wrapText(ctx, result?.subtitle || "", 120, 470, 660, 52);

  ctx.fillStyle = "#354766";
  ctx.font = "32px sans-serif";
  wrapText(ctx, result?.lyrics || "", 120, 610, 640, 50);

  ctx.fillStyle = "#6c7d98";
  ctx.font = "24px sans-serif";
  ctx.fillText(`怀旧 ${normalized.A}  压抑 ${normalized.B}  孤独 ${normalized.C}  流动 ${normalized.D}`, 120, 1000);
}

async function init() {
  try {
    await loadData();
    render();
  } catch (err) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<div class="error-box">初始化失败：${escapeHtml(err.message)}</div>`;
    }
  }
}

init();
