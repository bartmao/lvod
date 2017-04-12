import path = require('path')

export default class ServiceUtils{
    static getAbsolutePath(p){
        if(path.isAbsolute(p)) return p;
        return path.resolve(p);
    }

    static getShortTime(t?:Date){
        if(!t) t= new Date();
        return `${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}.${('000'+t.getMilliseconds()).substr(0,3)}`;
    }
}