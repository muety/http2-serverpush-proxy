'use strict';

const http = require('spdy')
    , fs = require('fs')
    , xpath = require('xpath')
    , dom = require('xmldom').DOMParser
    , request = require('request');

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
    'css': 'text/css',
    'js': 'application/javascript',
    'png': 'image/png',
    //'jpg': 'image/jpeg',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'ogg': 'video/ogg',
    'svg': 'image/svg+xml'
};

const assetCache = {};

const proxy = (req, res) => {
    if (!acceptsHtml(req) || (acceptsHtml(req) && fileExtensions.hasOwnProperty(getFileExtension(req.url))) || !res.push) {
        return request
            .get(baseUrl + req.url, { headers: req.headers })
            .on('response', (response) => {
                copyResponseHeaders(response, res);
            })
            .on('error', function (err) {
                copyAndEnd(response, res, 500, err);
            })
            .pipe(res);
    }

    request(baseUrl + req.url, { headers: req.headers }, (err, response, body) => {
        if (err) return copyAndEnd(null, res, 500);
        if (response.statusCode !== 200) return copyAndEnd(response, res, response.statusCode);
        if (!body || body === '') return copyAndEnd(response, res, 404);

        let assets = [];
        let doc = new dom().parseFromString(body);

        xpathQueries.forEach((q) => {
            let nodes = xpath.select(q, doc)
                .map(n => n.nodeValue)
                .filter(n => fileExtensions.hasOwnProperty(getFileExtension(n.toLowerCase())));
            assets = assets.concat(nodes);
        });

        let promises = [];

        assets.forEach((asset) => {
            promises.push(new Promise((resolve, reject) => {
                res.setHeader('link', `<${asset}>; rel=preload`);

                if (asset.indexOf('/') !== 0) asset = '/' + asset;

                fetchAsset(asset).then((assetData) => {
                    let pushStream = res.push(asset, {
                        request: { 'accept': '*/*' },
                        response: { 'content-type': fileExtensions[getFileExtension(asset)] + '; charset=utf-8' }
                    });

                    pushStream.on('error', err => {
                        console.log(err);
                    });
                    pushStream.end(assetData);
                    resolve();
                }).catch((response) => {
                    resolve(); // simply no server push if something went wrong with the asset
                });
            }));
        });

        Promise.all(promises).then(() => {
            setTimeout(() => {
                copyResponseHeaders(response, res);
                res.end(body);
            }, 1000);
        });
    });
};

function fetchAsset(assetUrl) {
    return new Promise((resolve, reject) => {
        request(baseUrl + assetUrl, (err, response, body) => {
            if (err) return reject(response);
            if (response.statusCode !== 200) return reject(response);
            return resolve(body);
        });
    });
}

function copyAndEnd(from, to, code, data) {
    if (from) copyResponseHeaders(from, to);
    to.writeHead(code);
    to.end(data);
}

function copyResponseHeaders(from, to) {
    for (let hKey in from.headers) {
        to.setHeader(hKey, from.headers[hKey]);
    }
    to.writeHead(from.statusCode);
}

http.createServer(spdyOpts, proxy).listen(443);

function getFileExtension(str) {
    return str.substr(str.lastIndexOf('.') + 1).split('?')[0];
}

function acceptsHtml(req) {
    return req.headers['accept'].indexOf('text/html') !== -1;
}