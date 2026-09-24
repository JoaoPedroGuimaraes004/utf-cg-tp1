// Toca a música do nível e dispara um evento sempre que o tempo atual
// da música cruza um instante marcado no beatmap (ver src/beatmaps/).
//
// Formato do beatmap: array de { time: segundos, instrument: 1..n },
// gerado pelo Editor de Beatmap (marcando na mão os tempos em que cada
// instrumento entra na música).

export class RhythmManager {
    constructor() {
        this.audio = null;
        this.beatmap = [];
        this.nextEventIndex = 0;
        this.onInstrumentCallbacks = [];
    }

    // Carrega o arquivo de música do nível
    loadTrack(url) {
        if (this.audio) {
            this.audio.pause();
        }
        this.audio = url ? new Audio(url) : null;

        if (this.audio) {
            this.audio.addEventListener("error", () => {
                console.error(
                    `[audio.js] Não foi possível carregar "${url}". ` +
                    `Confira: (1) se o caminho do arquivo está correto a partir ` +
                    `da raiz do projeto, (2) se o jogo está sendo aberto por um ` +
                    `servidor local (ex: Live Server) e não direto como arquivo ` +
                    `(file://), o que bloqueia o carregamento em alguns navegadores.`
                );
            });
        }
    }

    // Recebe o array de eventos { time, instrument } e garante que
    // estão ordenados por tempo.
    loadBeatmap(beatmap = []) {
        this.beatmap = [...beatmap].sort((a, b) => a.time - b.time);
        this.nextEventIndex = 0;
    }

    play() {
        if (!this.audio) return;
        this.nextEventIndex = 0;
        this.audio.currentTime = 0;

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.error(
                    "[audio.js] audio.play() foi rejeitado pelo navegador:", err,
                    "\nIsso normalmente acontece se play() não foi chamado " +
                    "diretamente dentro de um clique do usuário, ou se o " +
                    "arquivo de áudio não carregou."
                );
            });
        }
    }

    stop() {
        if (!this.audio) return;
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    // Pausa a música sem resetar o tempo (diferente de stop()) — usado
    // pelo botão de Pause e ao minimizar/trocar de aba.
    pause() {
        if (!this.audio) return;
        this.audio.pause();
    }

    // Retoma a música de onde parou.
    resume() {
        if (!this.audio) return;
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.error("[audio.js] Não foi possível retomar a música:", err);
            });
        }
    }

    // Registra uma função chamada toda vez que um instrumento "toca"
    // no beatmap. callback recebe o número do instrumento (1 a n).
    onInstrumentPlay(callback) {
        this.onInstrumentCallbacks.push(callback);
    }

    // Chamado a cada frame do jogo. Usa o tempo real de reprodução do
    // áudio (não um contador manual) para não perder sincronia.
    update() {
        if (!this.audio || this.audio.paused) return;

        const currentTime = this.audio.currentTime;
        while (
            this.nextEventIndex < this.beatmap.length &&
            this.beatmap[this.nextEventIndex].time <= currentTime
        ) {
            const event = this.beatmap[this.nextEventIndex];
            this.onInstrumentCallbacks.forEach(cb => cb(event.instrument));
            this.nextEventIndex++;
        }
    }
}