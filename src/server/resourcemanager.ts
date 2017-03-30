import fs = require('fs');
import path = require('path');
const vodConfig = require('./vod/vodconfig.json')

export default class ResourceManger {
    static _files;

    static locateFile(source: string) {
        if (!ResourceManger._files) ResourceManger.initFiles();
        let fidx = ResourceManger._files.findIndex(f => f.id == source);
        if (fidx > -1) return ResourceManger._files[fidx];
        return null;
    }

    static initFiles() {
        ResourceManger._files = [];
        let id = 0;
        let filters: [any] = vodConfig.filters;
        vodConfig.dirs.forEach(function (dir) {
            var files = fs.readdirSync(dir);

            files.forEach(function (f) {
                if (!fs.lstatSync(path.join(dir, f)).isDirectory()) {
                    var finfo = path.parse(f);
                    if (filters.indexOf(finfo.ext) > -1)
                        ResourceManger._files.push({
                            id: id++,
                            name: finfo.name,
                            path: path.join(dir, f)
                        });
                }
            });
        });
    }

    static getAvailStaticSources() {
        if (!ResourceManger._files) ResourceManger.initFiles();
        return ResourceManger._files;
    }
}