import path = require('path')

export default class ServiceUtils {
    static getAbsolutePath(p) {
        if (path.isAbsolute(p)) return p;
        return path.resolve(p);
    }

    static getShortTime(t?: Date) {
        if (!t) t = new Date();
        return `${ServiceUtils.padLeft(t.getHours(), 2)}:${ServiceUtils.padLeft(t.getMinutes(), 2)}:${ServiceUtils.padLeft(t.getSeconds(), 2)}.${ServiceUtils.padLeft(t.getMilliseconds(), 3)}`;
    }

    static padLeft(s: any, len: number) {
        s = new Array(len + 1).join('0') + s.toString();
        return s.substr(s.length - len, len);
    }
}