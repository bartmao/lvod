/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
declare var Whammy;
let myNavigator: any = navigator;
let myWindow: any = window;

class H5Recorder {
    private _videoStream: MediaStream;
    private _isRunning = false;
    private _encoder;

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
    }

    start() {
        this._encoder = new Whammy.Video(25);
        this._isRunning = true;
        this.draw();
        setTimeout(this.compile.bind(this));
    }

    stop() {
        this._isRunning = false;
        this._encoder = null;
    }

    draw() {
        if (!this._isRunning) return;

        let ins = this;

        var ctx = this._canvas.getContext('2d');
        ctx.drawImage(this._video, 0, 0, this._canvas.width, this._canvas.height);
        this._encoder.add(ctx);

        requestAnimationFrame(this.draw.bind(this));
    }

    compile() {
        var output = this._encoder.compile();
        this._upload(output);

        this._encoder = new Whammy.Video(25);
        setTimeout(this.compile.bind(this), 5000);
    }

    private _upload(output) {
        //test purpose
        var url = (myWindow.webkitURL || myWindow.URL).createObjectURL(output);
        $("<video id='v0' autoplay width='200' height='200' src='" + url + "' loop='true'></video>").appendTo($('body'));
        console.log(url);
    }
}
