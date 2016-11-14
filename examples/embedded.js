const pushMiddleware = require('./../index')({ baseUrl: 'http://localhost:8080' })
    , app = require('express')()
    , http = require('spdy')
    , fs = require('fs');

app.use('/static', pushMiddleware.proxy);
app.use('/static', pushMiddleware.push);
app.get('/', (req, res) => {
    res.send('It works!');
});

const spdyOpts = {
    key: fs.readFileSync(__dirname + '/certs/dev-key.pem'),
    cert: fs.readFileSync(__dirname + '/certs/dev-cert.pem'),
    spdy: {
        protocols: ['h2', 'spdy/3.1', 'http/1.1'],
        plain: false,
        'x-forwarded-for': true,
    }
};

http.createServer(spdyOpts, app).listen(8081);