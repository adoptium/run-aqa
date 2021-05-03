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
  openjdktestRepo: string,
  tkgRepo: string,
  vendorTestRepos: string,
  vendorTestBranches: string,
  vendorTestDirs: string,
  vendorTestShas: string
): Promise<void> {
  await installDependencyAndSetup()
  setSpec()
  process.env.BUILD_LIST = buildList
  if (!('TEST_JDK_HOME' in process.env)) process.env.TEST_JDK_HOME = getTestJdkHome(version, jdksource)

  await getOpenjdkTestRepo(openjdktestRepo)
  await runGetSh(tkgRepo, vendorTestRepos, vendorTestBranches, vendorTestDirs, vendorTestShas)

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
  // Remove spaces in Windows path and replace with a short name path, e.g. 'C:/Program Files/***' ->C:/Progra~1/***
  if (IS_WINDOWS && jdksource === 'github-hosted') {
    javaHome = javaHome.replace(/Program Files/g, 'Progra~1')
  }
  return javaHome
}

// This function is an alternative of extra install step in workflow or alternative install action. This could also be implemented as github action
async function installDependencyAndSetup(): Promise<void> {
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
    await exec.exec('sudo sysctl -w kern.sysv.shmall=655360')
    await exec.exec('sudo sysctl -w kern.sysv.shmmax=125839605760')
  } else {
    await exec.exec('sudo apt-get update')
    await exec.exec('sudo apt-get install ant-contrib -y')
    //environment
    if ('RUNNER_USER' in process.env) {
      process.env['LOGNAME'] = process.env['RUNNER_USER']
    } else {
      core.warning('RUNNER_USER is not the GitHub Actions environment variables shell script. Container is configured differently. Please check the updated lists of environment variables.')
    }

    //disable apport
    await exec.exec('sudo service apport stop')
  }
}

function setSpec(): void {
  if (IS_WINDOWS) {
    process.env['SPEC'] = 'win_x86-64_cmprssptrs'
  } else if (process.platform === 'darwin') {
    process.env['SPEC'] = 'osx_x86-64_cmprssptrs'
  } else {
    process.env['SPEC'] = 'linux_x86-64_cmprssptrs'
  }
}

async function getOpenjdkTestRepo(openjdktestRepo: string): Promise<void> {
  let repoBranch = ['AdoptOpenJDK/openjdk-tests', 'master']
  if (openjdktestRepo !== 'openjdk-tests:master') {
    repoBranch = parseRepoBranch(openjdktestRepo)
  }
  await exec.exec(
    `git clone --depth 1 -b ${repoBranch[1]} https://github.com/${repoBranch[0]}.git`
  )
  process.chdir('openjdk-tests')
}

async function runGetSh(tkgRepo: string, vendorTestRepos: string, vendorTestBranches: string, vendorTestDirs: string, vendorTestShas: string): Promise<void> {
  let tkgParameters = ''
  let repoBranch = ['AdoptOpenJDK/TKG', 'master']
  let vendorRepoParams = ''
  let vendorBranchParams = ''
  let vendorDirParams = ''
  let vendorShaParams = ''
  if (tkgRepo !== 'TKG:master') {
    repoBranch = parseRepoBranch(tkgRepo)
    tkgParameters = `--tkg_branch ${repoBranch[1]} --tkg_repo https://github.com/${repoBranch[0]}.git`
  }
  if (vendorTestRepos !== '') {
    vendorRepoParams = `--vendor_repos ${vendorTestRepos}`
  }
  if (vendorTestBranches !== '') {
    vendorBranchParams = `--vendor_branches ${vendorTestBranches}`
  }
  if (vendorTestDirs !== '') {
    vendorDirParams = `--vendor_dirs ${vendorTestDirs}`
  }
  if (vendorTestShas !== '') {
    vendorShaParams = `--vendor_shas ${vendorTestShas}`
  }
  if (IS_WINDOWS) {
    await exec.exec(`bash ./get.sh ${tkgParameters} ${vendorRepoParams} ${vendorBranchParams} ${vendorDirParams} ${vendorShaParams}`)
  } else {
    await exec.exec(`./get.sh ${tkgParameters} ${vendorRepoParams} ${vendorBranchParams} ${vendorDirParams} ${vendorShaParams}`)
  }
}

function parseRepoBranch(repoBranch: string): string[] {
  const tempRepo = repoBranch.replace(/\s/g, '')
  return tempRepo.split(':')
}