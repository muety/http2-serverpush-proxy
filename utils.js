'use strict';

module.exports = {
    copyHeaders: (from, to) => {
        for (let hKey in from.headers) {
            to.setHeader(hKey, from.headers[hKey]);
        }
    }
};