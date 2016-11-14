#!/usr/bin/env node

'use strict';

const http = require('spdy')
    , fs = require('fs')
    , request = require('request')
    , app = require('connect')()
    , proxy = require('./lib/proxy')
    , push = require('./lib/push')
    , argv = require('yargs').argv
    , path = require('path')
    , sprintf = require("sprintf-js").sprintf;

if (require.main === module) {
    if (!argv.target || !argv.key || !argv.cert) return printHelp();
    const baseUrl = argv.target;
    const sslKey = argv.key;
    const sslCert = argv.cert;
    const port = argv.port || 8080;
    const extensions = argv.extensions ? argv.extensions.split(',') : null;

    const spdyOpts = {
        key: fs.readFileSync(path.normalize(sslKey)),
        cert: fs.readFileSync(path.normalize(sslCert)),
        spdy: {
            protocols: ['h2', 'spdy/3.1', 'http/1.1'],
            plain: false,
            'x-forwarded-for': true,
        }
    };

    app.use(proxy(baseUrl));
    app.use(push({baseUrl: baseUrl, extensions: extensions}));
    http.createServer(spdyOpts, app).listen(port);
}

function printHelp() {
    const help = `
        Welcome to serverpush-proxy!

        These parameters are required:
        --target=       The target URL to be proxied. E.g. http://localhost:8080.
        --key=          Path to your SSL key (HTTP/2 requires TLS (HTTPS) encryption). E.g. ./certs/key.pem.
        --cert=         Path to your SSL certificate. E.g. ./certs/cert.pem.

        Additionally, these parameters are optional:
        --extensions=    File extensions to be push candidates. E.g. css,js,svg
        --port=         Port to make the proxy listen on. Defaults to 8080.
    `;
    console.log(sprintf(help));
}

module.exports = (config) => {
    return {
        proxy: proxy(config.baseUrl),
        push: push(config)
    }
}