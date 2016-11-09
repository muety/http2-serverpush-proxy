'use strict';

const proxy = require('redbird')({
    port: 80,
    ssl: {
      port: 443,
      key: "certs/dev-key.pem",
        cert: "certs/dev-cert.pem",
    http2: true,
  }
});

proxy.register('localhost', 'http://localhost:8080', {ssl: true});