'use strict';

// TODO

// download the pictures so that they are


let fs = require('fs'),
    path = require('path'),
    request = require('request'),
    picsLocalFolder = '/var/tmp/dldPics';

// debugger

let wits = require(__dirname + path.sep +  'vtipgrab.json');
let fetchedPicturesJSONfile = __dirname + path.sep +  'fetchedPics.json';

let picCount = {}; // to store the texts

let cnt = 0;
for (let v of wits) {
    let picUrls = getPicUrlsFromPostHTML(v);
    if (picUrls.length > 0) {
        ++cnt;
        // console.log(m[1]);
        // if(cnt > 30) process.exit()
        for(let picUrl of picUrls){
            picCount[picUrl] = picCount[picUrl] || 0;
            ++picCount[picUrl];
        }
    }
}

let doublePic = 0;
let histoDoubledPictures = {}
for (let picUrl in picCount) {
    if (picCount[picUrl] > 1) {
        ++doublePic;
    }
    histoDoubledPictures[picCount[picUrl]] = histoDoubledPictures[picCount[picUrl]] || 0;
    ++histoDoubledPictures[picCount[picUrl]];
}

console.log("Double picturu je: " + doublePic)
console.log("celkem picturu je: " + cnt)
console.log("Histogram of double pictures:")
console.log(histoDoubledPictures)

// start downloading the pictures somewhere
let picCtr = 0;


// ========================================================
// this part will try to link the reaction items
// ========================================================

var postsById = {} ; // this will contain the IDs of posts

for(let witId = wits.length - 1; witId >= 0; --witId){
    let wit = wits[witId];
    postsById[wit.postId] = wit;
    // this will contain the reaction numbers
    postsById[wit.postId].reactions = [];
    if(postsById[wit.reactionId] !== undefined){
        postsById[wit.reactionId].reactions.push(wit.postId);
    }
    // now search for the pictures
    let picUrlsInPost = getPicUrlsFromPostHTML(wit);
    postsById[wit.postId].picUrls = picUrlsInPost;    
}

debugger;

let reactHist = {};
// now traverse the hash and find out, how many reactions each post has
for(let postId in postsById){
    let reactCnt = postsById[postId].reactions.length;
    reactHist[reactCnt] = reactHist[reactCnt] || 0;
    ++reactHist[reactCnt];
}

console.log("Histogram of reactions: ");
console.log(reactHist);

console.log("Posts with more than one picture:");
for(let postId in postsById){
    if(postsById[postId].picUrls.length > 1){
        console.log(postId);
        console.log(postsById[postId].contentHTML);
    }
}

// histogram of pictures by type

let suffixHist = [];

for(let postId in postsById){
    // if the post contains exaclty one picture
    for(let picUrl of postsById[postId].picUrls){
        let pMatch = picUrl.match(/([A-Za-z]+)$/);
        if(pMatch !== null){
            let suffix = pMatch[1];
            suffixHist[suffix] = suffixHist[suffix] || 0;
            ++suffixHist[suffix];
            if(suffix.toLowerCase() === 'gif'){
                console.log("Post with gif:")
                console.log(postsById[postId]);
            }
        }
    }
}

console.log("Histogram of suffixes: ");
console.log(suffixHist);


// ========================================================
// this part will try to analyze each of the posts with 
// reactions:
//  - whether the post contains a picutre
//  - whether the reactions contains just text or picture as well   
// ========================================================

let totalPostsWithPicsInReactions = 0;

for(let postId in postsById){
    // if the post contains exaclty one picture
    if(postsById[postId].picUrls.length === 1){
        for(let reactId of postsById[postId].reactions){
            if(postsById[reactId].picUrls.length > 0){
                console.log("found reaction with picture:");
                console.log("post HTML:\n" + postsById[postId].contentHTML);
                console.log("reaction HTML:\n" + postsById[reactId].contentHTML);
                totalPostsWithPicsInReactions++;
            }
        }        
    }
}

console.log("total reactions with pics: " + totalPostsWithPicsInReactions);



// trying to print reactions of the posts
for(let postId in postsById){
    // if the post contains exaclty one picture
    if(postsById[postId].picUrls.length === 1){
        console.log("======== Post with pic: ==========");
        console.log("post HTML:\n" + postsById[postId].contentHTML);
        for(let reactId of postsById[postId].reactions){
            console.log("reaction HTML:\n" + postsById[reactId].contentHTML);
        }
    }
}

console.log("total reactions with pics: " + totalPostsWithPicsInReactions);


// ========================================================
// this part bellow is used to download the pictures
// ========================================================

// create some folder to download to if it doesn't exist

if (!fs.existsSync(picsLocalFolder)) {
    fs.mkdirSync(picsLocalFolder);
    fs.writeFileSync(picsLocalFolder + path.sep + 'README', 'Here come the downloaded pics');
}

let picUrls = Object.keys(picCount);

let urls2files = {}; // hash, that will have key as URL
let picIdx = 0; // the ever increasing counter for the pictures

let fetchedPictures = {}; // this will contain map with data structure
// 'url of the picture' => { 'status' : 200, 'file' : 'blabla-2222.jpg'}
// status, marks the http request status
// file: name of the file in the picsLocalFolder, in case the file was correctly
// downloaded 

if(fs.existsSync(fetchedPicturesJSONfile)){
    // load the JSON
    fetchedPictures = require(fetchedPicturesJSONfile);
}

let fetchList = []; // will contain an array of urls and lists to fetch

// prepare list of pictures to fetch
while (picUrls.length > 0) {
    let procPicUrl = picUrls.pop();
    if(fetchedPictures[procPicUrl] !== undefined
        && fetchedPictures[procPicUrl].status === 200){
        continue; // if the picture was already fetched, ignore it this time
    }
    let procPicNameMatch = procPicUrl.match(/([^\/]+$)/);
    if (procPicNameMatch !== null) {
        let localName = picsLocalFolder +  path.sep  + (10000 + picIdx).toString().substr(1)
            + '-' + procPicNameMatch[1];            
        ++picIdx;
        
        fetchList.push({url : procPicUrl, file : localName});
    }
}

// will contain the number of requests
let curRequests = 0, maxReqs = 10;


procNextPicFromList();

function procNextPicFromList(){
    if(fetchList.length > 0){
        // if there are still some pics to process                        
        let fetchData = fetchList.pop();
        ++curRequests;
        console.log(`Current reqCount: ${curRequests}, url: ${fetchData.url}, pics2go: ${fetchList.length}`);
        
        let writeStream = fs.createWriteStream(fetchData.file); 
        
        request.get(fetchData.url)
            .on('error', function(err){
                console.log('For ${fetchData.url} received an error', err );
                fetchedPictures[fetchData.url] = {
                    status : -1,
                    error : err
                }
                fetchNextPic(true);
            })
            .on('response', function(res){
                console.log(`Status code: ${res.statusCode}, picUrl ${fetchData.url}, path was: ${fetchData.file}`);
                
                // console.log(`Content type: ${res.headers['content-type']}`);
                fetchedPictures[fetchData.url] = {
                    status : res.statusCode
                };
                // fetchNextPic(true)
                
                if(res.statusCode === 200){
                    // picture was returned correctly
                    fetchedPictures[fetchData.url].file = fetchData.file;
                }
                else{
                    console.log("Returned statusCode ${statusCode}");
                }
                fetchNextPic(true);
            })
            .pipe(writeStream);
            
        writeStream.on('error', function(err){
            console.log("Write stream error: ");
            console.log(err); 
        });
        
        writeStream.on('end', function(err){
            console.log(`Write stream for ${fetchData.file} closed`);
            console.log(err); 
        });
            
        // try to fetch next picture from the list
        // fetchNextPic();
    }
}

// function procNextPicFromList(){
//     if(fetchList.length > 0){
//         // if there are still some pics to process                        
//         let fetchData = fetchList.pop();
        
//         let reqOptions = {
//             url : fetchData.url,
//             encoding: null,
//         }
        
//         console.log(`Current reqCount: ${curRequests}, url: ${fetchData.url}, pics2go: ${fetchList.length}`);
        
//         let writeStream = fs.createWriteStream(fetchData.file); 
        
//         request.get(reqOptions, function(err, res, buffer){
//             if(err !== null){
//                 console.log('For ${fetchData.url} received an error', err );
//                 fetchedPictures[fetchData.url] = {
//                     status : -1,
//                     error : err
//                 }
//                 fetchNextPic(true);
//             }
//             else{
//                 console.log(`Status code: ${res.statusCode}, picUrl ${fetchData.url}, path was: ${fetchData.file}`);
                
//                 // console.log(`Content type: ${res.headers['content-type']}`);
//                 fetchedPictures[fetchData.url] = {
//                     status : res.statusCode
//                 };
                
//                 if(res.statusCode === 200){
//                     // picture was returned correctly
//                     fetchedPictures[fetchData.url].file = fetchData.file;
//                     fs.writeFile(fetchData.file, buffer);
//                 }
//                 else{
//                     console.log("Returned statusCode ${statusCode}");
//                 }
//                 fetchNextPic(true);
//             }
//         });
            
            
//         // try to fetch next picture from the list
//         // fetchNextPic();
//     }
// } 


/**
 * Tests, whether the number of requests is currently lower than maxReqs and in that case runs a request;
 */

function fetchNextPic(doSubstract){
    if(doSubstract === true){
        --curRequests;
    }
    if(curRequests < maxReqs){
        procNextPicFromList();
    }
    
    // only if there are no extra data, 
    if(curRequests === 0 && fetchList.length === 0){
        fs.writeFile(fetchedPicturesJSONfile, JSON.stringify(fetchedPictures, null, 2));
    }
    else{
        procNextPicFromList();
    }
} 


/**
 * extracts all pictures, that are contained in the url
 */

function getPicUrlsFromPostHTML(post){
    let picUrlsOut = [];
    let picMatch = post.contentHTML.match(/<img\s+src=["']?([^"'> ]+)/gi);
    if (picMatch) {
        for(let matchedPic of picMatch){
            let singleMatch = matchedPic.match(/<img\s+src=["']?([^"'> ]+)/);
            picUrlsOut.push(singleMatch[1]);
        }
    }
    
    // return the pictures matched
    return picUrlsOut;
}


