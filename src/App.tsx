import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.scss';
import 'intro.js/introjs.css';
import './introjs-flattener.scss';
import { Controller } from './Controller';
import { defaultMatchProfile, MatchMode, MatchProfile } from './Match';
import { useWindowSize } from './Util';
import { CountdownTimer, TimerStatus } from './Timer';
import { SoundManager } from './SoundManager';
import introJs from 'intro.js';

let appInited = 0; // HACK: to prevent multiple inits in development mode

function App() {

    const [controllers] = useState(new Set<Controller>());

    const [profiles] = useState<MatchProfile[]>(defaultMatchProfile());

    const [selectedProfile, setSelectedProfile] = useState<number>(0);

    const [usingMatchMode, setUsingMatchMode] = useState<MatchMode>("disabled");

    const [profileIndicatorStyle, setProfileIndicatorStyle] = useState<{}>({});

    const [phaseIndex, setPhaseIndex] = useState(0);

    const [controllerState, setControllerState] = useState(0);

    const [timer, setTimer] = useState(new CountdownTimer());

    const [timerState, setTimerState] = useState(0);

    const [timerUpdateRequest, setTimerUpdateRequest] = useState(0);

    const [timerWarning, setTimerWarning] = useState(false);

    const profileDOMsRef = useRef<HTMLElement[]>([]);

    const soundManager = useMemo(() => new SoundManager(), []);

    const windowSize = useWindowSize();

    const handleConnect = async function () {
        let controller = new Controller();
        try {
            await controller.connect();
            controllers.add(controller);
            console.log("Controller connected");

            sendControllersMatchMode(usingMatchMode);
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
        let time = Math.trunc((timer.displayTicks + 999) % 3600000 / 60000);
        return time > 9 ? time + "" : "0" + time;
    }

    const getSecondNumber = function () {
        if (selectedProfile < 0) return "--";
        let time = Math.trunc((timer.displayTicks + 999) % 60000 / 1000);
        return time > 9 ? time + "" : "0" + time;
    }

    const btn1ClickEvent = function (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        if (timer.status === TimerStatus.INIT) {
            setPhaseIndex((past) => past + 1);
        } else if (timer.status === TimerStatus.RUNNING) {
            timer.stop();
            setUsingMatchMode("disabled");
        } else if (timer.status === TimerStatus.PAUSE) {
            timer.start();
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
        if (timer.status === TimerStatus.INIT) {
            setSelectedProfile(-1);
            setUsingMatchMode("driver");
        } else if (timer.status === TimerStatus.RUNNING) {
            timer.set(0);
            soundManager.playAbort();
        } else if (timer.status === TimerStatus.PAUSE) {
            timer.set(0);
            timer.start();
            soundManager.playAbort();
        } else if (timer.status === TimerStatus.TIMESUP) {
            setSelectedProfile(-1);
            setUsingMatchMode("driver");
        }
    }

    const getBtn1Text = function () {
        if (selectedProfile < 0) return "---";

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

            if (phase.mode === "disabled") return;

            if (timer.status === TimerStatus.TIMESUP) {
                setPhaseIndex(phaseIndex + 1);
                if (isLastPhaseProfile(profile, phaseIndex))
                    soundManager.playStop();
                else
                    soundManager.playPause();
            } else if (timer.isRunning) {
                if (timer.displayTicks > 30 * 1000) {
                    setTimerWarning(false);
                } else if (!timerWarning) {
                    setTimerWarning(true);
                    soundManager.playWarning();
                }
            }
        }, 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerState, timerUpdateRequest]);

    useEffect(() => {
        setTimeout(async () => {
            setControllerState(c => c + 1);

            for (let controller of controllers) {
                if (!controller.isConnected()) {
                    controllers.delete(controller);
                    console.log("Controller disconnected");
                }
            }

            let controller = new Controller();
            try {
                await controller.connect(false);
                if (controller.isConnected()) {
                    controllers.add(controller);
                    console.log("Controller connected automatically");

                    sendControllersMatchMode(usingMatchMode);
                }
            } catch (e) { }
        }, 200);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            "left": (rect.left + rect.width / 2) + "px"
        });

    }, [selectedProfile, windowSize]);

    useEffect(() => {
        timer.stop();

        if (selectedProfile < 0) return;

        let profile = profiles[selectedProfile];
        setPhaseIndex(0);
        let newTimer = new CountdownTimer();
        newTimer.set(profile.phases[1].duration * 1000);
        setTimer(newTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            timer.start();
            soundManager.playStart();
        } else {
            let nextProfile = profile.phases[phaseIndex + 1];

            if (nextProfile) {
                if (nextProfile.duration === 0) {
                    setPhaseIndex(phaseIndex + 2); // skip to next 2 phase
                    return; // dont use the match mode
                }

                let newTimer = new CountdownTimer();
                newTimer.set(nextProfile.duration * 1000);
                setTimer(newTimer);
            }
        }

        setUsingMatchMode(phase.mode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phaseIndex, profiles, selectedProfile, timerUpdateRequest]);

    useEffect(() => {
        sendControllersMatchMode(usingMatchMode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usingMatchMode]);

    useEffect(() => {
        if (appInited++) return;

        let t = introJs();
        t.setOptions({
            steps: [
                {
                    element: document.querySelector('.controller-info>span') ?? document.body,
                    title: 'Connect A Controller',
                    intro: 'Plug your controllers to the PC, then click here to connect them!<br/><br/>You can connect more than once, and they will be connected automatically next time.'
                },
                {
                    title: 'Select A Profile',
                    element: document.querySelector('.footer-body>span') ?? document.body,
                    intro: 'By default it is 15sec autonomous and 1:45 driver control.<br/><br/>You can switch to another profile. For exmaple: use "DRIVER" if you are working on 1 minute skill chanllenge.'
                },
                {
                    title: 'Custom Duration!',
                    element: document.querySelector('.profile-setting') ?? document.body,
                    intro: 'If none of them work for you, select "CUSTOM" profile and click the numbers above to edit the durations.'
                },
                {
                    title: 'Start The Timer',
                    element: document.querySelector('#btn1>span') ?? document.body,
                    intro: 'The robots will be enabled and disabled over time.'
                },
                {
                    title: 'Mode Indicator',
                    element: document.querySelector('.mode-info') ?? document.body,
                    intro: 'You can see what mode is on right here.<br/><br/>If you don\'t want to use a timer, you can also click these buttons to switch modes manually.'
                },
                {
                    title: 'That\'s It!',
                    intro: 'This is a free software under GNU GPL license written by team 7984.<br/><br/>You can find more information <a target="blank" href="https://github.com/Jerrylum/better-field-control">here</a>. Have fun and good luck!'
                }
            ]
        }).onbeforechange(function() {
            if (t.currentStep() === 2) {
                setSelectedProfile(4);
            } else {
                setSelectedProfile(0);
            }
        }).start();


    }, []);

    return (
        <div className="app noselect">
            <div className="app-body" style={{ opacity: timerState ? 1 : 0 }}>
                <div className="app-component">
                    <div className="header-body">
                        <p className='controller-info'>
                            <span onClick={handleConnect}>
                                {controllers.size} Controller{controllers.size > 1 ? "s" : ""} Connected
                            </span>
                        </p>
                        <p>{timerState && getStatusTitle()}</p>
                    </div>
                </div>
                <div className="app-timer-component">
                    <div className="timer-body">
                        <span className="timer-display">
                            <span>{timerState && getMinuteNumber()}
                                <div id="btn1" className="button" style={getBtnStyle()}>
                                    <span onClick={btn1ClickEvent}>{getBtn1Text()}</span>
                                </div>
                            </span>
                            <span>:</span>
                            <span>{timerState && getSecondNumber()}
                                <div id="btn2" className="button" style={getBtnStyle()}>
                                    <span onClick={btn2ClickEvent}>{getBtn2Text()}</span>
                                </div>
                            </span>
                        </span>
                    </div>
                    <div className="timer-info-body">
                        <div className="mode-info">
                            <span onClick={() => selectMatchMode("disabled")}>
                                {usingMatchMode === "disabled" ? ">" : "\u00a0"}&nbsp;Disabled
                            </span><br />
                            <span onClick={() => selectMatchMode("driver")}>
                                {usingMatchMode === "driver" ? ">" : "\u00a0"}&nbsp;Driver
                            </span><br />
                            <span onClick={() => selectMatchMode("autonomous")}>
                                {usingMatchMode === "autonomous" ? ">" : "\u00a0"}&nbsp;Autonomous
                            </span><br />
                            <span></span>
                        </div>
                        <div className="profile-setting" style={{ "visibility": selectedProfile === 4 ? "visible" : "hidden" }}>
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
                        <span>
                            {profiles.map((profile, index) => {
                                return <div
                                    className="profile"
                                    key={index}
                                    ref={el => profileDOMsRef.current[index] = el as HTMLElement}>
                                    <span
                                        className={selectedProfile === index ? "selected" : ""}
                                        onClick={() => { setSelectedProfile(index); setPhaseIndex(0) }}>
                                        {profile.name}
                                    </span>
                                </div>
                            })}

                        </span>
                        <div className="indicator" style={profileIndicatorStyle}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
