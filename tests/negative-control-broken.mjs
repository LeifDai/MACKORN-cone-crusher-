/**
 * 负控夹具：故意在模块导入期抛错，用于验证 DSH 插件树加载失败会「响亮报错」。
 * 这不是插件的一部分，只被 tests 引用；正常情况下不应挂载。
 */
throw new Error('MACKORN negative control: this module is intentionally broken');
