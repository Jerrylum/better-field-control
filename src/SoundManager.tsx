import abortSound from "./sound/Abort.wav";
import pauseSound from "./sound/Pause.wav";
import startSound from "./sound/Start.wav";
import stopSound from "./sound/Stop.wav";
import warningSound from "./sound/Warning.wav";

export class SoundManager {
    playingAudio: HTMLAudioElement | null = null;

    play(audio: HTMLAudioElement) {
        if (this.playingAudio == null) {
            this.playingAudio = audio;
            audio.play();

            let timeout = setTimeout(() => {
                this.playingAudio = null;
                clearTimeout(timeout);
            }, 6000);

            audio.addEventListener("ended", () => {
                this.playingAudio = null;
                clearTimeout(timeout);
            });
        }
    }

    playAbort() {
        this.play(new Audio(abortSound));
    }

    playPause() {
        this.play(new Audio(pauseSound));
    }

    playStart() {
        this.play(new Audio(startSound));
    }

    playStop() {
        this.play(new Audio(stopSound));
    }

    playWarning() {
        this.play(new Audio(warningSound));
    }
}