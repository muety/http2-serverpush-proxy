'use strict';

module.exports = {
    copyHeaders: (from, to) => {
        for (let hKey in from.headers) {
            to.setHeader(hKey, from.headers[hKey]);
        }
    },
    omit: (obj, propertyKeys) => {
        if (!Array.isArray(propertyKeys)) propertyKeys = [propertyKeys];
        let newObj = {};
        Object.assign(newObj, obj);
        for (let key in propertyKeys) {
            delete newObj[key];
        }
        return newObj;
    },
    appendBuffer: (buffer1, buffer2) => {
        let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }
};