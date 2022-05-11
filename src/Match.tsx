
export type MatchMode = "autonomous" | "driver" | "disabled";

export class Match {
    profile: MatchProfile;

    constructor(profile: MatchProfile) {
        this.profile = profile;
    }
}

export class MatchProfile {
    name: string;
    phases: MatchPhase[];

    constructor(name: string, phases: MatchPhase[]) {
        this.name = name;
        this.phases = phases;
    }
}

export class MatchPhase {
    mode: MatchMode;
    duration: number; // in second, 0 = forever

    constructor(mode: MatchMode, duration: number) {
        this.mode = mode;
        this.duration = duration;
    }
}

export function defaultMatchProfile() {
    return [
        new MatchProfile("Regular", [
            new MatchPhase("disabled", 0),
            new MatchPhase("autonomous", 15),
            new MatchPhase("disabled", 0),
            new MatchPhase("driver", 60 + 45),
            new MatchPhase("disabled", 0)
        ]),
        new MatchProfile("VexU", [
            new MatchPhase("disabled", 0),
            new MatchPhase("autonomous", 45),
            new MatchPhase("disabled", 0),
            new MatchPhase("driver", 60 + 15),
            new MatchPhase("disabled", 0)
        ]),
        new MatchProfile("Driver", [
            new MatchPhase("disabled", 0),
            new MatchPhase("driver", 60),
            new MatchPhase("disabled", 0)
        ]),
        new MatchProfile("Auton", [
            new MatchPhase("disabled", 0),
            new MatchPhase("autonomous", 60),
            new MatchPhase("disabled", 0)
        ]),
        new MatchProfile("Custom", [
            new MatchPhase("disabled", 0),
            new MatchPhase("autonomous", 15),
            new MatchPhase("disabled", 0),
            new MatchPhase("driver", 60 + 45),
            new MatchPhase("disabled", 0)
        ])
    ];
}
