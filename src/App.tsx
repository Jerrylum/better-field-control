import React, { useEffect, useRef, useState } from 'react';
import './App.scss';
import { Controller } from './Controller';
import { defaultMatchProfile, MatchMode, MatchProfile } from './Match';
import { useWindowSize } from './Util';
import { CountdownTimer, TimerStatus } from './Timer';
import { SoundManager } from './SoundManager';

let userSelected = 0;

function App() {

    // const controllers = useRef<Controller[]>([]);

    const [controllers, setControllers] = useState<Controller[]>([]);

    const [profiles, setProfiles] = useState<MatchProfile[]>(defaultMatchProfile());

    const [selectedProfile, setSelectedProfile] = useState<number>(0);

    const [usingMatchMode, setUsingMatchMode] = useState<MatchMode>("disabled");

    const [profileIndicatorStyle, setProfileIndicatorStyle] = useState<{}>({});

    const [phaseIndex, setPhaseIndex] = useState(0);

    const [controllerState, setControllerState] = useState(0);

    const [timerState, setTimerState] = useState(0);

    const [timerUpdateRequest, setTimerUpdateRequest] = useState(0);

    const profileDOMsRef = useRef<HTMLElement[]>([]);

    const profileIndicatorInitedRef = useRef(false);

    const timerWarningRef = useRef(false);

    const timerRef = useRef(new CountdownTimer());

    const soundManagerRef = useRef(new SoundManager());

    const windowSize = useWindowSize();

    const handleConnect = async function () {
        let controller = new Controller();
        try {
            await controller.connect();
            setControllers([...controllers, controller]);
            console.log("Controller connected");
        } catch (e) {
            console.log("Failed to connect controller");
        }
    }

    const selectMatchMode = function (mode: MatchMode) {
        setSelectedProfile(-1);
        setUsingMatchMode(mode);
    }

    const sendControllersMatchMode = async function (mode: MatchMode) {
        console.log("Sending match mode: " + mode);

        for (let controller of controllers) {
            await controller.setMatchMode(mode);
        }
    }

    const getStatusTitle = function () {
        if (selectedProfile < 0) return "Switched to mode: " + usingMatchMode;

        let profile = profiles[selectedProfile];
        let phase = profile.phases[phaseIndex];

        if (!phase) return "Invalid Match";

        if (phase.mode !== "disabled") {
            if (usingMatchMode === "disabled")
                return "PAUSED";
            else
                return "Running on " + usingMatchMode + " mode";
        }

        let nextPhase = profile.phases[phaseIndex + 1];
        if (nextPhase) {
            return "PAUSED - Waiting to start " + nextPhase.mode;
        } else {
            return "Match ended";
        }
    }

    const getMinuteNumber = function () {
        if (selectedProfile < 0) return "--";
        // HACK: +999 is for the VEX style timer
        // for example: "00:01" means this is the last second, less than 1000 milliseconds
        let time = Math.trunc((timerRef.current.displayTicks + 999) % 3600000 / 60000);
        return time > 9 ? time + "" : "0" + time;
    }

    const getSecondNumber = function () {
        if (selectedProfile < 0) return "--";
        let time = Math.trunc((timerRef.current.displayTicks + 999) % 60000 / 1000);
        return time > 9 ? time + "" : "0" + time;
    }

    const btn1ClickEvent = function (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        let timer = timerRef.current;
        if (timer.status === TimerStatus.INIT) {
            setPhaseIndex((past) => past + 1);
        } else if (timer.status === TimerStatus.RUNNING) {
            timerRef.current.stop();
            setUsingMatchMode("disabled");
        } else if (timer.status === TimerStatus.PAUSE) {
            timerRef.current.start();
            setUsingMatchMode(profiles[selectedProfile].phases[phaseIndex].mode);
        } else if (timer.status === TimerStatus.TIMESUP) {
            let profile = profiles[selectedProfile];
            if (phaseIndex + 1 >= profile.phases.length) {
                setPhaseIndex(0);
            } else {
                setPhaseIndex((past) => past + 1);
            }
        }
    }

    const btn2ClickEvent = function (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        let timer = timerRef.current;
        if (timer.status === TimerStatus.INIT) {
            setSelectedProfile(-1);
            setUsingMatchMode("driver");
        } else if (timer.status === TimerStatus.RUNNING) {
            timer.set(0);
            soundManagerRef.current.playAbort();
        } else if (timer.status === TimerStatus.PAUSE) {
            timer.set(0);
            timer.start();
            soundManagerRef.current.playAbort();
        } else if (timer.status === TimerStatus.TIMESUP) {
            setSelectedProfile(-1);
            setUsingMatchMode("driver");
        }
    }

    const getBtn1Text = function () {
        if (selectedProfile < 0) return "---";

        let timer = timerRef.current;
        if (timer.status === TimerStatus.INIT) {
            return "Start";
        } else if (timer.status === TimerStatus.RUNNING) {
            return "Pause";
        } else if (timer.status === TimerStatus.PAUSE) {
            return "Resume";
        } else if (timer.status === TimerStatus.TIMESUP) {
            let profile = profiles[selectedProfile];
            if (phaseIndex + 1 >= profile.phases.length) {
                return "Start Over";
            } else {
                return "Start";
            }
        }
    }

    const getBtn2Text = function () {
        if (selectedProfile < 0) return "---";

        let timer = timerRef.current;
        if (timer.status === TimerStatus.INIT || timer.status === TimerStatus.TIMESUP) {
            return "Exit";
        } else {
            return "Stop";
        }
    }

    const isValidProfile = function (profile: MatchProfile) {
        let shouldDisable = true;
        let check1 = false; // at least one phase has duration >= 1
        for (let phase of profile.phases) {
            if (phase.mode === "disabled") {
                if (!shouldDisable) return false;
                shouldDisable = false;
            } else {
                if (shouldDisable) return false;
                if (phase.duration >= 1) check1 = true;
                shouldDisable = true;
            }
        }
        if (shouldDisable) return false; // last phase should be "disable"
        return check1;
    }

    const isLastPhaseProfile = function (profile: MatchProfile, phaseIndex: number) {
        for (let i = phaseIndex + 1; i < profile.phases.length; i++) {
            if (profile.phases[i].mode !== "disabled" && profile.phases[i].duration >= 1) return false;
        }
        return true;
    }

    const getBtnStyle = function () {
        return { "display": selectedProfile < 0 || !isValidProfile(profiles[selectedProfile]) ? "none" : "" }
    }

    const numberEditableKeypressEvent = function (event: React.KeyboardEvent<HTMLInputElement>) {
        let x = event.charCode || event.keyCode;
        if (isNaN(parseInt(String.fromCharCode(event.which))) ||
            x === 46 ||
            x === 32 ||
            x === 13
        ) event.preventDefault();
    }

    const numberEditableInputEvent = function (event: React.ChangeEvent<HTMLInputElement>) {
        let target = event.currentTarget, raw = target.innerText, num = parseInt(raw);

        try {
            if (raw === "" || isNaN(num)) {
                event.currentTarget.innerText = "0";
                return;
            }

            if (raw.length > 3 || num > 999) {
                event.currentTarget.innerText = "999";
                return;
            }

            if (raw !== num.toString()) { // "0" first
                event.currentTarget.innerText = num.toString();
                return;
            }
        } finally {
            if (raw !== event.currentTarget.innerText) {
                let range = document.createRange();
                range.selectNodeContents(target);
                range.collapse(false);
                let sel = window.getSelection();
                if (!sel) return;
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    const customProfileAutoDurationChange = function (event: React.ChangeEvent<HTMLInputElement>) {
        numberEditableInputEvent(event);
        profiles[4].phases[1].duration = parseInt(event.currentTarget.innerText);

        if (selectedProfile === 4) {
            setPhaseIndex(0);
            setTimerUpdateRequest(timerUpdateRequest + 1);
        }
    }

    const customProfileDriverDurationChange = function (event: React.ChangeEvent<HTMLInputElement>) {
        numberEditableInputEvent(event);
        profiles[4].phases[3].duration = parseInt(event.currentTarget.innerText);

        if (selectedProfile === 4) {
            setPhaseIndex(0);
            setTimerUpdateRequest(timerUpdateRequest + 1);
        }
    }

    useEffect(() => {
        setTimeout(async () => {
            setTimerState(t => t + 1);

            if (selectedProfile < 0) return;

            let profile = profiles[selectedProfile];
            let phase = profile.phases[phaseIndex];
            let timer = timerRef.current;

            if (phase.mode === "disabled") return;

            if (timer.status === TimerStatus.TIMESUP) {
                setPhaseIndex(phaseIndex + 1);
                if (isLastPhaseProfile(profile, phaseIndex))
                    soundManagerRef.current.playStop();
                else
                    soundManagerRef.current.playPause();
            } else if (timer.isRunning) {
                if (timer.displayTicks > 30 * 1000) {
                    timerWarningRef.current = false;
                } else if (!timerWarningRef.current) {
                    timerWarningRef.current = true;
                    soundManagerRef.current.playWarning();
                }
            }
        }, 1);

    }, [timerState, timerUpdateRequest]);

    useEffect(() => {
        setTimeout(async () => {
            setControllerState(c => c + 1);

            let update = false;

            let newControllerSet = [];
            for (let controller of controllers) {
                if (controller.isConnected()) {
                    newControllerSet.push(controller);
                } else {
                    update = true;
                    console.log("Controller disconnected");
                }
            }

            let controller = new Controller();
            try {
                await controller.connect(false);
                if (controller.isConnected()) {
                    newControllerSet.push(controller);
                    update = true;
                    console.log("Controller connected automatically");
                }
            } catch (e) { }

            if (update)
                setControllers(newControllerSet);
        }, 200);

    }, [controllerState]);

    useEffect(() => {
        if (selectedProfile < 0) {
            setProfileIndicatorStyle({ "display": "none" });
            return;
        }

        const profileDOM = profileDOMsRef.current[selectedProfile];
        let span = profileDOM?.querySelector("span");

        if (!span) {
            setProfileIndicatorStyle({ "display": "none" });
            return;
        }

        let rect = span.getBoundingClientRect();
        setProfileIndicatorStyle({
            "width": rect.width + "px",
            "left": (rect.left + rect.width / 2) + "px",
            ...(
                profileIndicatorInitedRef.current ? {} : { "transition": "none" }
            )
        });

        profileIndicatorInitedRef.current = true;
    }, [selectedProfile, windowSize]);

    useEffect(() => {
        timerRef.current.stop();

        if (selectedProfile < 0) return;

        let profile = profiles[selectedProfile];
        setPhaseIndex(0);
        timerRef.current = new CountdownTimer();
        timerRef.current.set(profile.phases[1].duration * 1000);
    }, [profiles, selectedProfile]);

    useEffect(() => {
        if (selectedProfile < 0) return;

        let profile = profiles[selectedProfile];
        let phase = profile.phases[phaseIndex];

        if (!phase) {
            console.warn("Invalid phase");

            setUsingMatchMode("disabled");
            setSelectedProfile(-1);
            setPhaseIndex(0);
            return;
        }

        if (phase.mode !== "disabled") {
            timerRef.current.start();
            soundManagerRef.current.playStart();
        } else {
            let nextProfile = profile.phases[phaseIndex + 1];

            if (nextProfile) {
                if (nextProfile.duration === 0) {
                    setPhaseIndex(phaseIndex + 2); // skip to next 2 phase
                    return; // dont use the match mode
                }

                timerRef.current = new CountdownTimer();
                timerRef.current.set(nextProfile.duration * 1000);
            }
        }

        setUsingMatchMode(phase.mode);
    }, [phaseIndex, profiles, selectedProfile, timerUpdateRequest]);

    useEffect(() => {
        sendControllersMatchMode(usingMatchMode);
    }, [usingMatchMode, controllers]);

    return (
        <div className="app noselect">
            <div className="app-body" style={{opacity: timerState ? 1 : 0}}>
                <div className="app-component">
                    <div className="header-body">
                        <p className='controller-info'>
                            <span onClick={handleConnect}>
                                {controllers.length} Controller{controllers.length > 1 ? "s" : ""} Connected
                            </span>
                        </p>
                        <p>{timerState && getStatusTitle()}</p>
                    </div>
                </div>
                <div className="app-timer-component">
                    <div className="timer-body">
                        <span className="timer-display">
                            <span>{timerState && getMinuteNumber()}
                                <div className="button" style={getBtnStyle()}>
                                    <span onClick={btn1ClickEvent}>{getBtn1Text()}</span>
                                </div>
                            </span>
                            <span>:</span>
                            <span>{timerState && getSecondNumber()}
                                <div className="button" style={getBtnStyle()}>
                                    <span onClick={btn2ClickEvent}>{getBtn2Text()}</span>
                                </div>
                            </span>
                        </span>
                    </div>
                    <div className="timer-info-body">
                        <div className="mode-info">
                            <span onClick={() => ++userSelected && selectMatchMode("disabled")}>
                                {usingMatchMode === "disabled" ? ">" : "\u00a0"}&nbsp;Disabled
                            </span><br />
                            <span onClick={() => ++userSelected && selectMatchMode("driver")}>
                                {usingMatchMode === "driver" ? ">" : "\u00a0"}&nbsp;Driver
                            </span><br />
                            <span onClick={() => ++userSelected && selectMatchMode("autonomous")}>
                                {usingMatchMode === "autonomous" ? ">" : "\u00a0"}&nbsp;Autonomous
                            </span><br />
                            <span></span>
                        </div>
                        <div className="profile-setting" style={{ "display": selectedProfile === 4 ? "" : "none" }}>
                            <span>
                                &nbsp;&nbsp;AUTO:&nbsp;&nbsp;
                                <span contentEditable
                                    onKeyPress={numberEditableKeypressEvent}
                                    onInput={customProfileAutoDurationChange}
                                    suppressContentEditableWarning={true}>15</span>
                            </span><br />
                            <span>
                                &nbsp;&nbsp;Driver:
                                <span contentEditable
                                    onKeyPress={numberEditableKeypressEvent}
                                    onInput={customProfileDriverDurationChange}
                                    suppressContentEditableWarning={true}>105</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="app-component">
                    <div className="footer-body">
                        {profiles.map((profile, index) => {
                            return <div
                                className="profile"
                                key={index}
                                ref={el => profileDOMsRef.current[index] = el as HTMLElement}>
                                <span onClick={() => { setSelectedProfile(index); setPhaseIndex(0) }}>
                                    {profile.name}
                                </span>
                            </div>
                        })}

                        <div className="indicator" style={profileIndicatorStyle}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
