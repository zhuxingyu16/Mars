/**
 * @file 编译外部依赖模块，原因：
 *       1. 有些模块中有 process.env.NODE_ENV 判断。
 *       2. 微信小程序不识别项目文件夹之外的依赖
 * @author meixuguang
 */

/* eslint-disable fecs-no-require */

const fs = require('fs-extra');
const webpack = require('webpack');
const log = require('../../helper/log');
const {getPathToCWD} = require('../../helper/path');

const modules = {
    '@marsjs/core': {
        needCompile: false,
        path: '/mars-core'
    },
    'vuex': {
        needCompile: true,
        path: '/mars_modules/vuex'
    }
};

const inProcessingModules = new Set();

/**
 * compile
 *
 * @param {string} val key
 * @param {string} key key
 * @param {string} destPath dest
 * @return {Promise}
 */
function compile(val, key, destPath) {
    if (!modules[key].needCompile) {
        return Promise.resolve();
    }


    const entry = require.resolve(key, {
        paths: [process.cwd()]
    });

    let path;
    if (val === modules[key].path) {
        // 直接写的包名，为了能引用到，生成为 index.js
        path = val + '/index.js';
    }
    else {
        path = '/mars_modules' + entry.slice(entry.lastIndexOf('node_modules')).replace('node_modules', '');
    }

    if (fs.existsSync(destPath + path) || inProcessingModules.has(entry)) {
        return Promise.resolve();
    }

    log.info('[compile:module]:', getPathToCWD(entry));

    inProcessingModules.add(entry);
    return new Promise((resolve, reject) => {
        webpack({
            entry: [entry],
            output: {
                path: destPath,
                filename: '.' + path,
                libraryTarget: 'commonjs'
            },
            mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
        }, (err, stats) => {
            if (err) {
                log.error(err.stack || err);
                if (err.details) {
                    log.error(err.details);
                }
                return resolve();
            }

            const info = stats.toJson();

            if (stats.hasErrors()) {
                log.error(info.errors);
            }

            if (stats.hasWarnings()) {
                log.warn(info.warnings);
            }
            inProcessingModules.delete(entry);
            resolve();
            // Done processing
        });
    });

}

module.exports = {
    compile,
    modules
};
