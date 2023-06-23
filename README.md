# Brute Stack Code

## A stack-oriented language

The origin of the Brute Stack Code was because of the Red Power's minecraft mod computer which implemented the FORTH language. This means Brute Stack Code is inspirated from FORTH language

## How it works:
Brute Stack Code uses a stack (FIFO envorinment) to manipulate data and a RAM-like to store temporary data when executing the program.


Programs can only has a stacktrace (function tracing stack) of size 50 elements.


The program stack technically is infinite-size and also DOES NOT HOLD float numbers, only 16-bit signed integers.

## Extensions:
[Official extensions on Brute Stack Code](extensions.md)


## Commands:
All commands on this paper will be defined in the list as:
COMMANDNAME \[1st hardcoded argument which will be fetched on the command string] \[2nd hardcoded argument which will be fetched on the command string] \[...] \<1st arbitrary argument. Pops a value from the stack and defines as the first argument> \<2nd arbitrary argument. Pops a value from the stack and defines as the second argument> <...>
### Commands list
- . \<value>: Pops a value from the stack and displays it on the terminal.
- .S \<...values>: Pops all values from the stack and displays it on the terminal with spaces between the numbers
- E: Stops the program
- \+ \<argument 1> \<argument 2>: Pops two values from the stack and makes a addition operation, then push the result in the stack
- \- \<argument 1> \<argument 2>: Pops two values from the stack and makes a subtraction operation, then push the result in the stack
- \* \<argument 1> \<argument 2>: Pops two values from the stack and makes a multiplication operation, then push the result in the stack
- / \<argument 1> \<argument 2>: Pops two values from the stack and makes a division operation, then push the result in the stack. Note that the result is floored.
- % \<argument 1> \<argument 2>: Pops two values from the stack and makes a division operation, then push the remainder in the stack
- | \<argument 1> \<argument 2>: Pops two values from the stack and makes a OR operation, then push the result in the stack
- ! \<argument 1> \<argument 2>: Pops two values from the stack and makes a NOT (xor of 65535) operation, then push the result in the stack
- & \<argument 1> \<argument 2>: Pops two values from the stack and makes a AND operation, then push the result in the stack
- ^ \<argument 1> \<argument 2>: Pops two values from the stack and makes a XOR operation, then push the result in the stack
- PAGE: Clears the terminal
- WORDS: Displays all the command names
- TR \<length> \<...char codes>: Pops a length value and then iterate through 0 to length, popping a char code and displaying it's character on the screen
- TW \<length>: Pops a length value and then reads length bytes from input and push all of the readed values on the stack
- RE: Restart the program
- CL: Clears the stack
- IFQ \<argument 1> \<argument 2>: Check if both values is equal, if true, executes all commands inside the if statement until a ELSE or END is found
- INQ \<argument 1> \<argument 2>: Check if both values is NOT equal, if true, executes all commands inside the if statement until a ELSE or END is found
- IFS \<argument 1> \<argument 2>: Check if both values is smaller, if true, executes all commands inside the if statement until a ELSE or END is found
- IFB \<argument 1> \<argument 2>: Check if both values is bigger, if true, executes all commands inside the if statement until a ELSE or END is found
- ELSE: If inside a if statement, skips commands until a END is found. Otherwise should trigger a error
- END: If inside a if statement, does nothing. Otherwise should trigger a error
- DF \[...code, stops after a EF command]: Defines a function. First read the function name then reads commands until a EF command is found. If the function is not closed properly, should wait for user input until the user inputs a EF command
- EF: Ends the function definition.
- CALL \[function name]: Read a function name then calls the function
- FF \[function name]: Removes the function from the function definition list.
- R \<address>: Pops a address from the stack. Reads a 16-bit integer from the memory using the specified address.
- W \<value> \<address>: Pops a value THEN the address from the stack. Writes a 16-bit integer to the memory using the specified address and value.
- SIZE: Pushes the memory size
- EXTS: Pushes a bitfield of the current implemented extensions.
- " \[...characters] ": Converts all characters inside quotation marks to char codes and pushes it on the stack.
- (any integer): pushes the integer into the stack

## Tests:
### Test the IFS and IFB commands:

Pseudo-code (lua):
```lua
if 10 < 20 then
    if 20 + 10 > 2 then
        print(0);
    else
        print(1);
    end
else
    print(2);
end
```
Brute Stack Code:
```bsc
20 10 IFS 2 10 20 + IFB 0 . ELSE 1 . END ELSE 2 . END
```
Returns 0 if everything is ok

Returns 1 if IFB is not working

Returns 2 if IFB is not working



### Test the IFQ and INQ commands:
```lua
if (2 + 6*5) ~= (8 + 4*6) then
    if (4 + 2*14) == ((360 % 99 - 3)/2+2) then
        print(0);
    else
        print(1);
    end
else
    print(2);
end
```
Brute Stack Code:
```bsc
2 5 6 * + 8 6 5 * + INQ 4 14 2 * + 2 2 3 99 360 % - / + IFQ 0 . ELSE 1 . END ELSE 2 . END
```
Returns 0 if everything is ok

Returns 1 if IFQ is not working

Returns 2 if INQ is not working


## First implementations:
### Original implementation:
[CC: Tweaked implementation](original_implementation/README.md)

### Updated implementation:
[JavaScript implementation](index.js)