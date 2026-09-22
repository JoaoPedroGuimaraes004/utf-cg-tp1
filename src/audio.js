export class RhythmManager {
    constructor(bpm = 120) {
        this.setBpm(bpm);
        this.timeSinceLastBeat = 0;
        this.isPlaying = false;
        this.onBeatCallbacks = [];

        this.audio = null;
    }

    // Define o BPM da música atual.
    setBpm(bpm) {
        this.bpm = bpm;
        this.beatInterval = 60 / bpm; // Calcula periodo em segundos
    }

    // Carrega a música do nível.
    // Por enquanto é só um placeholder:
    // o ritmo é simulado a partir do BPM configurado em levels.js.
    loadTrack(url) {
        this.audio = null;
        if (url) {
            console.log(`[audio.js] TODO: carregar música em "${url}"`);
        }
    }

    play() {
        this.isPlaying = true;
        this.timeSinceLastBeat = 0;
        if (this.audio) this.audio.play();
    }

    stop() {
        this.isPlaying = false;
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
    }

    // Chama uma função a cada batida detectada (tipo um clock).
    onBeat(callback) {
        this.onBeatCallbacks.push(callback);
    }

    // Deve ser chamado a cada frame (dentro do gameLoop) com o deltaTime.
    update(deltaTime) {
        if (!this.isPlaying) return;

        this.timeSinceLastBeat += deltaTime;
        if (this.timeSinceLastBeat >= this.beatInterval) {
            this.timeSinceLastBeat -= this.beatInterval;
            this.onBeatCallbacks.forEach(cb => cb());
        }
    }
}