"use strict";

/* ---- Game Settings  ---- */
/** @type {number} */
const numOfSqrtBoxes = 10;
const proposedNumOfTotalMines = 15;

/* -------- */

class ABoxStyle {
    constructor(boxElement, prevStyle) {
        /** @type {HTMLDivElement} */
        this.boxElement = boxElement;
        /** @type {ABoxStyle} */
        this.prevStyle = prevStyle;
    }
    callApply() {
        this.apply();
    }

    callRevert() {
        const newStyle = this.revert();
        newStyle.callApply();
        return newStyle;
    }
}

class BoxNoneStyle extends ABoxStyle {
    apply() {

    }

    revert() {
        return this;
    }
}

class BoxSafeStyle extends ABoxStyle {
    apply() {
        this.boxElement.classList.add('box--safe');
        return this.prevStyle;
    }

    revert() {
        this.boxElement.classList.remove('box--safe');
        return this.prevStyle;
    }
}

class BoxFlagStyle extends ABoxStyle {
    apply() {
        this.boxElement.classList.add('box--flag');
        return this.prevStyle;
    }

    revert() {
        this.boxElement.classList.remove('box--flag');
        return this.prevStyle;
    }
}

class BoxMineStyle extends ABoxStyle {
    apply() {
        this.boxElement.classList.add('box--mine');
        return this.prevStyle;
    }

    revert() {
        this.boxElement.classList.remove('box--mine');
        return this.prevStyle;
    }
}

class BoxPressedStyle extends ABoxStyle {
    apply() {
        this.boxElement.classList.add('box--pressed');
    }

    revert() {
        this.boxElement.classList.remove('box--pressed');
        return this.prevStyle;
    }
}

let numOfAnimationFrameCallbacksRunning = 0;

const pendingAnimationFrameFinalCallbacks = [];

function executeInNextAnimationFrame(callback) {
    numOfAnimationFrameCallbacksRunning++;

    requestAnimationFrame(() => {
        callback();
        numOfAnimationFrameCallbacksRunning--;

        if (numOfAnimationFrameCallbacksRunning == 0) {
            if (pendingAnimationFrameFinalCallbacks.length > 0) {
                const newCallback = pendingAnimationFrameFinalCallbacks.pop();
                executeInNextAnimationFrame(newCallback);
            }
        }
    });
}

function executeAloneInSomeAnimationFrame(callback) {
    if (numOfAnimationFrameCallbacksRunning > 0) {
        pendingAnimationFrameFinalCallbacks.splice(0, 0, callback);
    }
    else {
        executeInNextAnimationFrame(callback);
    }
}

/** @type {HTMLDivElement} */
let boardElement = null;

const globalInitializers = [];
function registerGlobalInitializer(initializerFn) {
    globalInitializers.push(initializerFn);
    initializerFn();
}

/** @type {number} */
let numOfBoxes;
registerGlobalInitializer(() => {
    numOfBoxes = numOfSqrtBoxes * numOfSqrtBoxes;
});

/**
 * @type { {column: number, row: number}[HTMLDivElement] }
 * @see memorizeBoxElementCoords
 * @see getBoxCoords
 */
let mapperFromBoxElementToCoords;
registerGlobalInitializer(() => {
    mapperFromBoxElementToCoords = {};
});

/**
 * HTMLDivElement[ [column, row].toString() ]
 * 
 * @type { HTMLDivElement[string] }
 * @see memorizeBoxElementCoords
 * @see getBoxElement
 */
let mapperFromCoordsToBoxElement;
registerGlobalInitializer(() => {
    mapperFromCoordsToBoxElement = {};
});

let idNum;
registerGlobalInitializer(() => {
    idNum = 0;
});

/**
 * Set<[column, row].toString()>
 * 
 * @type { Set<string> }
 */
let mines;
registerGlobalInitializer(() => {
    mines = new Set();
});

let gamesEnds;
registerGlobalInitializer(() => {
    gamesEnds = false;
});

let flags;
registerGlobalInitializer(() => {
    flags = new Set();
});

let revealed;
registerGlobalInitializer(() => {
    revealed = new Set();
});

/**
 * @param {string} className 
 */
function reportErrorElementNotFound(className) {
    const errorMsg = `Error: .${className} Element Not Found`;
    alert(errorMsg);
    console.error(errorMsg);
}

function queryGameElements() {
    boardElement = document.querySelector('.board');
    if (boardElement == null) {
        reportErrorElementNotFound('.board');
    }
}

function initGlobals() {
    queryGameElements();

    globalInitializers.forEach((initializer) => {
        initializer();
    });
}

function initElements() {
    boardElement.style.setProperty('--num-sqrt-boxes', `${numOfSqrtBoxes}`);
    boardElement.addEventListener('contextmenu', (event) => {
        event.preventDefault()
    });

    boardElement.childNodes.forEach((child) => {
        boardElement.removeChild(child);
    });
}

function generateUniqueBoxId() {
    const newId = `box-${idNum}`;
    idNum++;
    return newId;
}

/**
 * 
 * @param {HTMLDivElement} boxElement 
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 */
function memorizeBoxElementCoords(boxElement, column, row) {
    mapperFromBoxElementToCoords[boxElement.id] = { column: column, row: row };
    mapperFromCoordsToBoxElement[[column, row].toString()] = boxElement;
}

/**
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 * @returns {HTMLDivElement}
 */
function getBoxElement(column, row) {
    return mapperFromCoordsToBoxElement[[column, row].toString()];
}

/**
 * @param {string} boxElementId
 * @returns { {column: number, row: number} }
 */
function getBoxCoordsById(boxElementId) {
    return mapperFromBoxElementToCoords[boxElementId];
}

/**
 * @param {HTMLDivElement} boxElement 
 * @returns { {column: number, row: number} }
 */
function getBoxCoords(boxElement) {
    return getBoxCoordsById(boxElement.id);
}

/**
 * 
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function isMine(column, row, minesSet) {
    minesSet = minesSet || mines;
    return minesSet.has([column, row].toString());
}

/**
 * ABoxStyle[[column, row].toString()]
 * @type { ABoxStyle[string] }
 * */
let boxStyles;
registerGlobalInitializer(() => {
    boxStyles = {};
});

/**
 * 
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 */
function setBoxStyle(column, row, newStyleType) {
    const boxElement = getBoxElement(column, row);

    const currentStyle = boxStyles[[column, row].toString()];
    const prevStyle = currentStyle != undefined ? currentStyle : new BoxNoneStyle(boxElement, null);

    const newStyle = new newStyleType(boxElement, prevStyle);
    newStyle.callApply();

    boxStyles[[column, row].toString()] = newStyle;
}


function revertBoxStyle(column, row) {
    const boxElement = getBoxElement(column, row);

    const currentStyle = boxStyles[[column, row].toString()];
    const prevStyle = currentStyle != undefined ? currentStyle.callRevert() : new BoxNoneStyle(boxElement, null);

    boxStyles[[column, row].toString()] = prevStyle;
}

/**
 * 
 * @param {HTMLDivElement} boxElement 
 */
function showBoxAsMine(boxElement) {
    boxElement.style.setProperty('background-color', 'var(--box-mine-color)');
}

/**
 * 
 * @param {number} column
 * @param {number} row
 * @returns {number}
 */
function getNumOfNearMines(column, row, minesSet) {
    return isMine(column - 1, row - 1, minesSet)
        + isMine(column - 1, row, minesSet)
        + isMine(column - 1, row + 1, minesSet)
        + isMine(column, row - 1, minesSet)
        + isMine(column, row + 1, minesSet)
        + isMine(column + 1, row - 1, minesSet)
        + isMine(column + 1, row, minesSet)
        + isMine(column + 1, row + 1, minesSet);
}

/**
 * 
 * @param {number} column
 * @param {number} row
 * @returns {number}
 */
function getNumOfNearFlags(column, row) {
    return hasFlagAt(column - 1, row - 1)
        + hasFlagAt(column - 1, row)
        + hasFlagAt(column - 1, row + 1)
        + hasFlagAt(column, row - 1)
        + hasFlagAt(column, row + 1)
        + hasFlagAt(column + 1, row - 1)
        + hasFlagAt(column + 1, row)
        + hasFlagAt(column + 1, row + 1);
}

/**
 * 
 * @param {string} mine 
 * @returns { {column: number, row: number} }
 */
function getMineCoords(mine) {
    const coords = JSON.parse('[' + mine + ']');
    const column = coords[0];
    const row = coords[1];

    return { column: column, row: row };
}

function showAllMines() {
    mines.forEach((mine) => {
        const coords = getMineCoords(mine);
        const column = coords.column;
        const row = coords.row;
        const boxElement = getBoxElement(column, row);
        showBoxAsMine(boxElement);
    });
}

/**
 * 
 * @param {HTMLDivElement} boxElement 
 */
function showBoxAsSafe(boxElement) {
    /** @type {HTMLDivElement} */
    const numberElement = boxElement.querySelector('.box-number');

    const coords = getBoxCoords(boxElement);
    const column = coords.column;
    const row = coords.row;

    revertBoxStyle(column, row);
    setBoxStyle(column, row, BoxSafeStyle);

    const numOfMines = getNumOfNearMines(column, row);
    if (numOfMines > 0) {
        numberElement.textContent = `${numOfMines}`;
    }
}

function isCoordsOutside(column, row) {
    return column > numOfSqrtBoxes || column <= 0 || row > numOfSqrtBoxes || row <= 0;
}

/**
 * @param {number} column
 * @param {number} row
 */
function revealBox(column, row) {
    if (isCoordsOutside(column, row)) {
        return;
    }

    if (isMine(column, row)) {
        return;
    }

    if (isBoxRevealed(column, row)) {
        return;
    }

    const boxElement = getBoxElement(column, row);
    showBoxAsSafe(boxElement);

    markBoxAsRevealed(column, row);

    if (getNumOfNearMines(column - 1, row) == 0)
        revealBox(column - 1, row);

    if (getNumOfNearMines(column, row - 1) == 0)
        revealBox(column, row - 1);

    if (getNumOfNearMines(column, row + 1) == 0)
        revealBox(column, row + 1);

    if (getNumOfNearMines(column + 1, row) == 0)
        revealBox(column - 1, row);

    const numOfMines = getNumOfNearMines(column, row);
    if (numOfMines == 0) {
        revealBox(column - 1, row - 1);
        revealBox(column - 1, row);
        revealBox(column - 1, row + 1);
        revealBox(column, row - 1);
        revealBox(column, row + 1);
        revealBox(column + 1, row - 1);
        revealBox(column + 1, row);
        revealBox(column + 1, row + 1);
    }
}

/**
 * 
 * @param {number} column
 * @param {number} row
 * @returns {HTMLDivElement} Box Element
 */
function generateBoxElement(column, row) {
    /** @type {HTMLDivElement} */
    const boxElement = document.createElement('div');

    boxElement.style.setProperty('--column', `${column}`);
    boxElement.style.setProperty('--row', `${row}`);
    boxElement.classList.add('box');
    boxElement.id = generateUniqueBoxId();

    const numberElement = document.createElement('div');
    numberElement.classList.add('box-number');

    boxElement.append(numberElement);

    return boxElement;
}

/**
 * @param {boolean} win 
 */
function gameOver(win) {
    doWin = win;
    gamesEnds = true;
}

function markAllWithFlags() {
    mines.forEach((value) => {
        const coords = JSON.parse(`[${value}]`);
        const column = coords[0];
        const row = coords[1];
        addFlagAt(column, row);
    });
}

function handleGameOver() {
    gamesEnds = true;

    if (doWin) {
        markAllWithFlags();
        executeAloneInSomeAnimationFrame(() => {
            alert('¡Felicitaciones Ganaste!');
        });
    }
    else {
        showAllMines();
        executeAloneInSomeAnimationFrame(() => {
            alert('Lamentablemente Perdiste');
        });
    }

    executeAloneInSomeAnimationFrame(() => {
        startNewGame();
    });
}

/**
 * 
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 */
function addFlagAt(column, row) {
    setBoxStyle(column, row, BoxFlagStyle);

    flags.add([column, row].toString());
}

/**
 * 
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function hasFlagAt(column, row) {
    return flags.has([column, row].toString());
}

/**
 * Requires: hasFlagAt(column, row) === true
 * 
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 */
function removeFlagAt(column, row) {
    flags.delete([column, row].toString());
    revertBoxStyle(column, row);
}

/**
 * 
 * @param {number} column 1 <= column <= numOfSqrtBoxes
 * @param {number} row  1 <= row <= numOfSqrtBoxes
 */
function toogleFlag(column, row) {
    if (hasFlagAt(column, row)) {
        removeFlagAt(column, row);
    }
    else {
        addFlagAt(column, row);
    }
}

function isBoxRevealed(column, row) {
    return revealed.has([column, row].toString());
}

function markBoxAsRevealed(column, row) {
    revealed.add([column, row].toString());
}

/**
 * @returns {boolean}
 */
function isAllBoxesRevealedSafetly() {
    return revealed.size == numOfBoxes - mines.size;
}

let doWin;
registerGlobalInitializer(() => {
    doWin = false;
});


function pushIfIsValidCandidate(column, row, targetArray) {
    if (!isCoordsOutside(testColumn, testRow) && !hasFlagAt(testColumn, testRow) && !isBoxRevealed(testColumn, testRow)) {
        targetArray.push([column, row].toString());
    }
}

function pressBox(column, row, propagate) {
    if (gamesEnds) {
        return;
    }

    if (isCoordsOutside(column, row)) {
        return;
    }

    if (hasFlagAt(column, row)) {
        return;
    }

    if (isBoxRevealed(column, row)) {
        if (getNumOfNearMines(column, row) == getNumOfNearFlags(column, row) && propagate) {
            propagate = false;

            pressBox(column - 1, row - 1, propagate);
            pressBox(column - 1, row, propagate);
            pressBox(column - 1, row + 1, propagate);
            pressBox(column, row - 1, propagate);
            pressBox(column, row + 1, propagate);
            pressBox(column + 1, row - 1, propagate);
            pressBox(column + 1, row, propagate);
            pressBox(column + 1, row + 1, propagate);
        }

        return;
    }

    if (isMine(column, row)) {
        const win = false;
        gameOver(win);
    }
    else {
        revealBox(column, row);
    }

    if (isAllBoxesRevealedSafetly()) {
        const win = true;
        gameOver(win);
    }
}

/**
 * 
 * @param {HTMLDivElement} boxElement
 */
function boxPressedHandler(boxElement) {
    const coords = getBoxCoords(boxElement);
    const column = coords.column;
    const row = coords.row;

    executeInNextAnimationFrame(() => {
        const propagate = true;
        pressBox(column, row, propagate);

        if (gamesEnds) {
            if (!doWin && revealed.size == 0 && flags.size == 0) {
                executeAloneInSomeAnimationFrame(() => {
                    startNewGame();
                    const newBoxElement = getBoxElement(column, row);
                    boxPressedHandler(newBoxElement);
                });
                return;
            }

            handleGameOver(doWin);
        }
    });
}

/**
 * 
 * @param {HTMLDivElement} boxElement 
 */
function boxMarkFlagHandler(boxElement) {
    if (gamesEnds) {
        return;
    }

    const coords = getBoxCoords(boxElement);
    const column = coords.column;
    const row = coords.row;

    if (isBoxRevealed(column, row)) {
        return;
    }

    executeInNextAnimationFrame(() => {
        toogleFlag(column, row);
    });
}

let _downPressedBox;
registerGlobalInitializer(() => {
    _downPressedBox = null;
});


let callbackPrevEvent;
registerGlobalInitializer(() => {
    callbackPrevEvent = [];
})

function callPreEventCallbacks() {
    callbackPrevEvent.forEach((callback) => {
        callback();
    });
    callbackPrevEvent = [];
}

function registerPreEventCallback(callback) {
    callbackPrevEvent.push(callback);
}

/**
 * @param {HTMLDivElement} boxElement 
 */
function assignBoxEvents(boxElement) {
    boxElement.addEventListener('pointerdown', (event) => {
        const LEFT_BUTTON = 0;
        if (event.button != LEFT_BUTTON) {
            return;
        }

        callPreEventCallbacks();

        const boxElement = event.currentTarget;
        _downPressedBox = boxElement.id;

        const coords = getBoxCoords(boxElement);
        const column = coords.column;
        const row = coords.row;

        setBoxStyle(column, row, BoxPressedStyle);

        registerPreEventCallback(() => {
            revertBoxStyle(column, row);
        });
    });

    boxElement.addEventListener('pointerup', (event) => {
        const LEFT_BUTTON = 0;
        if (event.button != LEFT_BUTTON) {
            return;
        }

        callPreEventCallbacks();

        const currentDownPressedBox = _downPressedBox;
        const newDownPressedBox = null;
        _downPressedBox = newDownPressedBox;

        const currentUpPressedBox = event.currentTarget.id;
        if (currentDownPressedBox !== currentUpPressedBox) {
            boxMarkFlagHandler(document.getElementById(currentDownPressedBox));
            return;
        }

        boxPressedHandler(event.currentTarget);

    });

    boxElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();

        callPreEventCallbacks();
        boxMarkFlagHandler(event.currentTarget);
    });
}

function forEachCoord(func) {
    for (let column = 1; column <= numOfSqrtBoxes; column++) {
        for (let row = 1; row <= numOfSqrtBoxes; row++) {
            func(column, row);
        }
    }
}

function resize() {
    const computedBoxWidth = boardElement.querySelector('.box').getBoundingClientRect().width;
    const boxFontSize = 32 * computedBoxWidth / 60;

    boardElement.style.setProperty('--box-font-size', boxFontSize + 'px');
}

function generateBoxes() {
    /** @type {DocumentFragment} */
    const fragment = document.createDocumentFragment();

    forEachCoord(
        /**
         * @param {number} column 1 <= column <= numOfSqrtBoxes
         * @param {number} row  1 <= row <= numOfSqrtBoxes
         */
        (column, row) => {
            const boxElement = generateBoxElement(column, row);

            memorizeBoxElementCoords(boxElement, column, row);
            assignBoxEvents(boxElement);

            fragment.append(boxElement);
        }
    );

    boardElement.append(fragment);
    resize();
}

/**
 * @param {number} num 1 <= num
 * @returns {Uint8Array}
 */
function genCryptoRandomUint32(num) {
    const array = new Uint32Array(num);
    window.crypto.getRandomValues(array);
    return array;
}

function generateMineCandidates() {
    const coords = [];

    forEachCoord(
        /**
         * @param {number} column 1 <= column <= numOfSqrtBoxes
         * @param {number} row  1 <= row <= numOfSqrtBoxes
         */
        (column, row) => {
            coords.push([column, row].toString());
        }
    );

    const randomBuf = genCryptoRandomUint32(proposedNumOfTotalMines);

    const candidates = new Set();
    randomBuf.forEach((value) => {
        const candidatesLength = coords.length;
        if (candidatesLength > 0) {
            const index = value % candidatesLength;

            candidates.add(coords[index]);
            coords.splice(index, 1);
        }
    });

    return candidates;
}

function generateMines() {
    const candidates = generateMineCandidates();
    console.assert(mines.size == 0);
    candidates.forEach(x => mines.add(x));
}

function startNewGame() {
    initGlobals();
    initElements();
    generateBoxes();
    generateMines();
};

window.onload = function () {
    executeAloneInSomeAnimationFrame(() => {
        startNewGame();
    });
};

window.onresize = function () {
    executeAloneInSomeAnimationFrame(() => {
        resize();
    });
};

/**
 * @see https://stackoverflow.com/questions/71649638/prevent-context-menu-in-edge-when-text-is-selected
 */
window.onmouseup = function (event) {
    event.preventDefault();
};

window.ondragend = function (event) {
    event.preventDefault();
};
