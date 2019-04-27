'use strict';

const GCP_PROJECT_ID = 'cloudstorage-test-237315';
const GCP_KEY_FILENAME = 'cloudstorage-test-237315-0a2d840ab4d6.json';
const {Datastore} = require('@google-cloud/datastore');
const moment = require('moment-timezone');
const datastore = new Datastore({
    projectId: GCP_PROJECT_ID,
    keyFilename: GCP_KEY_FILENAME
});

const cheerio = require('cheerio'),
    request = require('request'),
    nodeUuid = require('node-uuid');

let feedConfig = {
    feedName : 'Vymysli vtipný textík - výhreci jednotlivých kol',
    // where the feed gets exported
    // feedExportPath : "/var/www/default/witty-txt-pic/witty-txt-pic-feed.xml",
    // where the feed gets stored
    // feedJSONdir : "/var/tmp/witty-txt-pic-feed", 
    // what is the name of JSON file, containing the meta data from which the 
    // feed is generated
    feedJSONfile : "witty-txt.json",
    // at how many entries should the feed be capped
    feedMaxEntries : 50,
    // path to the page being scraped
    feedSource : 'http://www.okoun.cz/boards/vymysli_vtipny_textik'
};


async function getLatestFeedItem(){
    const query = datastore.createQuery ('WittyTxt', 'FeedItem')
           .order('timestamp',  { descending: true })
           .limit(1);
    const [feedItems] = await datastore.runQuery(query);
    return feedItems[0] || [];
}

async function storeFeedItems(feedItems){
    const items2insert = [];
    feedItems.forEach(elem => {
        const {imgSrc, authorNick, timestamp, UUID} = elem;
        const tsOut = new Date(Date.parse(timestamp));
        const key = datastore.key({
            namespace : 'WittyTxt',
            path: ['FeedItem', UUID]
        });
        items2insert.push({
            key, 
            data : {
                imgSrc, authorNick, timestamp : tsOut, UUID
            }
        });

        // console.log(items2insert);
    });

    await commitFeedItems2Datastore(items2insert);
}

async function commitFeedItems2Datastore(items2insert){
    console.log(`Trying to store ${items2insert.length} feed items`);
    while(items2insert.length > 0){
        try {
            const transaction = datastore.transaction();
            await transaction.run();
            transaction.save(items2insert.splice(0, 400));
            await transaction.commit();
            console.log(`FeedItems stored successfully, ${items2insert.length} to go`);
        } catch (err) {
            console.error('ERROR:', err);
            // res.send('ERROR:', err);
            return err;
        }
    }
}

// used to bootstrap the database
async function storeExistingFeedItems(){
    const items = require('./all-items.json');
    await storeFeedItems(items);
    console.log("Feed items succesfully stored");
}

async function scrapeFeedItems(){
    var reqOptions = {
        url : feedConfig.feedSource,
        headers: {
            'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language':'en-US,en;q=0.8',
            'Cache-Control':'max-age=0',
            'Connection':'keep-alive',
        },
        gzip : true,
    };
    
    return new Promise((resolve, reject) => {
        request.get(reqOptions, (err, res, body) => {
            if(err) return reject(err);
            if(!res.statusCode === 200){
                reject(new Error("scrapeFeedItems: Nedostal vraceny stauskod 200, to je zle"));
            }
            resolve(body);
        });
    });
}

// test if the folders for the storage of the feed exist and if not, create them :)

if(require.main == module){
    (async () => {
        // console.log(await fetchAndUpdateWiningImage());
        storeExistingFeedItems();
        // await getLatestTask();
        //console.log(await produceAtomFeed());
        // const body = await scrapeFeedItems();
        // console.log(body);
        // const itemsFound = await processFeedItemsFetch();
        // console.log("Najdenych novych " + itemsFound);
        // console.log(await produceAtomFeed());
        // uploadAllFeedItems2FTP()
        // testSub();
    })();
}
/**
 * Callback that handles the request
 */ 

/**
 * Searches the body to find image in header
 */

exports.fetchAndUpdateWiningImage = fetchAndUpdateWiningImage;

async function fetchAndUpdateWiningImage(){
    const body = await scrapeFeedItems();
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
        return processImageAndAuthorFound(imgSrc, authorNick);
    }
    else{
        return "No image could be scraped check the webpage!";
    }
}

/**
 * If an image was found on the page, this checks if it's new or if it already
 * exists in the feed. If the image is new, it adds it at the top of the feed
 * data and calls export
 */

async function processImageAndAuthorFound(imgSrc, authorNick){    
    const latestFeedItem = await getLatestFeedItem();
    let feedUpdateIsNeeded = false; // will be set to true, if feed update is needed
    // console.log(latestFeedItem);
    if(latestFeedItem){
            // if there are already any records in the feed
        if(latestFeedItem.imgSrc !== imgSrc){
            // if the src of the image differs, 
            // create new record and place it at the top
            feedUpdateIsNeeded = true;
        }else{
            feedUpdateIsNeeded = false;
        }
    }
    
    if(feedUpdateIsNeeded === true){
        var postDate = new Date();
        postDate.setMinutes(0); // if this is run repeatedly, reset minute and second, 
        postDate.setSeconds(0); // so that there isn't a repetitve pattern
        // just one item at time
        const feedData = [{
            imgSrc,
            authorNick,
            timestamp : postDate, 
            UUID : nodeUuid.v4(),
        }];
        
        // store newly found feed item
        await storeFeedItems(feedData);
        return `Stored new witty pic : ${imgSrc}`;
    }
    else{
        return "No new witty pic found\n";
    }
}

exports.produceAtomFeed = produceAtomFeed;

async function produceAtomFeed(){
    const query = datastore.createQuery ('WittyTxt', 'FeedItem')
           .order('timestamp',  { descending: true })
           .limit(feedConfig.feedMaxEntries);
    const [feedItems] = await datastore.runQuery(query);
    // console.log(feedItems);
    const feedData = [];
    feedItems.forEach(fe => {
      const feUUID = fe[datastore.KEY]; 
      const {imgSrc, authorNick, timestamp} = fe;     

      feedData.push({ UUID : feUUID.name, imgSrc, authorNick, timestamp })
    });
    // console.log(feedData);
    // process.exit();
    const hoursSub = parseInt(moment.tz(feedData[0].timestamp.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);
    const updatedDate = new Date(feedData[0].timestamp.getTime() - (hoursSub * 3600 * 1000));

    let feedParts = [
      '<?xml version="1.0" encoding="UTF-8"?>' ,
      `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">\n`+
      `<id>${feedConfig.feedSource}</id>` + "\n" +
      `<title>${feedConfig.feedName}</title>` + "\n" + 
      '<updated>' + updatedDate.toISOString() + '</updated>',
      `<link href="${feedConfig.feedSource}" rel="alternate"/>`, 
    ];
    
    for(let picPost of feedData){
        let picTS = picPost.timestamp;
        if(!(picTS instanceof Date)){
            // in case the date came from JSON, parse it firts
            picTS = new Date(Date.parse(picTS));
        }
        const hoursSub = parseInt(moment.tz(picTS.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);

        picTS = new Date(picTS.getTime() - (hoursSub * 3600 * 1000));

        let formatedDate = picTS.getFullYear() + '-' + (picTS.getMonth() + 101).toString().substr(1) + '-' + (picTS.getDate() + 100).toString().substr(1) 
                                + ' ' + (picTS.getHours() + 100).toString().substr(1) + ':' + (picTS.getMinutes() + 100).toString().substr(1);


        // console.log(`bPost.date before: ${bPost.date}`);
                        
                                
        var entry = `<entry>` +
                        `<id>${picPost.UUID}</id>\n` +
                        `<link href="${feedConfig.feedSource}"/>\n` +
                        `<title>${picPost.authorNick} - ${formatedDate}</title>\n` +
                        `<updated>${picTS.toISOString()}</updated>\n` +
                        `<summary type="html" >&lt;a href="${picPost.imgSrc}"&gt;&lt;img src="${picPost.imgSrc}" title="autor: ${picPost.authorNick}"/&gt;&lt;a/&gt;&lt;br/&gt;autor: ${picPost.authorNick}</summary>\n` +
                    `</entry>`;

        feedParts.push(entry);
    }
    
    feedParts.push('</feed>');
    var feedHtmlOutOut = feedParts.join('\n');
    return feedHtmlOutOut;
}
