import typescript from "rollup-plugin-ts";
import terser from "@rollup/plugin-terser";

export default {
    input: 'src/main.ts',
    plugins: [typescript()],
    external: ['ms'],
    output: [
        // { file: '/index.js', format: 'cjs', exports: 'auto' },
        // { file: 'build/bundleES.js', format: 'es' }
        // {
        //     name: '-peer',
        //     file: "/index.umd.js",
        //     format: 'umd',
        // },
        {
            file: "peer/index.js",
            format: 'es'
        },
    ]
};