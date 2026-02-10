if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.log(err));
    });
}

const listsWrapper = document.getElementById('listsWrapper');
const addListButton = document.getElementById('addListButton');

// Botões do Modal de Configurações
const dragToggleInput = document.getElementById('dragToggleInput');
const themeToggleInput = document.getElementById('themeToggleInput');
const clearStorageButton = document.getElementById('clearStorageButton');
const clearUnusedTimersButton = document.getElementById('clearUnusedTimersButton');

// Botões de Topo e Modais
const versionInfoButton = document.getElementById('versionInfoButton');
const versionInfoPopup = document.getElementById('versionInfoPopup');
const donationButton = document.getElementById('donationButton');
const donationPopup = document.getElementById('donationPopup');
const settingsButton = document.getElementById('settingsButton');
const settingsPopup = document.getElementById('settingsPopup');
const closeButtons = document.querySelectorAll('.close-button');

let timerIdCounter = 0;
let listIdCounter = 0;
let activeIntervals = {};
let currentlyActiveTimerId = null;
let timerStates = {};
let activeListId = null;
const STORAGE_KEY = 'MultiTimeTrackerData_v2'; 
const OLD_STORAGE_KEY = 'MultiTimeTrackerTimersState'; 
const THEME_KEY = 'MultiTimeTrackerTheme';
let listSortable = null;
let isDraggingEnabled = true;

// Lógica de Tema
themeToggleInput.addEventListener('change', function() {
    if (this.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem(THEME_KEY, 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem(THEME_KEY, 'light');
    }
});

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if(themeToggleInput) themeToggleInput.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if(themeToggleInput) themeToggleInput.checked = false;
    }
}

function createList(savedListState = null, prepend = true) {
    let listId;

    if (savedListState && savedListState.id) {
        listId = savedListState.id;
        const idNum = parseInt(listId.split('-')[1]);
        if (idNum > listIdCounter) listIdCounter = idNum;
    } else {
        listIdCounter++;
        listId = `list-${listIdCounter}`;
    }

    const listSection = document.createElement('div');
    listSection.classList.add('list-section');
    listSection.id = listId;

    const header = document.createElement('div');
    header.classList.add('list-header');
    if(isDraggingEnabled) header.classList.add('draggable-handle');

    const leftGroup = document.createElement('div');
    leftGroup.classList.add('header-left-group');

    const toggleIcon = document.createElement('span');
    toggleIcon.textContent = '▼'; 
    toggleIcon.classList.add('list-toggle-icon');

    const listNameInput = document.createElement('input');
    listNameInput.type = 'text';
    listNameInput.classList.add('list-name-input');
    listNameInput.value = (savedListState && savedListState.title) ? savedListState.title : `Lista ${listIdCounter}`;
    listNameInput.placeholder = "Nome da Lista";
    listNameInput.addEventListener('input', () => saveAllData());
    listNameInput.addEventListener('click', (e) => e.stopPropagation()); 

    leftGroup.appendChild(toggleIcon);
    leftGroup.appendChild(listNameInput);

    const rightGroup = document.createElement('div');
    rightGroup.classList.add('header-right-group');

    const totalDisplay = document.createElement('div');
    totalDisplay.classList.add('list-total-display');
    totalDisplay.textContent = '00:00:00';
    totalDisplay.id = `total-${listId}`;

    const removeListBtn = document.createElement('button');
    removeListBtn.textContent = 'X';
    removeListBtn.title = 'Remover Lista';
    removeListBtn.classList.add('remove-list-button');
    removeListBtn.onclick = (e) => {
        e.stopPropagation(); 
        removeList(listId);
    };

    rightGroup.appendChild(totalDisplay);
    rightGroup.appendChild(removeListBtn);
    header.appendChild(leftGroup);
    header.appendChild(rightGroup);

    // --- TOOLBAR ---
    const toolbar = document.createElement('div');
    toolbar.classList.add('list-toolbar');

    const addTimerBtnLocal = document.createElement('button');
    addTimerBtnLocal.classList.add('btn-list-icon-action', 'btn-add-timer');
    addTimerBtnLocal.title = "Adicionar Novo Timer";
    addTimerBtnLocal.innerHTML = '+'; 
    addTimerBtnLocal.onclick = (e) => {
        e.stopPropagation();
        setActiveList(listId); 
        createTimer(null, listId);
        saveAllData();
    };

    const resetListBtnLocal = document.createElement('button');
    resetListBtnLocal.classList.add('btn-list-icon-action', 'btn-reset-list');
    resetListBtnLocal.title = "Resetar Todos os Timers";
    resetListBtnLocal.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"/></svg>';
    resetListBtnLocal.onclick = (e) => {
        e.stopPropagation();
        resetListTimers(listId);
    };

    toolbar.appendChild(addTimerBtnLocal);
    toolbar.appendChild(resetListBtnLocal);

    const innerContainer = document.createElement('div');
    innerContainer.classList.add('timers-container-inner');
    innerContainer.id = `container-${listId}`;

    listSection.appendChild(header);
    listSection.appendChild(toolbar);
    listSection.appendChild(innerContainer);

    if (savedListState && savedListState.collapsed) {
        listSection.classList.add('collapsed');
    }

    if (prepend) {
        listsWrapper.insertBefore(listSection, listsWrapper.firstChild);
    } else {
        listsWrapper.appendChild(listSection);
    }

    initializeSortableForList(innerContainer);

    listSection.addEventListener('click', () => {
        setActiveList(listId);
    });

    header.addEventListener('click', () => {
        listSection.classList.toggle('collapsed');
        saveAllData();
    });

    if (!savedListState || !savedListState.id) {
        setActiveList(listId);
    }

    return { listId, innerContainer };
}

function resetListTimers(targetListId) {
    const listEl = document.getElementById(targetListId);
    const titleInput = listEl.querySelector('.list-name-input');
    const listName = titleInput ? titleInput.value : 'esta lista';
    if (!confirm(`Deseja ZERAR todos os cronômetros de "${listName}"?`)) return;
    const innerContainer = listEl.querySelector('.timers-container-inner');
    Array.from(innerContainer.children).forEach(timerEl => {
        const timerId = timerEl.id;
        const state = timerStates[timerId];
        if (state) {
            if(state.intervalId) clearInterval(state.intervalId);
            delete activeIntervals[timerId];
            state.startTime = null;
            state.pausedTime = 0;
            updateDisplay(0, timerId);
            updateDecimalDisplay(0, timerId);
            const startBtn = timerEl.querySelector('.start-button');
            const pauseBtn = timerEl.querySelector('.pause-button');
            if(startBtn) { startBtn.textContent = 'Iniciar'; startBtn.style.display = 'inline-block'; }
            if(pauseBtn) pauseBtn.style.display = 'none';
            timerEl.classList.remove('active');
            if (currentlyActiveTimerId === timerId) currentlyActiveTimerId = null;
        }
    });
    updateAllListsTotals();
    saveAllData();
}

function setActiveList(listId) {
    activeListId = listId;
    document.querySelectorAll('.list-section').forEach(el => el.classList.remove('active-list'));
    const activeEl = document.getElementById(listId);
    if (activeEl) activeEl.classList.add('active-list');
}

function removeList(listId) {
    const listEl = document.getElementById(listId);
    const titleInput = listEl.querySelector('.list-name-input');
    const listName = titleInput ? titleInput.value : 'esta lista';
    if (!confirm(`Tem certeza que deseja remover a lista "${listName}" e todos os seus cronômetros?`)) return;
    const innerContainer = listEl.querySelector('.timers-container-inner');
    Array.from(innerContainer.children).forEach(timerEl => removeTimer(timerEl.id, false));
    listEl.remove();
    if (activeListId === listId) {
        const firstList = listsWrapper.querySelector('.list-section');
        if (firstList) setActiveList(firstList.id);
        else activeListId = null;
    }
    saveAllData();
}

function createTimer(savedState = null, targetListId = null) {
    if (!targetListId && !activeListId) { createList(); }
    const destListId = targetListId || activeListId;
    const targetContainer = document.getElementById(`container-${destListId}`);
    if (!targetContainer) return;

    timerIdCounter++;
    let timerId = savedState ? savedState.id : `timer-${timerIdCounter}`;
    if (savedState) {
        const idNum = parseInt(timerId.split('-')[1]);
        if (idNum > timerIdCounter) timerIdCounter = idNum;
    }

    let container = document.createElement('div');
    container.classList.add('timer-container');
    container.id = timerId;
    if(isDraggingEnabled){ container.classList.add('draggable'); }

    // BOTÃO FECHAR (X)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.classList.add('timer-close-btn');
    closeBtn.title = 'Remover Cronômetro';
    closeBtn.dataset.timerId = timerId;
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeTimer(this.dataset.timerId, true);
    });
    container.appendChild(closeBtn);

    let nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('timer-name-input');
    nameInput.value = savedState ? savedState.name : `Cronômetro ${timerIdCounter}`;
    nameInput.maxLength = 30;
    const initialName = nameInput.value;

    let title = document.createElement('h2');
    title.classList.add('timer-title');
    title.textContent = nameInput.value;

    let display = document.createElement('div');
    display.classList.add('timer-display');
    display.textContent = '00:00:00';

    let decimalDisplay = document.createElement('div');
    decimalDisplay.classList.add('timer-inDecimal');
    decimalDisplay.textContent = '0.00';

    let controls = document.createElement('div');
    controls.classList.add('controls');

    let startButton = document.createElement('button');
    startButton.textContent = (savedState && savedState.pausedTime > 0) ? 'Retomar' : 'Iniciar';
    startButton.classList.add('start-button');
    startButton.dataset.timerId = timerId;
    startButton.style.display = savedState && savedState.startTimeOrigin ? 'none' : 'inline-block';
    
    let pauseButton = document.createElement('button');
    pauseButton.textContent = 'Pausar';
    pauseButton.classList.add('pause-button');
    pauseButton.dataset.timerId = timerId;
    pauseButton.style.display = savedState && savedState.startTimeOrigin ? 'inline-block' : 'none';

    let resetButton = document.createElement('button');
    resetButton.textContent = 'Resetar';
    resetButton.classList.add('reset-button');
    resetButton.dataset.timerId = timerId;

    controls.appendChild(startButton);
    controls.appendChild(pauseButton);
    controls.appendChild(resetButton);

    container.appendChild(nameInput);
    container.appendChild(title);
    container.appendChild(display);
    container.appendChild(decimalDisplay);
    container.appendChild(controls);

    if (savedState) { targetContainer.appendChild(container); } else { targetContainer.prepend(container); }

    timerStates[timerId] = { container, startTime: null, pausedTime: savedState ? savedState.pausedTime || 0 : 0, intervalId: null, nameInput, title, display, decimalDisplay, initialName };

    nameInput.addEventListener('input', function () { title.textContent = this.value; saveAllData(); });
    
    // CORREÇÃO: Usar display 'block' ao invés de 'flex'
    title.addEventListener('click', function () { 
        title.style.display = 'none'; 
        nameInput.style.display = 'block'; 
        nameInput.focus(); 
        nameInput.select(); 
    });
    
    nameInput.addEventListener('keydown', function (e) { 
        if (e.key === 'Enter' || e.key === 'Escape') { 
            // CORREÇÃO: Fallback se vazio
            if(this.value.trim() === "") {
                this.value = "Sem Nome";
                title.textContent = "Sem Nome";
            }
            title.style.display = 'block'; 
            nameInput.style.display = 'none'; 
            this.blur(); 
        } 
    });
    
    nameInput.addEventListener('blur', function () { 
        // CORREÇÃO: Fallback se vazio
        if(this.value.trim() === "") {
            this.value = "Sem Nome";
            title.textContent = "Sem Nome";
        }
        title.style.display = 'block'; 
        nameInput.style.display = 'none'; 
    });

    startButton.addEventListener('click', function () {
        let tId = this.dataset.timerId;
        pauseAllOtherTimers(tId);
        let state = timerStates[tId];
        if (!state.startTime) {
            state.startTime = Date.now();
            this.style.display = 'none';
            pauseButton.style.display = 'inline-block';
            state.intervalId = setInterval(() => updateTimerDisplay(tId), 100);
            activeIntervals[tId] = state.intervalId;
            currentlyActiveTimerId = tId;
            this.textContent = 'Retomar';
            container.classList.add('active');
        }
        saveAllData();
        updateAllListsTotals();
    });

    pauseButton.addEventListener('click', function () {
        let tId = this.dataset.timerId;
        let state = timerStates[tId];
        if (state.startTime) {
            state.pausedTime += (Date.now() - state.startTime);
            clearInterval(state.intervalId);
            delete activeIntervals[tId];
            state.startTime = null;
            startButton.style.display = 'inline-block';
            this.style.display = 'none';
            currentlyActiveTimerId = null;
            container.classList.remove('active');
        }
        saveAllData();
        updateAllListsTotals();
    });

    resetButton.addEventListener('click', function () {
        let tId = this.dataset.timerId;
        let state = timerStates[tId];
        clearInterval(state.intervalId);
        delete activeIntervals[tId];
        state.startTime = null;
        state.pausedTime = 0;
        updateDisplay(0, tId);
        updateDecimalDisplay(0, tId);
        startButton.textContent = 'Iniciar';
        startButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
        container.classList.remove('active');
        if (currentlyActiveTimerId === tId) currentlyActiveTimerId = null;
        saveAllData();
        updateAllListsTotals();
    });

    if (savedState && savedState.startTimeOrigin) {
        timerStates[timerId].startTime = Date.now() - (Date.now() - savedState.startTimeOrigin);
        timerStates[timerId].intervalId = setInterval(() => updateTimerDisplay(timerId), 100);
        activeIntervals[timerId] = timerStates[timerId].intervalId;
        currentlyActiveTimerId = timerId;
        container.classList.add('active');
    }
    updateTimerDisplay(timerId); 
    updateAllListsTotals(); 
}

function removeTimer(timerId, confirmAction) {
    let timerName = timerStates[timerId].nameInput.value;
    if (!confirmAction || confirm(`Tem certeza que deseja remover o cronômetro "${timerName}"?`)) {
        if(timerStates[timerId].intervalId) clearInterval(timerStates[timerId].intervalId);
        delete activeIntervals[timerId];
        timerStates[timerId].container.remove();
        delete timerStates[timerId];
        if (currentlyActiveTimerId === timerId) currentlyActiveTimerId = null;
        saveAllData();
        updateAllListsTotals();
    }
}

function updateTimerDisplay(timerId) {
    let state = timerStates[timerId];
    if (state) {
        let currentTime = state.startTime ? Date.now() - state.startTime + state.pausedTime : state.pausedTime;
        updateDisplay(currentTime, timerId);
        updateDecimalDisplay(currentTime, timerId);
        updateAllListsTotals(); 
    }
}

function updateDecimalDisplay(totalMilliseconds, timerId) {
    let state = timerStates[timerId];
    let hours = Math.floor(totalMilliseconds / 3600000);
    let minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
    let seconds = (totalMilliseconds % 60000) / 1000;
    let decimalTime = converterTempoParaDecimal(hours, minutes, seconds);
    state.decimalDisplay.textContent = decimalTime <= 0 ? '0.00' : decimalTime.toString();
}

function updateDisplay(totalMilliseconds, timerId) {
    let displayElement = timerStates[timerId].display;
    displayElement.textContent = formatTime(totalMilliseconds);
}

function converterTempoParaDecimal(horas, minutos, segundos) {
    const totalMinutos = horas * 60 + minutos + ((segundos / 60) >= 0.5 ? 1 : 0);
    const decimal = totalMinutos / 60;
    return parseFloat(decimal.toFixed(2));
}

function formatTime(totalMilliseconds) {
    let totalSeconds = Math.floor(totalMilliseconds / 1000);
    let seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    let minutes = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
    let hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function pauseAllOtherTimers(currentTimerId) {
    for (let tId in timerStates) {
        if (tId !== currentTimerId) {
            let state = timerStates[tId];
            if (state.startTime) {
                state.pausedTime += (Date.now() - state.startTime);
                clearInterval(state.intervalId);
                delete activeIntervals[tId];
                state.startTime = null;
                let startBtn = state.container.querySelector('.start-button');
                let pauseBtn = state.container.querySelector('.pause-button');
                if(startBtn) startBtn.style.display = 'inline-block';
                if(pauseBtn) pauseBtn.style.display = 'none';
                state.container.classList.remove('active');
            }
        } else {
            timerStates[tId].container.classList.add('active');
        }
    }
    currentlyActiveTimerId = currentTimerId;
    saveAllData();
}

function updateAllListsTotals() {
    const listSections = document.querySelectorAll('.list-section');
    listSections.forEach(listSection => {
        const listId = listSection.id;
        const innerContainer = listSection.querySelector('.timers-container-inner');
        const totalDisplay = listSection.querySelector(`#total-${listId}`);
        let listTotalMs = 0;
        Array.from(innerContainer.children).forEach(timerContainer => {
            const timerId = timerContainer.id;
            const state = timerStates[timerId];
            if (state) {
                if (state.startTime) {
                    listTotalMs += (Date.now() - state.startTime + state.pausedTime);
                } else {
                    listTotalMs += state.pausedTime;
                }
            }
        });
        if(totalDisplay) { totalDisplay.textContent = formatTime(listTotalMs); }
    });
}

function saveAllData() {
    let data = { lists: [] };
    const listSections = document.querySelectorAll('.list-section');
    listSections.forEach(listSection => {
        const titleInput = listSection.querySelector('.list-name-input');
        const isCollapsed = listSection.classList.contains('collapsed');
        let listObj = { id: listSection.id, title: titleInput ? titleInput.value : '', collapsed: isCollapsed, timers: [] };
        const innerContainer = listSection.querySelector('.timers-container-inner');
        Array.from(innerContainer.children).forEach(timerContainer => {
            const tId = timerContainer.id;
            const state = timerStates[tId];
            if (state) {
                listObj.timers.push({ id: tId, name: state.nameInput.value, pausedTime: state.pausedTime, startTimeOrigin: state.startTime || null, initialName: state.initialName });
            }
        });
        data.lists.push(listObj);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadAllData() {
    const savedJSON = localStorage.getItem(STORAGE_KEY);
    listsWrapper.innerHTML = '';
    timerStates = {};
    activeIntervals = {};
    timerIdCounter = 0;
    listIdCounter = 0;
    let loadedAnything = false;
    if (savedJSON) {
        const data = JSON.parse(savedJSON);
        if (data.lists && data.lists.length > 0) {
            data.lists.forEach(listData => {
                createList(listData, false); 
                listData.timers.forEach(timerData => createTimer(timerData, listData.id));
            });
            if(data.lists.length > 0) setActiveList(data.lists[0].id);
            loadedAnything = true;
        }
    } 
    checkAndMigrateOldData(loadedAnything);
    updateAllListsTotals();
}

function checkAndMigrateOldData(hasV2Data) {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldData) { if (!hasV2Data) initDefault(); return; }
    const existingLists = document.querySelectorAll('.list-name-input');
    let migrationListExists = false;
    existingLists.forEach(input => { if(input.value === 'Timers Antigos') migrationListExists = true; });
    if (migrationListExists) { if (!hasV2Data) initDefault(); return; }
    try {
        const oldTimers = JSON.parse(oldData);
        if (oldTimers.length > 0) {
            const listInfo = createList({ title: 'Timers Antigos' }, false);
            oldTimers.forEach(t => createTimer(t, listInfo.listId));
            if (!hasV2Data) {
                const newListInfo = createList({ title: 'Nova Lista' }, true);
                setActiveList(newListInfo.listId);
                createTimer(null, newListInfo.listId);
            }
            saveAllData(); 
            console.log("Timers antigos migrados com sucesso.");
        } else if (!hasV2Data) { initDefault(); }
    } catch(e) { console.error("Erro ao migrar dados antigos:", e); if (!hasV2Data) initDefault(); }
}

function initDefault() {
    const listInfo = createList({ title: 'Minha Lista' }, true);
    createTimer(null, listInfo.listId);
    setActiveList(listInfo.listId);
}

function initializeSortableForList(element) {
    new Sortable(element, { group: 'shared-timers', animation: 150, ghostClass: 'ghost', handle: '.draggable', onEnd: function (evt) { saveAllData(); updateAllListsTotals(); } });
}

function initializeListSorting() {
    listSortable = new Sortable(listsWrapper, { animation: 150, handle: '.list-header', ghostClass: 'ghost', filter: 'input, button', preventOnFilter: false, onEnd: function (evt) { saveAllData(); } });
}

// Lógica de Drag dentro do Modal de Settings
function habilitaSortable(){
    document.querySelectorAll('.timer-container').forEach(timer => timer.classList.add('draggable'));
    document.querySelectorAll('.list-header').forEach(header => header.classList.add('draggable-handle'));
    if(listSortable) listSortable.option("disabled", false);
    isDraggingEnabled = true;
    dragToggleInput.checked = true; // Sincroniza o toggle
}

function desabilitaSortable(){
    document.querySelectorAll('.timer-container').forEach(timer => timer.classList.remove('draggable'));
    document.querySelectorAll('.list-header').forEach(header => header.classList.remove('draggable-handle'));
    if(listSortable) listSortable.option("disabled", true);
    isDraggingEnabled = false;
    dragToggleInput.checked = false; // Sincroniza o toggle
}

addListButton.addEventListener('click', function() { const info = createList({ title: 'Nova Lista' }, true); createTimer(null, info.listId); saveAllData(); });

// Listeners do Modal de Configurações
clearStorageButton.addEventListener('click', function () { if(confirm("Deseja apagar TUDO (incluindo backups antigos)?")) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(OLD_STORAGE_KEY); localStorage.removeItem(THEME_KEY); location.reload(); } });

clearUnusedTimersButton.addEventListener('click', function () {
    let removedCount = 0;
    for (let timerId in timerStates) {
        const state = timerStates[timerId];
        const isDefaultName = state.nameInput.value === state.initialName;
        const isZeroed = state.display.textContent === '00:00:00';
        const neverStarted = !state.startTime;
        if (isZeroed && neverStarted && isDefaultName) { removeTimer(timerId, false); removedCount++; }
    }
    if (removedCount > 0) { alert(`${removedCount} cronômetros vazios removidos.`); } else { alert('Nenhum cronômetro não utilizado encontrado.'); }
    saveAllData();
});

// Listener do Toggle Switch (Checkbox)
dragToggleInput.addEventListener('change', function () {
    if (this.checked) { habilitaSortable(); } else { desabilitaSortable(); }
});

// Modais
versionInfoButton.addEventListener('click', () => { versionInfoPopup.style.display = 'flex'; });
donationButton.addEventListener('click', () => { donationPopup.style.display = 'flex'; });
settingsButton.addEventListener('click', () => { settingsPopup.style.display = 'flex'; });

closeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        if (targetId) { document.getElementById(targetId).style.display = 'none'; }
    });
});
window.addEventListener('click', (event) => {
    if (event.target === versionInfoPopup) versionInfoPopup.style.display = 'none'; 
    if (event.target === donationPopup) donationPopup.style.display = 'none';
    if (event.target === settingsPopup) settingsPopup.style.display = 'none';
});

window.addEventListener('load', function () {
    loadAllData();
    loadTheme(); 
    initializeListSorting(); 
    if(isDraggingEnabled) { habilitaSortable(); } else { desabilitaSortable(); }
});