# lvod
A Living/VOD system using FFMPEG+MP4Box, generate [DASH](http://dashif.org/) content supported by most PC/mobility devices. 

## Prerequisite
Nodejs + [FFMPEG](http://ffmpeg.org/download.html) + [MP4Box](https://gpac.wp.imt.fr/mp4box/)

## Features
1. Live static resources
2. Transcode static resources

## Setup
1. Clone the repository and npm install the dependencies.
2. Config the lvod\src\server\live\liveconfig.json and lvod\src\server\vod\vodconfig.json, set those **dir** options using absolute path.
3. Run gulp
4. Run/Debug http server
5. Open dashboard page (localhost:8000/)

