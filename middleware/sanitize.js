const xss = require('xss');

const sanitizePayload = (obj) => {
    if (typeof obj === 'string') {
        return xss(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizePayload(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            // we don't strictly need to sanitize keys, just values
            sanitizedObj[key] = sanitizePayload(value);
        }
        return sanitizedObj;
    }
    return obj;
};

const sanitize = (req, res, next) => {
    if (req.body) {
        req.body = sanitizePayload(req.body);
    }
    if (req.query) {
        req.query = sanitizePayload(req.query);
    }
    if (req.params) {
        req.params = sanitizePayload(req.params);
    }
    next();
};

module.exports = sanitize;
