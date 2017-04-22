import nodeuuid = require('node-uuid')
import path = require('path');
import cp = require('child_process');
import fs = require('fs');
import events = require('events');

import ServerUtils from '../serverutils';
import ResourceManager from '../resourcemanager';
const liveConfig = require('./liveconfig.json')

export default class Live4WebV10 extends events.EventEmitter {
    static _lives: Array<Live4WebV10> = [];

    private _ffmpeg_ps: cp.ChildProcess;

    private _ffmpeg: string;
    private _mp4box: string;
    private _ffmpeg_trans: string;
    private _mp4box_add: string;
    private _mp4box_pkg: string;

    private _optime: number;
    private _isTranscoding: boolean = false;
    private _transGroups = [];

    curGroup: number;
    workingPath: string = null;
    liveId: string;
    sourceType: string;
    sourceTrack: string; // video,audio,mul
    source: string;
    sourceId: number;
    sourceName: string;
    sourcePath: string;
    initTime: Date;
    liveTime: Date;
    dur: number;
    elapsed: number = 0;
    queuedDur: number = 0;

    constructor() {
        super();
        this._ffmpeg = liveConfig.cmd.ffmpeg;
        this._mp4box = liveConfig.cmd.mp4box;
        this._ffmpeg_trans = liveConfig.ffmpegtrans4web;
        this._mp4box_add = liveConfig.mp4boxadd;
        this._mp4box_pkg = liveConfig.mp4boxpkg4web;
        this.curGroup = 1;
        this.dur = 1000;

        this.liveId = nodeuuid.v4();
        this.workingPath = path.join(liveConfig.outputDir, this.liveId);
    }

    static startLive(req: LiveRequest) {
        return new Promise<any>((resolve, reject) => {
            let live = new Live4WebV10();
            live.source = req.source;
            live.sourceType = req.type;
            live.sourceId = 0;
            live.sourcePath = null;
            live.sourceName = null;
            live.initTime = req.reqTime;
            live.on('reqTranscode', () => live.transcode());
            Live4WebV10._lives.push(live);

            fs.mkdirSync(live.workingPath);
            resolve({
                liveId: live.liveId
            });

            console.log('init time: ' + ServerUtils.getShortTime(live.initTime));
        });
    }

    static stopLive(liveId: string) {
        return new Promise<any>(resolve => {
            let liveIdx = Live4WebV10._lives.findIndex(l => l.liveId == liveId);
            if (liveIdx > -1) {
                let live = Live4WebV10._lives[liveIdx];
                if (live._ffmpeg_ps)
                    live._ffmpeg_ps.kill();
                Live4WebV10._lives.splice(liveIdx, 1);
                live.emit('stop', live.liveId);
                resolve();
            }
        });
    }

    static getLivings() {
        return new Promise<Array<Live4WebV10>>(resolve => {
            resolve(this._lives);
        });
    }

    static uploadFrames(liveId: string, seq: number, frames: Array<any>, requestUploadingTime: Date) {
        //console.log(`${ServerUtils.getShortTime()} Uploading frames ${seq}`)
        return new Promise(resolve => {
            let live = this._lives.find(l => l.liveId == liveId);
            let counter = frames.length;
            let group = {
                requestUploadingTime: requestUploadingTime,
                uploadingTime: new Date(),
                seq: seq,
                r: counter,
                dur: 1000,
            };

            // keep the last frame, reserved for delay
            fs.createWriteStream(path.join(live.workingPath, 'lastframe.webp'))
                .end(new Buffer(frames[frames.length - 1][1], 'base64'));

            frames.forEach(f => {
                fs.createWriteStream(path.join(live.workingPath, f[0]))
                    .on('close', () => {
                        if ((--counter) == 0) {
                            group['uploadedTime'] = new Date();
                            live.queuedDur += group.dur;
                            live._transGroups.push(group);
                            live.emit('reqTranscode');
                            resolve();
                        }
                    })
                    .end(new Buffer(f[1], 'base64'));
            });
        });
    }

    getLiveStatus() {
        return {
            liveId: this.liveId,
            liveTime: this.liveTime
        };
    }

    async transcode() {
        let ins = this;
        if (this._transGroups.length == 0 || this._isTranscoding) return;
        this._isTranscoding = true;
        let group = this._transGroups.shift();
        let seq = group.seq;
        group.transcodingTime = new Date();

        // if (!this.liveTime) {
        //     this.liveTime = new Date();
        //     console.log(`live time: ${ServerUtils.getShortTime(this.liveTime)}`);
        // }
        // this._optime = +new Date();
        // let latestTime = +this.liveTime + seq * 1000;
        // if (this._optime > latestTime) {
        //     console.warn(`${ServerUtils.getShortTime()} Transcode delayed. Seq: ${seq}, Difference:${(this._optime - latestTime)}ms`)
        // }

        let retry = 3;
        while (retry-- > 0) {
            try {
                await this._transcode(group);
                group.transcodedTime = new Date();
                group.packagingTime = new Date();
                this._package(group);
                break;
            } catch (err) {
                console.warn(`generate group failed, seq: ${seq}, remains:${retry}`);
                // if (retry == 1) {
                //     group.orignSeq = seq;
                //     group.seq = 'c';
                //     ins._transGroups.unshift(group);
                // }
            }
        }

        this._isTranscoding = false;
        this.transcode();
    }

    private _startAccuracyDaemon() {
        let difference = +new Date() - +this.liveTime - this.elapsed;
        if (difference > this.dur / 2) {
            console.warn(`Deplayed ${difference}ms`);
            let group = {
                requestUploadingTime: null,
                uploadingTime: null,
                uploadedTime: null,
                seq: 'c',
                r: 1,
                dur: 1000
            };
            this._transGroups.unshift(group);
            this.emit('reqTranscode');
        }
        let daemon = setTimeout(this._startAccuracyDaemon.bind(this), this.dur);
    }

    private _transcode(group) {
        let seq = group.seq;
        return new Promise((resolve, reject) => {
            let ins = this;
            let optStr = ins._ffmpeg_trans;
            if (seq != 'c')
                optStr = optStr.replace(/\$\{input\}/g, seq + '_%03d.webp');
            else
                optStr = optStr.replace(/\$\{input\}/g, 'lastframe.webp');
            optStr = optStr.replace(/\$\{outputPattern\}/g, seq + '.mp4');
            optStr = optStr.replace(/\$\{r\}/g, group.r);
            let opts = optStr.split(' ')

            //console.log(`FFMPEG ${opts.join(' ')}`);

            ins._ffmpeg_ps = cp.spawn(ins._ffmpeg, opts, { cwd: ins.workingPath });
            ins._ffmpeg_ps.on('exit', () => {
                let fn = path.join(ins.workingPath, '' + seq + '.mp4');
                fs.exists(fn, exists => {
                    if (exists)
                        fs.stat(fn, (err, stat) => {
                            // 48 as linux, 0 as windows
                            stat.size <= 48 ? reject() : resolve();
                        })
                    else reject();
                })
            });
        });
    }

    private _package(group) {
        let ins = this;
        let seq = group.seq;
        return new Promise(resolve => {
            // video
            let fn = seq + '.mp4';
            let opts_pkg_v = ins._mp4box_pkg.split(' ');
            opts_pkg_v[opts_pkg_v.indexOf('${dashCtx}')] = 'dash-live-v.txt';
            opts_pkg_v[opts_pkg_v.indexOf('${dashFile}')] = 'live_v';
            opts_pkg_v[opts_pkg_v.indexOf('${prefix}')] = 'v_';
            opts_pkg_v[opts_pkg_v.indexOf('${input}')] = fn + '#video';
            //console.log(`MP4Box ${opts_pkg_v.join(' ')}`);
            cp.spawn(ins._mp4box, opts_pkg_v, { cwd: ins.workingPath })
                .on('exit', () => {
                    ins.elapsed += group.dur;
                    ins.queuedDur -= group.dur;
                    group.packagedTime = new Date();
                    if (!ins.liveTime) {
                        ins.liveTime = new Date();
                        //ins._startAccuracyDaemon();
                    }

                    ins.printGroup(group);

                    let f = ins.workingPath + '/v_' + seq + '.m4s';
                    fs.readdir(ins.workingPath, (err, files) => {
                        files.forEach(f => {
                            if (f.startsWith(seq + '_'))
                                fs.unlink(path.join(ins.workingPath, f), err => {
                                    if (err) console.log(err);
                                });
                        });
                    });
                    resolve();
                });
        });
    }

    private _setupNewMPD() {
        let ins = this;
        fs.exists(path.join(ins.workingPath, 'live_fix.mpd'), exists => {
            if (!exists) {
                if (!fs.existsSync(path.join(ins.workingPath, 'live_v.mpd'))) return;
                if (!fs.existsSync(path.join(ins.workingPath, 'live_a.mpd'))) return;

                var mpdv = fs.readFileSync(path.join(ins.workingPath, 'live_v.mpd'), { encoding: 'utf8' });
                mpdv = mpdv.replace(/availabilityStartTime=\".+?\"/
                    , 'availabilityStartTime="' + ins.liveTime.toISOString() + '"');
                var mpda = fs.readFileSync(path.join(ins.workingPath, 'live_a.mpd'), { encoding: 'utf8' });
                var insertPt = mpdv.lastIndexOf('</AdaptationSet>') + 16;
                var audioStart = mpda.indexOf('<AdaptationSet');
                var audioEnd = mpda.lastIndexOf('</AdaptationSet>') + 16;

                let ws = fs.createWriteStream(path.join(ins.workingPath, 'live_fix.mpd'), { encoding: 'utf8' });
                ws.end(mpdv.substring(0, insertPt)
                    + mpda.substring(audioStart, audioEnd)
                    + mpdv.substr(insertPt, mpdv.length - 1));
            }
        })

    }

    private printGroup(group) {
        console.log(group.seq);
        if (group.orignSeq)
            console.log(`rs ${group.orignSeq}`);
        console.log(`r ${group.r}`);
        console.log(`Uploading      at ${ServerUtils.getShortTime(group.requestUploadingTime)}`);
        console.log(`Uploaded       at ${ServerUtils.getShortTime(group.uploadedTime)}`);
        console.log(`Transcodeing   at ${ServerUtils.getShortTime(group.transcodingTime)}`);
        console.log(`Transcoded     at ${ServerUtils.getShortTime(group.transcodedTime)}`);
        console.log(`Packaging      at ${ServerUtils.getShortTime(group.packagingTime)}`);
        console.log(`Packaged       at ${ServerUtils.getShortTime(group.packagedTime)}`);
        console.log(`Elapsed ${group.packagedTime - group.requestUploadingTime}ms`);
        console.log(new Array(50).join('='));
    }
}

export class LiveRequest {
    type: string;
    source: string;
    reqTime: Date;
}