'use strict';

const http = require('spdy')
    , fs = require('fs')
    , request = require('request')
    , app = require('connect')()
    , proxy = require('./proxy')
    , push = require('./push')
    , argv = require('yargs').argv
    , path = require('path');

if (require.main === module) {
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

module.exports = (config) => {
    return {
        proxy: proxy(config.baseUrl),
        push: push(config)
    }
}