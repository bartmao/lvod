export default class ServiceBase {
    private _funcs;

    callFunction(funcName: string, data: any): Promise<any> {
        let func = null;
        funcName = funcName.toLowerCase();
        if (!this._funcs) {
            this._funcs = [];
            Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach(v => {
                if (this[v] instanceof Function &&
                    !/callFunction/i.test(v)) {
                    this._funcs.push([v.toLowerCase(), this[v]]);
                }
            });
        }

        this._funcs.forEach(e => {
            if (e[0] == funcName) {
                func = e[1];
                return false;
            }
        });

        if (func) {
            return func.bind(this, data)();
        }

        return null;
    }

    getPublicFields(obj: object) {
        let o = {};
        Object.getOwnPropertyNames(obj).forEach(p => {
            if(!p.startsWith('_')&& !(obj[p] instanceof Function))
                o[p] = obj[p];
        });
        return o;
    }
}