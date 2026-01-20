const firebaseConfig = {
    apiKey: "AIzaSyAMuStvZhCJJjYU0t_jxazFbGumjsmiznw",
    authDomain: "tictactoe71-bc49e.firebaseapp.com",
    projectId: "tictactoe71-bc49e",
    storageBucket: "tictactoe71-bc49e.firebasestorage.app",
    messagingSenderId: "553822159753",
    appId: "1:553822159753:web:437f35f8b5eba4ecc09758",
    measurementId: "G-LXFJY25YHF"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoomId = null;
let isHost = false;
let mySymbol = "X"; 
let gameMode = 'bot';
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');

// Kombinasi Kemenangan
const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], 
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

// --- NAVIGASI ---
window.showMode = (mode) => {
    gameMode = mode;
    document.getElementById('main-menu').style.display = 'none';
    if(mode === 'multiplayer') document.getElementById('multiplayer-menu').style.display = 'flex';
    else startBotGame();
};

window.showCreateRoom = () => {
    document.getElementById('multiplayer-menu').style.display = 'none';
    document.getElementById('create-room-form').style.display = 'flex';
};

window.showJoinRoom = () => {
    document.getElementById('multiplayer-menu').style.display = 'none';
    document.getElementById('join-room-form').style.display = 'flex';
};

// --- MULTIPLAYER LOGIC ---
document.getElementById('btn-final-create').onclick = () => {
    const rounds = document.getElementById('rounds-input').value;
    const roomCode = Math.floor(1000 + Math.random() * 9000); 
    currentRoomId = roomCode;
    isHost = true; mySymbol = "X";

    db.ref('rooms/' + roomCode).set({
        maxRounds: rounds,
        currentRound: 1,
        status: 'waiting',
        board: Array(9).fill(""),
        turn: "X",
        players: 1,
        scores: { X: 0, O: 0 }
    });
    enterLobby(roomCode);
};

document.getElementById('btn-final-join').onclick = () => {
    const code = document.getElementById('room-code-input').value;
    db.ref('rooms/' + code).once('value', snapshot => {
        if(snapshot.exists()) {
            currentRoomId = code;
            isHost = false; mySymbol = "O";
            db.ref('rooms/' + code).update({ players: 2 });
            enterLobby(code);
        } else alert("Room tidak ditemukan!");
    });
};

function enterLobby(code) {
    document.querySelectorAll('.menu-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('lobby-room').style.display = 'flex';
    document.getElementById('display-room-code').innerText = code;

    db.ref('rooms/' + code).on('value', snapshot => {
        const data = snapshot.val();
        if(!data) return;
        document.getElementById('display-rounds').innerText = data.maxRounds;
        if(data.players === 2) document.getElementById('player-count').innerText = "Pemain 2 Join!";
        if(data.status === 'playing') {
            document.getElementById('lobby-room').style.display = 'none';
            document.getElementById('game-screen').style.display = 'block';
            renderGame(data);
        }
    });
}

document.getElementById('start-game-btn').onclick = () => {
    db.ref('rooms/' + currentRoomId).update({ status: 'playing' });
};

// --- CORE GAMEPLAY ---
cells.forEach(cell => {
    cell.onclick = () => {
        const idx = cell.getAttribute('data-index');
        if(gameMode === 'multiplayer') handleOnlineMove(idx);
    };
});

function handleOnlineMove(idx) {
    db.ref('rooms/' + currentRoomId).once('value').then(snapshot => {
        const data = snapshot.val();
        if(data.turn === mySymbol && data.board[idx] === "" && data.status === 'playing') {
            let newBoard = [...data.board];
            newBoard[idx] = mySymbol;
            
            if(checkWin(newBoard, mySymbol)) {
                // Jika Menang
                let newScores = {...data.scores};
                newScores[mySymbol]++;
                alert(`Ronde ${data.currentRound} dimenangkan oleh ${mySymbol}!`);
                db.ref('rooms/' + currentRoomId).update({
                    board: Array(9).fill(""),
                    scores: newScores,
                    currentRound: data.currentRound + 1,
                    turn: "X" 
                });
            } else if(!newBoard.includes("")) {
                // Jika Seri
                alert("Seri!");
                db.ref('rooms/' + currentRoomId).update({
                    board: Array(9).fill(""),
                    turn: "X"
                });
            } else {
                // Lanjut Giliran
                db.ref('rooms/' + currentRoomId).update({
                    board: newBoard,
                    turn: mySymbol === "X" ? "O" : "X"
                });
            }
        }
    });
}

function renderGame(data) {
    data.board.forEach((val, i) => cells[i].innerText = val);
    statusText.innerHTML = `Ronde: ${data.currentRound}/${data.maxRounds} <br> Skor X: ${data.scores.X} - O: ${data.scores.O} <br> Giliran: <b>${data.turn}</b>`;
    
    if(data.currentRound > data.maxRounds) {
        const pemenang = data.scores.X > data.scores.O ? "X" : "O";
        alert("PERMAINAN SELESAI! Pemenang Akhir: " + pemenang);
        location.reload();
    }
}

function checkWin(board, player) {
    return winConditions.some(comb => comb.every(i => board[i] === player));
}

// --- BOT MODE ---
function startBotGame() {
    document.getElementById('game-screen').style.display = 'block';
    let board = Array(9).fill("");
    let turn = "X";

    cells.forEach(cell => {
        cell.onclick = () => {
            const i = cell.getAttribute('data-index');
            if(board[i] === "" && turn === "X") {
                board[i] = "X";
                updateBotUI(board);
                if(checkWin(board, "X")) { alert("Kamu Menang!"); resetBot(); return; }
                
                turn = "O";
                setTimeout(() => {
                    let empty = board.map((v, idx) => v === "" ? idx : null).filter(v => v !== null);
                    if(empty.length > 0) {
                        board[empty[Math.floor(Math.random()*empty.length)]] = "O";
                        updateBotUI(board);
                        if(checkWin(board, "O")) alert("Bot Menang!");
                        turn = "X";
                    }
                }, 500);
            }
        };
    });
}

function updateBotUI(b) { b.forEach((v, i) => cells[i].innerText = v); }
function resetBot() { location.reload(); }
