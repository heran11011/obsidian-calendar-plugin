// 1. 引入新插件 (注意这里改成了 rollup-plugin-typescript2)
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import svelte from 'rollup-plugin-svelte';
import autoPreprocess from 'svelte-preprocess';

export default {
  input: 'src/main.ts',
  output: {
    file: 'main.js',
    sourcemap: true, // <--- 改成 true！Rollup 会自动生成独立的 .map 文件
    format: 'cjs',
    exports: 'default',
  },
  external: ['obsidian'],
  plugins: [
    svelte({
      preprocess: autoPreprocess(),
      emitCss: false,
    }),
    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),
    // 2. 使用新插件配置
    typescript({
      // 删掉了 tsconfig: './tsconfig.json' 这一行，让它自动查找
      clean: true, 
      check: false,
      verbosity: 2 // 让它多吐点信息，万一报错方便看
    }),
  ],
};