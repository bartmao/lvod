/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
let myNavigator: any = navigator;
let myWindow: any = window;
let io: any;

class H5Recorder {
    private _socket;
    private _videoStream: MediaStream;
    private _isRunning = false;
    private _fps = 15;
    private _sec = 0;
    private _seq = 0;

    constructor(private _video, private _canvas) {
        this.init();
    }

    init() {
        let ins = this;
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

        ins._socket = io('http://localhost');
        ins._socket.on('news', function (data) {
            console.log(data);
            ins._socket.emit('my', { my: 'data' });
        });
    }

    start() {
        this._isRunning = true;
        this.draw();
        //setTimeout(this.compile.bind(this));
    }

    stop() {
        this._isRunning = false;
    }

    draw() {
        if (!this._isRunning) return;

        let ins = this;
        var ctx = this._canvas.getContext('2d');
        ctx.drawImage(this._video, 0, 0, this._canvas.width, this._canvas.height);

        this._upload(this._seq++ + '.webp');

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
}
