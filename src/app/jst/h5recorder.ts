/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
let myNavigator: any = navigator;
let myWindow: any = window;
let io: any;

class H5Recorder {
    private _socket;
    private _videoStream: MediaStream;
    private _isRunning = false;

    private _ts = 0;
    private _fps = 15;
    private _tick = 0;
    private _dur = 4;
    private _last_time: number;

    private _liveStatus = 0;
    private _liveId: string;

    private _frameQueue = [];
    private _curSeq = 0;
    private _isUploading = false;

    constructor(private _video, private _canvas, private _mockup: boolean = false) {
        let ins = this;
        if (!_mockup) {
            myNavigator.getUserMedia = myNavigator.getUserMedia ||
                myNavigator.webkitGetUserMedia ||
                myNavigator.mozGetUserMedia ||
                myNavigator.msGetUserMedia;
            myNavigator.getUserMedia({ video: true, audio: true }, function (stream) {
                ins._video.src = window.URL.createObjectURL(stream);
                ins._videoStream = stream;
            }, err => {
                console.log(err);
            });
        }

        //this._initNetwork();
    }

    start() {
        this._isRunning = true;
        $.post('live/startlive', {
            type: 1,
            ts: new Date()
        }, data => {
            let live = JSON.parse(data);
            this._liveStatus = 1;
            this._liveId = live.liveId;
            console.log('start live: ' + this._liveId);
            this._ts = +new Date();
            this.draw();
        });
        // this._socket.emit('service', {
        //     ts: new Date,
        //     type: 1,
        //     source: 'live',
        //     op: 'startlive'
        // });
    }

    stop() {
        this._isRunning = false;
    }

    draw() {
        if (!this._isRunning) return;

        let ins = this;
        if (!this._mockup) {
            var ctx = this._canvas.getContext('2d');
            ctx.drawImage(this._video, 0, 0, this._canvas.width, this._canvas.height);
        }
        else {
            this._getClock();
        }

        let ts = +new Date() - this._ts;
        let seq = Math.floor(ts / 1000 / this._dur);
        let tick = Math.floor((ts - this._dur * seq * 1000) * this._fps / 1000);
        if (tick > this._tick || (tick == 0 && this._tick > 0)) {
            this._tick = tick;
            let fn = seq + '_' + tick++ + '.webp';
            this._frameQueue.push([fn, this._canvas.toDataURL('image/webp'), seq]);
            this._upload();
        }

        requestAnimationFrame(this.draw.bind(this));
    }

    save() {
        // let ctx = this._canvas.getContext('2d');
        // this._upload('sample' + '.webp');
    }

    private _upload() {
        if (this._isUploading) return;
        if (this._frameQueue.length == 0) return;

        this._isUploading = true;
        let frame = this._frameQueue.splice(0, 1)[0];
        let seq = frame[2];

        $.post('live/uploadFrame', {
            liveId: this._liveId,
            name: frame[0],
            data: frame[1].substr(23)
        }, resp => {
            this._isUploading = false;
            if (this._curSeq != seq) {
                // all frames of the same seq sent, notify server to transcode
                let seqToHandle = this._curSeq;
                $.post('live/transcodeframe', {
                    liveId: this._liveId,
                    seq: seqToHandle
                }, ()=>{
                    console.log('transcoded ' + seqToHandle);
                    if(!_player){
                        play(this._liveId + '/live_v.mpd')
                    }
                });
                this._curSeq = seq;
            }
        });

    }

    private _initNetwork() {
        let ins = this;
        ins._socket = io('http://localhost:8000');
        ins._socket.on('service', function (data) {
            console.log(data);
        });
    }

    // copy from http://antimatter15.com/whammy/clock.html
    private _getClock() {
        this._last_time = +new Date;
        var now = new Date();
        now.setTime(this._last_time + 1000);
        var ctx = this._canvas.getContext('2d');
        ctx.save();
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 150, 150); // videos cant handle transprency
        ctx.translate(75, 75);
        ctx.scale(0.4, 0.4);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = "black";
        ctx.fillStyle = "white";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";

        // Hour marks
        ctx.save();
        for (var i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.rotate(Math.PI / 6);
            ctx.moveTo(100, 0);
            ctx.lineTo(120, 0);
            ctx.stroke();
        }
        ctx.restore();

        // Minute marks
        ctx.save();
        ctx.lineWidth = 5;
        for (i = 0; i < 60; i++) {
            if (i % 5 != 0) {
                ctx.beginPath();
                ctx.moveTo(117, 0);
                ctx.lineTo(120, 0);
                ctx.stroke();
            }
            ctx.rotate(Math.PI / 30);
        }
        ctx.restore();

        var sec = now.getSeconds();
        var min = now.getMinutes();
        var hr = now.getHours();
        hr = hr >= 12 ? hr - 12 : hr;

        ctx.fillStyle = "black";

        // write Hours
        ctx.save();
        ctx.rotate(hr * (Math.PI / 6) + (Math.PI / 360) * min + (Math.PI / 21600) * sec)
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(80, 0);
        ctx.stroke();
        ctx.restore();

        // write Minutes
        ctx.save();
        ctx.rotate((Math.PI / 30) * min + (Math.PI / 1800) * sec)
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-28, 0);
        ctx.lineTo(112, 0);
        ctx.stroke();
        ctx.restore();

        // Write seconds
        ctx.save();
        ctx.rotate(sec * Math.PI / 30);
        ctx.strokeStyle = "#D40000";
        ctx.fillStyle = "#D40000";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(83, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(95, 0, 10, 0, Math.PI * 2, true);
        ctx.stroke();
        ctx.fillStyle = "#555";
        ctx.arc(0, 0, 3, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#325FA2';
        ctx.arc(0, 0, 142, 0, Math.PI * 2, true);
        ctx.stroke();

        ctx.restore();

        return ctx;
    }
}
