/**
 * @file gulp plugin file compiler
 * @author zhangwentao <winty2013@gmail.com>
 */
/* eslint-disable fecs-min-vars-per-destructure */

const through = require('through2');
const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const PLUGIN_NAME = 'file-compiler';
const path = require('path');

const {transformSync} = require('@babel/core');

const {compile: compileStyle} = require('../style/style');
const {getFileCompiler} = require('./base');
const {isCSS, isJS, changeExt, getDestDir} = require('../../helper/path');
const log = require('../../helper/log');

/**
 * 编译 JS
 *
 * @param {string} content 文件内容
 * @param {mars.options} options opt
 * @return {babel.BabelFileResult}
 */
function compileJS(content, options) {
    const {
        target
    } = options;
    const buildConfig = options._config;

    content = content.replace(
        /process\.env\.MARS_ENV/g,
        JSON.stringify(target)
    ).replace(
        /process\.env\.NODE_ENV/g,
        JSON.stringify(process.env.NODE_ENV || 'development')
    );

    return transformSync(content, {
        plugins: [
            [
                path.resolve(__dirname, './babel-plugin-relative-import.js'),
                {
                    filePath: options.path,
                    // cwd: path.resolve(process.cwd(), getDestDir(buildConfig.dest, target)),
                    cwd: path.resolve(process.cwd(), './src'),
                    modules: {
                        '@marsjs/core': '/mars-core',
                        'vuex': '/mars_modules/vuex'
                    }
                }
            ],
            'minify-guarded-expressions',
            'minify-dead-code-elimination'
        ]
    });
}

async function compile(file, options) {
    const {fileSuffix, target} = options;
    const buildConfig = options._config || {};
    const cssCompiler = getFileCompiler(compileStyle, buildConfig);
    const jsCompiler = getFileCompiler(compileJS, buildConfig);
    file.lang = path.extname(file.path).substr(1);

    // h5 的没有编译 sfc 中的 style block, assets file 也先不编译保持一致
    if (isCSS(file.path) && target !== 'h5') {
        file.type = 'css';
        file.path = changeExt(file.path, fileSuffix.css);
        await cssCompiler(file, options);
    }
    if (isJS(file.path)) {
        file.type = 'js';
        // TODO: H5 支持 ts 文件编译
        if (target !== 'h5') {
            file.path = changeExt(file.path, fileSuffix.js);
        }
        await jsCompiler(file, options);
    }
    return file;
}

exports.gulpPlugin = function (options) {
    const stream = through.obj(function (file, enc, cb) {
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }
        if (file.isBuffer()) {
            try {
                compile(file, options).then(_ => cb(null, file));
            }
            catch (e) {
                log.error('[COMPILE ERROR]:', e);
            }
            return;
        }
        // for other file type
        cb(null, file);
    });
    return stream;
};
