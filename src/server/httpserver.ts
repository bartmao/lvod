import express = require('express');
import fs = require('fs');
import path = require('path');
import bodyParser = require('body-parser');
import LiveService from './live/liveservice';
import VODService from './vod/vodservice';
import ServiceUtils from './serverutils'

let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

let liveService = new LiveService();
let vodService = new VODService();

app.use((req, resp, next) => {
    let t = new Date();
    if (!req.path.endsWith('uploadFrame'))
        console.log(`${ServiceUtils.getShortTime()}  ${req.path}`);
    next();
});

// app.get('/:liveId/v_:gp.m4s', (req, resp, next) => {
//     //liveService.
//     console.log(req.params['liveId']);
//     console.log(req.params['gp']);
//     next();
// });

app.use(express.static('bin/app'));
app.use(express.static('resources'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req, resp) => {
    resp.redirect('/dashboard.html');
});

app.all('/live/:op', (req, resp) => {
    let r = liveService.callFunction(req.params['op'], req.body);
    r.then(v => {
        v = v ? v : {};
        resp.end(JSON.stringify(v));
    });
});

app.all('/vod/:op', (req, resp) => {
    let r = vodService.callFunction(req.params['op'], req.body);
    r.then(v => {
        v = v ? v : {};
        resp.end(JSON.stringify(v));
    });
});

app.use(function (req, resp, next) {
    // let m;
    // if (m = req.url.match(/\/(.*)\/v_(\d+).m4s/)) {
    //     let liveId = m[1];
    //     let gp = parseInt(m[2]);
    //     liveService.getLiveStatus(liveId).then(live => {
    //         let watchFn = path.join(live.workingPath, 'v_' + (gp + 1) + '.m4s');
    //         if (gp < live.curGroup + 2) {
    //             fs.watchFile(watchFn, fileCreated);
    //             setTimeout(()=>fs.unwatchFile(watchFn, fileCreated), 5000);
    //         }

    //         function fileCreated() {
    //             fs.createReadStream(path.join(live.workingPath, 'v_' + gp + '.m4s')).pipe(resp);
    //             fs.unwatchFile(watchFn, fileCreated);
    //         }
    //     });
    // }
    next();
});

server.listen(8000);

io.on('connection', socket => {
    socket.emit('news', { hello: 'world' });
    socket.on('image', data => {
        let name = data.name;
        let ws = fs.createWriteStream(__dirname + '/../../resources/bitmap/' + name);
        ws.end(new Buffer(data.data, 'base64'));
    });
    socket.on('service', req => {
        liveService.callFunction(req.op, req)
            .then(v => socket.emit('service', v));
    });
});

console.log('application server started!');