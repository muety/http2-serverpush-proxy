'use strict';

const request = require('request')
    , http = require('spdy')
    , Negotiator = require('negotiator')
    , utils = require('./utils');

module.exports = (baseUrl) => {
    return (req, res, next) => {
        const negotiator = new Negotiator(req);
        let htmlAccepted = !!negotiator.mediaType(['text/html']);

        let chunks;
        let proxyRequest = req.pipe(request({
            method: req.method,
            url: baseUrl + req.url,
            headers: req.headers,
            encoding: null
        })).on('response', (response) => {
            utils.copyHeaders(response, res);
            res.statusCode = response.statusCode;
        }).on('error', function (err) {
            res.statusCode = 500;
            next();
        }).on('data', function (chunk) {
            if (!chunks) chunks = chunk;
            else chunks = chunks.concat(chunk);
        }).on('end', () => {
            if (htmlAccepted && res._headers && res._headers['content-type'].indexOf('text/html') !== -1 || !chunks.length) res.htmlBody = chunks.toString('utf-8');
            else if (htmlAccepted) res.write(new Buffer(chunks));
            next();
        });

        if (!htmlAccepted) proxyRequest.pipe(res);
    };
};