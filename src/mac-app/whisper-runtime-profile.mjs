// 번들에 명시된 두 프로파일만 허용한다. 임의 경로·환경변수 선택은 받지 않는다.
import fs from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
async function safeDirectory(dir){dir=path.resolve(dir);const parent=path.dirname(dir);if(parent!==dir)await safeDirectory(parent);const st=await fs.lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error('unsafe_profile_directory');}
export const RUNTIME_NAME='whisper-portable-3.12.16';
export const DEFAULT_PROFILE='default';
export const DEVELOPMENT_PROFILE='development-whisper-pyav-lgpl-v1';
export const DEVELOPMENT_RUNTIME_NAME='whisper-pyav-lgpl-dev-v1';
export const PROFILE_FILE='whisper-runtime-profile.json';
export function runtimeNameForProfile(profile=DEFAULT_PROFILE){if(profile===DEFAULT_PROFILE)return RUNTIME_NAME;if(profile===DEVELOPMENT_PROFILE)return DEVELOPMENT_RUNTIME_NAME;throw Error('unsupported_runtime_profile');}
export async function resolveRuntimeProfile(bundleRoot){
 await safeDirectory(bundleRoot);let file;
 try{file=await fs.open(path.join(bundleRoot,PROFILE_FILE),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);}catch(e){if(e.code==='ENOENT')return DEFAULT_PROFILE;throw Error('invalid_runtime_profile');}
 try{const st=await file.stat();if(!st.isFile()||st.size>1024)throw Error('invalid_runtime_profile');const meta=JSON.parse(await file.readFile('utf8'));
  if(!meta||JSON.stringify(Object.keys(meta).sort())!==JSON.stringify(['profile','version'])||meta.version!==1||meta.profile!==DEVELOPMENT_PROFILE)throw Error('invalid_runtime_profile');return DEVELOPMENT_PROFILE;
 }catch{throw Error('invalid_runtime_profile');}finally{await file.close();}
}
export function profileInfo(profile=DEFAULT_PROFILE){const runtimeName=runtimeNameForProfile(profile);return{profile,runtimeName,storageName:profile===DEFAULT_PROFILE?'Ahmatda':'Ahmatda-PyAV-Dev'};}
export async function resolveStorageRoot(bundleRoot){const info=profileInfo(await resolveRuntimeProfile(bundleRoot));return path.join(homedir(),'Library/Application Support',info.storageName);}
export async function resolveRuntimePaths(bundleRoot,root){const profile=await resolveRuntimeProfile(bundleRoot),info=profileInfo(profile);return{...info,runtime:info.runtimeName,source:path.join(bundleRoot,'runtime',info.runtimeName),local:path.join(root,'runtime',info.runtimeName),python:path.join(root,'runtime',info.runtimeName,'python/bin/python3.12')};}
