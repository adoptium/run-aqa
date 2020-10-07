/* eslint-disable prefer-template */
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as path from 'path'
import * as fs from 'fs'
import {ExecOptions} from '@actions/exec/lib/interfaces'

let tempDirectory = process.env['RUNNER_TEMP'] || ''
const IS_WINDOWS = process.platform === 'win32'

if (!tempDirectory) {
  let baseLocation

  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\'
  } else if (process.platform === 'darwin') {
    baseLocation = '/Users'
  } else {
    baseLocation = '/home'
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp')
}

export async function runaqaTest(
  version: string,
  jdksource: string,
  buildList: string,
  target: string,
  customTarget: string,
  openjdktestRepo: string
): Promise<void> {
  await installDependency()
  process.env.BUILD_LIST = buildList
  if (!('TEST_JDK_HOME' in process.env)) process.env.TEST_JDK_HOME = getTestJdkHome(version, jdksource)
  const workspace = process.env['GITHUB_WORKSPACE'] || ''
  if (!workspace.includes('work/openjdk-tests/openjdk-tests')) {
    await getOpenjdkTestRepo(openjdktestRepo)
  }

  if (IS_WINDOWS) {
    await exec.exec('bash ./get.sh')
  } else {
    await exec.exec('./get.sh')
  }
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
    if (target.includes('custom') && customTarget !== '') {
      const customOption = `${target.substr(1).toUpperCase()}_TARGET=${customTarget}`
      await exec.exec('make', [`${target}`, `${customOption}`], options)
    } else {
      await exec.exec('make', [`${target}`], options)
    }
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
  }
  return javaHome
}

// This function is an alternative of extra install step in workflow or alternative install action. This could also be implemented as github action
async function installDependency(): Promise<void> {
  if (IS_WINDOWS) {
    const cygwinPath = 'C:\\cygwin64'
    try {
      if (!fs.existsSync(cygwinPath)) {
        core.info(`if the cygwin exist?`)
        await io.mkdirP('C:\\cygwin64')
        await io.mkdirP('C:\\cygwin_packages')
        await tc.downloadTool('https://cygwin.com/setup-x86_64.exe', 'C:\\temp\\cygwin.exe')
        await exec.exec(`C:\\temp\\cygwin.exe  --packages wget,bsdtar,rsync,gnupg,git,autoconf,make,gcc-core,mingw64-x86_64-gcc-core,unzip,zip,cpio,curl,grep,perl --quiet-mode --download --local-install
        --delete-orphans --site  https://mirrors.kernel.org/sourceware/cygwin/
        --local-package-dir "C:\\cygwin_packages"
        --root "C:\\cygwin64"`)
        await exec.exec(`C:/cygwin64/bin/git config --system core.autocrlf false`)
        core.addPath(`C:\\cygwin64\\bin`)
      }
    } catch (error) {
      core.warning(error.message)
    }
    const antContribFile = await tc.downloadTool(`https://sourceforge.net/projects/ant-contrib/files/ant-contrib/ant-contrib-1.0b2/ant-contrib-1.0b2-bin.zip/download`)
    await tc.extractZip(`${antContribFile}`, `${tempDirectory}`)
    await io.cp(`${tempDirectory}/ant-contrib/lib/ant-contrib.jar`,`${process.env.ANT_HOME}\\lib`)
  } else if (process.platform === 'darwin') {
    await exec.exec('brew install ant-contrib')
  } else {
    await exec.exec('sudo apt-get update')
    await exec.exec('sudo apt-get install ant-contrib -y')
  }
}

async function getOpenjdkTestRepo(openjdktestRepo: string): Promise<void> {
  let repo = 'AdoptOpenJDK/openjdk-tests'
  let branch = 'master'
  if (openjdktestRepo !== 'openjdk-tests:master') {
    const tempRepo = openjdktestRepo.replace(/\s/g, '')
    const index = tempRepo.indexOf(':')
    repo = tempRepo.substr(0, index)
    branch = tempRepo.substring(index + 1)
  }
  await exec.exec(
    `git clone --depth 1 -b ${branch} https://github.com/${repo}.git`
  )
  process.chdir('openjdk-tests')
}
