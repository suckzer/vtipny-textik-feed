'use strict';

// script to search for picture similarities based on their occurence in discussion posts

// uses following files:

// vtipgrab.json - this file contains the text grabbed from the discussion
// fetchedPics.json - hash with pictures fetched
// postsById.json - contains hash of the posts sorted by the id with some meta information


let fs = require('fs'),
    jimp = require('jimp'),
    path = require("path");
    
const POSTS_BY_TIME_JSON = path.join(__dirname, 'vtipgrab.json');
const POSTS_BY_ID_JSON = path.join(__dirname, 'postsById.json');
const PICS_BY_URL_JSON = path.join(__dirname, 'fetchedPics.json');

// how many times the match group should be idle before it's considered "seniored" 
// and should be moved to the list of completed groups, no longer considered for matching
const MATCH_GROUP_MAX_IDLE_TIMES = 10;

let postsByTime = require(POSTS_BY_TIME_JSON),
    postsById = require(POSTS_BY_ID_JSON),
    picsByUrl = require(PICS_BY_URL_JSON);

let similarPicGroups = []; // contains similar pics in hashes, this only stores the already discovered groups
// the currently active groups are in another array

let activelyEvaledPicGroups = []; // contains recently discovered picture. Every pic, that does not fit will 
// be created as new. Every group contains conuter. With every new picture, the counter for the group, in which
// the picture doesn't match is increased. If the group surpasses certain path, you'll get the new item.

let errorsForPics = []; // logs errors for pictures in the format { 'url' : 'picUrl', 'error' : errObj }

// the structure for each group is as follows

// { counter : 0, // increased with each miss 
//   origPicture : some representation of the orig picture discovered, that will be 
//                 compared with the incomming pictures
//   similarPics : [time sorted array of similar pictures, contains even the original picture]
// }

// after there are too many misses, ie ?? 10 ?? the group will be moved to similarPicGroups . The original hash is deleted


let postIdx = postsByTime.length - 1;

fetchNextPost();

function fetchNextPost(){
    // debugger;
    if(postIdx < 0){
        // there are no more posts to process, save the file and exit
        
        while(activelyEvaledPicGroups.length > 0){
            // convert the currently active groups to something else
            let matchGroup = activelyEvaledPicGroups.pop() ;
            let closedGroup = matchGroup.similarPics;
            similarPicGroups.push(closedGroup);
        }
        
        fs.writeFile(path.join(__dirname, "groupedPics.json"), JSON.stringify(similarPicGroups, null, 2));
        fs.writeFile(path.join(__dirname, "errorsForPics.json"), JSON.stringify(errorsForPics, null, 2));
        return;
    }
    if(postIdx % 10 === 0){
        console.log(`Posts2go: ${postIdx}, Active groups: ${activelyEvaledPicGroups.length}, closed groups: ${similarPicGroups.length}`);
    }
    let postPics = postsById[postsByTime[postIdx].postId].picUrls;
    --postIdx;
    
    let fn2call = function(){
        let readNextPic = function(){
        if(postPics.length === 0){
            fetchNextPost();
            return; // finish this function if there are no more pics
        }
        // debugger;
        let currentPicUrl = postPics.shift();
        if(picsByUrl[currentPicUrl].status !== 200){
            // test if the current url is actually useful
            readNextPic();
            return;
        }
        let picPath = picsByUrl[currentPicUrl].file;
        jimp.read(picPath).then(function(loadedImg){
            // now try to compare the picture to all "origPictures", that might exist
            // debugger;
            let bestMatchGroupIdx = -1; // index of the best matching group in the group
                                        // of activelly matched master images
            let bestMatchVal = 100; // best matched value, 100%
            
            for(let matchGroupIdx in activelyEvaledPicGroups){
                let matchGroup = activelyEvaledPicGroups[matchGroupIdx];
                let distance = jimp.distance(matchGroup.origPicture, loadedImg); // perceived distance
                // let diff = jimp.diff(matchGroup.origPicture, loadedImg);
                if(distance < bestMatchVal){
                    bestMatchVal = distance // + diff;
                    bestMatchGroupIdx = matchGroupIdx;
                }
            }
            
            // now that all the groups were traversed, decide whether there is a match and the picture should be added into a group
            // or whether the match threshold was not met and new group should be created
            
            if(bestMatchVal < 0.18 && bestMatchGroupIdx > -1){
                // the picture matches with some group, just add the url of the picture to the list
                console.log(`${bestMatchVal} - tested pic ${currentPicUrl} (post: ${postIdx}) matches ${activelyEvaledPicGroups[bestMatchGroupIdx].similarPics[0].url}`);
                activelyEvaledPicGroups[bestMatchGroupIdx].similarPics.push({ url : currentPicUrl, postId : postsByTime[postIdx].postId});
            }
            else{
                // the picture doesn't match any of the existing ones. Create new match group for the pic
                activelyEvaledPicGroups.push(
                    {
                        counter : 0,
                        origPicture : loadedImg,
                        similarPics : [{ url : currentPicUrl, postId : postsByTime[postIdx].postId}],
                    }
                );
                bestMatchGroupIdx = activelyEvaledPicGroups.length - 1;
                console.log(`${bestMatchVal} - tested pic ${currentPicUrl} not matched. New group created`);
                debugger;
            }
            
            // increase the counters of the other match groups
            for(let matchGroupIdx in activelyEvaledPicGroups){
                if(matchGroupIdx !== bestMatchGroupIdx.toString()){
                    // increase the counter
                    ++activelyEvaledPicGroups[matchGroupIdx].counter;
                }
            }
            
            for(let matchGroupIdx = 0; matchGroupIdx < activelyEvaledPicGroups.length; ++matchGroupIdx){
                // if you've discovered a match group, in which there wasn't added no picture in last MATCH_GROUP_MAX_IDLE_TIMES,
                // then move it on the stack
                let matchGroup = activelyEvaledPicGroups[matchGroupIdx]
                if(matchGroup.counter > MATCH_GROUP_MAX_IDLE_TIMES){
                    // move it to the other array
                    let closedGroup = matchGroup.similarPics;
                    similarPicGroups.push(closedGroup);
                    console.log(`Active group closed. Current active groups: ${activelyEvaledPicGroups.length}, closed groups: ${similarPicGroups.length}`);
                    activelyEvaledPicGroups.splice(matchGroupIdx, 1);
                    --matchGroupIdx;
                }
            }
            
            readNextPic(); // read next picture, if needed

        }).catch(function(err){
            // fixme - no recovery is signalized here
            console.error("thrown from promise");
            console.error(err );
            errorsForPics.push({url : currentPicUrl, error : err.toString()});
            readNextPic(); // read next picture, if needed
        })
        }
        
        return readNextPic;
    }

    // call the function above, if the picture was read
    let closure = fn2call(); 
    closure();
}


