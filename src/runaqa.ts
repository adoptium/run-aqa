/* eslint-disable prefer-template */
import * as core from '@actions/core'
import * as exec from '@actions/exec'

export async function runaqaTest(
  version: string,
  buildList: string,
  target: string
): Promise<void> {
  process.env.BUILD_LIST = buildList
  process.env.TEST_JDK_HOME = defaultJAVAHome(version)
  await exec.exec('ls')
  //Testing

  await exec.exec(
    'git clone --depth 1 https://github.com/AdoptOpenJDK/openjdk-tests.git'
  )
  process.chdir('openjdk-tests')
  await exec.exec('git clone --depth 1 https://github.com/AdoptOpenJDK/TKG.git')
  process.chdir('TKG')
  await exec.exec('ls -l')
  await exec.exec('make compile')
  await exec.exec('make', [`${target}`])
}

function defaultJAVAHome(version: string): string {
  let defaultJavahome = ''
  // On linux for now
  if (process.platform === 'linux') {
    defaultJavahome = process.env[`JAVA_HOME_${version}_X64`] as string
    core.info(` JAVAHOME is ${defaultJavahome}`)
  } else {
    core.error(' TODO supoort other platform')
  }
  return defaultJavahome
}
