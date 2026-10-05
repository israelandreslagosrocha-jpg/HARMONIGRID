// Exercise the proposed Vercel headers locally against the real production build.
import fs from 'node:fs'
import {defineConfig,mergeConfig} from 'vite'
import config from '../vite.config.js'
const headers=Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url))).headers[0].headers.map(({key,value})=>[key,value]))
export default mergeConfig(config,defineConfig({preview:{host:'127.0.0.1',port:4173,headers}}))
