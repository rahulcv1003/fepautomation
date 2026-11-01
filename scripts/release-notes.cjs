const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const sections=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8').split(/^## /m);
const section=sections.find(value=>value.startsWith(version+' '));
if(!section)throw Error('Missing changelog entry for '+version);
process.stdout.write(section.split(/\r?\n/).slice(1).join('\n').trim()+'\n');
