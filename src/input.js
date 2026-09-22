export class InputManager {
    constructor(canvas, onEnemyClick) {
        this.canvas = canvas;
        this.onEnemyClick = onEnemyClick;

        this.initEvents();
    }

    initEvents() {
        this.canvas.addEventListener("mousedown", (event) => {
            // Obtém os limites do canvas na página
            const rect = this.canvas.getBoundingClientRect();

            // Converte o clique na página para a resolução interna do Canvas
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            const mouseX = (event.clientX - rect.left) * scaleX;
            const mouseY = (event.clientY - rect.top) * scaleY;

            // Notifica o jogo sobre a posição do clique
            this.onEnemyClick(mouseX, mouseY);
        });
    }
}