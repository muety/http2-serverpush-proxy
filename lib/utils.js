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
    }
};