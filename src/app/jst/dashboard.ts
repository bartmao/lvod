/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
declare var dashjs;
declare var Vue;

$(() => {
    let d = new Dashboard();
    d.init();
});

class Dashboard {
    private _serviceInvoker = new ServiceInvoker();
    private _player;

    play(url) {
        if (!this._player)
            this._player = dashjs.MediaPlayer().create();
        this._player.initialize($("#video-sample")[0], null, true);
        this._player.attachSource(url);
    }

    init() {
        $('.live-detail').on('hide.bs.collapse', function (e) {
            $(e.target).siblings().last()
                .removeClass('glyphicon-chevron-up')
                .addClass('glyphicon-chevron-down');
        }).on('show.bs.collapse', function (e) {
            $(e.target).siblings().last()
                .removeClass('glyphicon-chevron-down')
                .addClass('glyphicon-chevron-up');
        });

        // load data
        var living_view = new Vue({
            el: '.livings',
            data: {
                livings: []
            },
            methods: {
                init: () => {
                    living_view.loadData();
                },
                loadData: () => {
                    this._serviceInvoker.getLivings((err, _livings) => {
                        if (!err) {
                            living_view.livings = _livings;
                        }
                    });
                },
                play: (sourceId) => {
                    let living = living_view.livings.find(v => v.sourceId == sourceId);
                    this.play(living.liveId + '/live_fix.mpd')
                }
            }
        });

        var vod_view = new Vue({
            el: '.vods',
            data: {
                vods: []
            },
            methods: {
                init: () => {
                    vod_view.loadData();
                },
                loadData: () => {
                    this._serviceInvoker.getAvailStaticSources((err, _vods) => {
                        if (!err) {
                            _vods.forEach(v => v['status'] = 0);
                            vod_view.vods = _vods;
                        }
                    });
                },
                startLive: (source) => {
                    let vod = vod_view.vods.find(v => v.id == source);
                    vod.living = 1;
                    this._serviceInvoker.startLive({
                        ts: new Date(),
                        eid: new Date().getMilliseconds().toString(),
                        source: source
                    }, resp => {
                        if (resp.err) alert(resp.err);
                        else {
                            let liveInfo = JSON.parse(resp.msg);
                            console.log(resp.msg);
                            vod.liveId = liveInfo.liveId;
                            this.play(liveInfo.liveId + '/live_fix.mpd');
                        }
                    });
                },
                stopLive: (source) => {
                    let vod = vod_view.vods.find(v => v.id == source);
                    if (vod.liveId)
                        vod.living = 0;
                    this._serviceInvoker.stopLive(vod.liveId, () => {
                        delete vod.liveId;
                        console.log('live stopped');
                    });
                },
                startVOD: (source) => {
                    let vod = vod_view.vods.find(v => v.id == source);
                    vod.transcoded = 1;
                    this._serviceInvoker.startVOD({
                        ts: new Date(),
                        eid: new Date().getMilliseconds().toString(),
                        source: source
                    }, (err, _vod) => {
                        if (err) return;
                        console.log(_vod);
                    });
                },
                play: (sourceId) => {
                    let vod = vod_view.vods.find(v => v.id == sourceId);
                    if (vod)
                        this.play(vod.vodId + '/1.mpd')
                }
            }
        });

        living_view.init();
        vod_view.init();
    }
}

class ServiceInvoker {
    startLive(data: any, cb: (resp: any) => void) {
        $.ajax('/live/startlive', {
            method: 'post',
            data: data,
            success: msg => cb({ err: null, msg: msg }),
            error: (msg, status, err) => cb({ err: err })
        });
    }

    stopLive(liveId: any, cb: (resp: any) => void) {
        $.ajax('/live/stoplive', {
            method: 'post',
            data: { liveId: liveId },
            success: msg => cb({ err: null, msg: msg }),
            error: (msg, status, err) => cb({ err: err })
        });
    }

    getLivings(cb: (err: any, livings: any) => void) {
        $.ajax('/live/getlivings', {
            method: 'post',
            data: null,
            success: msg => cb(null, JSON.parse(msg)),
            error: (msg, status, err) => cb(err, null)
        });
    }

    getAvailStaticSources(cb: (err: any, livings: any) => void) {
        $.ajax('/vod/getAvailStaticSources', {
            method: 'post',
            data: null,
            success: msg => cb(null, JSON.parse(msg)),
            error: (msg, status, err) => cb(err, null)
        });
    }

    startVOD(data: any, cb: (err: any, vod: any) => void) {
        $.ajax('/vod/startVOD', {
            method: 'post',
            data: data,
            success: msg => cb(null, JSON.parse(msg)),
            error: (msg, status, err) => cb(err, null)
        });
    }
}
