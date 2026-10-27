const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'content.js'),'utf8');
const version=source.match(/const CHANGELOG = \{\s*version: "([^"]+)"/)?.[1];
if(version!==manifest.version || pkg.version!==manifest.version)throw Error('Manifest, package, and What’s New versions must agree.');
const scripts=new Set([manifest.background.service_worker]);
for(const entry of manifest.content_scripts)for(const file of [...(entry.js||[]),...(entry.css||[])]){if(!fs.existsSync(path.join(root,file)))throw Error(`Missing runtime file: ${file}`);if(file.endsWith('.js'))scripts.add(file);}
for(const file of scripts)execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
for(const [size,file]of Object.entries(manifest.icons)){
 const data=fs.readFileSync(path.join(root,file));
 if(data.toString('hex',0,8)!=='89504e470d0a1a0a' || data.readUInt32BE(16)!==Number(size) || data.readUInt32BE(20)!==Number(size))throw Error(`Invalid icon: ${file}`);
}
console.log(`PASS: v${manifest.version} version consistency, runtime JavaScript, manifest references, and icon dimensions.`);
