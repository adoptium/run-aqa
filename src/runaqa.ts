/* eslint-disable prefer-template */
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as path from 'path'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const isWindows = process.platform === 'win32'
export async function runaqaTest(
  version: string,
  jdksource: string,
  buildList: string,
  target: string
): Promise<void> {
  await installDependency()
  process.env.BUILD_LIST = buildList
  process.env.TEST_JDK_HOME = getJAVAHome(version, jdksource)
  await exec.exec('ls')
  //Testing
  // TODO : make run functional using get.sh?
  await exec.exec(
    'git clone --depth 1 https://github.com/AdoptOpenJDK/openjdk-tests.git'
  )
  process.chdir('openjdk-tests')
  await exec.exec('./get.sh')

  const options: ExecOptions = {}
  let myOutput = ''
  options.listeners = {
    stdout: (data: Buffer) => {
      myOutput += data.toString()
    }
  }
  process.chdir('TKG')
  try {
    await exec.exec('make compile')
    await exec.exec('make', [`${target}`], options)
  } catch (error) {
    core.setFailed(error.message)
  }
  if (myOutput.includes('FAILED test targets') === true) {
    core.setFailed('There are failed tests')
  }
}

function getJAVAHome(version: string, jdksource: string): string {
  let javaHome = process.env[`JAVA_HOME_${version}_X64`] as string
  if (jdksource) {
    javaHome = process.env.JAVA_HOME as string
    core.info(`customized javaHome is ${javaHome}`)
  }
  // Window path has to be in apostrophe. e.g. ''C:/Program Files/Java/***'
  if (isWindows) {
    return `'${javaHome}'`
  }
  return javaHome
}

// This function is an alternative of extra install step in workflow or alternative install action. This could also be implemented as github action
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
