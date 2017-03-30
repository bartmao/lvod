import ServiceBase from '../servicebase'
import VOD from './vod'
import Live from '../live/live'

export default class VODService extends ServiceBase {
    constructor() { super(); }

    startVOD(req){
        return VOD.startVOD(req.source);
    }

    getAvailStaticSources(){
        return  VOD.getAvailStaticSources()
            .then(s=>{
                let sources = s.map(l=> this.getPublicFields(l)) as any[];
                Live.getLivings().then(livings=>{
                    sources.forEach(source=>{
                        let live = livings.find(l=>l.sourceId == source.id);
                        if(live){
                            source['living'] = 1;
                            source['liveId'] = live.liveId;
                        }
                        else source['living'] = 0;
                    });
                });
                return sources;
            });
    }
}