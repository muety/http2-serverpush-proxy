'use strict';

const http = require('spdy')
    , fs = require('fs')
    , request = require('request')
    , app = require('connect')()
    , proxy = require('./proxy')
    , push = require('./push');

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
app.use(push);
app.use((req, res) => {
    res.end();
});

http.createServer(spdyOpts, app).listen(8081);