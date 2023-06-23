const stream = require("stream");
const {EventEmitter} = require("events");
const readline = require("readline-sync");
const MAX_FUNCTIONS_ON_STACK = 50;
const INTEGER_LIMIT = 2**16;
const MAX_MEMORY_ADDRESS = INTEGER_LIMIT-1;

const IFs = ["IFQ","INQ","IFS","IFB"];
/**
 * 
 * @param {string[]} commands 
 * @param {number?} skipIfs 
 * @param {number} offset 
 */
function locateElseEnd(commands, skipIfs = 0, offset){
    let index = offset || 0;
    /**
     * @type {number?}
     */
    let elseIndex;
    while(true){
        const curCommand = commands[index];
        if(!curCommand) throw new TypeError("INVALID IF");
        if(IFs.includes(curCommand)){
            skipIfs++;
        }else if(curCommand === "ELSE" && skipIfs < 1){
            elseIndex = index;
        }else if(curCommand === "END"){
            if(skipIfs < 1){
                return {elseIndex, endIndex: index};
            }else skipIfs--;
        }
        index++;
    }
}
const commandStringArray = [];
const commands = {
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["."](processor, commands, commandIndex){
        const value = processor.stack.pop();
        if(value === undefined) return;
        processor._stream_log(value);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    [".S"](processor, commands, commandIndex){
        while(true){
            const value = processor.stack.pop();
            if(value === undefined) break;
            processor._stream_write(value.toString()+" ");
        }
        processor._stream_log("");
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["E"](processor, commands, commandIndex){
        processor.stop();
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["+"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 + arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["-"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 - arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["*"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 * arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["/"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(Math.floor(arg1 / arg2));
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["%"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 % arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["|"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 | arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["!"](processor, commands, commandIndex){
        const arg1 = processor._fetchOneArg();
        return processor._checkAndPush(arg1 ^ MAX_MEMORY_ADDRESS);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["&"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 & arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ["^"](processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        return processor._checkAndPush(arg1 ^ arg2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    PAGE(processor, commands, commandIndex){
        processor.emit("clearStream");
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    WORDS(processor, commands, commandIndex){
        for(const commandName of commandStringArray){
            processor._stream_write(commandName+" ");
        }
        processor._stream_log("");
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    TR(processor, commands, commandIndex){ // TODO: Need to make this a async function to accept arbitrary input instead of stdin
        const length = processor._fetchOneArg();
        const string = processor._readInput(length);
        const charCodes = string.split("").map(char => char.charCodeAt(0));
        processor.stack.push(...charCodes);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    TW(processor, commands, commandIndex){
        const length = processor._fetchOneArg();
        let string = "";
        for(let i=0;i<length;i++){
            string += String.fromCharCode(processor._fetchOneArg());
        }
        processor._stream_write(string);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    RE(processor, commands, commandIndex){
        processor.restart();
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    CL(processor, commands, commandIndex){
        while(processor.stack.pop() !== undefined);
    },

    // If elses is on if(arg1 equal_operator arg2){ignore;}else{skip command} for clean-coding

    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    IFQ(processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        const indexes = locateElseEnd(commands, -1, commandIndex);
        if(arg1 === arg2){
            return;
        }else{
            processor._setCommandIndex(indexes.elseIndex || indexes.endIndex);
        }
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    INQ(processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        const indexes = locateElseEnd(commands, -1, commandIndex);
        if(arg1 !== arg2){
            return;
        }else{
            processor._setCommandIndex(indexes.elseIndex || indexes.endIndex);
        }
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    IFS(processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        const indexes = locateElseEnd(commands, -1, commandIndex);
        if(arg1 <= arg2){
            return;
        }else{
            processor._setCommandIndex(indexes.elseIndex || indexes.endIndex);
        }
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    IFB(processor, commands, commandIndex){
        const [arg1, arg2] = processor._fetchTwoArgs();
        const indexes = locateElseEnd(commands, -1, commandIndex);
        if(arg1 >= arg2){
            return;
        }else{
            processor._setCommandIndex(indexes.elseIndex || indexes.endIndex);
        }
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    ELSE(processor, commands, commandIndex){
        const indexes = locateElseEnd(commands, -1, commandIndex);
        processor._setCommandIndex(indexes.endIndex);
    },
    END(){},
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    DF(processor, commands, commandIndex){
        const functionName = commands[commandIndex + 1];
        const isInvalid = functionName === undefined || commandStringArray.includes(functionName);
        if(isInvalid) throw new SyntaxError("INVALID FUNCTION NAME");
        processor.functions[functionName] = "";
        processor.currentFunctionName = functionName;
        processor._setCommandIndex(commandIndex + 2);
    },
    EF(){
        throw new SyntaxError("INVALID FUNCTION CLOSING");
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    CALL(processor, commands, commandIndex){
        processor._setCommandIndex(commandIndex + 2);
        processor._callFunction(commands[commandIndex + 1]);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    FF(processor, commands, commandIndex){
        const functionName = commands[commandIndex + 1];
        processor.functions[functionName] = undefined;
        processor._setCommandIndex(commandIndex + 2);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    R(processor, commands, commandIndex){
        const address = processor._fetchOneArg();
        if(address < 0 || address > MAX_MEMORY_ADDRESS) throw new RangeError("INVALID ADDRESS");
        processor.stack.push(processor.memory[address]);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    W(processor, commands, commandIndex){
        const [address, value] = processor._fetchTwoArgs();
        if(address < 0 || address > MAX_MEMORY_ADDRESS) throw new RangeError("INVALID ADDRESS");
        processor.memory[address] = value;
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    SIZE(processor, commands, commandIndex){
        processor.stack.push(processor.memory.length);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    EXTS(processor, commands, commandIndex){
        processor.stack.push(0);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    P3(processor, commands, commandIndex){
        const value = processor._fetchOneArg();
        processor.stack.push(value, value);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    CEXTS(processor, commands, commandIndex){
        const value = processor._fetchOneArg();
        processor.stack.push(value, value);
    },
    /**
     * @param {Processor} processor
     * @param {string[]} commands
     * @param {number} commandIndex
     */
    USEXTS(processor, commands, commandIndex){
        const extensionBitfield = processor._fetchOneArg();
        if(extensionBitfield !== 0) throw new Error("INCOMPATIBLE EXTENSION");
    }
};
class FunctionTrace{
    /**
     * The name of the function, for the main function it will use "<MAIN>""
     * @type {string}
     */
    name
    /**
     * The original function code
     * @type {string}
     */
    originalCode
    /**
     * The function code splitted (used internally)
     * @type {string}
     */
    splittedCode
    /**
     * The current index which the Processor is processing (used interally)
     * @type {number}
     */
    index
}
const _nextTick = () => new Promise(r => process.nextTick(r));
class Processor extends EventEmitter{
    /**
     * A FIFO environment that is used to save temporarily data that is used on the commands processed by the `Processor`
     */
    stack = [];
    /**
     * A RAM-like memory
     */
    memory = new Int16Array(MAX_MEMORY_ADDRESS);
    outputStream = new stream.Readable({
        read(){}
    });
    /*#internalBuffer = new stream.Readable({
        read(){}
    })
    inputStream = new stream.Writable({
        write: chunk => {
            this.#internalBuffer.write(chunk);
        }
    });*/
    /**
     * True if the processor is ignoring the `step()` function
     * @type {boolean}
     */
    halted = false;
    /**
     * The current function name that is processing if the `DF` command is not finished yet
     * @type {string?}
     */
    currentFunctionName = null
    /**
     * All functions defined used the `DF ... EF` code or assigning it manually
     * @type {Object<String, String>}
     */
    functions = {}
    /**
     * @type {FunctionTrace[]}
     */
    stacktrace = []
    /**
     * If true, the processor is processing the code as a string and so, pushing their char codes to the stack. false otherwise
     * @type {bool}
     */
    runningStringMode = false

    _readInput(bytes){
        let str = "";
        for(let i=0;i<bytes;i++){
            str += readline.keyIn("", {hideEchoBack:true,mask:""});
        }
        return str;
    }
    /**
     * 
     * @param {string} code 
     */
    setMainCode(code){
        const mainCode = this.stacktrace[0];
        if(mainCode) throw new Error("Writing already existing main function is forbidden");
        this.stacktrace[0] = {
            name: "<MAIN>",
            originalCode: code,
            splittedCode: code.split(" "),
            index: 0
        };
    }
    _step_function(){
        const currentStacktrace = this.stacktrace[this.stacktrace.length-1];
        const command = currentStacktrace.splittedCode[currentStacktrace.index];
        if(command === undefined){
            this.emit("waitingForCode");
            return;
        }
        if(command === "DF"){
            this.functions[this.currentFunctionName] = undefined;
            this.currentFunctionName = undefined;
            throw new SyntaxError("DF CANNOT BE USED INSIDE A FUNCTION. CANCELED");
        }
        if(command === "EF"){
            this.currentFunctionName = undefined;
        }else{
            this.functions[this.currentFunctionName] += command + " ";
        }
        currentStacktrace.index++;
    }
    _step_string(skipStringOpenCharOnce){
        const currentStacktrace = this.stacktrace[this.stacktrace.length-1];
        const command = currentStacktrace.splittedCode[currentStacktrace.index];
        if(command === undefined){
            this.emit("waitingForCode");
            return;
        }

        for(const char of command){
            if(char === "\""){
                if(skipStringOpenCharOnce){
                    skipStringOpenCharOnce = false;
                    continue;
                }
                this.runningStringMode = false;
            }else{
                this.stack.push(char.charCodeAt(0));
            }
        }
        if(this.runningStringMode){
            this.stack.push(" ".charCodeAt(0));
        }
        currentStacktrace.index++;
    }
    step(){
        if(this.halted) return;
        if(this.currentFunctionName) return this._step_function();
        if(this.runningStringMode) return this._step_string();
        const currentStacktrace = this.stacktrace[this.stacktrace.length-1];
        const command = currentStacktrace.splittedCode[currentStacktrace.index];
        if(command === undefined){
            this.halted = true;
            return;
        }
        if(command[0] === "\""){
            this.runningStringMode = true;
            return this._step_string(true);
        }
        const commandNumber = parseInt(command);
        if(!isNaN(commandNumber)){
            this.stack.push(commandNumber);
            currentStacktrace.index++;
            return;
        }
        const commandFunction = commands[command];
        if(command !== ""){ // if command === "", skip it
            if(!commandFunction) throw new Error("NO COMMAND");
            commandFunction(this, currentStacktrace.splittedCode, currentStacktrace.index);
        }
        currentStacktrace.index++;
    }
    stop(){
        this.halted = true;
        this.emit("stop");
    }
    restart(){
        this.halted = false;
        this.stack.splice(0, Infinity);
        this.memory.fill(0);
        this.stacktrace.splice(0, Infinity);
        this.functions = {};
        this.emit("clearStream");
        this.emit("restart");
    }

    _callFunction(functionName){
        this.stacktrace.push({
            name: functionName,
            originalCode: this.functions[functionName],
            splittedCode: this.functions[functionName].split(" "),
            index: 0
        });
    }
    _setCommandIndex(index){
        this.stacktrace[this.stacktrace.length-1].index = index-1;
    }
    _stream_write(value){
        this.outputStream.push(String(value));
    }
    _stream_log(value){
        this.outputStream.push(`${value}\n`);
    }
    _checkAndPush(value){
        const number = parseInt(value);
        if(number >= INTEGER_LIMIT) throw new RangeError("NUM2BIG");
        this.stack.push(number);
    }
    _fetchOneArg(){
        const arg1 = this.stack.pop();
        if(arg1 === undefined) throw new TypeError("NO ARGS");
        return arg1;
    }
    _fetchTwoArgs(){
        const arg1 = this.stack.pop();
        const arg2 = this.stack.pop();
        if(arg1 === undefined || arg2 === undefined) throw new TypeError("NO ARGS");
        return [arg1, arg2];
    }

    constructor(){
        super();
    }
}
module.exports = Processor;