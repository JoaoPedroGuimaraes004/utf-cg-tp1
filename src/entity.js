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

// Inimigos
export class Enemy extends Entity {
    constructor(x, y, type = "square") {
        super(x, y, 30, 30, [1.0, 0.2, 0.4, 1.0]); // Codigo cor rosa
        this.hp = 2;
        this.speed = 200; // Velocidade inimigo (pixels por segundo)
        this.type = type;
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

