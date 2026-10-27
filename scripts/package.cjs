// Dependency-free ZIP packaging. Only files referenced by the Chrome manifest ship.
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const files=new Set(['manifest.json',manifest.background.service_worker,...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)]);
for(const script of manifest.content_scripts)for(const file of [...(script.js||[]),...(script.css||[])])files.add(file);
const crcTable=Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const name of [...files].sort()){
 const full=path.resolve(root,name);
 if(!full.startsWith(root+path.sep) || !fs.statSync(full).isFile())throw Error(`Invalid runtime path: ${name}`);
 const raw=fs.readFileSync(full),data=zlib.deflateRawSync(raw,{level:9}),filename=Buffer.from(name.replaceAll('\\','/'));
 const crc=crc32(raw),header=Buffer.alloc(30);
 header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);
 header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(filename.length,26);
 local.push(header,filename,data);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt16LE(33,14);
 entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
 central.push(entry,filename);offset+=header.length+filename.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,directory,end]);
const name=`fep-master-autofill-suite-${manifest.version}.zip`,out=path.join(root,'release');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,name),zip);
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),`${crypto.createHash('sha256').update(zip).digest('hex')}  ${name}\n`);
console.log(`Created release/${name} (${zip.length} bytes, ${files.size} runtime files).`);
