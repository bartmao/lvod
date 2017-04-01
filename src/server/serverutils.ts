import path = require('path')

export default class ServiceUtils{
    static getAbsolutePath(p){
        if(path.isAbsolute(p)) return p;
        return path.resolve(p);
    }
}