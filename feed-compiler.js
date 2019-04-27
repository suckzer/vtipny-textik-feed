// compiles the feed 

const fs = require('fs'), path = require('path');
const OLD_WITTY_FEEDS_PATH = 'witty-txt-pic-feed/old';
const JSONS_DIR = path.join(__dirname, OLD_WITTY_FEEDS_PATH);
console.log(JSONS_DIR);

const entries = fs.readdirSync(JSONS_DIR).filter( entry => entry.match(/^witty-txt./)).sort();

// console.log(entries);

const entriesOut = [];

entries.forEach(el => {
    const tmpEntries = require(path.join(JSONS_DIR, el));
    tmpEntries.forEach(entry => {
        if(entriesOut.length === 0 || entriesOut[0].timestamp < entry.timestamp){
            entriesOut.unshift(entry);
        }
    });
});

fs.writeFileSync(path.join(__dirname, 'all-items.json'), JSON.stringify(entriesOut, null, 2));