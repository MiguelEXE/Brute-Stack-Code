const Processor = require(".");
const fs = require("fs");

const file = process.argv.slice(2).join(" ");

const processor = new Processor();
processor.outputStream.pipe(process.stdout);
processor.setMainCode(fs.readFileSync(file, "ascii"));
function nextTick(){
    if(processor.halted) return;
    processor.step();
    process.nextTick(nextTick);
}
nextTick();