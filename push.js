'use strict';

const xpath = require('xpath')
    , dom = require('xmldom').DOMParser
    , request = require('request')
    , utils = require('./utils');

const baseUrl = 'http://localhost:8080';
const xpathQueries = ["//link/@href", "//img/@src", "//script/@src"];
const fileExtensions = {
    'css': { mime: 'text/css', as: 'style' },
    'js': { mime: 'application/javascript', as: 'script' },
    'png': { mime: 'image/png', as: 'image' },
    'jpg': { mime: 'image/jpeg', as: 'image' },
    'gif': { mime: 'image/gif', as: 'image' },
    'svg': { mime: 'image/svg+xml', as: 'image' },
    'mp4': { mime: 'video/mp4', as: 'video' },
    'ogg': { mime: 'video/ogg', as: 'video' }
};

function parseAssetsFromHtml(html, errorCallback) {
    let assets = [];
    let doc = new dom({
        errorHandler: { error: errorCallback }
    }).parseFromString(html);

    xpathQueries.forEach((q) => {
        let nodes = xpath.select(q, doc)
            .map(n => n.nodeValue)
            .filter(n => fileExtensions.hasOwnProperty(getFileExtension(n.toLowerCase())));
        assets = assets.concat(nodes);
    });
    return assets;
}

function fetchAsset(assetUrl, destPushStream, headers) {
    return new Promise((resolve, reject) => {
        request(baseUrl + assetUrl, { headers: headers })
            .on('response', (response) => {
                destPushStream.sendHeaders(response.headers);
            })
            .on('err', reject)
            .on('end', resolve)
            .pipe(destPushStream);
    });
}

function omitContentRelatedHeaders(oldHeaders, additionalHeaderFields) {
    let newHeaders = omit(oldHeaders, ['accept', 'content-type']);
    Object.assign(newHeaders, additionalHeaderFields);
    return newHeaders;
}

// Returns new object without propertyKeys properties
function omit(obj, propertyKeys) {
    if (!Array.isArray(propertyKeys)) propertyKeys = [propertyKeys];
    let newObj = {};
    Object.assign(newObj, obj);
    for (let key in propertyKeys) {
        delete newObj[key];
    }
    return newObj;
}

function getFileExtension(str) {
    return str.substr(str.lastIndexOf('.') + 1).split('?')[0];
}

module.exports = (req, res, next) => {
    if (!res.htmlBody) return next();
    let body = res.htmlBody;

    let assets = parseAssetsFromHtml(body, () => {
        res.statusCode = 500;
        next();
    });

    let promises = [];
    let linkHeader = '';

    assets.forEach((asset, i) => {
        if (/^(http(s)?:)?\/\//.test(asset)) return;
        if (asset.indexOf('/') !== 0) asset = '/' + asset;

        promises.push(new Promise((resolve, reject) => {
            let pushStream = res.push(asset, { request: { 'accept': '*/*' } });
            pushStream.on('error', () => { return; });

            fetchAsset(asset, pushStream, omitContentRelatedHeaders(req.headers, { 'accept': fileExtensions[getFileExtension(asset)].mime })).then(resolve).catch(resolve);
        }));

        linkHeader += `<${asset}>; rel=preload; as=${fileExtensions[getFileExtension(asset)].as}${i < assets.length - 1 ? ',' : ''}`;
    });

    Promise.all(promises).then(() => {
        //if (assets.length) res.setHeader('link', linkHeader);
        res.write(body);
        next();
    });
};