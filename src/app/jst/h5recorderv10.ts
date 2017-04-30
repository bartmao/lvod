/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
let myNavigator: any = navigator;
let myWindow: any = window;
let io: any;
declare var _player;
declare var play;

class H5RecorderV10 {
    private _socket;
    private _videoStream: MediaStream;
    private _isRunning = false;

    private _ts = 0;
    private _fps = 2;
    private _dur = 3;
    private _sec = 0;
    private _tick = -1;
    private _seq = 0;
    private _subseq = 0;
    private _last_time: number;

    private _liveStatus = 0;
    private _liveId: string;

    private _frameQueue = [];
    private _audioQueue = [];
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

                // let AudioContext = myWindow.AudioContext || myWindow.webkitAudioContext;
                // let ctx = new AudioContext();
                // let source = ctx.createMediaStreamSource(stream);
                // let processor = (ctx.createScriptProcessor || ctx.createJavaScriptNode).call(ctx, 1024 * 4, 1, 1);
                // processor.onaudioprocess = e => {
                //     let inputBuffer = e.inputBuffer;
                //     let data = inputBuffer.getChannelData(0);
                //     ins._audioQueue.push(data);
                // };
                // source.connect(processor);
                // processor.connect(ctx.destination);
            }, err => {
                console.log(err);
            });
        }

        this.getData();
        this._initNetwork();
    }

    start() {
        this._isRunning = true;
        $.post('live/startlive', {
            type: 1,
            ts: new Date(),
            ver: '10'
        }, data => {
            let live = JSON.parse(data);
            this._liveStatus = 1;
            this._liveId = live.liveId;
            console.log('start live: ' + this._liveId);
            this._ts = +new Date();
            this.draw();
        });
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
        let sec = Math.floor(ts / 1000 / this._dur);
        let tick = Math.floor((ts - this._dur * sec * 1000) * this._fps / 1000);
        if (sec > this._sec) {
            this._sec = sec;
            this._upload();
            this._seq++;
        }
        if (tick > this._tick || (tick == 0 && this._tick > 0)) {
            if (tick == 0) this._subseq = 0;
            else this._subseq++;
            this._tick = tick;
            this._frameQueue.push({
                seq: this._seq,
                subseq: this._subseq,
                ts: new Date(),
                data: this._canvas.toDataURL('image/webp')
            });
        }

        requestAnimationFrame(this.draw.bind(this));
    }

    private getData() {
        var ins = this;
        var audioCtx = new AudioContext();
        var source = audioCtx.createBufferSource();
        var request = new XMLHttpRequest();

        request.open('GET', 'wk1.wav', true);

        request.responseType = 'arraybuffer';


        request.onload = function () {
            var audioData = request.response;
            ins._audioQueue.push(request.response);

            // audioCtx.decodeAudioData(audioData, function (buffer) {
            //     source.buffer = buffer;
            //     source.connect(audioCtx.destination);
            //     source.loop = true;
            //     source.start(0);
            // });

        }

        request.send();
    }

    private _upload() {
        let ins = this;
        if (this._isUploading) return;
        if (this._frameQueue.length == 0) return;

        this._isUploading = true;
        //let audio = this._arrayBufferToBase64(this.encodeWAV(this._audioQueue));
        let audio = this._arrayBufferToBase64(this._audioQueue[0]);
        this._socket.emit('liveservice', {
            liveId: this._liveId,
            frames: this._frameQueue,
            audio: audio,
            ts: new Date(),
            op: 'distribFrames',
            ver: '10'
        });
        let videoSize = 0;
        this._frameQueue.reduce((acc, cur) => {
            videoSize += cur.data.length;
        }, 0);
        console.log('Video ' + videoSize / 1024 + 'KB/s' + ', Audio ' + audio.length / 1024 + 'KB/s')
        this._isUploading = false;
        this._frameQueue = [];
        //this._audioQueue = [];
    }

    private _arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private encodeWAV(samples) {
        let sampleLength = 0;
        samples.reduce((acc, cur) => sampleLength += cur.length, 0);
        let newSamples = new Float32Array(sampleLength);
        let newOffset = 0;
        for (let i = 0; i < samples.length; ++i) {
            newSamples.set(samples[i], newOffset);
            newOffset += samples[i].length;
        }
        samples = newSamples;

        var arr = new ArrayBuffer(44 + sampleLength * 2);
        var view = new DataView(arr);

        /* RIFF identifier */
        this.writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + sampleLength * 2, true);
        /* RIFF type */
        this.writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        this.writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, 1, true);
        /* sample rate */
        view.setUint32(24, 48000, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, 48000 * 1 * 2, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, 1 * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        this.writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, sampleLength * 2 + 44, true);

        this.floatTo16BitPCM(view, 44, samples);
        return arr;
    }

    private floatTo16BitPCM(view, offset, input) {
        for (var i = 0; i < input.length; i++ , offset += 2) {
            var s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    private writeString(view, offset, string) {
        for (var i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    private _padLeft(s: any) {
        let o = new Array(4).join('0') + s.toString();
        return o.substr(o.length - 3, 3);
    }

    private _initNetwork() {
        let ins = this;
        ins._socket = io('http://localhost:8000');
        ins._socket.on('receiveFrames', function (data) {
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
