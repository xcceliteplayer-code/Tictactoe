import { db } from "./firebase.js";
import { ref, set, onValue, update, get }
from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

/* ===== ELEMENT ===== */
const home = document.getElementById("home");
const box = document.getElementById("roomInputBox");
const boardEl = document.getElementById("board");
const info = document.getElementById("info");
const roleInfo = document.getElementById("roleInfo");
const hostPanel = document.getElementById("hostPanel");
const leaderboardEl = document.getElementById("leaderboard");

const nameInput = document.getElementById("playerNameInput");
const roomNameInput = document.getElementById("roomNameInput");
const roomCodeInput = document.getElementById("roomCodeInput");

/* ===== STATE ===== */
const playerId = "p" + Math.floor(Math.random() * 99999);
let playerName = "";
let roomCode = "";
let role = "";
let isHost = false;
let action = "";

/* ===== BOARD ===== */
const cells = [];
for (let i = 0; i < 9; i++) {
  const c = document.createElement("div");
  c.className = "cell";
  c.onclick = () => move(i);
  boardEl.appendChild(c);
  cells.push(c);
}

/* ===== UTILS ===== */
const genCode = () =>
  Math.random().toString(36).substring(2, 7).toUpperCase();

/* ===== SAVE PLAYER ===== */
async function savePlayer() {
  const pRef = ref(db, `players/${playerId}`);
  const snap = await get(pRef);
  if (!snap.exists()) {
    set(pRef, { name: playerName, win: 0, score: 0 });
  }
}

/* ===== HOME BUTTONS ===== */
createRoomBtn.onclick = () => openInput("create");
joinPlayerBtn.onclick = () => openInput("joinPlayer");
joinSpectatorBtn.onclick = () => openInput("joinSpectator");

function openInput(type) {
  if (!nameInput.value) return alert("Isi nama dulu!");
  playerName = nameInput.value;
  action = type;

  home.style.display = "none";
  box.style.display = "block";
  roomNameInput.style.display = type === "create" ? "block" : "none";
  roomCodeInput.style.display = type !== "create" ? "block" : "none";
}

/* ===== CONFIRM ===== */
confirmBtn.onclick = async () => {
  await savePlayer();

  if (action === "create") {
    if (!roomNameInput.value) return alert("Isi nama room!");

    roomCode = genCode();
    role = "X";
    isHost = true;

    await set(ref(db, `rooms/${roomCode}`), {
      roomName: roomNameInput.value,
      host: playerId,
      started: false,
      turn: "X",
      board: Array(9).fill(""),
      players: { X: playerId }
    });

    listen();
  }

  if (action === "joinPlayer") joinRoom("player");
  if (action === "joinSpectator") joinRoom("spectator");
};

/* ===== JOIN ===== */
async function joinRoom(type) {
  roomCode = roomCodeInput.value.toUpperCase();
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return alert("Room tidak ada!");

  const d = snap.val();

  if (type === "spectator") role = "spectator";
  else if (!d.players.O) {
    role = "O";
    update(roomRef, { "players/O": playerId });
  } else role = "spectator";

  listen();
}

/* ===== LISTEN ROOM ===== */
function listen() {
  box.style.display = "none";
  boardEl.style.display = "grid";
  document.getElementById("gameInfo").style.display = "block";

  onValue(ref(db, `rooms/${roomCode}`), snap => {
    const d = snap.val();
    if (!d) return;

    info.innerText = `${d.roomName} | Code: ${roomCode}`;
    roleInfo.innerText =
      role === "spectator" ? "👀 Spectator" : `🎮 Player ${role}`;

    d.board.forEach((v, i) => (cells[i].innerText = v));

    if (d.host === playerId) hostPanel.style.display = "block";
  });
}

/* ===== START ===== */
startGameBtn.onclick = () => {
  update(ref(db, `rooms/${roomCode}`), { started: true });
};

function move(i) {
  if (role === "spectator") return;

  const roomRef = ref(db, `rooms/${roomCode}`);
  onValue(roomRef, async snap => {
    const d = snap.val();
    if (!d.started || d.turn !== role || d.board[i]) return;

    d.board[i] = role;
    const winner = checkWinner(d.board);

    if (winner) {
      d.started = false;
      if (winner !== "draw") await addWin(winner);
      alert(winner === "draw" ? "🤝 Seri!" : `🏆 ${winner} Menang!`);
    } else {
      d.turn = role === "X" ? "O" : "X";
    }

    update(roomRef, {
      board: d.board,
      turn: d.turn,
      started: d.started
    });
  }, { onlyOnce: true });
}

/* ===== LEADERBOARD ===== */
onValue(ref(db, "players"), snap => {
  leaderboardEl.innerHTML = "";
  if (!snap.exists()) return;

  Object.values(snap.val())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.name} | 🏆 ${p.win} | ⭐ ${p.score}`;
      leaderboardEl.appendChild(li);
    });
});

/* ===== CHECK WIN ===== */
const winPattern = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function checkWinner(board) {
  for (const [a,b,c] of winPattern) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.includes("") ? null : "draw";
}

/* ===== ADD SCORE ===== */
async function addWin(playerSymbol) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const winnerId = snap.val().players[playerSymbol];
  if (!winnerId) return;

  const pRef = ref(db, `players/${winnerId}`);
  const ps = await get(pRef);
  if (!ps.exists()) return;

  const d = ps.val();
  update(pRef, {
    win: d.win + 1,
    score: d.score + 10
  });
}
