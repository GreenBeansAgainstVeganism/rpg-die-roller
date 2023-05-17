import Parser from './parser.js';
import profileTemplates from './profile_templates.js';

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
const profileExport = document.getElementById('profile-export');
const profileImport = document.getElementById('profile-import');
const exportDialog = document.getElementById('export-dialog');
const importDialog = document.getElementById('import-dialog');
const exportCopy = document.getElementById('export-copy');
const exportSave = document.getElementById('export-save');
const exportDone = document.getElementById('export-done');
const importConfirm = document.getElementById('import-confirm');
const importFile = document.getElementById('import-file');
const importCancel = document.getElementById('import-cancel');
const exportText = document.getElementById('export-text');
const importText = document.getElementById('import-text');
const profileTemplateRows = document.getElementById('profile-template-rows');

/**
 * Changes what tab is currently visible in the main element.
 * @param {Number} index The number tab to change to
 */
function changeTab (index) {
    tabButtons.item(currentTab).classList.remove('selected');
    currentTab = index;
    [...mainElement.children].forEach((child, i) => {
        child.style.left = `calc(-${index*2}rem - ${index}00%)`; // I hate this solution but it works
    });
    tabButtons.item(index).classList.add('selected');
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

/**
 * Generates a splash text element.
 * @param {String} message text to display
 * @param {Number} x x coordinate on the screen
 * @param {Number} y y coordinate on the screen
 * @param {Object} options... set the distance, duration, class, and parent of the element. Parent must be specified for
 * text inside dialog boxes because otherwise the text will render behind the dialog and be invisible.
 * @returns a reference to the generated element.
 */
function spawnText(message, x, y, {distance = 5, duration = 2.5, bonusClass, parent = document.body} = {})
{
    const element = document.createElement('div');
    element.innerText = message;
    parent.appendChild(element);
    element.classList.add('splash');
    if(bonusClass) element.classList.add(bonusClass);
    element.style.left = x + 'px';
    element.style.top = y - 40 + 'px';
    element.animate([
        {
            transform: 'translate(-50%, 0)',
            opacity: 1,
            easing: 'cubic-bezier(0.2,0.8,0.2,0.8)'
        },
        {
            transform: `translate(-50%, -${distance}rem)`,
            opacity: 0
        }
    ], {
        duration: duration*1000+1, /* needs to be 1 ms longer than the timeout duration to avoid blipping */
        iterations: 1
    })
    // delete the element after duration ends
    window.setTimeout(() => {
        element.remove();
    }, duration*1000);
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
        spawnText(
            rollResult === undefined ? 'ERROR' : rollResult+parser.getCritText(),
            ev.x + Math.random()*16,
            ev.y + Math.random()*16);
        ev.stopPropagation();
    });

    cells[4].append(button);
    tr.append(...cells);
    formulaTableElement.appendChild(tr);
}

/**
 * Removes the formula with a given name from both the internal table and the UI. (removes multiple if there are duplicate names)
 * @param {String} name The name of the formula to remove
 * @returns the index in the table of the formula deleted.
 */
function deleteFormula(name) {
    let x, index;
    while ((x = formulas.findIndex(y => y.name == name)) >= 0)
    {
        formulas.splice(x, 1);
    }
    for (x = 0; x < formulaTableElement.children.length;)
    {
        if (formulaTableElement.children[x].dataset.formulaName == name)
        {
            formulaTableElement.children[x].remove();
            index = x;
        }
        else x++;
    }
    console.log(formulas);
    return index;
}

/**
 * Swaps an element in the formula table with the element directly proceeding it.
 * @param {Number} a The index of the first element to swap
 */
function swapFormula(a) {
    const x = formulaTableElement.children[a]
    x.before(x.nextElementSibling);
}

/**
 * Shifts an element in the formula table up or down until it resides at a particular index.
 * @param {String} name The name of the element to move
 * @param {Number} loc The index to move the element to
 */
function shiftFormula(name, loc) {
    let n = [...formulaTableElement.children].findIndex(x => x.dataset.formulaName == name);
    while(n < loc) {
        swapFormula(n);
        n++;
    }
    while(n > loc) {
        n--;
        swapFormula(n);
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
 * Deletes all formulas
 */
function clearFormulas() {
    formulas.splice(0);
    [...formulaTableElement.children].forEach(child => child.remove());
    deselectFormula();
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

/**
 * Loads the data from a profile object
 * @param {Object} profile a list of objects containing formula data
 * 
 * @returns {Boolean} whether the load was successful or not.
 */
function loadProfile (profile) {
    // Edge case where profile is empty
    if(profile.length == 0)
    {
        clearFormulas();
        return true;
    }

    // Return false if there's an error with the json structure
    if(!profile.reduce(
        (flag, obj) => flag && typeof(obj) == "object" && obj.name && obj.category && obj.code)) return false;
    
    // Clear existing formulas
    clearFormulas();

    // for each object in the profile data, convert to a dsFormula and add it
    profile.forEach(obj => addFormula(new dsFormula(obj.name, obj.category, obj.code)));
    return true;
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
    // Delete the previous formula and save its table index
    const index = deleteFormula(formulaSelection);
    // Add new formula with new data
    addFormula(new dsFormula(formulaNameInput.value, formulaCategoryInput.value, formulaCommandInput.value));
    // Select the new formula
    selectFormula(formulaNameInput.value);
    // Shift the new formula to the old one's position
    if(index != undefined) shiftFormula(formulaSelection, index);
    // scroll the table element to make sure the formula is in view
    formulaTableElement.children[index].scrollIntoView();
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
    [...formulaTableElement.children].find(x => x.dataset.formulaName == name).scrollIntoView();
    formulaNameInput.focus();
}

formulaNewElement.addEventListener('click', handleNewFormula);

const handleClearFormulas = function () {
    if(!window.confirm(`Are you sure you want to clear all formulas? (This action is not reversible.)`))
        return;
    clearFormulas();
}

formulaClearElement.addEventListener('click', handleClearFormulas);

// Profile control events

const handleOpenExportDialog = function () {
    let fOrdered = [...formulaTableElement.children]
        .map(t => formulas.find(f => f.name == t.dataset.formulaName));
    exportText.value = JSON.stringify(fOrdered);
    exportDialog.showModal();
}
profileExport.addEventListener('click', handleOpenExportDialog);

const handleOpenImportDialog = function () {
    importDialog.showModal();
}
profileImport.addEventListener('click', handleOpenImportDialog);

exportDone.addEventListener('click',() => exportDialog.close());
importCancel.addEventListener('click',() => importDialog.close());

const handleExportCopy = function (ev) {
    navigator.clipboard.writeText(exportText.value);
    exportText.focus();
    exportText.select();
    spawnText(
        'Copied!',
        ev.x + Math.random()*16,
        ev.y + Math.random()*16,
        {parent: exportDialog});
}
exportCopy.addEventListener('click', handleExportCopy);

const handleExportSave = function (ev) {
    // To do this, we need to simulate clicking an anchor element
    let link = document.createElement('a');

    // Set the anchor to link to a file download with the data
    link.setAttribute('href', 'data:text/plain;charset=utf-8,'+encodeURIComponent(exportText.value));
    link.setAttribute('download', 'profile.txt');

    // Simulate the click
    link.click();
}
exportSave.addEventListener('click', handleExportSave);


const handleImportText = function (ev) {
    let parsed;
    try {
        parsed = JSON.parse(importText.value);
    }
    catch (ex) {
        window.alert("There was an issue with reading the data.");
        return;
    }
    
    if(loadProfile(parsed)) {
        spawnText(
            'Data Loaded Successfully!',
            ev.x + Math.random()*16,
            ev.y + Math.random()*16,
            {parent: importDialog});
    }
    else {
        window.alert("There was an issue with reading the data.");
    }

}
importConfirm.addEventListener('click', handleImportText);

const handleImportFile = function (ev) {
    // To get this to work, we need to simulate a click on a file input element
    const input = document.createElement('input');
    input.type = 'file';

    // Set up what to do with the file when it is chosen
    input.onchange = e => {
        // Get the file, create a new FileReader
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file,'UTF-8');
        // This method will trigger once the FileReader has finished reading
        reader.onload = readerEvent => {
            // Get the file content, put it into the import text area and
            // let the other event handler take care of the rest
            const content = readerEvent.target.result;
            importText.value = content;
            handleImportText(ev);
        }
    }

    // Simulate the click
    input.click();
}
importFile.addEventListener('click', handleImportFile);

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

// Load profile templates into table
profileTemplates.forEach(template => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${template.name}</td>
        <td>${template.desc}</td>
        <td><button>Load</button></td>`;
    const handleLoad = ev => {
        loadProfile(template.data);
        spawnText('Profile Loaded!',
            ev.x + Math.random()*16,
            ev.y + Math.random()*16);
    }
    row.querySelector('button').addEventListener('click', handleLoad);

    profileTemplateRows.appendChild(row);
})

// Preloaded formulas
loadProfile(profileTemplates[0].data);
deselectFormula();


dieRollerLog('Welcome!', 'Enter what you\'d like to roll below, or roll one of the formulas to the left:', '(Check out the help tab for more info!)');
commandElement.focus();