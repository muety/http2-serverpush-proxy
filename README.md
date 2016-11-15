# http2-serverpush-proxy

This is a reverse proxy that helps you to automatically make use of HTTP/2.0's [server push](http://blog.xebia.com/http2-server-push/) mechanism for your static websites.

[![NPM](https://nodei.co/npm/http2-serverpush-proxy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/http2-serverpush-proxy/)

## How it works
Usually, websites consist of multiple assets, like CSS and JS files as well as images like PNGs, JPGs and SVGs. Traditionally, a user's browser fetches the HTML first, parses it and then downloads all linked assets. However, this is slow, since the assets can't be loaded before the HTML is completely fetched and parsed. With server push, your webserver can actively sends those assets to the client browser even before it requested them. To prevent you from having to implement this functionality, _http2-serverpush-proxy_ sits as a proxy between your actual webserver and the user. In contrast to some other approaches like [http2-push-manifest](https://github.com/GoogleChrome/http2-push-manifest), where the assets to be pushed are declared statically, this library __dynamically parses the HTML__ files and extracts contained asset that should be pushed.

![](https://anchr.io/i/XEitW.png)
Without server push
![](https://anchr.io/i/AOisH.png)
With server push

## Usage
### Standalone
One way to use this is as a standalone proxy by installing it globally with `npm install -g http2-serverpush-proxy`
```bash
$ serverpush-proxy --extensions=css,js,svg --target=http://localhost:8080 --key=./certs/dev-key.pem --cert=./certs/dev-cert.pem --port 3000
```

#### Options
* `--target` __[required]__: The target URL to be proxied. E.g. if your website runs at _http://localhost:8080_, this would be your target URL. 
* `--extensions`: File extensions to be push candidates Defaults to: see [this section](#what-is-pushed)
* `--key` __[required]__: Path to your SSL key (HTTP/2 requires TLS (HTTPS) encryption) .
* `--cert` __[required]__:  Path to your SSL certificate.
* `--port`: Port to make the proxy listen on. Defaults to `8080`.

### Embedded (connect middleware)
You can also use this library as [connect](https://www.npmjs.com/package/connect) middleware in your application. You need a webserver running with [node-spdy](https://www.npmjs.com/package/spdy) (you need HTTP/2!). Please not that currently this middleware must be __the last one in your stack__, since it calls `res.end()`.

#### Example
```javascript
const pushMiddleware = require('http2-serverpush-proxy')({ baseUrl: 'http://localhost:8080' })
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
```

This would spawn an Express webserver, where all requests to `/static` are proxied to `http://localhost:8080` and all HTML (`Content-Type: text/html`) responses are parsed for assets to get server-pushed.

#### Options
Instantiating the middleware happens through calling a function (see line 1) that receives a config object with following parameters.
* `baseUrl` __[required]__: The target URL to be proxied. E.g. if your website runs at _http://localhost:8080_, this would be your target URL. 
* `extensions` __[optional]__: File extensions to be push candidates Defaults to: see [this section](#what-is-pushed)

## What is pushed?
Currently, `<img src="..."`, `<script src="..."` and `<link href="..."` attributes are parsed when looking for assets. Supported file types to be pushed include `css`, `js`, `png`, `jpg`, `gif` and , `svg`.

Non-GET requests as well as requests, which don't `Accept` HTML are directly piped to and from the proxy. GET requests, which accept HTML (`text/html`, `text/*`, `*/*`) are fetched by the proxy first. If `Content-Type` doesn't equal `text/html`, they're written to the response. Otherwise the HTML response body (the one from the proxied server) is parsed, assets are fetched and pushed and finally the HTML payload is also written to the response.

## Constraints
* The proxied server mustn't use encryption (no HTTPS)
* The proxied server mustn't use compression (no `Content-Encoding`). `Accept-Encoding` headers are removed from any request.
* The proxied server musn't require authentication
* The proxy only listens for HTTPS connections. If you want to support "upgrading" an _http://_ request to _https://_, you'd need another proxy (like nginx) to do that redirect.

## What doesn't work / Todo
This library is not completely finished, yet. Consequently it still lacks of some useful features, which should be implemented some time. 
* Support for __Websockets__
* Support for HTTP __authentication__
* Also push dynamically included HTML (__WebComponents__, ng-include, ...)
* Support for __compression__ (gzip, deflate)
* Avoid this from having to be the very last middleware step, but support __further middleware after it__

## Contribute
If you find bugs, feel free to do a pull request or open an [issue](https://github.com/n1try/http2-serverpush-proxy/issues). If you want to implement some of the above Todos, that'd be great of course ;-)

## License
MIT @ [Ferdinand Mütsch](https://ferdinand-muetsch.de)