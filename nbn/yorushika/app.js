// ===== Firebase config =====
const firebaseConfig = {
    apiKey: "AIzaSyAq3fTUZvUscSi0V5I49TFL9SOLB5e1BfI",
    authDomain: "yorushika-comment.firebaseapp.com",
    projectId: "yorushika-comment",
    storageBucket: "yorushika-comment.firebasestorage.app",
    messagingSenderId: "424982794250",
    appId: "1:424982794250:web:64f52fdd4226cca00dcff3",
    measurementId: "G-V7D492Q0S4"
  };
// ===== 数据 =====
let DATA = null;

const state = {
 view:"start",
 index:0,
 scores:{A:0,B:0,C:0,D:0},
 result:null
};

async function loadData(){
 DATA = await (await fetch("./yorushika.json")).json();
}

// ===== 渲染 =====
function render(){
 const app = document.getElementById("app");

 if(!DATA){app.innerHTML="Loading...";return;}

 if(state.view==="start"){
  app.innerHTML=`
   <div class="card">
   <h1>${DATA.meta.title}</h1>
   <p>${DATA.meta.subtitle}</p>
   <button class="primary" onclick="start()">开始</button>
   </div>`;
 }

 if(state.view==="quiz"){
  let q = DATA.questions[state.index];
  app.innerHTML=`
   <div class="card">
   <h2>${q.text}</h2>
   ${DATA.options.map((o,i)=>`<button onclick="answer(${i})">${o}</button>`).join("")}
   </div>`;
 }

 if(state.view==="result"){
  app.innerHTML=`
   <div class="card">
   <h2>${state.result.name}</h2>
   <p>${state.result.lyrics}</p>

   <button onclick="drawShare()">生成分享卡片</button>
   <canvas id="canvas" width="400" height="400"></canvas>

   <h3>留言</h3>
   <input id="name" placeholder="名字">
   <textarea id="msg" placeholder="留言"></textarea>
   <button onclick="addComment()">提交</button>

   <div id="comments"></div>

   <button onclick="restart()">再测一次</button>
   </div>`;

  loadComments();
 }
}

// ===== 逻辑 =====
function start(){state.view="quiz";render();}

function answer(i){
 let val = 6 - i;
 let dim = DATA.questions[state.index].dim;
 state.scores[dim]+=val;

 if(state.index===DATA.questions.length-1){
   state.result = DATA.songs[0];
   state.view="result";
 } else state.index++;

 render();
}

function restart(){
 state.view="start";
 state.index=0;
 state.scores={A:0,B:0,C:0,D:0};
 render();
}

// ===== 分享卡片 =====
function drawShare(){
 let c=document.getElementById("canvas");
 let ctx=c.getContext("2d");

 ctx.fillStyle="#0f1c2e";
 ctx.fillRect(0,0,400,400);

 ctx.fillStyle="#7dd3fc";
 ctx.font="20px sans-serif";
 ctx.fillText("你的歌是：",20,150);

 ctx.font="26px sans-serif";
 ctx.fillText(state.result.name,20,200);
}

// ===== 评论系统（Firebase） =====
async function addComment(){
 let name=document.getElementById("name").value;
 let msg=document.getElementById("msg").value;

 if(!name||!msg){alert("填完整");return;}

 await db.collection("comments").add({
  name, msg, time:Date.now()
 });

 loadComments();
}

async function loadComments(){
 const box=document.getElementById("comments");
 const snap = await db.collection("comments").orderBy("time","desc").get();

 box.innerHTML = snap.docs.map(d=>{
  let c=d.data();
  return `<div class="comment">${c.name} - ${c.msg}</div>`;
 }).join("");
}

// ===== init =====
loadData().then(render);
