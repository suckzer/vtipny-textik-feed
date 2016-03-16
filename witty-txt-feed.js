'use strict';

let fs = require('fs'),
    cheerio = require('cheerio'),
    request = require('request'),
    nodeUuid = require('node-uuid'),
    path = require('path');

let feedConfig = {
    feedName : 'Vymysli vtipný textík - výhreci jednotlivých kol',
    // where the feed gets exported
    feedExportPath : "/var/www/default/witty-txt-pic/witty-txt-pic-feed.xml",
    // where the feed gets stored
    feedJSONdir : "/var/tmp/witty-txt-pic-feed", 
    // what is the name of JSON file, containing the meta data from which the 
    // feed is generated
    feedJSONfile : "witty-txt.json",
    // at how many entries should the feed be capped
    feedMaxEntries : 50,
    // path to the page being scraped
    feedSource : 'http://www.okoun.cz/boards/vymysli_vtipny_textik'
};
    
if(fs.existsSync(__dirname + path.sep + 'feedconfig.js')){
    // if there is file called feed config in the crurent directory, 
    // it might contain some settings, that will be different from
    // the defaults or some additional settings
    var feedCustomConfig = require(__dirname + path.sep + 'feedconfig.js');
    for(let cfgKey in feedCustomConfig){
        feedConfig[cfgKey] = feedCustomConfig[cfgKey];
    }
}

// test if the folders for the storage of the feed exist and if not, create them

if(!fs.existsSync(feedConfig.feedJSONdir)){
    fs.mkdirSync(feedConfig.feedJSONdir);
    fs.writeFile(feedConfig.feedJSONdir + path.sep + 'README.md', `# Folder to store data of the feed '${feedConfig.feedName}'\n`);
    if(!fs.existsSync(feedConfig.feedJSONdir + path.sep + 'old')){
        fs.mkdirSync(feedConfig.feedJSONdir + path.sep + 'old');
        fs.writeFile(feedConfig.feedJSONdir + path.sep + 'old' + 
                      path.sep + 'README.md', `# Folder to store old versions of data from the feed '${feedConfig.feedName}'\n`);
    }
}

var reqOptions = {
    // url: 'http://www.pervers.cz/?Loc=fre&Forum=215906',
    url : feedConfig.feedSource,
    headers: {
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.8',
        'Cache-Control':'max-age=0',
        'Connection':'keep-alive',
    },
    gzip : true,
};

request.get(reqOptions, processPageCallback);

/**
 * Callback that handles the request
 */ 

function processPageCallback(err, response, body){
    if(err) throw err;
    if(!response.statusCode === 200){
        throw Error(`Expected status code 200 but received ${response.statusCode}`);
    }
    processContent(body);
}

/**
 * Searches the body to find image in header
 */

function processContent(body){
    let $ = cheerio.load(body.toString());
    let imgsInHeader = $('div.welcome div.content img');
    // grab the last image src attribute - this seems to be the last attribute
    let searchedImg = imgsInHeader[imgsInHeader.length - 1]; 
    let imgSrc = '';
    let authorNick = '';
    if(imgsInHeader.length > 0){
        imgSrc = $(searchedImg).attr('src');
        
        // try to grab the author of the last image
        // this should be the content of the last "<b>" tag on the page
        let bTagsInHeader = $('div.welcome div.content b');
        if(bTagsInHeader.length > 0){
            let authorTag = bTagsInHeader[bTagsInHeader.length - 1]; 
            authorNick = $(authorTag).text().trim();
        }
    }    
    if(imgSrc.length > 0){ 
        // there is some image, so pass it on and try to find out if it's new
        processImageAndAuthorFound(imgSrc, authorNick);
    }
}

/**
 * If an image was found on the page, this checks if it's new or if it already
 * exists in the feed. If the image is new, it adds it at the top of the feed
 * data and calls export
 */

function processImageAndAuthorFound(imgSrc, authorNick){
    let feedDataFile = feedConfig.feedJSONdir + path.sep + feedConfig.feedJSONfile;
    let feedData = []; // feed data is an array of objects
    if(fs.existsSync(feedDataFile)){
        // loads the JSON if it exists
        feedData = JSON.parse(fs.readFileSync(feedDataFile)); 
    }
    
    let feedUpdateIsNeeded = false; // will be set to true, if feed update is needed
    
    if(feedData.length > 0){
        // if there are already any records in the feed
        if(feedData[0].imgSrc !== imgSrc){
            // if the src of the image differs, 
            // create new record and place it at the top
            feedUpdateIsNeeded = true;
        }
    }else{
        feedUpdateIsNeeded = true;
    }
    
    if(feedUpdateIsNeeded === true){
        var postDate = new Date();
        postDate.setMinutes(0); // if this is run repeatedly, reset minute and second, 
        postDate.setSeconds(0); // so that there isn't a repetitve pattern

        feedData.unshift({
            imgSrc : imgSrc,
            authorNick : authorNick,
            timestamp : postDate, 
            UUID : nodeUuid.v4(),
        });
        
        if(fs.existsSync(feedDataFile)){
            let ofMtime = fs.statSync(feedDataFile).mtime; // mtime of the original file
            
            let ofTs = ofMtime.getFullYear().toString() 
                            + (101 + ofMtime.getMonth()).toString().substr(1)
                            + (100 + ofMtime.getDate()).toString().substr(1) + '_' + 
                            + (100 + ofMtime.getHours()).toString().substr(1) 
                            + (100 + ofMtime.getMinutes()).toString().substr(1);

            let oldFeedDataFile = feedConfig.feedJSONdir + path.sep + 'old' + path.sep 
                   + feedConfig.feedJSONfile.replace(/json$/, ofTs + '.json');
            // preserve the old data file for reference purposes
            fs.renameSync(feedDataFile, oldFeedDataFile);
        }
        
        // cut the old entries
        feedData.splice(feedConfig.feedMaxEntries);
        fs.writeFileSync(feedDataFile, JSON.stringify(feedData, null, 2));
        // now that the new version of the data file has been written, 
        // call function, that creates the Atom feed
        produceAtomFeed(feedData);
    }
}

function produceAtomFeed(feedData){
    if(feedData === undefined){
        // if the feed data wasn't passed, load it
        let feedDataFile = feedConfig.feedJSONdir + path.sep + feedConfig.feedJSONfile;
        if(fs.existsSync(feedDataFile)){
            // loads the JSON if it exists
            feedData = JSON.parse(fs.readFileSync(feedDataFile)); 
        }
        else{
            return; // without data and the file, there isn't much to do
        }
    }
    
    let feedParts = [
      '<?xml version="1.0" encoding="UTF-8"?>' ,
      `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">\n`+
      `<id>${feedConfig.feedSource}</id>` + "\n" +
      `<title>${feedConfig.feedName}</title>` + "\n" + 
      '<updated>' + feedData[0].timestamp.toISOString() + '</updated>',
      `<link href="${feedConfig.feedSource}" rel="alternate"/>`, 
    ];
    
    for(let picPost of feedData){
        let picTS = picPost.timestamp;
        if(!(picTS instanceof Date)){
            // in case the date came from JSON, parse it firts
            picTS = new Date(Date.parse(picTS));
        }
        let formatedDate = picTS.getFullYear() + '-' + (picTS.getMonth() + 101).toString().substr(1) + '-' + (picTS.getDate() + 100).toString().substr(1) 
                                + ' ' + (picTS.getHours() + 100).toString().substr(1) + ':' + (picTS.getMinutes() + 100).toString().substr(1);
        var entry = `<entry>` +
                        `<id>${picPost.UUID}</id>\n` +
                        `<link href="${feedConfig.feedSource}"/>\n` +
                        `<title>${picPost.authorNick} - ${formatedDate}</title>\n` +
                        `<updated>${picTS.toISOString()}</updated>\n` +
                        `<summary type="html" >&lt;img src="${picPost.imgSrc}" title="autor: ${picPost.authorNick}"/&gt;&lt;br/&gt;autor: ${picPost.authorNick}</summary>\n` +
                    `</entry>`;

        feedParts.push(entry);
    }
    
    feedParts.push('</feed>');
    var feedHtmlOutOut = feedParts.join('\n');
    fs.writeFileSync(feedConfig.feedExportPath, feedHtmlOutOut);
}
