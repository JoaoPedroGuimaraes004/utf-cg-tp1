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

// Estilo (cor e velocidade) de cada inimigo, por instrumento. 
const ENEMY_STYLES = {
    1: { color: [1.0, 0.45, 0.55, 1.0], speed: 25 },  // Instrumento 1
    2: { color: [1.0, 0.75, 0.15, 1.0], speed: 60 }, // Instrumento 2
    3: { color: [0.35, 0.75, 1.0, 1.0], speed: 25 },  // Instrumento 3
    4: { color: [0.75, 0.4, 1.0, 1.0], speed: 60 },  // Instrumento 4
};

// Inimigos
export class Enemy extends Entity {
    constructor(x, y, instrument = 1) {
        const style = ENEMY_STYLES[instrument] || ENEMY_STYLES[1];
        super(x, y, 30, 30, style.color);
        this.hp = 1;
        this.speed = style.speed;
        this.instrument = instrument;
        // Direção que o bicho está "olhando" (radianos), usada para
        // desenhá-lo virado pro sentido em que se move.
        this.angle = 0;

        this.animPhase = Math.random() * Math.PI * 2;
    }

    update(deltaTime, targetX, targetY) {
        // Calcula a trajetória 
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0.001) {
            this.angle = Math.atan2(dy, dx);
        }

        // Se estiver perto o suficiente da torre, ataca
        if (distance > 20) {
            this.x += (dx / distance) * this.speed * deltaTime;
            this.y += (dy / distance) * this.speed * deltaTime;
        }
    }
}
