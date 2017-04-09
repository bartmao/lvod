import nodeuuid = require('node-uuid')
import path = require('path');
import cp = require('child_process');
import fs = require('fs');
import events = require('events');

import ResourceManager from '../resourcemanager';
const liveConfig = require('./liveconfig.json')

export default class Live4Web extends events.EventEmitter {
    static _lives: Array<Live4Web> = [];

    private _workingPath: string = null;
    private _ffmpeg_ps: cp.ChildProcess;

    private _ffmpeg: string;
    private _mp4box: string;
    private _ffmpeg_trans: string;
    private _mp4box_add: string;
    private _mp4box_pkg: string;
    private _tsBuffers: Array<string>;
    private _curGroup: number;

    liveId: string;
    sourceType: string;
    sourceTrack: string; // video,audio,mul
    source: string;
    sourceId: number;
    sourceName: string;
    sourcePath: string;
    initTime: Date;
    liveTime: Date;

    constructor() {
        super();
        this._ffmpeg = liveConfig.cmd.ffmpeg;
        this._mp4box = liveConfig.cmd.mp4box;
        this._ffmpeg_trans = liveConfig.ffmpegtrans4web;
        this._mp4box_add = liveConfig.mp4boxadd;
        this._mp4box_pkg = liveConfig.mp4boxpkg4web;
        this._curGroup = 1;

        this.liveId = nodeuuid.v4();
        this._workingPath = path.join(liveConfig.outputDir, this.liveId);
        this._tsBuffers = [];
    }

    static startLive(req: LiveRequest) {
        return new Promise<any>((resolve, reject) => {
            let live = new Live4Web();
            live.source = req.source;
            live.sourceType = req.type;
            live.sourceId = 0;
            live.sourcePath = null;
            live.sourceName = null;
            live.initTime = req.reqTime;

            Live4Web._lives.push(live);
            fs.mkdirSync(live._workingPath);
            resolve({
                liveId: live.liveId
            });
            // fs.watch(__dirname + '/../../../resources/bitmap', (evt, fn) => {
            //     if (evt == 'rename') {
            //         var gp = parseInt(fn.split('_')[0]);
            //         if (gp > live._curGroup) {
            //             live._transcode()
            //                 .then(live._package.bind(live))
            //                 .then(() => live._curGroup++);
            //         }
            //     }
            // });
        });
    }

    static stopLive(liveId: string) {
        return new Promise<any>(resolve => {
            let liveIdx = Live4Web._lives.findIndex(l => l.liveId == liveId);
            if (liveIdx > -1) {
                let live = Live4Web._lives[liveIdx];
                if (live._ffmpeg_ps)
                    live._ffmpeg_ps.kill();
                Live4Web._lives.splice(liveIdx, 1);
                live.emit('stop', live.liveId);
                resolve();
            }
        });
    }

    static getLivings() {
        return new Promise<Array<Live4Web>>(resolve => {
            resolve(this._lives);
        });
    }

    static uploadFrame(liveId: string, req) {
        return new Promise(resolve => {
            let live = this._lives.find(l => l.liveId == liveId);
            let ws = fs.createWriteStream(path.join(live._workingPath, req.name));
            ws.end(new Buffer(req.data, 'base64'), resolve);
        });
    }

    static transcodeFrame(liveId: string, req) {
        let live = this._lives.find(l => l.liveId == liveId);
        live._curGroup = req.seq;
        return live._transcode();
    }

    getLiveStatus() {
        return {
            liveId: this.liveId,
            liveTime: this.liveTime
        };
    }

    private _transcode() {
        let ins = this;

        return new Promise(resolve => {
            let opts = ins._ffmpeg_trans.split(' ')
            opts[opts.indexOf('${input}')] = ins._curGroup + '_%d.webp';
            opts[opts.indexOf('${outputPattern}')] = ins._curGroup + '.mp4';
            console.log(`FFMPEG ${opts.join(' ')}`);

            ins._ffmpeg_ps = cp.spawn(ins._ffmpeg, opts, { cwd: ins._workingPath});
            ins._ffmpeg_ps.on('exit', () => {
                resolve();
            });
        }).then(ins._package.bind(this));
    }

    private _package() {
        let ins = this;
        let group = this._curGroup;

        return new Promise(resolve => {
            // video
            let fn = group + '.mp4';
            let opts_pkg_v = ins._mp4box_pkg.split(' ');
            opts_pkg_v[opts_pkg_v.indexOf('${dashCtx}')] = 'dash-live-v.txt';
            opts_pkg_v[opts_pkg_v.indexOf('${dashFile}')] = 'live_v';
            opts_pkg_v[opts_pkg_v.indexOf('${prefix}')] = 'v_';
            opts_pkg_v[opts_pkg_v.indexOf('${input}')] = fn + '#video';
            console.log(`MP4Box ${opts_pkg_v.join(' ')}`);
            cp.spawn(ins._mp4box, opts_pkg_v, { cwd: ins._workingPath})
                .on('exit', () => {
                    // fs.readdir(ins._workingPath, (err, files)=>{
                    //     files.forEach(f=>{
                    //         if(f.startsWith(group + '_'))
                    //             fs.unlink(path.join(ins._workingPath, f), err=>{
                    //                 if(err) console.log(err);
                    //             });
                    //     });
                    // });
                    resolve();
                });
        });
    }

    private _setupNewMPD() {
        let ins = this;
        fs.exists(path.join(ins._workingPath, 'live_fix.mpd'), exists => {
            if (!exists) {
                if (!fs.existsSync(path.join(ins._workingPath, 'live_v.mpd'))) return;
                if (!fs.existsSync(path.join(ins._workingPath, 'live_a.mpd'))) return;

                var mpdv = fs.readFileSync(path.join(ins._workingPath, 'live_v.mpd'), { encoding: 'utf8' });
                mpdv = mpdv.replace(/availabilityStartTime=\".+?\"/
                    , 'availabilityStartTime="' + ins.liveTime.toISOString() + '"');
                var mpda = fs.readFileSync(path.join(ins._workingPath, 'live_a.mpd'), { encoding: 'utf8' });
                var insertPt = mpdv.lastIndexOf('</AdaptationSet>') + 16;
                var audioStart = mpda.indexOf('<AdaptationSet');
                var audioEnd = mpda.lastIndexOf('</AdaptationSet>') + 16;

                let ws = fs.createWriteStream(path.join(ins._workingPath, 'live_fix.mpd'), { encoding: 'utf8' });
                ws.end(mpdv.substring(0, insertPt)
                    + mpda.substring(audioStart, audioEnd)
                    + mpdv.substr(insertPt, mpdv.length - 1));
            }
        })

    }
}

export class LiveRequest {
    type: string;
    source: string;
    reqTime: Date;
}