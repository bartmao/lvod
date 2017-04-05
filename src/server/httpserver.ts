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
    console.log(req.path);
    next();
});

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
        resp.end(JSON.stringify(v));
    });
});

app.all('/vod/:op', (req, resp) => {
    let r = vodService.callFunction(req.params['op'], req.body);
    r.then(v => {
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