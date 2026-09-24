import { vsSource, fsSource, createProgram, loadTexture } from './shaders.js';
import { Tower, Enemy } from './entity.js';
import { InputManager } from './input.js';
import { RhythmManager } from './audio.js';
import { getLevel } from './levels.js';

let gl, program;
let positionAttributeLocation, texcoordAttributeLocation;
let resolutionUniformLocation, translationUniformLocation, scaleUniformLocation, colorUniformLocation, useTextureUniformLocation;

let canvas;
let tower;
let enemies = [];
let shapeBuffers = {}; // 'square' | 'triangle' | 'diamond' | 'circle' -> { position, texcoord, count }

let lastTime = 0;
let score = 0;
let isGameOver = false;
let isGameStarted = false;
let isPaused = false;

let currentLevel = null;
const rhythmManager = new RhythmManager();

// Elementos da HUD
const hpElement = document.getElementById("hp-val");
const scoreElement = document.getElementById("score-val");
const gameOverScreen = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const menuScreen = document.getElementById("menu-screen");
const level1Btn = document.getElementById("level1-btn");
const pauseBtn = document.getElementById("pause-btn");
const pauseScreen = document.getElementById("pause-screen");
const resumeBtn = document.getElementById("resume-btn");

// Cria os buffers de posição/texcoord para uma forma geométrica, a
// partir de uma lista plana de vértices [x0,y0, x1,y1, ...] dentro do
// quadrado unitário. O texcoord não é usado (inimigos não têm textura),
// mas o shader espera o atributo preenchido, então reaproveitamos os
// mesmos valores de posição.
function createShapeBuffers(gl, vertices) {
    const data = new Float32Array(vertices);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return { position: positionBuffer, texcoord: texcoordBuffer, count: vertices.length / 2 };
}

// Gera os triângulos (em leque) que aproximam um círculo dentro do
// quadrado unitário, centrado em (0.5, 0.5) com raio 0.5.
function generateCircleVertices(segments = 20) {
    const verts = [];
    const cx = 0.5, cy = 0.5, r = 0.5;
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        verts.push(cx, cy);
        verts.push(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
        verts.push(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    return verts;
}

function resizeCanvas() {
    if (!canvas || !gl) return;

    // Ajusta tamanho do canvas para tamanho da tela
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Atualiza a viewport do WebGL e a uniform de resolução
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (program) {
        gl.useProgram(program);
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    }

    // Reposiciona a torre no novo centro da tela
    if (tower) {
        tower.x = canvas.width / 2;
        tower.y = canvas.height / 2;
    }
}

function init() {
    canvas = document.getElementById("glcanvas");
    gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("WebGL 2 não é suportado!");
        return;
    }

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    texcoordAttributeLocation = gl.getAttribLocation(program, "a_texcoord");

    resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    translationUniformLocation = gl.getUniformLocation(program, "u_translation");
    scaleUniformLocation = gl.getUniformLocation(program, "u_scale");
    colorUniformLocation = gl.getUniformLocation(program, "u_color");
    useTextureUniformLocation = gl.getUniformLocation(program, "u_useTexture");

    // Buffer de Posições (Vértices)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Buffer de UVs (Texturas)
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texcoordAttributeLocation);
    gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Formas geométricas dos inimigos: cada uma é um conjunto de
    // triângulos dentro do quadrado unitário [0,1]x[0,1], igual ao
    // buffer padrão acima, só que com vértices diferentes.
    shapeBuffers.square = { position: positionBuffer, texcoord: texcoordBuffer, count: 6 };
    shapeBuffers.triangle = createShapeBuffers(gl, [
        0.5, 0,  0, 1,  1, 1,
    ]);
    shapeBuffers.diamond = createShapeBuffers(gl, [
        0.5, 0,  1, 0.5,  0.5, 1,
        0.5, 0,  0.5, 1,  0, 0.5,
    ]);
    shapeBuffers.circle = createShapeBuffers(gl, generateCircleVertices(20));

    // Redimensiona o canvas para a tela toda
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    new InputManager(canvas, handleMouseClick);
    restartBtn.addEventListener("click", restartLevel);
    level1Btn.addEventListener("click", () => startLevel(1));
    // Níveis 2 a 4 ainda não fazem nada (bloqueados por enquanto)

    pauseBtn.addEventListener("click", pauseGame);
    resumeBtn.addEventListener("click", resumeGame);

    // Pausa automaticamente ao minimizar a janela ou trocar de aba
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseGame();
    });

    // A cada instante marcado no beatmap, spawna o inimigo daquele instrumento
    rhythmManager.onInstrumentPlay((instrument) => {
        if (isGameStarted && !isGameOver) spawnEnemy(instrument);
    });

    resetGame();
    requestAnimationFrame(gameLoop);
}

function startLevel(levelNumber) {
    currentLevel = getLevel(levelNumber);
    if (!currentLevel) return;

    resetGame();
    isGameStarted = true;
    menuScreen.style.display = "none";

    rhythmManager.loadTrack(currentLevel.musicUrl);
    rhythmManager.loadBeatmap(currentLevel.beatmap);
    rhythmManager.play();
}

// Reinicia o nível em andamento (usado pelo botão "Jogar Novamente")
function restartLevel() {
    if (currentLevel) {
        startLevel(currentLevel.id);
    } else {
        resetGame();
    }
}

function pauseGame() {
    if (!isGameStarted || isGameOver || isPaused) return;
    isPaused = true;
    rhythmManager.pause();
    pauseScreen.style.display = "flex";
}

function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    rhythmManager.resume();
    pauseScreen.style.display = "none";
}

function resetGame() {
    tower = new Tower(canvas.width / 2, canvas.height / 2);
    if (currentLevel) {
        tower.hp = currentLevel.towerHp;
        tower.maxHp = currentLevel.towerHp;
    }
    enemies = [];
    score = 0;
    isGameOver = false;
    isPaused = false;

    gameOverScreen.style.display = "none";
    pauseScreen.style.display = "none";
    updateHUD();
}

function updateHUD() {
    hpElement.textContent = Math.max(0, tower.hp);
    scoreElement.textContent = score;
}

function triggerGameOver() {
    isGameOver = true;
    rhythmManager.stop();
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = "flex";
}

function handleMouseClick(mouseX, mouseY) {
    if (isGameOver) return;

    enemies.forEach(enemy => {
        if (!enemy.active) return;

        const halfW = enemy.width / 2;
        const halfH = enemy.height / 2;

        if (mouseX >= enemy.x - halfW && mouseX <= enemy.x + halfW &&
            mouseY >= enemy.y - halfH && mouseY <= enemy.y + halfH) {
            
            enemy.hp -= 1;
            if (enemy.hp <= 0) {
                enemy.active = false;
                score += 10;
                updateHUD();
            }
        }
    });
}

function spawnEnemy(instrument = 1) {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    if (side === 0) { x = Math.random() * canvas.width; y = -30; }                      // Topo
    else if (side === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }  // Direita
    else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 30; }  // Baixo
    else { x = -30; y = Math.random() * canvas.height; }                                // Esquerda

    enemies.push(new Enemy(x, y, instrument));
}

function update(deltaTime) {
    if (isGameOver || !isGameStarted || isPaused) return;

    rhythmManager.update(); // dispara spawnEnemy() nos tempos do beatmap

    enemies.forEach(enemy => {
        enemy.update(deltaTime, tower.x, tower.y);

        const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
        if (dist < 35 && enemy.active) {
            tower.hp -= 10;
            enemy.active = false;
            updateHUD();

            if (tower.hp <= 0) {
                triggerGameOver();
            }
        }
    });

    enemies = enemies.filter(e => e.active);
}

function drawRect(x, y, width, height, color, shape = "square", texture = null) {
    const buffers = shapeBuffers[shape] || shapeBuffers.square;

    // Troca o buffer de posição/texcoord ativo para o da forma pedida
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
    gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(translationUniformLocation, x - width / 2, y - height / 2);
    gl.uniform2f(scaleUniformLocation, width, height);

    if (texture) {
        gl.uniform1i(useTextureUniformLocation, 1);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    } else {
        gl.uniform1i(useTextureUniformLocation, 0);
        gl.uniform4fv(colorUniformLocation, color);
    }

    gl.drawArrays(gl.TRIANGLES, 0, buffers.count);
}

function gameLoop(timestamp) {
    let deltaTime = (timestamp - lastTime) / 1000;
    if (isNaN(deltaTime)) deltaTime = 0;
    lastTime = timestamp;

    update(deltaTime);

    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (tower.hp > 0) {
        drawRect(tower.x, tower.y, tower.width, tower.height, tower.color, "square");
    }

    enemies.forEach(e => drawRect(e.x, e.y, e.width, e.height, e.color, e.shape));

    requestAnimationFrame(gameLoop);
}

window.onload = init;