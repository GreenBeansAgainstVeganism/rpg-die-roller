import Parser from './parser.js';

const LOGHISTORYLENGTH = 100;

/**list of strings currently in the log. use dieRollerLog() to change*/
let log_lines = [];

/**list of user defined elements that are accessible via <> references in dicescript */
let elements = [];

// getting all the html elements we'll need for later
const logElement = document.getElementById('log-text');
const logScreenElement = document.getElementById('log');
const commandElement = document.getElementById('command-entry');
const logSubmitElement = document.getElementById('log-submit');
const logClearElement = document.getElementById('log-clear');
const elementTableElement = document.getElementById('element-tbody');

/**
 * Print text to the log
 * @param  {...any} lines single line strings to print to the log. Each string counts as 1 line for the purposes of history length
 */
const dieRollerLog = function (...lines) {
    log_lines.push(...lines);
    while (log_lines.length > LOGHISTORYLENGTH) log_lines.shift();
    logElement.innerText = log_lines.join('\n');
    logScreenElement.scrollTop = logScreenElement.scrollHeight;
}

/**
 * Clear the log
 */
const dieRollerLogClear = function () {
    log_lines = ['~~ log cleared ~~'];
    logElement.innerText = '~~ log cleared ~~';
    logScreenElement.scrollTop = logScreenElement.scrollHeight;
}

/**
 * Represents an element in dicescript, whose value/formula can be referenced by other scripts. This is an immutable object.
 */
class dsElement {
    /**
     * Create a new dsElement
     * @param {String} name name of the element
     * @param {String} category valid categories: Stat, Equipment, Check
     * @param {String} code The command associated with this element
     */
    constructor(name, category, code) {
        this.name = name;
        this.category = category;
        this.code = code;

        Object.freeze(this);
    }

    roll() {
        executeCommand(this.code);
    }
}

/**
 * Adds an element to the internal table of referenceable elements as well as to the visual table in the ui.
 * @param {dsElement} item element to be added to the table
 * @returns true if the element was successfully added and false otherwise
 */
const addElement = function (item) {
    if (elements.some(x => x.name == item.name)) return false; /* cannot have duplicate named elements */
    elements.push(item);

    // Creating the dom elements
    const tr = document.createElement('tr');
    const cells = Array(4).fill(0).map(() => document.createElement('td'));
    cells[0].append(item.name);
    cells[1].append(item.category);
    cells[2].append(item.code);

    const buttons = Array(3).fill(0).map(() => document.createElement('button'));
    buttons[0].append('Roll!');
    buttons[0].classList.add('roll-button');
    buttons[0].addEventListener('click', () => item.roll());
    buttons[1].append('Edit');
    buttons[1].addEventListener('click', ev => {

    });
    buttons[2].append('Delete');
    buttons[2].addEventListener('click', ev => {

    });

    cells[3].append(...buttons);
    tr.append(...cells);
    elementTableElement.appendChild(tr);
}

const parser = new Parser(dieRollerLog, elements);

/**
 * Runs a command and outputs to log
 * @param {String} code the dicescript command to run
 */
const executeCommand = function (code) {
    if (code == '') return;
    dieRollerLog('> ' + code);
    const parseResult = parser.parseCommand(code.replaceAll(/\s/g, ''));
    switch (parser.parseErr)
    {
        case 0:
            dieRollerLog('Result: ' + parseResult);
            break;
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
            dieRollerLog('Error: Could not find element');
            break;
        case 9:
            dieRollerLog('Error: Element ill-defined');
            break;
        case 10:
            dieRollerLog('Error: Self-referential element');
            break;
        default:
            dieRollerLog('Unnamed Error');
    }
}

/** Event handler for the command element */
const submitCommand = function () {
    executeCommand(commandElement.value);
    commandElement.value = '';
}

commandElement.addEventListener('keydown', ev => {
    if (ev.key == 'Enter') submitCommand();
})

logSubmitElement.addEventListener('click', submitCommand);

logClearElement.addEventListener('click', dieRollerLogClear);

addElement(new dsElement('Strength', 'Stat', '4'));
addElement(new dsElement('Dexterity', 'Stat', '2'));
addElement(new dsElement('Broadsword', 'Equipment', '2d8+[Strength]'));
addElement(new dsElement('Longbow', 'Equipment', '2d6+[Dexterity]'));
addElement(new dsElement('Recursion', 'Misc', 'd20+[Recursion]'));


dieRollerLog('Welcome!', 'Enter what you\'d like to roll below:', '(Check out the help tab for more info!)');
commandElement.focus();