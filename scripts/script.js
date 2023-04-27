import Parser from './parser.js';

const LOGHISTORYLENGTH = 100;

/**list of strings currently in the log. use dieRollerLog() to change*/
let log_lines = [];

window.addEventListener('load', e => {
    const logElement = document.getElementById('log-text');
    const logScreenElement = document.getElementById('log');
    const commandElement = document.getElementById('command-entry');
    const logSubmitElement = document.getElementById('log-submit');
    const logClearElement = document.getElementById('log-clear');

    /**
     * Print text to the log
     * @param  {...any} lines single line strings to print to the log. Each string counts as 1 line for the
     * purposes of history length
    */
    const dieRollerLog = function (...lines) {
        log_lines.push(...lines);
        while (log_lines.length > LOGHISTORYLENGTH) log_lines.shift();
        logElement.innerText = log_lines.join('\n');
        logScreenElement.scrollTop = logScreenElement.scrollHeight;
    }
    
    const dieRollerLogClear = function () {
        log_lines = ['~~ log cleared ~~'];
        logElement.innerText = '~~ log cleared ~~';
        logScreenElement.scrollTop = logScreenElement.scrollHeight;
    }

    const parser = new Parser(dieRollerLog);

    const submitCommand = function () {
        dieRollerLog('> ' + commandElement.value);
        const parseResult = parser.parseCommand(commandElement.value.replaceAll(/\s/g, ''));
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
            default:
                dieRollerLog('Unnamed Error');
        }
        commandElement.value = '';
    }

    commandElement.addEventListener('keydown', ev => {
        if (ev.key == 'Enter') submitCommand();
    })

    logSubmitElement.addEventListener('click', submitCommand);

    logClearElement.addEventListener('click', dieRollerLogClear);

    dieRollerLog('Welcome!', 'Enter what you\'d like to roll below:', '(Check out the help tab for more info!)');
    commandElement.focus();
});