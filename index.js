const {produceAtomFeed, fetchAndUpdateWiningImage} = require('./witty-txt-feed');
// const moment = require('moment-timezone');

exports.getWittyTxtAtomFeed = async (req, res) => {
    const feedData = await produceAtomFeed();
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.send(feedData);
}

exports.fetchAndUpdateWiningWittyTxtImage = async (req, res) => {
    const newItemsFound = await fetchAndUpdateWiningImage();
    res.send(`${newItemsFound}`);
}
