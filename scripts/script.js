import Parser from './parser.js';

const LOGHISTORYLENGTH = 100;
const CONSOLEHISTORYLENGTH = 50;

/** Determines which tab is currently active */
let currentTab = 0;

/** list of strings currently in the log. use dieRollerLog() to change*/
let log_lines = [];

/** holds the list of previously executed commands */
let console_history = [];
let console_history_pos = -1;

/** holds the result of the last die roll, and undefined if there was an error or no rolls have happened yet */
let rollResult;

/** list of user defined formulas that are accessible via <> references in dicescript */
let formulas = [];

/** Holds the name of the currently selected formula */
let formulaSelection;

// getting all the html elements we'll need for later
const logElement = document.getElementById('log-text');
const logScreenElement = document.getElementById('log');
const commandElement = document.getElementById('command-entry');
const logSubmitElement = document.getElementById('log-submit');
const logClearElement = document.getElementById('log-clear');
const formulaTableElement = document.getElementById('formula-tbody');
const formulaNameInput = document.getElementById('formula-name-input');
const formulaCategoryInput = document.getElementById('formula-category-input');
const formulaCommandInput = document.getElementById('formula-command-input');
const formulaSaveElement = document.getElementById('formula-save');
const formulaTestElement = document.getElementById('formula-test');
const formulaDeleteElement = document.getElementById('formula-delete');
const formulaUpElement = document.getElementById('formula-up');
const formulaDownElement = document.getElementById('formula-down');
const formulaSortElement = document.getElementById('formula-sort');
const formulaNewElement = document.getElementById('formula-new');
const formulaClearElement = document.getElementById('formula-clear');
const mainElement = document.querySelector('main');
const tabButtons = document.querySelectorAll('nav button');


/**
 * Changes what tab is currently visible in the main element.
 * @param {Number} index The number tab to change to
 */
function changeTab (index) {
    currentTab = index;
    [...mainElement.children].forEach((child, i) => {
        child.style.left = `calc(-${index*2}rem - ${index}00%)`; // I hate this solution but it works
    });
}

/**
 * Print text to the log
 * @param  {...any} lines single line strings to print to the log. Each string counts as 1 line for the purposes of history length
 */
function dieRollerLog(...lines) {
    log_lines.push(...lines);
    while (log_lines.length > LOGHISTORYLENGTH) log_lines.shift();
    logElement.innerText = log_lines.join('\n');
    logScreenElement.scrollTop = logScreenElement.scrollHeight;
}

/**
 * Clear the log
 */
function dieRollerLogClear() {
    log_lines = ['~~ log cleared ~~'];
    logElement.innerText = '~~ log cleared ~~';
    logScreenElement.scrollTop = logScreenElement.scrollHeight;
}

function spawnText(message, x, y, distance = 6, duration = 3)
{
    const element = document.createElement('div');
    element.innerText = message;
    document.body.appendChild(element);
    element.style.position = 'absolute';
    element.style.textAlign = 'center';
    element.style.fontSize = '20pt';
    element.style.color = 'black';
    element.style.pointerEvents = 'none';
    element.style.pointerEvents = 'none';
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.animate([
        {
            transform: 'translatey(0)',
            opacity: 1
        },
        {
            transform: `translatey(-${distance}rem)`,
            opacity: 0
        }
    ], {
        duration: duration*1000,
        iterations: 1
    })
    // delete the element after duration ends
    window.setTimeout(() => element.remove(), duration*1000);
    return element;
}

/**
 * Represents an formula in dicescript, which can be referenced by name in other scripts. This is an immutable object.
 */
class dsFormula {
    /**
     * Create a new dsFormula
     * @param {String} name name of the formula
     * @param {String} category valid categories: Stat, Equipment, Check
     * @param {String} code The command associated with this formula
     */
    constructor(name, category, code) {
        this.name = name;
        this.category = category;
        this.code = code;

        Object.freeze(this);
    }

    roll() {
        executeCommand(`[${this.name}]`);
    }
}

/**
 * Adds an formula to the internal table of referenceable formulas as well as to the visual table in the ui.
 * @param {dsFormula} item formula to be added to the table
 * @param {boolean} replace optional: if true, will replace existing formulas with the same name
 * @returns true if the formula was successfully added and false otherwise
 */
function addFormula(item, replace = false) {
    if (formulas.some(x => x.name == item.name))
    {
        if (replace) deleteFormula(item.name);
        else return false; /* cannot have duplicate named formulas */
    }

    formulas.push(item);

    // Creating the dom elements
    const tr = document.createElement('tr');
    tr.dataset.formulaName = item.name;
    tr.title = 'Click to edit';

    const handleSelectFormula = function (ev) {
        if (ev.currentTarget.dataset.formulaName == formulaSelection) deselectFormula();
        else selectFormula(ev.currentTarget.dataset.formulaName);
        ev.stopPropagation();
    }
    tr.addEventListener('click', handleSelectFormula);

    const cells = Array(5).fill(0).map(() => document.createElement('td'));
    cells[0].dataset.category = item.category;
    cells[1].append(item.name);
    cells[2].append(item.category);
    cells[3].append(item.code);

    const button = document.createElement('button');
    button.append('Roll!');
    button.title = ''; /* cancels title showing up when hovering over button */
    button.classList.add('roll-button');
    button.addEventListener('click', (ev) => {
        item.roll();
        spawnText(rollResult === undefined ? 'ERROR' : rollResult+parser.getCritText(), ev.clientX, ev.clientY);
        ev.stopPropagation();
    });

    cells[4].append(button);
    tr.append(...cells);
    formulaTableElement.appendChild(tr);
}

/**
 * Removes the formula with a given name from both the internal table and the UI. (removes multiple if there are duplicate names)
 * @param {String} name The name of the formula to remove
 */
function deleteFormula(name) {
    let x;
    while ((x = formulas.findIndex(y => y.name == name)) >= 0)
    {
        formulas.splice(x, 1);
    }
    for (x = 0; x < formulaTableElement.children.length;)
    {
        if (formulaTableElement.children[x].dataset.formulaName == name)
        {
            formulaTableElement.children[x].remove();
        }
        else x++;
    }
}

/**
 * Changes formulaSelection and updates the UI to reflect the change.
 * @param {String} name The name of the formula to select
 */
function selectFormula(name) {
    // change formulaSelection
    formulaSelection = name;

    // apply classes to table and find row to pull data from
    for (let i = 0; i < formulaTableElement.children.length; i++)
    {
        let child = formulaTableElement.children[i];
        child.classList.toggle(
            'selected',
            child.dataset.formulaName == name);
    }

    // populate edit panel
    let formula = formulas.find(x => x.name == name);
    formulaNameInput.value = name;
    formulaCategoryInput.value = formula.category;
    formulaCommandInput.value = formula.code;

    formulaNameInput.disabled = false;
    formulaCategoryInput.disabled = false;
    formulaCommandInput.disabled = false;
    formulaSaveElement.disabled = false;
    formulaTestElement.disabled = false;
    formulaDeleteElement.disabled = false;
    formulaUpElement.disabled = false;
    formulaDownElement.disabled = false;
}

/**
 * Sets formulaSelection to undefined and updates the UI to reflect the change.
 */
function deselectFormula() {
    // change formulaSelection
    formulaSelection = undefined;

    // apply classes to table and find row to pull data from
    for (let i = 0; i < formulaTableElement.children.length; i++)
    {
        let child = formulaTableElement.children[i];
        child.classList.remove('selected');
    }

    // disable edit panel
    formulaNameInput.disabled = true;
    formulaCategoryInput.disabled = true;
    formulaCommandInput.disabled = true;
    formulaSaveElement.disabled = true;
    formulaTestElement.disabled = true;
    formulaDeleteElement.disabled = true;
    formulaUpElement.disabled = true;
    formulaDownElement.disabled = true;

    formulaNameInput.value = '';
    formulaCategoryInput.value = '';
    formulaCommandInput.value = '';
}


/**
 * Sort the rows of the formula table.
 * @param {function} compareFn compare function to use (same format as Array.prototype.sort)
 */
function sortFormulaTable(compareFn) {
    let rows = [...formulaTableElement.children];

    rows.sort(compareFn);

    rows.forEach(x => formulaTableElement.appendChild(x));
}

// Some compare functions
const categoryOrder = ['Action','Check','Modifier','Stat','Status Effect','Misc'];
const sortByName = (row1, row2) => row1.dataset.formulaName.localeCompare(row2.dataset.formulaName);
const sortByCategory = (row1, row2) => {
    return  categoryOrder.indexOf(formulas.find(x => x.name == row1.dataset.formulaName).category) -
            categoryOrder.indexOf(formulas.find(x => x.name == row2.dataset.formulaName).category);
}
const sortByCategoryName = (row1, row2) => {
    const s = sortByCategory(row1,row2);
    return s === 0 ? sortByName(row1,row2) : s;
}

const parser = new Parser(dieRollerLog, formulas);

/**
 * Runs a command and outputs to log
 * @param {String} code the dicescript command to run
 */
function executeCommand(code) {
    if (code.match(/^\s*$/)) return;
    dieRollerLog('> ' + code);

    // add command to history
    console_history_pos = -1;
    if(console_history[0] != code)
    {
        console_history.unshift(code);
        while(console_history.length > CONSOLEHISTORYLENGTH) console_history.pop();
    }

    const parseResult = parser.parseCommand(code);
    switch (parser.parseErr)
    {
        case 0:
            dieRollerLog('Result: ' + parseResult + parser.getCritText());
            rollResult = parseResult[0];
            return;
        case 1:
            dieRollerLog('Error: Unrecognized syntax');
            break;
        case 2:
            dieRollerLog('Error: Unexpected end of expression');
            break;
        case 3:
            dieRollerLog('Error: Unexpected symbol');
            break;
        case 4:
            dieRollerLog('Error: Invalid number of dice');
            break;
        case 5:
            dieRollerLog('Error: Invalid number of sides');
            break;
        case 6:
            dieRollerLog('Error: Mismatched parentheses');
            break;
        case 7:
            dieRollerLog('Error: Invalid advantage level');
            break;
        case 8:
            dieRollerLog('Error: Could not find formula');
            break;
        case 9:
            dieRollerLog('Error: Formula ill-defined');
            break;
        case 10:
            dieRollerLog('Error: Self-referential formula');
            break;
        default:
            dieRollerLog('Unnamed Error');
    }
    rollResult = undefined;
}

// Adding event handlers

/** Event handler for tab buttons */
for (let b of tabButtons.entries()) {
    b[1].addEventListener('click', ev => changeTab(b[0]));
}

/** Event handler for the command element */
const handleSubmitCommand = function () {
    executeCommand(commandElement.value);
    commandElement.value = '';
}

commandElement.addEventListener('keydown', ev => {
    if(currentTab != 0) return;
    if (ev.key == 'Enter') handleSubmitCommand();
    else if (ev.key == 'ArrowUp')
    {
        if(console_history_pos < console_history.length-1) console_history_pos++;
        if(console_history_pos > -1) {
            commandElement.value = console_history[console_history_pos];
        }
        ev.stopPropagation();
    }
    else if (ev.key == 'ArrowDown')
    {
        if(console_history_pos > -1)
        {
            console_history_pos--;
            commandElement.value = console_history_pos > -1 ? console_history[console_history_pos] : '';
        }
        ev.stopPropagation();
    }
})

logSubmitElement.addEventListener('click', handleSubmitCommand);

logClearElement.addEventListener('click', dieRollerLogClear);

formulaTableElement.addEventListener('click', deselectFormula);
document.addEventListener('keydown', ev => {
    if(ev.key == 'Escape') deselectFormula();
})

/** Event handler for saving formulas */
const handleSaveFormula = function () {
    if(!formulaNameInput.value.match(/^[^\[\]]+$/))
    {
        window.alert('Your formula name cannot contain square bracket characters: [ ]\nNo changes were saved');
        return;
    }
    deleteFormula(formulaSelection);
    addFormula(new dsFormula(formulaNameInput.value, formulaCategoryInput.value, formulaCommandInput.value));
    selectFormula(formulaNameInput.value);
}

formulaSaveElement.addEventListener('click', handleSaveFormula);

/** Event handler for testing formulas */
const handleTestFormula = function () {
    executeCommand(formulaCommandInput.value);
}

formulaTestElement.addEventListener('click', handleTestFormula);

/** Event handler for deleting formulas */
const handleDeleteFormula = function () {
    if(!window.confirm(`Are you sure you want to delete the formula [${formulaSelection}]? (This action is not reversible.)`))
        return;
    deleteFormula(formulaSelection);
    deselectFormula();
}

formulaDeleteElement.addEventListener('click', handleDeleteFormula);

/** Event handler for moving formula up */
const handlemoveFormulaUp = function() {
    const row = [...formulaTableElement.children].find(x => x.dataset.formulaName == formulaSelection)
    if(row.previousElementSibling) row.after(row.previousElementSibling);
    return;
}
formulaUpElement.addEventListener('click', handlemoveFormulaUp);

/** Event handler for moving formula down */
const handlemoveFormulaDown = function() {
    const row = [...formulaTableElement.children].find(x => x.dataset.formulaName == formulaSelection)
    if(row.nextElementSibling) row.before(row.nextElementSibling);
    return;
}
formulaDownElement.addEventListener('click', handlemoveFormulaDown);

formulaSortElement.addEventListener('click', ev => sortFormulaTable(sortByCategoryName));

/** Event handler for creating a new formula */
const handleNewFormula = function () {
    let name = 'New Formula';
    if(formulas.some(x => x.name == 'New Formula'))
    {
        let i = 1;
        while(formulas.some(x => x.name == 'New Formula '+i)) i++;
        name = 'New Formula '+i;
    }
    addFormula(new dsFormula(name, 'Misc', '1d6'));
    selectFormula(name);
    formulaNameInput.focus();
}

formulaNewElement.addEventListener('click', handleNewFormula);

const handleClearFormulas = function () {
    if(!window.confirm(`Are you sure you want to clear all formulas? (This action is not reversible.)`))
        return;
    formulas = [];
    [...formulaTableElement.children].forEach(child => child.remove());
}

formulaClearElement.addEventListener('click', handleClearFormulas);

// global key events
document.addEventListener('keydown', ev => {
    if(currentTab != 0) return;
    if(ev.key == 'ArrowUp' && formulaSelection)
    {
        handlemoveFormulaUp();
    }
    else if(ev.key == 'ArrowDown' && formulaSelection)
    {
        handlemoveFormulaDown();
    }
})

// Preloaded formulas
addFormula(new dsFormula('20-sided die', 'Misc', 'D20'));
addFormula(new dsFormula('10-sided die', 'Misc', 'd10'));
addFormula(new dsFormula('8-sided die', 'Misc', 'd8'));
addFormula(new dsFormula('6-sided die', 'Misc', 'd6'));
addFormula(new dsFormula('4-sided die', 'Misc', 'd4'));
addFormula(new dsFormula('100-sided die', 'Misc', 'd100'));
deselectFormula();


dieRollerLog('Welcome!', 'Enter what you\'d like to roll below, or roll one of the formulas to the left:', '(Check out the help tab for more info!)');
commandElement.focus();