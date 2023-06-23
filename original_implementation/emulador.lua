--local completion = require("cc.completion");
local MAX_FUNCTIONS_ON_STACK = 50;
local MAX_MEMORY_ADDRESS = 2^15-1;

local stack = {};
local memory = {};
local lim = 2^16;
local function push(value)
    stack[#stack + 1] = tonumber(value);
end
local function checkPush(value)
    value = tonumber(value);
    if value >= lim then
        --error("NUM2BIG");
        return "error","NUM2BIG";
    end
    push(value);
end
local function pop()
   return table.remove(stack, #stack); 
end

local function swrite(val)
    write(val);
    sleep(0.05);
end
local function sprint(val)
    print(val);
    sleep(0.05);
end

local IFs = {"IFQ","INQ","IFS","IFB"};
local function table_includes(t,v) -- Array.includes of javascript
    for _,val in ipairs(t) do
        if v == val then
            return true;
        end
    end
    return false;
end
local function locateElseEnd(commands, skipIfs, offset)
    local index = offset or 1;
    skipIfs = skipIfs or 0;
    local elseIndex = nil;
    while true do
        local curCommand = commands[index];
        if curCommand == nil then
            error("INVALID IF");
        end
        if table_includes(IFs, curCommand) then
            skipIfs = skipIfs + 1;
        elseif (curCommand == "ELSE") and (skipIfs < 1) then
            elseIndex = index;
        elseif curCommand == "END" then
            if skipIfs < 1 then
                return {elseIndex = elseIndex, endIndex = index};
            else
                skipIfs = skipIfs - 1;
            end
        end
        index = index + 1;
    end
end

local completionCommands = {};
local currentFunctionName = nil;
local functions = {};
local stacktrace = {};
local commands = {
    ["."] = function()
        local value = pop();
        if value == nil then
            return;
        end;
        sprint(tostring(value));
    end,
    [".S"] = function()
        while true do
            local value = pop();
            if value == nil then
                break;
            end
            swrite(tostring(value) .. " ");
        end
        sprint("");
    end,
    ["E"] = function()
        return "exit";
    end,
    --[[["exit"] = function()
        sprint("USE INSTEAD \"E\"");
    end,]]--
    ["+"] = function()
        local arg1 = pop();
        local arg2 = pop();
        if (arg1 == nil) or (arg2 == nil) then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        return checkPush(arg1 + arg2);
    end,
    ["-"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(arg1 - arg2);
    end,
    ["*"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(arg1 * arg2);
    end,
    ["/"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(math.floor(arg1 / arg2));
    end,
    ["%"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(arg1 % arg2);
    end,
    ["|"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(bit32.bor(arg1, arg2));
    end,
    ["!"] = function() -- alias for 65535 ^
        local arg1 = pop();
        return checkPush(bit32.bxor(arg1, lim-1));
    end,
    ["&"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(bit32.band(arg1, arg2));
    end,
    ["^"] = function()
        local arg1 = pop();
        local arg2 = pop();
        return checkPush(bit32.bxor(arg1, arg2));
    end,
    ["PAGE"] = function()
        term.clear();
    end,
    ["WORDS"] = function()
        for _,command in ipairs(completionCommands) do
            swrite(command .. " ");
        end
        sprint("");
    end,
    ["TR"] = function()
        local length = pop();
        if length == nil then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        
    end,
    ["TW"] = function()
        local length = pop();
        if length == nil then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        for i=1, length do
            local charcode = pop();
            swrite(string.char(charcode));
        end
    end,
    ["RE"] = function()
        -- implement later
    end,
    ["CL"] = function()
        repeat
            local value = pop();
        until value == nil;
    end,
    
    ["IFQ"] = function(commands, index)
        local arg1 = pop();
        local arg2 = pop();
        if (arg1 == nil) or (arg2 == nil) then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        local indexes = locateElseEnd(commands, -1, index);
        if arg1 == arg2 then
            return;
        else
            return "newIndex", indexes.elseIndex or indexes.endIndex;
        end
    end,
    ["INQ"] = function(commands, index)
        local arg1 = pop();
        local arg2 = pop();
        if (arg1 == nil) or (arg2 == nil) then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        local indexes = locateElseEnd(commands, -1, index);
        if arg1 ~= arg2 then
            return;
        else
            return "newIndex", indexes.elseIndex or indexes.endIndex;
        end
    end,
    ["IFS"] = function(commands, index)
        local arg1 = pop();
        local arg2 = pop();
        if (arg1 == nil) or (arg2 == nil) then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        local indexes = locateElseEnd(commands, -1, index);
        if arg1 < arg2 then
            return;
        else
            return "newIndex", indexes.elseIndex or indexes.endIndex;
        end
    end,
    ["IFB"] = function(commands, index)
        local arg1 = pop();
        local arg2 = pop();
        if (arg1 == nil) or (arg2 == nil) then
            --error("NO ARGS");
            return "error","NO ARGS";
        end
        local indexes = locateElseEnd(commands, -1, index);
        if arg1 > arg2 then
            return;
        else
            return "newIndex", indexes.elseIndex or indexes.endIndex;
        end
    end,
    ["ELSE"] = function(commands, index)
        local indexes = locateElseEnd(commands, -1, index);
        return "newIndex", indexes.endIndex;
    end,
    ["END"] = function() end,
    ["DF"] = function(commands, index)
        local functionName = commands[index + 1];
        local isInvalid = (functionName == nil) or (commands[functionName] ~= nil);
        if isInvalid then
            --error("INVALID FUNCTION NAME");
            return "error","INVALID FUNCTION NAME";
        end
        functions[functionName] = "";
        currentFunctionName = functionName;
        return "newIndex", index + 1;
    end,
    ["EF"] = function()
        --error("NO FUNCTION");
        return "INVALID FUNCTION CLOSING";
    end,
    ["CALL"] = function(commands, index)
        if #stacktrace > MAX_FUNCTIONS_ON_STACK then
            --error("STACK OVERFLOW");
            return "error","STACK OVERFLOW";
        end
        local functionName = commands[index + 1];
        local isInvalid = functions[functionName] == nil;
        if isInvalid then
            --error("NO FUNCTION");
            return "error","NO FUNCTION";
        end
        stacktrace[#stacktrace].codeIndex = index + 2;
        stacktrace[#stacktrace + 1] = {
            funname = functionName,
            code = functions[functionName],
            codeIndex = 1
        };
        return "stacktraceUpdate";
    end,
    ["FF"] = function(commands, index)
        local functionName = commands[index + 1];
        functions[functionName] = nil;
        return "newIndex", index + 1;
    end,
    ["R"] = function()
        local address = math.floor(pop());
        if address == nil then
            return "error", "NO ARGS";
        end
        if (address < 0) or (address > MAX_MEMORY_ADDRESS) then
            return "error", "INVALID ADDRESS";
        end
        push(memory[address] or 0);
    end,
    ["W"] = function()
        local val = math.floor(pop());
        local address = math.floor(pop());
        if (val == nil) or (address == nil) then
            return "error", "NO ARGS";
        end
        if (address < 0) or (address > MAX_MEMORY_ADDRESS) then
            return "error", "INVALID ADDRESS";
        end
        memory[address] = val;
    end
};
for k in pairs(commands) do
    completionCommands[#completionCommands + 1] = k;
end
local history = {};
local function split(str, sep)
    if sep == nil then
        sep = "%s";
    end
    local t = {};
    for s in string.gmatch(str, "([^"..sep.."]+)") do
        t[#t + 1] = s;
    end
    return t;
end
local function csplit(str) -- character split
    return {string.match(str, (string.gsub(str, ".","(.)")))}
end

local function run_number(value)
    push(value);
end
local function run_command(str, commandsString, index)
    local func = commands[str];
    if func == nil then
        sprint("NO COMMAND");
        return "error";
    end
    local state, msg = func(commandsString, index);
    if state == "error" then
        sprint("ERROR: " .. msg);
    end
    return state, msg;
end
local function traceback()
    while true do
        local func = table.remove(stacktrace, #stacktrace);
        if func == nil then
            break;
        end
        sprint("-> IN \"" .. func.funname .. "\" ON SPACE INDEX " .. tostring(func.codeIndex));
    end
end
local function run_commands()
    local func = stacktrace[#stacktrace];
    local commandsStr = func.code;
    -- parse
    local commands = split(commandsStr, " ");
    local stringMode = false;
    while commands[func.codeIndex] ~= nil do
        local command = commands[func.codeIndex];
        local runningStringMode = false;
        sleep(0);
        if stringMode then
            runningStringMode = true;
            push(string.byte(" "));
            sleep(0.05);
            local splitted = csplit(command);
            for _,v in ipairs(splitted) do
                if v == "\"" then
                    stringMode = false;
                    break;
                end
                push(string.byte(v));
                sleep(0.05);
            end
        end
        do
            local splitted = csplit(command);
            if (splitted[1] == "\"") and (currentFunctionName == nil) then
                stringMode = true;
                runningStringMode = true;
                table.remove(splitted, 1);
                for _,v in ipairs(splitted) do
                    if v == "\"" then
                        stringMode = false;
                        break;
                    end
                    push(string.byte(v));
                    sleep(0.05);
                end
            end
        end
        command = string.gsub(command, "%s", "");
        if currentFunctionName ~= nil then
            if command == "DF" then
                functions[currentFunctionName] = nil;
                currentFunctionName = nil;
                command = "";
                print("DF CANNOT BE USED INSIDE A DF. CANCELED");
            elseif command == "EF" then
                print(functions[currentFunctionName]);
                currentFunctionName = nil;
                command = "";
            else
                functions[currentFunctionName] = functions[currentFunctionName] .. command .. " ";
            end
        end
        sleep(0.1);
        if (command ~= "") and (not runningStringMode) and (currentFunctionName == nil) then
            if (tonumber(command) == nil) or (command == "-") then
                local commandAction, newIndex = run_command(command, commands, func.codeIndex);
                if commandAction == "exit" then
                    return "exit";
                elseif commandAction == "stacktraceUpdate" then
                    return "ignore";
                elseif commandAction == "error" then
                    traceback();
                    return "ignore";
                elseif commandAction == "newIndex" then
                    func.codeIndex = newIndex;
                end
            else
                run_number(command);
            end
        end
        func.codeIndex = func.codeIndex + 1;
    end
    table.remove(stacktrace, #stacktrace);
end

local facts = {"Brute Stack Code is inspirated on the Red Power's computer that runs FORTH programming language"};
swrite("BedrockOS/1.0 (Brute Stack Code)\nDid you know: ");
sprint(facts[math.random(#facts)]);
while true do
    local val;
    if #stacktrace < 1 then
        swrite(((currentFunctionName == nil) and "" or "FUNC") .. "> ");
        local userCode = read(nil, history);
        stacktrace[#stacktrace + 1] = {
            codeIndex = 1,
            funname = "<MAIN>",
            code = userCode
        };
    end
    local termProcess = run_commands();
    if termProcess == "exit" then
        return;
    elseif termProcess ~= "ignore" then
        history[#history + 1] = val;
    end
end
