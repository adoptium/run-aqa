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
  target: string,
  usePersonalRepo: boolean
): Promise<void> {
  await installDependency()
  process.env.BUILD_LIST = buildList
  if (!('TEST_JDK_HOME' in process.env)) process.env.TEST_JDK_HOME = getTestJdkHome(version, jdksource)

  core.info(`test JDK is ${process.env['TEST_JDK_HOME']}`)
  let openjdktestRepo = 'AdoptOpenJDK/openjdk-tests' 
  let openjdktestBranch = 'master'
  let tkgRepo = ''
  let tkgBranch = ''
  if (usePersonalRepo) {
    const repo = process.env.GITHUB_REPOSITORY as string
    const ref = process.env.GITHUB_REF as string
    const branch = ref.substr(ref.lastIndexOf('/') + 1)
    if (repo.includes('/openjdk-tests')) {
      openjdktestRepo = repo
      openjdktestBranch = branch
    } else if (repo.includes('/TKG')) {
      tkgRepo = repo
      tkgBranch = branch
    }
  }
  await exec.exec(
    `git clone --depth 1 -b ${openjdktestBranch} https://github.com/${openjdktestRepo}.git`
  )
  process.chdir('openjdk-tests')
  let tkgParameters = ''
  if (tkgRepo.length !== 0) {
    tkgParameters = `--tkg_branch ${tkgBranch} --tkg_repo https://github.com/${tkgRepo}.git`
  }
  await exec.exec(`./get.sh ${tkgParameters}`)
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

function getTestJdkHome(version: string, jdksource: string): string {
  let javaHome = process.env[`JAVA_HOME_${version}_X64`] as string
  if (jdksource === 'install-jdk') {
    // work with AdoptOpenJDK/install-sdk
    if (`JDK_${version}` in process.env) {
      javaHome = process.env[`JDK_${version}`] as string
    } else {
      javaHome = process.env.JAVA_HOME as string
    }
    core.info(`install-jdk jdkhome is ${javaHome}`)
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
