if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso:', registration);
            })
            .catch(error => {
                console.log('Erro ao registrar o Service Worker:', error);
            });
    });
}

const timersContainer = document.getElementById('timersContainer');
const addTimerButton = document.getElementById('addTimerButton');
const saveTimersButton = document.getElementById('saveTimersButton');
const clearStorageButton = document.getElementById('clearStorageButton');
const clearUnusedTimersButton = document.getElementById('clearUnusedTimersButton');

let timerIdCounter = 0;
const activeIntervals = {};
let currentlyActiveTimerId = null;
const timerStates = {};
const STORAGE_KEY = 'myTimersState';

function createTimer(savedState) {
    timerIdCounter++;
    const timerId = savedState ? savedState.id : `timer-${timerIdCounter}`;
    const container = document.createElement('div');
    container.classList.add('timer-container');
    container.id = timerId;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('timer-name-input');
    nameInput.value = savedState ? savedState.name : `Cronômetro ${timerIdCounter}`;

    const title = document.createElement('h2');
    title.classList.add('timer-title');
    title.textContent = nameInput.value;

    const display = document.createElement('div');
    display.classList.add('timer-display');
    display.textContent = '00:00:00';

    const controls = document.createElement('div');
    controls.classList.add('controls');

    const startButton = document.createElement('button');
    startButton.textContent = savedState && savedState.startTimeOrigin ? 'Retomar' : 'Iniciar';
    startButton.classList.add('start-button');
    startButton.dataset.timerId = timerId;
    startButton.style.display = 'inline-block';

    const pauseButton = document.createElement('button');
    pauseButton.textContent = 'Pausar';
    pauseButton.classList.add('pause-button');
    pauseButton.dataset.timerId = timerId;
    pauseButton.style.display = savedState && savedState.startTimeOrigin ? 'inline-block' : 'none';

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Resetar';
    resetButton.classList.add('reset-button');
    resetButton.dataset.timerId = timerId;

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remover';
    removeButton.classList.add('remove-button');
    removeButton.dataset.timerId = timerId;
    removeButton.disabled = timersContainer.children.length <= 1;

    controls.appendChild(startButton);
    controls.appendChild(pauseButton);
    controls.appendChild(resetButton);
    controls.appendChild(removeButton);

    container.appendChild(nameInput);
    container.appendChild(title);
    container.appendChild(display);
    container.appendChild(controls);

    timersContainer.appendChild(container);

    let startTime = null;
    let pausedTime = savedState ? savedState.pausedTime || 0 : 0;
    let intervalId = null;
    timerStates[timerId] = { container, startTime, pausedTime, intervalId, nameInput, title, display };

    nameInput.addEventListener('input', function () {
        title.textContent = this.value;
    });

    startButton.addEventListener('click', function () {
        const timerId = this.dataset.timerId;
        pauseAllOtherTimers(timerId);
        const state = timerStates[timerId];
        if (!state.startTime) {
            state.startTime = Date.now();
            this.style.display = 'none';
            pauseButton.style.display = 'inline-block';
            updateTimerDisplay(timerId);
            state.intervalId = setInterval(() => updateTimerDisplay(timerId), 100);
            activeIntervals[timerId] = state.intervalId;
            currentlyActiveTimerId = timerId;
            this.textContent = 'Retomar';
        }
    });

    pauseButton.addEventListener('click', function () {
        const timerId = this.dataset.timerId;
        const state = timerStates[timerId];
        if (state.startTime) {
            state.pausedTime += (Date.now() - state.startTime);
            clearInterval(state.intervalId);
            delete activeIntervals[timerId];
            state.startTime = null;
            startButton.style.display = 'inline-block';
            this.style.display = 'none';
            currentlyActiveTimerId = null;
        }
    });

    resetButton.addEventListener('click', function () {
        const timerId = this.dataset.timerId;
        const state = timerStates[timerId];
        clearInterval(state.intervalId);
        delete activeIntervals[timerId];
        state.startTime = null;
        state.pausedTime = 0;
        updateDisplay(0, timerId);
        startButton.textContent = 'Iniciar';
        startButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
        if (currentlyActiveTimerId === timerId) {
            currentlyActiveTimerId = null;
        }
    });

    removeButton.addEventListener('click', function () {
        const timerId = this.dataset.timerId;
        const timerName = timerStates[timerId].nameInput.value || `Cronômetro ${timerId.split('-')[1]}`;
        if (confirm(`Tem certeza que deseja remover o cronômetro "${timerName}"?`)) {
            clearInterval(timerStates[timerId].intervalId);
            delete activeIntervals[timerId];
            delete timerStates[timerId];
            container.remove();
            updateRemoveButtonsState();
            if (currentlyActiveTimerId === timerId) {
                currentlyActiveTimerId = null;
            }
        }
    });

    function updateTimerDisplay(timerId) {
        const state = timerStates[timerId];
        if (state) {
            const currentTime = state.startTime ? Date.now() - state.startTime + state.pausedTime : state.pausedTime;
            updateDisplay(currentTime, timerId);
        }
    }

    function updateDisplay(totalMilliseconds, timerId) {
        const displayElement = timerStates[timerId].display;
        displayElement.textContent = formatTime(totalMilliseconds);
    }

    updateRemoveButtonsState();

    if (savedState && savedState.startTimeOrigin) {
        timerStates[timerId].startTime = Date.now() - (Date.now() - savedState.startTimeOrigin);
        timerStates[timerId].pausedTime = savedState.pausedTime || 0;
        display.textContent = '00:00:00'; // Inicializa visualmente
        startButton.style.display = 'none';
        pauseButton.style.display = 'inline-block';
        timerStates[timerId].intervalId = setInterval(() => updateTimerDisplay(timerId), 100);
        activeIntervals[timerId] = timerStates[timerId].intervalId;
        currentlyActiveTimerId = timerId;
        updateTimerDisplay(timerId);
    } else if (savedState) {
        timerStates[timerId].pausedTime = savedState.pausedTime || 0;
        display.textContent = formatTime(savedState.pausedTime || 0);
    }
}

function pauseAllOtherTimers(currentTimerId) {
    for (const timerId in timerStates) {
        if (timerId !== currentTimerId) {
            const state = timerStates[timerId];
            if (state.startTime) {
                state.pausedTime = Date.now() - state.startTime;
                clearInterval(state.intervalId);
                delete activeIntervals[timerId];
                state.startTime = null;
                const startButton = state.container.querySelector('.start-button');
                const pauseButton = state.container.querySelector('.pause-button');
                startButton.style.display = 'inline-block';
                pauseButton.style.display = 'none';
            }
        }
    }
    currentlyActiveTimerId = currentTimerId;
}

function formatTime(totalMilliseconds) {
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function updateRemoveButtonsState() {
    const removeButtons = document.querySelectorAll('.remove-button');
    removeButtons.forEach(button => {
        button.disabled = timersContainer.children.length <= 1;
    });
}

addTimerButton.addEventListener('click', function () {
    createTimer();
});

saveTimersButton.addEventListener('click', function () {
    const timersData = [];
    for (const timerId in timerStates) {
        const state = timerStates[timerId];
        timersData.push({
            id: timerId,
            name: state.nameInput.value,
            pausedTime: state.pausedTime,
            startTimeOrigin: state.startTime ? state.startTime : null // Salva o startTime original
        });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timersData));
    alert('Estado dos cronômetros salvo!');
});

clearStorageButton.addEventListener('click', function () {
    localStorage.removeItem(STORAGE_KEY);
    alert('Dados salvos foram removidos do armazenamento local.');
});

clearUnusedTimersButton.addEventListener('click', function () {
    const unusedTimers = [];
    for (const timerId in timerStates) {
        if (timerStates[timerId].display.textContent === '00:00:00' && !timerStates[timerId].startTime) {
            unusedTimers.push(timerStates[timerId].nameInput.value || `Cronômetro ${timerId.split('-')[1]}`);
        }
    }

    if (unusedTimers.length > 0) {
        const confirmationMessage = `Tem certeza que deseja remover os seguintes cronômetros não utilizados?\n- ${unusedTimers.join('\n- ')}`;
        if (confirm(confirmationMessage)) {
            const timersToRemove = Object.keys(timerStates).filter(timerId =>
                timerStates[timerId].display.textContent === '00:00:00' && !timerStates[timerId].startTime
            );
            timersToRemove.forEach(timerId => {
                const containerToRemove = timerStates[timerId].container;
                clearInterval(timerStates[timerId].intervalId);
                delete activeIntervals[timerId];
                delete timerStates[timerId];
                containerToRemove.remove();
            });
            updateRemoveButtonsState();
        }
    } else {
        alert('Não há cronômetros não utilizados para limpar.');
    }
});

window.addEventListener('load', function () {
    const savedTimers = localStorage.getItem(STORAGE_KEY);
    timerIdCounter = 0;
    timersContainer.innerHTML = '';

    if (savedTimers) {
        const parsedTimers = JSON.parse(savedTimers);
        if (parsedTimers && parsedTimers.length > 0) {
            parsedTimers.forEach(timerData => {
                createTimer(timerData);
                const idNumber = parseInt(timerData.id.split('-')[1]);
                if (!isNaN(idNumber)) {
                    timerIdCounter = Math.max(timerIdCounter, idNumber);
                }
            });
            timerIdCounter++;
        } else {
            createTimer();
        }
    } else {
        createTimer();
    }
    updateRemoveButtonsState();
});