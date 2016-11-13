'use strict';

const http = require('spdy')
    , fs = require('fs')
    , xpath = require('xpath')
    , dom = require('xmldom').DOMParser
    , request = require('request')
    , app = require('connect')()
    , stream = require('stream');

const spdyOpts = {
    key: fs.readFileSync(__dirname + '/certs/dev-key.pem'),
    cert: fs.readFileSync(__dirname + '/certs/dev-cert.pem'),
    spdy: {
        protocols: ['h2', 'spdy/3.1', 'http/1.1'],
        plain: false,
        'x-forwarded-for': true,
    }
};

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

const assetCache = {};

const proxy = (req, res, next) => {
    if (req.method !== 'GET' || !acceptsHtml(req) || fileExtensions.hasOwnProperty(getFileExtension(req.url)) || !res.push) {
        return pipeThrough(req, res).then(() => {
            next();
            return res.end();
        });
    }

    request(baseUrl + req.url, { headers: omit(req.headers, 'accept-encoding'), encoding: null }, (err, response, rawBody) => {
        let body = rawBody.toString('utf-8');

        if (err) return copyAndEnd(null, res, 500);
        if (response.statusCode !== 200) return copyAndEnd(response, res, response.statusCode);
        if (!body || body === '') return copyAndEnd(response, res, 404);

        let isHtml = true;
        let assets = parseAssetsFromHtml(body, () => {
            if (!isHtml) return;
            copyResponseHeaders(response, res);
            next();
            res.end(rawBody);
            isHtml = false;
        });

        let promises = [];
        let linkHeader = '';

        assets.forEach((asset, i) => {
            promises.push(new Promise((resolve, reject) => {
                if (asset.indexOf('/') !== 0) asset = '/' + asset;

                let pushStream = res.push(asset, { request: { 'accept': '*/*' } });
                pushStream.on('error', console.log);

                fetchAsset(asset, pushStream, omitContentRelatedHeaders(req.headers, { 'accept': fileExtensions[getFileExtension(asset)].mime })).then(resolve).catch(resolve);
            }));
            linkHeader += `<${asset}>; rel=preload; as=${fileExtensions[getFileExtension(asset)].as}${i < assets.length - 1 ? ',' : ''}`;
        });

        Promise.all(promises).then(() => {
            //if (assets.length) res.setHeader('link', linkHeader);
            copyResponseHeaders(response, res, true);
            next();
            res.end(isHtml ? body : rawBody);
        });
    });
};

function parseAssetsFromHtml(html, errorCallback) {
    let assets = [];
    let doc = new dom({
        errorHandler: {error: errorCallback}
    }).parseFromString(html);

    xpathQueries.forEach((q) => {
        let nodes = xpath.select(q, doc)
            .map(n => n.nodeValue)
            .filter(n => fileExtensions.hasOwnProperty(getFileExtension(n.toLowerCase())));
        assets = assets.concat(nodes);
    });
    return assets;
}

function pipeThrough(req, res) {
    return new Promise((resolve, reject) => {
        req.pipe(request({
            method: req.method,
            url: baseUrl + req.url,
            headers: req.headers
        }).on('response', (response) => {
            copyResponseHeaders(response, res, true);
            setTimeout(resolve, 0);
        }).on('error', function (err) {
            copyAndEnd(null, res, 500, err);
        })).pipe(res);
    });
}

function fetchAsset(assetUrl, destPushStream, headers) {
    return new Promise((resolve, reject) => {
        request(baseUrl + assetUrl, { headers: headers })
            .on('response', (response) => {
                destPushStream.sendHeaders(response.headers);
                setTimeout(resolve, 0);
            })
            .on('err', () => {
                return reject();
            })
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

function copyAndEnd(from, to, code, data) {
    if (from && to && typeof (from === 'object') && typeof (to === 'object')) copyResponseHeaders(from, to, true);
    to.writeHead(code);
    to.end(data);
}

function copyResponseHeaders(from, to, notWriteHead) {
    for (let hKey in from.headers) {
        to.setHeader(hKey, from.headers[hKey]);
    }
    if (!notWriteHead) to.writeHead(from.statusCode);
}

function getFileExtension(str) {
    return str.substr(str.lastIndexOf('.') + 1).split('?')[0];
}

function acceptsHtml(req) {
    return req.headers['accept'].indexOf('text/html') !== -1;
}

app.use(proxy);
http.createServer(spdyOpts, app).listen(8081);