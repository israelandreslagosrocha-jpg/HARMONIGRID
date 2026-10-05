import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {fileURLToPath} from 'node:url'
const resolve=p=>fileURLToPath(new URL(p,import.meta.url))
export default defineConfig({root:resolve('../../'),base:'/HARMONIGRID/',plugins:[vue()],resolve:{alias:[{find:'../services/supabase.js',replacement:resolve('./mock-supabase.js')},{find:/^vue$/,replacement:resolve("../../node_modules/vue/dist/vue.esm-bundler.js")},{find:resolve('../../src/services/supabase.js'),replacement:resolve('./mock-supabase.js')}]},server:{host:'127.0.0.1',port:5174},build:{outDir:'/private/tmp/hg-cloud-browser',emptyOutDir:true,rollupOptions:{input:resolve('./index.html')}}})
