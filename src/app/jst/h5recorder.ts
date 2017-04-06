/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
let myNavigator: any = navigator;
let myWindow: any = window;
let io: any;

class H5Recorder {
    private _socket;
    private _videoStream: MediaStream;
    private _isRunning = false;
    private _fps = 3;
    private _tick = 0;
    private _dur = 2;
    private _seq = 0;
    private _subseq = 0;
    private _sec = 0;
    private _last_time: number;

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

        this._initNetwork();
    }

    start() {
        this._isRunning = true;
        this.draw();
        this._socket.emit('service', {
            ts: new Date,
            type: 1,
            source: 'live',
            op: 'startlive'
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

        let ts = +new Date();
        let tick = Math.floor(ts / (1000 / this._fps));
        let sec = Math.floor(ts / 1000);
        if (this._sec + this._dur <= sec) {
            this._sec = sec;
            this._subseq = 0;
            this._seq++;
        }
        if (tick > this._tick) {
            this._tick = tick;
            this._upload(this._seq + '_' + this._subseq++ + '.webp');
        }

        requestAnimationFrame(this.draw.bind(this));
    }

    save() {
        let ctx = this._canvas.getContext('2d');
        this._upload('sample' + '.webp');
    }

    private _upload(name) {
        let img = this._canvas.toDataURL('image/webp');
        console.log(img.substr(0, 100));
        this._socket.emit('image', {
            name: name,
            data: img.substr(23)
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
