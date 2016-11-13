'use strict';

const xpath = require('xpath')
    , dom = require('xmldom').DOMParser
    , request = require('request')
    , utils = require('./utils');

const FILE_EXTENSIONS = {
    'css': { mime: 'text/css', as: 'style' },
    'js': { mime: 'application/javascript', as: 'script' },
    'png': { mime: 'image/png', as: 'image' },
    'jpg': { mime: 'image/jpeg', as: 'image' },
    'gif': { mime: 'image/gif', as: 'image' },
    'svg': { mime: 'image/svg+xml', as: 'image' },
    'mp4': { mime: 'video/mp4', as: 'video' },
    'ogg': { mime: 'video/ogg', as: 'video' }
};

const cfg = { baseUrl: '', extensions: {} }
    , xpathQueries = ["//link/@href", "//img/@src", "//script/@src"];

function parseAssetsFromHtml(html, errorCallback) {
    let assets = [];
    let doc = new dom({
        errorHandler: { error: errorCallback }
    }).parseFromString(html);

    xpathQueries.forEach((q) => {
        let nodes = xpath.select(q, doc)
            .map(n => n.nodeValue)
            .filter(n => cfg.extensions.hasOwnProperty(getFileExtension(n.toLowerCase())));
        assets = assets.concat(nodes);
    });
    return assets;
}

function fetchAsset(assetUrl, destPushStream, headers) {
    return new Promise((resolve, reject) => {
        request(cfg.baseUrl + assetUrl, { headers: headers })
            .on('response', (response) => {
                destPushStream.sendHeaders(response.headers);
            })
            .on('err', reject)
            .on('end', resolve)
            .pipe(destPushStream);
    });
}

function omitContentRelatedHeaders(oldHeaders, additionalHeaderFields) {
    let newHeaders = utils.omit(oldHeaders, ['accept', 'content-type']);
    Object.assign(newHeaders, additionalHeaderFields);
    return newHeaders;
}

function getFileExtension(str) {
    return str.substr(str.lastIndexOf('.') + 1).split('?')[0];
}

module.exports = (config) => {
    if (/^https/.test(config.baseUrl)) return console.log('[Push Middleware] Error: Proxied endpoints must not be encrypted (no https)!');
    cfg.baseUrl = config.baseUrl.lastIndexOf('/') === config.baseUrl.length - 1 ? config.baseUrl.split('/').slice(0, -1).join('/') : config.baseUrl;
    if (config.extensions && config.extensions.length) config.extensions.forEach((e) => { cfg.extensions[e] = FILE_EXTENSIONS[e]} )
    else cfg.extensions = FILE_EXTENSIONS;

    return (req, res, next) => {
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

                fetchAsset(asset, pushStream, omitContentRelatedHeaders(req.headers, { 'accept': cfg.extensions[getFileExtension(asset)].mime })).then(resolve).catch(resolve);
            }));

            linkHeader += `<${asset}>; rel=preload; as=${cfg.extensions[getFileExtension(asset)].as}${i < assets.length - 1 ? ',' : ''}`;
        });

        Promise.all(promises).then(() => {
            //if (assets.length) res.setHeader('link', linkHeader);
            res.write(body);
            next();
        });
    };
};