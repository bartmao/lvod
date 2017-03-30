import nodeuuid = require('node-uuid')
import path = require('path');
import cp = require('child_process');
import fs = require('fs');
import events = require('events');

import ResourceManager from '../resourcemanager';
const liveConfig = require('./liveconfig.json')

export default class Live extends events.EventEmitter {
    static _lives: Array<Live> = [];

    private _workingPath: string = null;
    private _ffmpeg_ps: cp.ChildProcess;

    private _ffmpeg: string;
    private _mp4box: string;
    private _ffmpeg_trans: string;
    private _mp4box_add: string;
    private _mp4box_pkg: string;
    private _tsBuffers: Array<string>;

    liveId: string;
    sourceType: string;
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
        this._ffmpeg_trans = liveConfig.ffmpegtrans;
        this._mp4box_add = liveConfig.mp4boxadd;
        this._mp4box_pkg = liveConfig.mp4boxpkg;

        this.liveId = nodeuuid.v4();
        this._workingPath = path.join(liveConfig.outputDir, this.liveId);
        this._tsBuffers = [];
    }

    static startLive(req: LiveRequest) {
        return new Promise<any>((resolve, reject) => {
            let live = new Live();
            live.source = req.source;
            live.sourceType = req.type;
            let sourceInfo = ResourceManager.locateFile(req.source);
            live.sourceId = sourceInfo.id;
            live.sourcePath = sourceInfo.path;
            live.sourceName = sourceInfo.name;
            live.initTime = req.reqTime;

            Live._lives.push(live);
            fs.mkdirSync(live._workingPath);
            live._transcode(() => {
                resolve(live.getLiveStatus());
            });
        });
    }

    static stopLive(liveId: string) {
        return new Promise<any>(resolve => {
            let liveIdx = Live._lives.findIndex(l => l.liveId == liveId);
            if (liveIdx > -1) {
                let live = Live._lives[liveIdx];
                live._ffmpeg_ps.kill();
                Live._lives.splice(liveIdx, 1);
                live.emit('stop', live.liveId);
                resolve();
            }
        });
    }

    static getLivings() {
        return new Promise<Array<Live>>(resolve => {
            resolve(this._lives);
        });
    }

    getLiveStatus() {
        return {
            liveId: this.liveId,
            liveTime: this.liveTime
        };
    }

    private _transcode(cb: Function) {
        let ins = this;
        let opts = this._ffmpeg_trans.split(' ')
        opts[opts.indexOf('${input}')] = this.sourcePath;
        opts[opts.indexOf('${outputPattern}')] = this._workingPath + path.sep + 's_%05d.ts';
        console.log(`FFMPEG ${opts.join(' ')}`);

        this._ffmpeg_ps = cp.spawn(this._ffmpeg, opts);
        this._ffmpeg_ps.on('exit', () => {
            let liveIdx = Live._lives.findIndex(l => l.liveId == this.liveId);
            if (liveIdx > -1) {
                let live = Live._lives[liveIdx];
                Live._lives.splice(liveIdx, 1);
                live.emit('stop', live.liveId);
            }
        });
        fs.watch(this._workingPath, (evt, fn) => {
            if (evt == 'rename' && fn.endsWith('.ts')) {
                if (this._tsBuffers.indexOf(fn) > -1) return;
                this._tsBuffers.push(fn);

                if (fn == 's_00000.ts') return;
                // package last ts
                ins._package(fn.replace(/(\d+)/, w => ('00000' + (parseInt(w) - 1)).slice(-5)));
            }
            else if (evt == 'rename' && fn == 'v_init.mp4') {
                if (ins.liveTime) return;
                ins.liveTime = new Date();
                ins.emit('start', ins.getLiveStatus());
                cb();
            }
            else if (evt == 'rename' && fn.endsWith('.mpd')) {
                //ins.liveTime = new Date();
                ins._setupNewMPD();
            }

            // if (evt == 'rename')
            //     console.log(`event: ${evt}   file: ${fn}`);
        });
    }

    private _package(fn: string) {
        let ins = this;
        if (this._tsBuffers.length > 10) this._tsBuffers.splice(0, 1);

        console.log('package ' + fn);
        let opts_add = this._mp4box_add.split(' ');
        opts_add[opts_add.indexOf('${in}')] = path.join(this._workingPath, fn);
        opts_add[opts_add.indexOf('${out}')] = path.join(this._workingPath, fn + '.mp4');
        //console.log(`MP4Box ${opts_add.join(' ')}`);
        cp.spawn(this._mp4box, opts_add)
            .on('exit', () => {
                // video
                let opts_pkg_v = this._mp4box_pkg.split(' ');
                opts_pkg_v[opts_pkg_v.indexOf('${dashCtx}')] = path.join(this._workingPath, 'dash-live-v.txt');
                opts_pkg_v[opts_pkg_v.indexOf('${dashFile}')] = path.join(this._workingPath, 'live_v');
                opts_pkg_v[opts_pkg_v.indexOf('${prefix}')] = 'v_';
                opts_pkg_v[opts_pkg_v.indexOf('${input}')] = path.join(this._workingPath, fn + '.mp4' + '#video');
                //console.log(`MP4Box ${opts_pkg_v.join(' ')}`);
                cp.spawn(this._mp4box, opts_pkg_v);
                // audio
                let opts_pkg_a = this._mp4box_pkg.split(' ');
                opts_pkg_a[opts_pkg_a.indexOf('${dashCtx}')] = path.join(this._workingPath, 'dash-live-a.txt');
                opts_pkg_a[opts_pkg_a.indexOf('${dashFile}')] = path.join(this._workingPath, 'live_a');
                opts_pkg_a[opts_pkg_a.indexOf('${prefix}')] = 'a_';
                opts_pkg_a[opts_pkg_a.indexOf('${input}')] = path.join(this._workingPath, fn + '.mp4' + '#audio');
                //console.log(`MP4Box ${opts_pkg_a.join(' ')}`);
                cp.spawn(this._mp4box, opts_pkg_a)
                    .on('exit', () => {
                        setTimeout(function () {
                            fs.unlink(path.join(ins._workingPath, fn), err => {
                                if (err) console.error(err)
                            });
                            fs.unlink(path.join(ins._workingPath, fn + '.mp4'), err => {
                                if (err) console.error(err)
                            });
                        }, 1000);

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