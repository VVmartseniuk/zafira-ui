'use strict';

//TODO: // Implement run the linter (before Babel processes the JS).
//TODO: Source maps are resource heavy and can cause out of memory issue for large source files. We need to enable it only on demand (using env variables);

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');
const ImageminPlugin = require('imagemin-webpack-plugin').default;
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const imageminMozjpeg = require('imagemin-mozjpeg');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
    const isProd = env === 'production';
    const isDev = env === 'development';
    const __PRODUCTION__ = JSON.stringify(isProd);
    const __ZAFIRA_WS_URL__ = process.env.ZAFIRA_WS_URL || 'http://localhost:8080/zafira-ws'; //TODO: move WS_URL fallback value from this file
    const __ZAFIRA_UI_VERSION__ = JSON.stringify(process.env.ZAFIRA_UI_VERSION || 'local');
    const packageName = JSON.stringify(process.env.npm_package_name) || '';
    const base = JSON.stringify(process.env.ZAFIRA_UI_BASE) || '/';
    const htmlWebpackConfig = Object.assign(
        {},
        {
            inject: true,
            template: '../index.html',
            showErrors: true,
            base,
        },
        isProd
            ? {
                minify: {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true,
                },
            }
            : undefined
    );

    return {
        mode: 'none',
        bail: isProd,
        devtool: 'source-map',
        context: path.join(__dirname, '../client/app'),
        entry: {
            vendors: './app.vendors.js',
            app: './app.module.js',
        },
        output: {
            filename: isProd ? '[name].build.[hash:8].min.js' : '[name].build.js',
            chunkFilename: isProd ? '[name].chunk.[hash:8].min.js' : '[name].chunk.js',
            path: path.join(__dirname, '../dist'),
            pathinfo: isDev,
        },
        resolve: {
            modules: [
                path.join(__dirname, '../client/app'),
                path.join(__dirname, '../client/assets'),
                path.join(__dirname, '../node_modules')
            ],
            alias: {
                'jquery-ui': path.resolve(__dirname, '../node_modules/jquery-ui/ui'),
                'humanizeDuration': 'humanize-duration',
                appConfig: path.join(__dirname, '../client/config.json')
            }
        },
        module: {
            rules: [
                {
                    // "oneOf" will traverse all following loaders until one will
                    // match the requirements. When no loader matches it will fall
                    // back to the "file" loader at the end of the loader list.
                    oneOf: [
                        {
                            test: /\.m?js$/,
                            exclude: [/node_modules/],
                            use: [
                                {
                                    loader: 'babel',
                                    options: {
                                        compact: isProd && 'auto',
                                        presets: ['@babel/preset-env'],
                                        plugins: [
                                            '@babel/plugin-proposal-object-rest-spread',
                                            '@babel/transform-runtime',
                                            ['angularjs-annotate', { 'explicitOnly' : true}],
                                            '@babel/plugin-syntax-dynamic-import'
                                        ],
                                        cacheDirectory: true,
                                        cacheCompression: isProd,
                                    }
                                },
                            ]

                        },
                        {
                            test: /\.(gif|png|jpe?g)$/i,
                            loader: 'url',
                            exclude: [
                                path.resolve(__dirname, '../node_modules/font-awesome/fonts')
                            ],
                            options: {
                                limit: 8192,
                                name: isProd ? '[name].[hash:8].[ext]' : '[name].[ext]',
                            },
                        },
                        {
                            test: /\.(otf|ttf|eot|woff2?|svg)$/i,
                            include: [
                                path.resolve(__dirname, '../node_modules/font-awesome/fonts')
                            ],
                            loader: 'file',
                            options: {
                                name: '[name].[ext]',
                                basePath: '/',
                            },
                        },
                        {
                            test: /\.html$/,
                            exclude: [path.resolve(__dirname, '../client/index.html')],
                            loader: 'html',
                            options: {
                                attrs: [':md-svg-src', ':data-src', ':src']
                            }
                        },
                        {
                            test: /\.(sa|sc|c)ss$/,
                            use: [
                                isDev ? 'style' : MiniCssExtractPlugin.loader,
                                {loader: 'css', options: { importLoaders: 1, sourceMap: isDev }},
                                {
                                    loader: `postcss`,
                                    options: {
                                        // Necessary for external CSS imports to work
                                        // https://github.com/facebook/create-react-app/issues/2677
                                        ident: 'postcss',
                                        plugins: () => [
                                            require('postcss-flexbugs-fixes'),
                                            require('postcss-preset-env')({
                                                autoprefixer: {
                                                    flexbox: 'no-2009',
                                                },
                                                stage: 3,
                                            }),
                                        ],
                                        sourceMap: isDev,
                                    },
                                },
                                'sass',
                            ],
                        },
                        // "file" loader makes sure those assets get served by WebpackDevServer.
                        // When you `import` an asset, you get its (virtual) filename.
                        // In production, they would get copied to the `build` folder.
                        // This loader doesn't use a "test" so it will catch all modules
                        // that fall through the other loaders.
                        {
                            loader: 'file',
                            // Exclude `js` files to keep "css" loader working as it injects
                            // its runtime that would otherwise be processed through "file" loader.
                            // Also exclude `html` and `json` extensions so they get processed
                            // by webpacks internal loaders.
                            exclude: [/\.(s?css)$/, /\.(m?js)$/, /\.html$/, /\.json$/],
                            options: {
                                name: isProd ? '[name].[hash:8].[ext]' : '[name].[ext]',
                                basePath: '/',
                            },
                        },
                        // ** STOP ** Are you adding a new loader?
                        // Make sure to add the new loader(s) before the "file" loader.
                    ]
                },
            ]
        },
        resolveLoader: {
            moduleExtensions: ['-loader']
        },
        plugins: [
            new webpack.DefinePlugin({
                __PRODUCTION__,
                __ZAFIRA_UI_VERSION__,
            }),
            new webpack.ProvidePlugin({
                $: 'jquery',
                jQuery: 'jquery',
                'window.jQuery': 'jquery',
            }),
            new MiniCssExtractPlugin({
                filename: isProd ? '[name].[hash:8].css' : '[name].css',
                chunkFilename: isProd ? '[name].chunk.[hash:8].css' : '[name].chunk.css',
            }),
            new FaviconsWebpackPlugin({
                // Your source logo
                logo: '../favicon.png',
                // The prefix for all image files (might be a folder or a name)
                prefix: 'icons-[hash:8]/',
                // Emit all stats of the generated icons
                emitStats: false,
                // The name of the json containing all favicon information
                statsFilename: 'iconstats-[hash:8].json',
                // Generate a cache file with control hashes and
                // don't rebuild the favicons until those hashes change
                persistentCache: true,
                // Inject the html into the html-webpack-plugin
                inject: true,
                // favicon background color (see https://github.com/haydenbleasel/favicons#usage)
                background: '#fff',
                // favicon app title (see https://github.com/haydenbleasel/favicons#usage)
                title: packageName,

                // which icons should be generated (see https://github.com/haydenbleasel/favicons#usage)
                icons: {
                    android: true,
                    appleIcon: true,
                    appleStartup: false,
                    coast: false,
                    favicons: true,
                    firefox: true,
                    opengraph: false,
                    twitter: false,
                    yandex: true,
                    windows: false
                }
            }),
            new HtmlWebpackPlugin(htmlWebpackConfig),
            new webpack.ProgressPlugin(),
            // To strip all locales except “en”
            new MomentLocalesPlugin(),
            new ImageminPlugin({
                test: /\.(jpe?g|png|gif|svg)$/i,
                disable: isDev,
                options: {
                    jpegtran: false,
                    pngquant: {
                        quality: '65-90',
                        speed: 4
                    },
                    plugins: [
                        imageminMozjpeg({
                            quality: 65,
                            progressive: true
                        })
                    ]
                },
            }),
            new CopyWebpackPlugin(
                [{
                    from: '../config.json',
                    transform(data) {
                        const str = data.toString('utf8').replace('__ZAFIRA_WS_URL__', __ZAFIRA_WS_URL__);

                        return Buffer.from(str);
                    }
                }]
            ),
        ],
        optimization: {
            runtimeChunk: 'single',
            namedModules: true,
            namedChunks: true,
            minimize: isProd,
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    vendors: false
                }
            }
        },
        // Some libraries import Node modules but don't use them in the browser.
        // Tell Webpack to provide empty mocks for them so importing them works.
        node: {
            module: 'empty',
            dgram: 'empty',
            dns: 'mock',
            fs: 'empty',
            net: 'empty',
            tls: 'empty',
            child_process: 'empty',
        },
        performance: {
            hints: isProd ? false : 'warning'
        },
        stats: {
            colors: true,
        }
    };

};
