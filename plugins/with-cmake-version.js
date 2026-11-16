/**
 * Expo config plugin: pin the CMake version of the Android app module.
 *
 * Why: on Windows the React Native codegen object paths exceed 260 characters. CMake 3.22.1 (AGP default)
 * ships ninja 1.10.2, which cannot use long paths; CMake 3.31.6 from the Android SDK ships ninja 1.12.1,
 * which can (Windows "LongPathsEnabled" must be 1). The android/ folder is generated (CNG), so the setting
 * lives here instead of a hand edit.
 */
const { withAppBuildGradle } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const withCmakeVersion = (config, { version = '3.31.6' } = {}) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('with-cmake-version: app/build.gradle is not Groovy');
    cfg.modResults.contents = mergeContents({
      src: cfg.modResults.contents,
      newSrc: `    externalNativeBuild { cmake { version "${version}" } }`,
      tag: 'grzybodex-cmake-version',
      anchor: /^android\s*\{$/,
      offset: 1,
      comment: '//',
    }).contents;
    return cfg;
  });

module.exports = withCmakeVersion;
