/*
 * Copyright 2017 balena.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readdirSync } from 'fs';
import * as _ from 'lodash';
import * as os from 'os';
import outdent from 'outdent';
import * as path from 'path';
import * as SimpleProgressWebpackPlugin from 'simple-progress-webpack-plugin';
import { BannerPlugin } from 'webpack';

/**
 * Don't webpack package.json as mixpanel & sentry tokens
 * will be inserted in it after webpacking
 */
function externalPackageJson(packageJsonPath: string) {
	return (
		_context: string,
		request: string,
		callback: (error?: Error | null, result?: string) => void,
	) => {
		if (_.endsWith(request, 'package.json')) {
			return callback(null, `commonjs ${packageJsonPath}`);
		}
		return callback();
	};
}

function platformSpecificModule(
	platform: string,
	module: string,
	replacement = '{}',
) {
	// Resolves module on platform, otherwise resolves the replacement
	return (
		_context: string,
		request: string,
		callback: (error?: Error, result?: string, type?: string) => void,
	) => {
		if (request === module && os.platform() !== platform) {
			callback(undefined, replacement);
			return;
		}
		callback();
	};
}

interface ReplacementRule {
	search: string;
	replace: string | (() => string);
}

function replace(test: RegExp, ...replacements: ReplacementRule[]) {
	return {
		loader: 'string-replace-loader',
		test,
		options: { multiple: replacements.map((r) => ({ ...r, strict: true })) },
	};
}

const commonConfig = {
	mode: 'production',
	optimization: {
		minimize: false,
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
			},
			// remove bindings magic from drivelist
			replace(
				/node_modules\/drivelist\/js\/index\.js$/,
				{
					search: 'require("bindings");',
					replace: "require('../build/Release/drivelist.node')",
				},
				{
					search: "bindings('drivelist')",
					replace: 'bindings',
				},
			),
			// remove node-pre-gyp magic from lzma-native
			replace(/node_modules\/lzma-native\/index\.js$/, {
				search: 'require(binding_path)',
				replace: () => {
					const files = readdirSync(path.join('node_modules', 'lzma-native'));
					const bindingFolder = files.find((f) => f.startsWith('binding-'));
					if (bindingFolder === undefined) {
						throw new Error('Could not find lzma_native binding');
					}
					return `require('./${path.posix.join(
						bindingFolder,
						'lzma_native.node',
					)}')`;
				},
			}),
			// remove node-pre-gyp magic from usb
			replace(/node_modules\/@balena.io\/usb\/usb\.js$/, {
				search: 'require(binding_path)',
				replace: "require('./build/Release/usb_bindings.node')",
			}),
			// remove bindings magic from ext2fs
			replace(/node_modules\/ext2fs\/lib\/(ext2fs|binding)\.js$/, {
				search: "require('bindings')('bindings')",
				replace: "require('../build/Release/bindings.node')",
			}),
			// remove bindings magic from mountutils
			replace(/node_modules\/mountutils\/index\.js$/, {
				search: outdent`
						require('bindings')({
						  bindings: 'MountUtils',
						  /* eslint-disable camelcase */
						  module_root: __dirname
						  /* eslint-enable camelcase */
						})
					`,
				replace: "require('./build/Release/MountUtils.node')",
			}),
			// Copy native modules to generated folder
			{
				test: /\.node$/,
				use: [
					{
						loader: 'native-addon-loader',
						options: {
							name: '[path][name].[ext]',
						},
					},
				],
			},
		],
	},
	resolve: {
		extensions: ['.node', '.js', '.json', '.ts', '.tsx'],
	},
	plugins: [
		new SimpleProgressWebpackPlugin({
			format: process.env.WEBPACK_PROGRESS || 'verbose',
		}),
	],
	output: {
		path: path.join(__dirname, 'generated'),
		filename: '[name].js',
	},
	externals: [
		// Only exists on windows
		platformSpecificModule('win32', 'winusb-driver-generator'),
		// Not needed but required by resin-corvus > os-locale > execa > cross-spawn
		platformSpecificModule('none', 'spawn-sync'),
		// Not needed as we replace all requires for it
		platformSpecificModule('none', 'node-pre-gyp', '{ find: () => {} }'),
		// Not needed as we replace all requires for it
		platformSpecificModule('none', 'bindings'),
	],
};

const guiConfig = {
	...commonConfig,
	target: 'electron-renderer',
	node: {
		__dirname: true,
		__filename: true,
	},
	externals: [
		...commonConfig.externals,
		// '../../../package.json' because we are in 'lib/gui/app/index.html'
		externalPackageJson('../../../package.json'),
	],
	entry: {
		gui: path.join(__dirname, 'lib', 'gui', 'app', 'app.ts'),
	},
	plugins: [
		...commonConfig.plugins,
		// Remove "Download the React DevTools for a better development experience" message
		new BannerPlugin({
			banner: '__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };',
			raw: true,
		}),
	],
};

const htmlConfig = {
	mode: 'production',
	optimization: {
		minimize: false,
	},
	module: {
		rules: [
			{
				test: /\.html$/,
				loader: 'html-loader',
			},
			{
				test: /\.css$/i,
				// TODO ?
				use: ['css-loader'],
			},
			{
				test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
				loader: 'file-loader',
				options: {
					name: '[path][name].[ext]',
				},
			},
		],
	},
	entry: {
		index: path.join(__dirname, 'lib', 'gui', 'app', 'index.html'),
	},
	output: {
		path: path.join(__dirname, 'generated'),
	},
};

const etcherConfig = {
	...commonConfig,
	target: 'electron-main',
	node: {
		__dirname: false,
		__filename: true,
	},
	externals: [
		...commonConfig.externals,
		// '../package.json' because we are in 'generated/etcher.js'
		externalPackageJson('../package.json'),
	],
	entry: {
		etcher: path.join(__dirname, 'lib', 'start.ts'),
	},
};

module.exports = [htmlConfig, guiConfig, etcherConfig];
