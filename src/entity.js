// Classe base para todas as entidades do jogo

class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.active = true;
    }
}

// Torre
export class Tower extends Entity {
    constructor(x, y) {
        super(x, y, 60, 60, [0.0, 0.8, 1.0, 1.0]); // Codigo cor azul 
        this.hp = 100;
        this.maxHp = 100;
    }
}

// Estilo visual, velocidade e forma de cada inimigo, por instrumento.
// Ajustar quando os detalhes de cada inimigo forem definidos
// (animação, dano, etc). As formas disponíveis são: 'triangle',
// 'diamond', 'circle' e 'square' (ver shapeBuffers em main.js).
const ENEMY_STYLES = {
    1: { color: [1.0, 0.2, 0.4, 1.0], speed: 200, shape: "triangle" }, // Instrumento 1
    2: { color: [1.0, 0.8, 0.0, 1.0], speed: 160, shape: "diamond" },  // Instrumento 2
    3: { color: [0.3, 0.8, 1.0, 1.0], speed: 240, shape: "circle" },   // Instrumento 3
    4: { color: [0.7, 0.3, 1.0, 1.0], speed: 180, shape: "square" },   // Instrumento 4
};

// Inimigos
export class Enemy extends Entity {
    constructor(x, y, instrument = 1) {
        const style = ENEMY_STYLES[instrument] || ENEMY_STYLES[1];
        super(x, y, 30, 30, style.color);
        this.hp = 2;
        this.speed = style.speed;
        this.instrument = instrument;
        this.shape = style.shape;
    }

    update(deltaTime, targetX, targetY) {
        // Calcula a trajetória 
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.hypot(dx, dy);

        // Se estiver perto o suficiente da torre, ataca
        if (distance > 20) {
            this.x += (dx / distance) * this.speed * deltaTime;
            this.y += (dy / distance) * this.speed * deltaTime;
        }
    }
}