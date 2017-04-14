import ServiceBase from '../servicebase'
import Live from './live'
import Live4Web from './live4web'

export default class LiveService extends ServiceBase {
    constructor() { super(); }

    startLive(req) {
        if (req.type == 0)
            return Live.startLive({
                reqTime: new Date(req.ts),
                type: req.type,
                source: req.source
            });
        return Live4Web.startLive({
            reqTime: new Date(req.ts),
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

    getLiveStatus(liveId){
        return Live4Web.getLivings().then(lives=>lives.find(l=>l.liveId==liveId));
    }

    uploadFrames(req){
        return Live4Web.uploadFrames(req.liveId, req.seq, req.frames, new Date(req.ts));
    }
}