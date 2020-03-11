import * as core from '@actions/core'
import * as runaqa from './runaqa'

async function run(): Promise<void> {
  try {
    let version = core.getInput('version', {required: false})
    let buildList = core.getInput('build_list', {required: false})
    let target = core.getInput('target', {required: false})
    //  let arch = core.getInput("architecture", { required: false })
    const jdksource = core.getInput('jdksource', {required: false})
    if (!version) version = '8'
    if (!buildList) buildList = 'openjdk'
    if (!target) target = '_jdk_math'
    //  if (!arch) arch = "x64";
    if (
      buildList !== 'openjdk' &&
      buildList !== 'external' &&
      buildList !== 'functional' &&
      buildList !== 'perf' &&
      buildList !== 'system'
    ) {
      core.error(
        `buildList should be one of [openjdk, external, functional, system, perf]. Found: ${buildList}`
      )
    }

    await runaqa.runaqaTest(version, jdksource, buildList, target)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
