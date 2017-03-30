import express = require('express');
import bodyParser = require('body-parser');

import LiveService from './live/liveservice';
import VODService from './vod/vodservice';

let app = express();
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
    r.then(v=>{
        resp.end(JSON.stringify(v));
    });
});

app.all('/vod/:op', (req, resp) => {
    let r = vodService.callFunction(req.params['op'], req.body);
    r.then(v=>{
        resp.end(JSON.stringify(v));
    });
});

app.listen(8000);
console.log('application server started!');