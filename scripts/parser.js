/**enum object detailing the order of operations for dice script */
const PRECEDENCE = {
    addition: 1,
    multiplication: 2,
    advantage: 3,
    dice: 4,
    negation: 5
};

export default class DiceScriptParser {
    log;
    table;
    /** Error code for parseCommand(). Used to escape recursion when error encountered as well as retrieve the error after. */
    parseErr = 0;
    critCount = 0;
    failCount = 0;
    #recursionBlacklist = [];

    /**
     * Creates a new DiceScriptParser
     * @param {function} outputMethod The method to be called when printing output. Should accept any number of Strings.
     * @param {list<dsFormula>} formulaTable List holding all the formulas which this parser should be able to reference.
     */
    constructor(outputMethod, formulaTable) {
        this.log = outputMethod;
        this.table = formulaTable;
    }

    getCritText() {
        let result = '';
        if(this.critCount)
        {
            result += ` ${this.critCount > 1 ? this.critCount+'x ': ''}CRIT!`;
        }
        if(this.failCount)
        {
            result += ` ${this.failCount > 1 ? this.failCount+'x ': ''}CRIT FAIL!`;
        }
        return result;
    }

    /**
     * Runs a command in dice script recursively and returns the result. Sets parseErr to the appropriate error code if an error
     * was encountered:
     * 
     * 0: no error
     * 1: unrecognized syntax
     * 2: unexpected end of expression
     * 3: unexpected symbol
     * 4: invalid number of dice
     * 5: invalid number of sides
     * 6: mismatched parentheses
     * 7: invalid advantage level
     * 8: could not find formula
     * 9: formula ill-defined
     * 10: self-referential formula
     * 
     * @param {String} code String containing the command to execute
     * @returns {[Number, String]} the computed number, any trailing code not yet parsed
     */
    parseCommand (code)
    {
        this.critCount = 0;
        this.failCount = 0;
        return this.#parseCommandRec(code);
    }


    /**
     * Recursive form of parseCommand
     * @param {String} code String containing the command to execute
     * @param {Number} operand optional: holds a previously computed value computing operations
     * @param {Number} context optional: holds the precedence level at which to stop executing
     * @returns {[Number, String]} the computed number, any trailing code not yet parsed
     */
    #parseCommandRec (code, operand, context) {
        // variable to hold match results
        let m;

        this.parseErr = 0;

        code = code.trimStart(); /* trim whitespace */

        if (code.length === 0) /* EMPTY CASE */
        {
            if (operand == undefined && context != undefined)
            {
                this.parseErr = 2; /* unexpected end of expression */
                return [];
            }
            return [operand];
        }
        else if (m = code.match(/^(\d+)(.*)$/)) /* NUMBER */
        {
            // this.log('matched number',m);
            return this.#parseCommandRec(m[2], Number(m[1]), context);
        }
        else if (m = code.match(/^\((.*)$/)) /* PARENTHESIS */
        {
            // this.log('matched parenthesis',m);

            // find the corresponding closing parenthesis
            let level = 1;
            let i;
            for(i = 0; i < m[1].length; i++)
            {
                if(m[1].charAt(i) === '(') level++;
                else if(m[1].charAt(i) === ')') level--;
                if(!level) break;
            }
            if(level)
            {
                this.parseErr = 6; /* mismatched parentheses */
                return [];
            }

            // Parse inner expression
            const [inner] = this.#parseCommandRec(m[1].slice(0,i));
            if(this.parseErr) return [];
            if(inner === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }

            return this.#parseCommandRec(m[1].slice(i+1,m[1].length),inner,context);
        }
        else if (m = code.match(/^\[(.*?)\](.*)$/)) /* FORMULA REFERENCE */
        {
            // this.log('matched formula reference',m);

            this.log(`Evaluating formula [${m[1]}]:`);

            // check for recursive reference
            if(this.#recursionBlacklist.includes(m[1]))
            {
                this.parseErr = 10; /* Self-referential formula */
                return [];
            }

            // search table for formula reference
            const ref = this.table.find(item => item.name == m[1]);
            if(ref === undefined)
            {
                this.parseErr = 8; /* Could not find formula */
                return [];
            }

            // Parse inner expression
            // In order to catch recursive references, we add the formula name to the blacklist before calling parseCommand,
            // then remove it again immediately after parseCommand returns.
            this.#recursionBlacklist.push(m[1]);
            const [inner] = this.#parseCommandRec(ref.code);
            this.#recursionBlacklist.pop();

            if(this.parseErr) return [];
            if(inner === undefined)
            {
                this.parseErr = 9; /* Formula ill-defined */
                return [];
            }
            
            this.log(`Formula [${m[1]}] evaluated to ${inner}`);
            
            return this.#parseCommandRec(m[2],inner,context);
        }
        else if (m = code.match(/^([dD])(.*)$/)) /* DIE ROLL */
        {
            // this.log('matched die roll',m);
            if (context >= PRECEDENCE.dice)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if (operand < 0 || operand > 999)
            {
                this.parseErr = 4; /* invalid number of dice */
                return [];
            }
            let [sides, tail] = this.#parseCommandRec(m[2], undefined, PRECEDENCE.dice);
            if (this.parseErr) return [];
            if (sides === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }
            if (sides < 1)
            {
                this.parseErr = 5; /* invalid number of sides */
                return [];
            }

            // calculating die rolls
            sides = Math.floor(sides);
            const count = operand === undefined ? 1 : Math.floor(operand);
            const doCrits = m[1]==='D';
            let result = 0;
            let rolls = [];
            for (let i = 0; i < count; i++)
            {
                const roll = Math.floor(Math.random() * sides) + 1;
                if(doCrits)
                {
                    if(roll===sides) this.critCount++;
                    if(roll===1) this.failCount++;
                }
                result += roll;
                rolls.push(roll);
            }

            // logging
            if(count != 1)
            {
                this.log(`Rolling ${count} dice with ${sides} sides:`,
                    ...rolls.map((a,b) => `${b+1}: ${a}${doCrits?(a===1 ? ' CRIT FAIL!' : a===sides ? ' CRIT!': ''):''}`),
                    rolls.join(' + ') + ' = ' + result);
            }
            else
            {
                this.log(`Rolling 1 die with ${sides} sides: ${result}${doCrits?(result===1 ? ' CRIT FAIL!' : result===sides ? ' CRIT!': ''):''}`);
            }
            
            return tail ? this.#parseCommandRec(tail, result, context) : [result];
        }
        else if (m = code.match(/^'(.*)$/)) /* ADVANTAGE */
        {
            // this.log('matched advantage',m)
            if(context >= PRECEDENCE.advantage)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if(operand < 0 || operand > 9)
            {
                this.parseErr = 7; /* invalid advantage level */
                return [];
            }
            if(operand === undefined) operand = 1;

            // Save the current number of crits / fails
            const baseCrits = this.critCount;
            const baseFails = this.failCount;

            this.log(`Trying with advantage${operand!=1?` x${operand}`:''}:`,'Trial 1:');
            let [best, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.advantage);
            if(this.parseErr) return [];
            if(best === undefined) {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }

            // These will decide what the final count of crits / fails is
            let bestcrits = this.critCount;
            let bestfails = this.failCount;
            for(let i = 0; i < operand; i++)
            {
                this.critCount = baseCrits;
                this.failCount = baseFails;

                this.log(`Trial ${i+2}:`);
                let [trial] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.advantage);
                if(this.parseErr) return [];
                if(trial === undefined) {
                    this.parseErr = 3; /* unexpected symbol */
                    return [];
                }
                if(trial > best)
                {
                    best = trial;
                    bestcrits = this.critCount;
                    bestfails = this.failCount;
                }
            }

            this.critCount = bestcrits;
            this.failCount = bestfails;

            this.log('Result with advantage: ' + best);
            return tail ? this.#parseCommandRec(tail, best, context) : [best];
        }
        else if (m = code.match(/^\.(.*)$/)) /* DISADVANTAGE */
        {
            // this.log('matched advantage',m)
            if(context >= PRECEDENCE.advantage)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if(operand < 0 || operand > 9)
            {
                this.parseErr = 7; /* invalid advantage level */
                return [];
            }
            if(operand === undefined) operand = 1;

            // Save the current number of crits / fails
            const baseCrits = this.critCount;
            const baseFails = this.failCount;

            this.log(`Trying with disadvantage${operand!=1?` x${operand}`:''}:`,'Trial 1:');
            let [worst, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.advantage);
            if(this.parseErr) return [];
            if(worst === undefined) {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }
            // These will decide what the final count of crits / fails is
            let worstcrits = this.critCount;
            let worstfails = this.failCount;
            for(let i = 0; i < operand; i++)
            {
                this.critCount = baseCrits;
                this.failCount = baseFails;

                this.log(`Trial ${i+2}:`);
                let [trial] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.advantage);
                if(this.parseErr) return [];
                if(trial === undefined) {
                    this.parseErr = 3; /* unexpected symbol */
                    return [];
                }
                if(trial < worst)
                {
                    worst = trial;
                    worstcrits = this.critCount;
                    worstfails = this.failCount;
                }
            }

            this.critCount = worstcrits;
            this.failCount = worstfails;

            this.log('Result with disadvantage: ' + worst);
            return tail ? this.#parseCommandRec(tail, worst, context) : [worst];
        }
        else if (m = code.match(/^\+(.*)$/)) /* ADDITION */
        {
            // this.log('matched addition',m);
            if (context >= PRECEDENCE.addition)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if (operand === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }
            const [operand2, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.addition);
            if (this.parseErr) return [];
            if (operand2 === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }

            const result = operand + operand2;
            this.log(`Adding ${operand} + ${operand2}:`, result);
            return tail ? this.#parseCommandRec(tail, result, context) : [result];
        }
        else if (m = code.match(/^\-(.*)$/)) /* SUBTRACTION/NEGATION */
        {
            if (operand === undefined)
            {
                // this.log('matched negation',m);
                if (context >= PRECEDENCE.negation)
                {
                    // this.log('precedence exceeded, backtracking...');
                    return [operand, code];
                }

                const [operand2, tail, err] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.negation);
                if (this.parseErr) return [];
                if (operand2 === undefined)
                {
                    this.parseErr = 3; /* unexpected symbol */
                    return [];
                }

                let result = -operand2;
                // no log output for this one because that would be silly
                return tail ? this.#parseCommandRec(tail, result, context) : [result];
            }
            else
            {
                // this.log('matched subtraction',m);
                if (context >= PRECEDENCE.addition)
                {
                    // this.log('precedence exceeded, backtracking...');
                    return [operand, code];
                }

                const [operand2, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.addition);
                if (this.parseErr) return [];
                if (operand2 === undefined)
                {
                    this.parseErr = 3; /* unexpected symbol */
                    return [];
                }

                let result = operand - operand2;
                this.log(`Subtracting ${operand} - ${operand2}:`, result);
                return tail ? this.#parseCommandRec(tail, result, context) : [result];
            }
        }
        else if (m = code.match(/^\*(.*)$/)) /* MULTIPLICATION */
        {
            // this.log('matched multiplication',m);
            if (context >= PRECEDENCE.multiplication)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if (operand === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }
            const [operand2, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.multiplication);
            if (this.parseErr) return [];
            if (operand2 === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }

            const result = operand * operand2;
            this.log(`Multiplying ${operand} * ${operand2}:`, result);
            return tail ? this.#parseCommandRec(tail, result, context) : [result];
        }
        else if (m = code.match(/^\/(.*)$/)) /* DIVISION */
        {
            // this.log('matched division',m);
            if (context >= PRECEDENCE.multiplication)
            {
                // this.log('precedence exceeded, backtracking...');
                return [operand, code];
            }

            if (operand === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }
            const [operand2, tail] = this.#parseCommandRec(m[1], undefined, PRECEDENCE.multiplication);
            if (this.parseErr) return [];
            if (operand2 === undefined)
            {
                this.parseErr = 3; /* unexpected symbol */
                return [];
            }

            const result = operand / operand2;
            this.log(`Dividing ${operand} / ${operand2}:`, result);
            return tail ? this.#parseCommandRec(tail, result, context) : [result];
        }
        else /* DEFAULT */
        {
            this.parseErr = 1; /* unrecognized syntax */
            return [];
        }
    }
}