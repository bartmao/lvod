import express = require('express');
import fs = require('fs');
import bodyParser = require('body-parser');
import LiveService from './live/liveservice';
import VODService from './vod/vodservice';

let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

let liveService = new LiveService();
let vodService = new VODService();

app.use((req, resp, next) => {
    let t = new Date();
    if (!req.path.endsWith('uploadFrame'))
        console.log(`${t.toTimeString()}.${t.getMilliseconds()}  ${req.path}`);
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
// app.use(function (err, req, res, next) {
//   console.error(err.stack)
//   res.status(500).send('Something broke!')
// })

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