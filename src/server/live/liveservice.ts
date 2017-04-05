import ServiceBase from '../servicebase'
import Live from './live'
import Live4Web from './live4web'

export default class LiveService extends ServiceBase {
    constructor() { super(); }

    startLive(req) {
        if (req.type == 0)
            return Live.startLive({
                reqTime: req.ts,
                type: req.type,
                source: req.source
            });
        return Live4Web.startLive({
            reqTime: req.ts,
            type: req.type,
            source: req.source
        });
    }

    stopLive(req) {
        return Live.stopLive(req.liveId);
    }

    getLivings() {
        return Live.getLivings().then(livings => {
            return livings.map(l => this.getPublicFields(l));
        })
    }
}