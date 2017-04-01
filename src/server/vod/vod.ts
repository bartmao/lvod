import nodeuuid = require('node-uuid')
import path = require('path');
import cp = require('child_process');
import fs = require('fs');
import events = require('events');

import ServiceUtils from '../serverutils';
import ResourceManager from '../resourcemanager';
const vodConfig = require('./vodconfig.json')

export default class VOD {
    private static _transcodings = [];
    private static _transcoded = [];

    private static _ffmpeg: string = vodConfig.cmd.ffmpeg;
    private static _mp4box: string = vodConfig.cmd.mp4box;
    private static _ffmpeg_trans: string = vodConfig.ffmpegtrans;
    private static _mp4box_pkg_4v: string = vodConfig.mp4boxpkg4v;
    private static _mp4box_pkg_4a: string = vodConfig.mp4boxpkg4a;

    private _workingPath: string = null;

    vodId: string;
    sourceType: string;
    sourceId: number;
    sourceName: string;
    sourcePath: string;
    reqTime: Date;
    completedTime: Date;

    constructor() {
        this.vodId = nodeuuid.v4();
        this._workingPath = path.join(ServiceUtils.getAbsolutePath(vodConfig.outputDir), this.vodId);
    }

    static startVOD(source) {
        // 1. transcode using ffmpeg divide into video/audio files
        // 2. mp4box packages video/audio files
        // 3. merge AdaptationSet
        return new Promise<VOD>(r => {
            let ins = new VOD();
            let finfo = ResourceManager.locateFile(source);
            ins.sourceId = source;
            ins.sourceName = finfo.name;
            ins.sourcePath = finfo.path;
            ins.sourceType = '0';
            VOD._transcodings.push(ins);
            fs.mkdirSync(ins._workingPath);
            ins._startTranscode()
                .then(() => {
                    let idx = VOD._transcodings.indexOf(this);
                    VOD._transcoded.push(VOD._transcodings.splice(idx, 1)[0]);
                });
            r(ins);
        });
    }

    static getAvailStaticSources() {
        return new Promise<Array<object>>(resolve => {
            let sources = ResourceManager.getAvailStaticSources();
            sources.forEach(s=>{
                let transcoded = VOD._transcoded.find(t=>t.sourceId == s.id)
                if(transcoded){
                    s['vodId'] = transcoded.vodId;
                    s['transcoded'] = 2;
                }
                else if(VOD._transcodings.findIndex(t=>t.sourceId == s.id) > -1) s['transcoded'] = 1;
                else s['transcoded'] = 0;
            });
            resolve(sources);
        });
    }

    _startTranscode() {
        return new Promise(r => {
            let opts = VOD._ffmpeg_trans.split(' ')
            opts[opts.indexOf('${input}')] = this.sourcePath;
            opts[opts.indexOf('${videoOutput}')] = path.join(this._workingPath, '1v.mp4');
            opts[opts.indexOf('${audioOutput}')] = path.join(this._workingPath, '1a.mp4');
            console.log(`ffmpeg ${opts.join(' ')}`)
            var ps = cp.spawn(VOD._ffmpeg, opts, { stdio: ['pipe', process.stdout, process.stderr] });

            ps.on('exit', () => {
                this._startpkg()
                    .then(this._mergeMPD.bind(this))
                    .then(() => r());
            });
        });
    }

    _startpkg() {
        var p1 = cp.spawn(VOD._mp4box, VOD._mp4box_pkg_4v.split(' '), { cwd: this._workingPath });
        var p2 = cp.spawn(VOD._mp4box, VOD._mp4box_pkg_4a.split(' '), { cwd: this._workingPath });

        return new Promise(resolve => {
            var flags = [0, 0];
            p1.on('exit', () => new Promise(r => {
                flags[0] = 1;
                if (flags[1] == 1) resolve();
            }));
            p2.on('exit', () => new Promise(r => {
                flags[1] = 1;
                if (flags[0] == 1) resolve();
            }));
        });
    }

    _mergeMPD() {
        return new Promise(r => {
            var mpd = fs.readFileSync(path.join(this._workingPath, '1v_dash.mpd'), { encoding: 'utf8' });
            var mpda = fs.readFileSync(path.join(this._workingPath, '1a_dash.mpd'), { encoding: 'utf8' });
            var insertPt = mpd.lastIndexOf('</AdaptationSet>') + 16;
            var audioStart = mpda.indexOf('<AdaptationSet');
            var audioEnd = mpda.lastIndexOf('</AdaptationSet>') + 16;
            fs.writeFileSync(path.join(this._workingPath, '1.mpd'),
                mpd.substring(0, insertPt)
                + mpda.substring(audioStart, audioEnd)
                + mpd.substr(insertPt, mpd.length - 1)
            )
            r();
        });
    }
}