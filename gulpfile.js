let gulp = require('gulp');
let ts = require('gulp-typescript');
let sourcemaps = require('gulp-sourcemaps');

let tsProjB = ts.createProject({
    module: 'commonjs',
    target: 'es5'
});
let tsProjS = ts.createProject({
    module: 'commonjs',
    target: 'es6'
});

gulp.task('tb', () => {
    return gulp.src(['src/**/*.ts', '!src/server/**/*.ts'])
        //.pipe(sourcemaps.init())
        .pipe(tsProjB())
        //.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../src' }))
        .pipe(gulp.dest('bin'));
});

gulp.task('ts', () => {
    return gulp.src(['src/**/*.ts', '!src/app/**/*.ts'])
        .pipe(sourcemaps.init())
        .pipe(tsProjS())
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../src' }))
        .pipe(gulp.dest('bin'));
});

gulp.task('copy', () => {
    return gulp.src(['src/**/*', '!src/**/*.ts'])
        .pipe(gulp.dest('bin'));
});

gulp.task('watch', ['copy', 'tb', 'ts'], () => {
    gulp.watch(['src/**/*.ts', '!src/server/**/*.ts'], ['tb']);
    gulp.watch(['src/**/*.ts', '!src/app/**/*.ts'], ['ts']);
    gulp.watch(['src/**/*', '!src/**/*.ts'], ['copy']);
});