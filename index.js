'use strict';

const http = require('spdy')
    , fs = require('fs')
    , request = require('request')
    , app = require('connect')()
    , proxy = require('./proxy');

const spdyOpts = {
    key: fs.readFileSync(__dirname + '/certs/dev-key.pem'),
    cert: fs.readFileSync(__dirname + '/certs/dev-cert.pem'),
    spdy: {
        protocols: ['h2', 'spdy/3.1', 'http/1.1'],
        plain: false,
        'x-forwarded-for': true,
    }
};

app.use(proxy);
app.use((req, res) => {
    if (res.htmlBody) res.write(res.htmlBody);
    res.end();
});

http.createServer(spdyOpts, app).listen(8081);