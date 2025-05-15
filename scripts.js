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
const clearStorageButton = document.getElementById('clearStorageButton');
const clearUnusedTimersButton = document.getElementById('clearUnusedTimersButton');
const versionInfoButton = document.getElementById('versionInfoButton');
const versionInfoPopup = document.getElementById('versionInfoPopup');
const closeButton = document.querySelector('.close-button');

const newTimerPopup = document.getElementById('newTimerPopup');
const closeNewTimerPopup = document.getElementById('closeNewTimerPopup');
const createNewTimerButton = document.getElementById('createNewTimerButton');
const cancelNewTimerButton = document.getElementById('cancelNewTimerButton');
const newTimerNameInput = document.getElementById('newTimerNameInput');

const totalTimeDisplay = document.getElementById('totalTimeDisplay');

let timerIdCounter = 0;
let activeIntervals = {};
let currentlyActiveTimerId = null;
let timerStates = {};
const STORAGE_KEY = 'MultiTimeTrackerTimersState';

function createTimer(savedState) {
    timerIdCounter++;
    let timerId = savedState ? savedState.id : `timer-${timerIdCounter}`;
    let container = document.createElement('div');
    container.classList.add('timer-container');
    container.id = timerId;

    let nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('timer-name-input');
    nameInput.value = savedState ? savedState.name : `Cronômetro ${timerIdCounter}`;
    const initialName = nameInput.value; // Salva o nome inicial

    let title = document.createElement('h2');
    title.classList.add('timer-title');
    title.textContent = nameInput.value;

    let display = document.createElement('div');
    display.classList.add('timer-display');
    display.textContent = '00:00:00';

    let controls = document.createElement('div');
    controls.classList.add('controls');

    let startButton = document.createElement('button');
    startButton.textContent = savedState && savedState.startTimeOrigin ? 'Retomar' : 'Iniciar';
    startButton.classList.add('start-button');
    startButton.dataset.timerId = timerId;
    startButton.style.display = 'inline-block';

    let pauseButton = document.createElement('button');
    pauseButton.textContent = 'Pausar';
    pauseButton.classList.add('pause-button');
    pauseButton.dataset.timerId = timerId;
    pauseButton.style.display = savedState && savedState.startTimeOrigin ? 'inline-block' : 'none';

    let resetButton = document.createElement('button');
    resetButton.textContent = 'Resetar';
    resetButton.classList.add('reset-button');
    resetButton.dataset.timerId = timerId;

    let removeButton = document.createElement('button');
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
    timerStates[timerId] = { container, startTime, pausedTime, intervalId, nameInput, title, display, initialName }; // Salva initialName

    nameInput.addEventListener('input', function () {
        title.textContent = this.value;
        saveAllTimers(); // Garante que o nome atual seja salvo
    });

    startButton.addEventListener('click', function () {
        let timerId = this.dataset.timerId;
        pauseAllOtherTimers(timerId);
        let state = timerStates[timerId];
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
        saveAllTimers();
        updateTotalTimeDisplay(); // Atualiza o tempo total
    });

    pauseButton.addEventListener('click', function () {
        let timerId = this.dataset.timerId;
        let state = timerStates[timerId];
        if (state.startTime) {
            state.pausedTime += (Date.now() - state.startTime);
            clearInterval(state.intervalId);
            delete activeIntervals[timerId];
            state.startTime = null;
            startButton.style.display = 'inline-block';
            this.style.display = 'none';
            currentlyActiveTimerId = null;
        }
        saveAllTimers();
        updateTotalTimeDisplay(); // Atualiza o tempo total
    });

    resetButton.addEventListener('click', function () {
        let timerId = this.dataset.timerId;
        let state = timerStates[timerId];
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
        saveAllTimers();
        updateTotalTimeDisplay(); // Atualiza o tempo total
    });

    removeButton.addEventListener('click', function () {
        let timerId = this.dataset.timerId;
        let timerName = timerStates[timerId].nameInput.value || `Cronômetro ${timerId.split('-')[1]}`;
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
        saveAllTimers();
        updateTotalTimeDisplay(); // Atualiza o tempo total
    });

    function updateTimerDisplay(timerId) {
        let state = timerStates[timerId];
        if (state) {
            let currentTime = state.startTime ? Date.now() - state.startTime + state.pausedTime : state.pausedTime;
            updateDisplay(currentTime, timerId);
            updateTotalTimeDisplay();
        }
    }

    function updateDisplay(totalMilliseconds, timerId) {
        let displayElement = timerStates[timerId].display;
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
    for (let timerId in timerStates) {
        if (timerId !== currentTimerId) {
            let state = timerStates[timerId];
            if (state.startTime) {
                state.pausedTime += (Date.now() - state.startTime);
                clearInterval(state.intervalId);
                delete activeIntervals[timerId];
                state.startTime = null;
                currentlyActiveTimerId = null;
                let startButton = state.container.querySelector('.start-button');
                let pauseButton = state.container.querySelector('.pause-button');
                startButton.style.display = 'inline-block';
                pauseButton.style.display = 'none';
            }
        }
    }
    currentlyActiveTimerId = currentTimerId;
    saveAllTimers();
}

function formatTime(totalMilliseconds) {
    let totalSeconds = Math.floor(totalMilliseconds / 1000);
    let seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    let minutes = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
    let hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function updateRemoveButtonsState() {
    let removeButtons = document.querySelectorAll('.remove-button');
    removeButtons.forEach(button => {
        button.disabled = timersContainer.children.length <= 1;
    });
}

function saveAllTimers() {
    let timersData = [];
    for (let timerId in timerStates) {
        let state = timerStates[timerId];
        timersData.push({
            id: timerId,
            name: state.nameInput.value,
            pausedTime: state.pausedTime,
            startTimeOrigin: state.startTime ? state.startTime : null,
            initialName: state.initialName
        });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timersData));
}

function updateTotalTimeDisplay() {
    let totalMilliseconds = 0;
    for (let timerId in timerStates) {
        let state = timerStates[timerId];
        if (state.startTime) {
            totalMilliseconds += (Date.now() - state.startTime + state.pausedTime);
        } else {
            totalMilliseconds += state.pausedTime;
        }
    }
    totalTimeDisplay.textContent = formatTime(totalMilliseconds);
}

addTimerButton.addEventListener('click', function () {
    createTimer();
    saveAllTimers();
    updateTotalTimeDisplay(); // Atualiza o tempo total
});

clearStorageButton.addEventListener('click', function () {
    localStorage.removeItem(STORAGE_KEY);
    alert('Dados salvos foram removidos do armazenamento local.');
});

clearUnusedTimersButton.addEventListener('click', function () {
    let unusedTimers = [];

    for (let timerId in timerStates) {
        const state = timerStates[timerId];
        const isDefaultName = state.nameInput.value === state.initialName;
        const isZeroed = state.display.textContent === '00:00:00';
        const neverStarted = !state.startTime;

        if (isZeroed && neverStarted && isDefaultName) {
            unusedTimers.push(state.nameInput.value || `Cronômetro ${timerId.split('-')[1]}`);
        }
    }

    if (unusedTimers.length > 0) {
        let confirmationMessage = `Tem certeza que deseja remover os seguintes cronômetros não utilizados?\n- ${unusedTimers.join('\n- ')}`;
        if (confirm(confirmationMessage)) {
            let timersToRemove = Object.keys(timerStates).filter(timerId => {
                const state = timerStates[timerId];
                const isDefaultName = state.nameInput.value === state.initialName;
                const isZeroed = state.display.textContent === '00:00:00';
                const neverStarted = !state.startTime;
                return isZeroed && neverStarted && isDefaultName;
            });
            timersToRemove.forEach(timerId => {
                let containerToRemove = timerStates[timerId].container;
                clearInterval(timerStates[timerId].intervalId);
                delete activeIntervals[timerId];
                delete timerStates[timerId];
                containerToRemove.remove();
            });
            updateRemoveButtonsState();

            if (Object.keys(timerStates).length === 0) {
                createTimer();
            }
            saveAllTimers();
            updateTotalTimeDisplay(); // Atualiza o tempo total
        }
    } else {
        alert('Não há cronômetros não utilizados para limpar (apenas cronômetros zerados, nunca iniciados e com o nome padrão).');
    }
});

versionInfoButton.addEventListener('click', () => {
    versionInfoPopup.style.display = 'flex';
});

closeButton.addEventListener('click', () => {
    versionInfoPopup.style.display = 'none';
});

window.addEventListener('load', function () {
    let savedTimers = localStorage.getItem(STORAGE_KEY);
    timerIdCounter = 0;
    timersContainer.innerHTML = '';

    if (savedTimers) {
        let parsedTimers = JSON.parse(savedTimers);
        if (parsedTimers && parsedTimers.length > 0) {
            parsedTimers.forEach(timerData => {
                createTimer(timerData);
                let idNumber = parseInt(timerData.id.split('-')[1]);
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
    saveAllTimers();

    // Inicializa o SortableJS após carregar os timers
    let sortable = new Sortable(timersContainer, {
        animation: 150, // Tempo de animação em milissegundos
        onEnd: function (evt) {
            updateTimerOrder();
            saveAllTimers();
        }
    });

    updateTotalTimeDisplay(); // Inicializa o tempo total na carga
});

window.addEventListener('click', (event) => {
    if (event.target === versionInfoPopup) {
        versionInfoPopup.style.display = 'none';
    }
});

function updateTimerOrder() {
    let newTimerStates = {};
    let timerElements = Array.from(timersContainer.children);

    timerElements.forEach(timerElement => {
        let timerId = timerElement.id;
        newTimerStates[timerId] = timerStates[timerId];
    });

    timerStates = newTimerStates;
}