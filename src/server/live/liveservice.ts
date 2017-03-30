import ServiceBase from '../servicebase'
import Live from './live'

export default class LiveService extends ServiceBase {
    constructor() { super(); }

    startLive(req) {
        return Live.startLive({
            reqTime: req.ts,
            type: req.type,
            source: req.source
        });
    }

    stopLive(req) {
        return Live.stopLive(req.liveId);
    }

    getLivings(){
        return Live.getLivings().then(livings=>{
            return livings.map(l=> this.getPublicFields(l));
        })
    }
}