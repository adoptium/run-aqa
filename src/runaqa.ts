/* eslint-disable prefer-template */
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as path from 'path'

const isWindows = process.platform === 'win32'
export async function runaqaTest(
  version: string,
  jdksource: string,
  buildList: string,
  target: string
): Promise<void> {
  await installDependency()
  process.env.BUILD_LIST = buildList
  if (jdksource) {
    // TODO: installJDK set output $targets, now suppose the default JAVA_HOME
    process.env.TEST_JDK_HOME = process.env.JAVA_HOME
  } else {
    process.env.TEST_JDK_HOME = defaultJAVAHome(version)
  }
  await exec.exec('ls')
  //Testing
  // TODO : make run functional using get.sh?
  await exec.exec(
    'git clone --depth 1 https://github.com/AdoptOpenJDK/openjdk-tests.git'
  )
  process.chdir('openjdk-tests')
  await exec.exec('git clone --depth 1 https://github.com/AdoptOpenJDK/TKG.git')
  process.chdir('TKG')
  await exec.exec('make compile')
  await exec.exec('make', [`${target}`])
}

function defaultJAVAHome(version: string): string {
  let defaultJavahome = ''
  defaultJavahome = process.env[`JAVA_HOME_${version}_X64`] as string
  // Window path has to be in apostrophe. e.g. ''C:/Program Files/Java/***'
  if (isWindows) {
    return `'${defaultJavahome}'`
  }
  return defaultJavahome
}

// This function is an alternate of extra install step in workflow or alternative install action. This should go away if we move this installation to getDependency target in TKG
async function installDependency(): Promise<void> {
  if (isWindows) {
    const antContribFile = await tc.downloadTool(`https://sourceforge.net/projects/ant-contrib/files/ant-contrib/ant-contrib-1.0b2/ant-contrib-1.0b2-bin.zip/download`)
    const baseLocation = process.env['USERPROFILE'] || 'C:\\'
    const tempDirectory = path.join(baseLocation, 'actions', 'temp')
    const tempDir: string = path.join(
      tempDirectory,
      `temp_${Math.floor(Math.random() * 2000000000)}`
    )
    await tc.extractZip(`${antContribFile}`, tempDir)
    io.mv(`${tempDir}\\ant-contrib.jar`, `${process.env.ANT_HOME}`)
  } else if (process.platform === 'darwin') {
    await exec.exec('brew install ant-contrib')
  } else {
    await exec.exec('sudo apt-get update')
    await exec.exec('sudo apt-get install ant-contrib -y')
  }
}
