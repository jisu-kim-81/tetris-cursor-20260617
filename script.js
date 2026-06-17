// ── 상수 ──────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL = 800;
const LINE_SCORES = [0, 100, 300, 500, 800];

const PIECES = {
  I: { shape: [[1, 1, 1, 1]], color: "piece-i" },
  O: { shape: [[1, 1], [1, 1]], color: "piece-o" },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: "piece-t" },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: "piece-s" },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: "piece-z" },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: "piece-j" },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: "piece-l" },
};

const PIECE_TYPES = Object.keys(PIECES);

// ── DOM ────────────────────────────────────────────────
const boardElement = document.getElementById("game-board");
const scoreElement = document.getElementById("score");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const gameOverElement = document.getElementById("game-over");

// ── 게임 상태 ─────────────────────────────────────────
let score = 0;
let board = createEmptyBoard();
let currentPiece = null;
let cellElements = [];
let dropTimer = null;
let isPlaying = false;
let isGameOver = false;
let isKeyboardBound = false;

// ── 보드 초기화 ───────────────────────────────────────
function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function initBoardCells() {
  cellElements = [];

  for (let i = 0; i < ROWS * COLS; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    boardElement.appendChild(cell);
    cellElements.push(cell);
  }
}

function isRowFull(rowIndex) {
  return board[rowIndex].every((cell) => cell !== null);
}

// ── 블록 생성 ─────────────────────────────────────────
function createPiece(type) {
  const randomType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const pieceType = PIECES[type] ? type : randomType;
  const pieceDef = PIECES[pieceType];

  return {
    type: pieceType,
    shape: pieceDef.shape.map((row) => [...row]),
    color: pieceDef.color,
    row: 0,
    col: Math.floor((COLS - pieceDef.shape[0].length) / 2),
  };
}

// ── 충돌 판정 ─────────────────────────────────────────
function forEachPieceCell(piece, deltaRow, deltaCol, onCell) {
  for (let shapeRow = 0; shapeRow < piece.shape.length; shapeRow++) {
    for (let shapeCol = 0; shapeCol < piece.shape[shapeRow].length; shapeCol++) {
      if (!piece.shape[shapeRow][shapeCol]) {
        continue;
      }

      onCell(
        piece.row + shapeRow + deltaRow,
        piece.col + shapeCol + deltaCol
      );
    }
  }
}

function canMove(piece, deltaRow, deltaCol, matrix) {
  if (!piece) {
    return false;
  }

  let movable = true;

  forEachPieceCell(piece, deltaRow, deltaCol, (boardRow, boardCol) => {
    if (!movable) {
      return;
    }

    if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) {
      movable = false;
      return;
    }

    if (boardRow < 0) {
      return;
    }

    if (matrix[boardRow][boardCol]) {
      movable = false;
    }
  });

  return movable;
}

function isActiveGame() {
  return isPlaying && !isGameOver && currentPiece !== null;
}

// ── 고정 · 라인 삭제 · 점수 ───────────────────────────
function lockPiece() {
  if (!currentPiece) {
    return;
  }

  forEachPieceCell(currentPiece, 0, 0, (boardRow, boardCol) => {
    if (boardRow >= 0 && boardRow < ROWS && boardCol >= 0 && boardCol < COLS) {
      board[boardRow][boardCol] = currentPiece.color;
    }
  });
}

function clearLines() {
  const remainingRows = [];
  let linesCleared = 0;

  for (let rowIndex = 0; rowIndex < ROWS; rowIndex++) {
    if (isRowFull(rowIndex)) {
      linesCleared += 1;
    } else {
      remainingRows.push(board[rowIndex]);
    }
  }

  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(null));
  }

  board = remainingRows;
  return linesCleared;
}

function addScore(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  const scoreIndex = Math.min(linesCleared, LINE_SCORES.length - 1);
  score += LINE_SCORES[scoreIndex];
}

function lockPieceAndContinue() {
  lockPiece();

  const linesCleared = clearLines();
  addScore(linesCleared);
  updateScore();

  spawnNextPiece();
  updateDisplay();
}

// ── 게임 오버 ─────────────────────────────────────────
function showGameOver() {
  gameOverElement.classList.remove("hidden");
  gameOverElement.hidden = false;
}

function hideGameOver() {
  gameOverElement.classList.add("hidden");
  gameOverElement.hidden = true;
}

function triggerGameOver() {
  isPlaying = false;
  isGameOver = true;
  currentPiece = null;
  stopDropTimer();
  showGameOver();
}

function spawnNextPiece() {
  currentPiece = createPiece();

  if (!canMove(currentPiece, 0, 0, board)) {
    triggerGameOver();
  }
}

// ── 이동 · 낙하 ───────────────────────────────────────
function moveDownOrLock() {
  if (!isActiveGame()) {
    return;
  }

  if (canMove(currentPiece, 1, 0, board)) {
    currentPiece.row += 1;
    updateDisplay();
    return;
  }

  lockPieceAndContinue();
}

function dropPiece() {
  moveDownOrLock();
}

function tryMovePiece(deltaRow, deltaCol) {
  if (!isActiveGame()) {
    return false;
  }

  if (!canMove(currentPiece, deltaRow, deltaCol, board)) {
    return false;
  }

  currentPiece.row += deltaRow;
  currentPiece.col += deltaCol;
  updateDisplay();
  return true;
}

function hardDrop() {
  if (!isActiveGame()) {
    return;
  }

  while (canMove(currentPiece, 1, 0, board)) {
    currentPiece.row += 1;
  }

  lockPieceAndContinue();
}

// ── 회전 ─────────────────────────────────────────────
function rotateShape(shape) {
  const rowCount = shape.length;
  const colCount = shape[0].length;
  const rotated = Array.from({ length: colCount }, () => Array(rowCount).fill(0));

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      rotated[col][rowCount - 1 - row] = shape[row][col];
    }
  }

  return rotated;
}

function rotatePiece() {
  if (!isActiveGame()) {
    return false;
  }

  const previousShape = currentPiece.shape.map((row) => [...row]);
  currentPiece.shape = rotateShape(currentPiece.shape);

  if (!canMove(currentPiece, 0, 0, board)) {
    currentPiece.shape = previousShape;
    return false;
  }

  updateDisplay();
  return true;
}

// ── 타이머 ────────────────────────────────────────────
function startDropTimer() {
  stopDropTimer();
  dropTimer = setInterval(dropPiece, DROP_INTERVAL);
}

function stopDropTimer() {
  if (dropTimer !== null) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
}

// ── 렌더링 ────────────────────────────────────────────
function drawPiece(grid, piece) {
  const display = grid.map((row) => [...row]);

  if (!piece) {
    return display;
  }

  forEachPieceCell(piece, 0, 0, (boardRow, boardCol) => {
    if (boardRow >= 0 && boardRow < ROWS && boardCol >= 0 && boardCol < COLS) {
      display[boardRow][boardCol] = piece.color;
    }
  });

  return display;
}

function renderBoard(grid) {
  for (let rowIndex = 0; rowIndex < ROWS; rowIndex++) {
    for (let colIndex = 0; colIndex < COLS; colIndex++) {
      const cell = cellElements[rowIndex * COLS + colIndex];
      const colorClass = grid[rowIndex][colIndex];

      cell.className = "cell";
      if (colorClass) {
        cell.classList.add(colorClass);
      }
    }
  }
}

function updateDisplay() {
  renderBoard(drawPiece(board, currentPiece));
}

function updateScore() {
  scoreElement.textContent = score;
}

// ── 키보드 ────────────────────────────────────────────
function handleKeyDown(event) {
  if (!isActiveGame()) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      tryMovePiece(0, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      tryMovePiece(0, 1);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveDownOrLock();
      break;
    case "ArrowUp":
      event.preventDefault();
      rotatePiece();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
}

function bindKeyboardControls() {
  if (isKeyboardBound) {
    return;
  }

  document.addEventListener("keydown", handleKeyDown);
  isKeyboardBound = true;
}

// ── 게임 라이프사이클 ─────────────────────────────────
function resetGameState() {
  stopDropTimer();
  hideGameOver();

  score = 0;
  board = createEmptyBoard();
  currentPiece = createPiece();
  isPlaying = true;
  isGameOver = false;

  updateScore();
  updateDisplay();
  startDropTimer();
}

function startGame() {
  resetGameState();
}

function restartGame() {
  resetGameState();
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);

// ── 앱 초기화 ─────────────────────────────────────────
initBoardCells();
bindKeyboardControls();
hideGameOver();
currentPiece = createPiece("T");
updateDisplay();
updateScore();
