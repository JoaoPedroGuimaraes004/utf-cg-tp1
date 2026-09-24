export class InputManager {
    constructor(canvas, onEnemyClick, onMouseMove) {
        this.canvas = canvas;
        this.onEnemyClick = onEnemyClick;
        this.onMouseMove = onMouseMove;

        this.initEvents();
    }

    // Converte a posição do evento na página para a resolução interna do Canvas
    toCanvasCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    }

    initEvents() {
        this.canvas.addEventListener("mousedown", (event) => {
            const { x, y } = this.toCanvasCoords(event);
            // Notifica o jogo sobre a posição do clique
            this.onEnemyClick(x, y);
        });

        // Notifica o jogo sobre a posição do mouse a cada movimento, pra
        // ele poder trocar o cursor quando estiver sobre um inimigo.
        if (this.onMouseMove) {
            this.canvas.addEventListener("mousemove", (event) => {
                const { x, y } = this.toCanvasCoords(event);
                this.onMouseMove(x, y);
            });
        }
    }
}
