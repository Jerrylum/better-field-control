
export class TimerStatus {
    static INIT = Symbol();
    static RUNNING = Symbol();
    static PAUSE = Symbol();
    static TIMESUP = Symbol();
}

export class Timer {
    protected _previousTicks: number;
    protected _startTick: number | null;
    protected _totalTicks: number | null;

    constructor() {
        this._previousTicks = 0;
        this._startTick = null;
        this._totalTicks = null;
    }

    stop() {
        if (this.isRunning && this._startTick != null) {
            this._previousTicks += new Date().getTime() - this._startTick;
            this._startTick = null;
        }
    }

    start() {
        throw new Error("NotImplementedError");
    }

    /**
     * Set the time value of this timer
     * @param {number} a Hour or tick
     * @param {number} b Minute or undefined
     * @param {number} c Second or undefined
     * @param {number} d Millisecond or undefined
     */
    set(a: number, b?: number, c?: number, d?: number) {
        throw new Error("NotImplementedError");
    }

    reset() {
        this._startTick = null;
        this._previousTicks = 0;

        // CountdownTimer -> _totalTicks; StopwatchTimer -> 0
        this.set(this._totalTicks || 0);
    }

    get displayTicks(): number {
        throw new Error("NotImplementedError");
    }

    get isRunning(): boolean {
        return this.status === TimerStatus.RUNNING;
    }

    get status(): TimerStatus {
        throw new Error("NotImplementedError");
    }
}

export class StopwatchTimer extends Timer {
    private _initTicks: number;

    constructor() {
        super();

        this._initTicks = 0;
    }

    start() { // override
        if (!this.isRunning)
            this._startTick = new Date().getTime();
    }

    set(a: number, b?: number, c?: number, d?: number) {
        if (b != null && c != null && d != null)
            a = a * 3600000 + b * 60000 + c * 1000 + d;

        if (this.status === TimerStatus.PAUSE) {
            this._initTicks = a - 1; // keep ms
            this._previousTicks = 1; // keep pause mode
        } else {
            this._initTicks = a;
        }
    }

    get displayTicks(): number {
        return this.passedTicks;
    }

    get status(): TimerStatus { // override
        if (this._startTick == null && this._previousTicks === 0)
            return TimerStatus.INIT;
        else if (this._startTick == null && this._previousTicks !== 0)
            return TimerStatus.PAUSE;
        else
            return TimerStatus.RUNNING;
    }

    get passedTicks(): number {
        return Math.max(
            0,
            (
                this._startTick ?
                new Date().getTime() - this._startTick :
                0
            ) +
            this._initTicks + this._previousTicks
        );
    }
}

export class CountdownTimer extends Timer {
    constructor() {
        super();

        this._totalTicks = 0;
    }

    start() { // override
        if (!this.isRunning && !this.isTimeup)
            this._startTick = new Date().getTime();
    }

    set(a: number, b?: number, c?: number, d?: number) {
        if (b != null && c != null && d != null)
            a = a * 3600000 + b * 60000 + c * 1000 + d;

        if (this.status === TimerStatus.PAUSE) {
            this._totalTicks = a + 1; // keep ms
            this._previousTicks = 1; // keep pause mode
        } else {
            this._totalTicks = a;
        }
    }

    get displayTicks(): number {
        return this.remainingTicks;
    }

    get isTimeup(): boolean {
        return this.status === TimerStatus.TIMESUP;
    }

    get status(): TimerStatus { // override
        if (this._startTick == null && this._previousTicks === 0)
            return TimerStatus.INIT;
        else if (this._startTick != null && this.remainingTicks !== 0)
            return TimerStatus.RUNNING;
        else if (this._startTick == null && this._previousTicks !== 0)
            return TimerStatus.PAUSE;
        else if (this.remainingTicks === 0)
            return TimerStatus.TIMESUP;

        throw new Error("Error Status");
    }


    get totalTicks(): number {
        return this._totalTicks || 0;
    }

    get remainingTicks(): number {
        return Math.max(
            0,
            (
                this._startTick ?
                this._startTick - new Date().getTime() :
                0
            ) +
            (this._totalTicks || 0) - this._previousTicks
        );
    }

}