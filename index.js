'use strict';

const http = require('spdy')
    , httpProxy = require('http-proxy')
    , proxy = httpProxy.createProxyServer()
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
    'jpg': 'image/jpeg'
};

let fooAsset = '';
request('http://localhost:8080/assets/css/lato.css', (err, response, body) => {
    fooAsset = body;
});


proxy.on('proxyRes', function (proxyRes, req, res, options) {
    var responseBody = '';

    proxyRes.on('data', (chunk) => {
        let c = chunk.toString();
        responseBody += chunk.toString();
    }).on('end', () => {
        if (responseBody !== '') {
            let assets = [];
            let doc = new dom().parseFromString(responseBody);

            xpathQueries.forEach((q) => {
                let nodes = xpath.select(q, doc)
                    .map(n => n.nodeValue)
                    .filter(n => Object.keys(fileExtensions).includes(getFileExtension(n.toLowerCase())));
                assets = assets.concat(nodes);
            });

            assets.forEach((asset) => {
                if (asset.indexOf('lato.css') === -1) return;
                let target = asset.indexOf(baseUrl) === 0 ? asset : baseUrl + (asset.indexOf('/') === 0 ? asset : '/' + asset);
                //request(target, (err, response, body) => {
                //if (err) return console.log(err);
                //if (response.statusCode !== 200) return console.log(response.statusCode);
                //if (!body || body == '') return console.log('Body was empty.');

                let pushStream = res.push('https://localhost/assets/css/lato.css', {
                    request: { 'accept': '*/*' },
                    response: { 'content-type': 'text/css' }
                });

                pushStream.on('error', err => {
                    console.log(err);
                });

                pushStream.end(fooAsset);
        res.end();
                
                //});
            });
        }
    });
});

http.createServer(spdyOpts, (req, res) => {
    proxy.web(req, res, {
        target: 'http://localhost:8080'
    });
}).listen(443);

function getFileExtension(str) {
    return str.substr(str.lastIndexOf('.') + 1);
}