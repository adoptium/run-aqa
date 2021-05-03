import * as core from '@actions/core'
import * as runaqa from './runaqa'

async function run(): Promise<void> {
  try {
    const jdksource = core.getInput('jdksource', {required: false})
    const version = core.getInput('version', {required: false})
    const buildList = core.getInput('build_list', {required: false})
    const target = core.getInput('target', {required: false})
    const customTarget = core.getInput('custom_target', {required: false})
    const openjdktestRepo = core.getInput('openjdk_testRepo', {required: false})
    const tkgRepo = core.getInput('tkg_Repo', {required: false})
    const vendorTestRepos = core.getInput('vendor_testRepos', {required: false})
    const vendorTestBranches = core.getInput('vendor_testBranches', {required: false})
    const vendorTestDirs = core.getInput('vendor_testDirs', {required: false})
    const vendorTestShas = core.getInput('vendor_testShas', {required: false})

    let vendorTestParams = ''
    //  let arch = core.getInput("architecture", { required: false })
    if (
      jdksource !== 'upstream' &&
      jdksource !== 'github-hosted' &&
      jdksource !== 'install-jdk'
    ) {
      core.error(
        `jdksource should be one of [upstream, github-hosted, install-jdk]. Found: ${jdksource}`
      )
    }

    if (
      buildList !== 'openjdk' &&
      !buildList.startsWith('external') &&
      !buildList.startsWith('functional') &&
      !buildList.startsWith('perf') &&
      !buildList.startsWith('system')
    ) {
      core.setFailed(
        `buildList should be one of or sub dir of [openjdk, external, functional, system, perf]. Found: ${buildList}`
      )
    }
    if (jdksource !== 'upstream' && version.length === 0) {
      core.setFailed(
        'Please provide jdkversion if jdksource is github-hosted installed or AdoptOpenJKD/install-jdk installed.'
      )
    }
    if (vendorTestRepos !== '') {
      vendorTestParams = `--vendor_repos ${vendorTestRepos}`
    }
    if (vendorTestBranches !== '') {
      vendorTestParams += ` --vendor_branches ${vendorTestBranches}`
    }
    if (vendorTestDirs !== '') {
      vendorTestParams += ` --vendor_dirs ${vendorTestDirs}`
    }
    if (vendorTestShas !== '') {
      vendorTestParams +=  ` --vendor_shas ${vendorTestShas}`
    }
    await runaqa.runaqaTest(version, jdksource, buildList, target, customTarget, openjdktestRepo, tkgRepo, vendorTestParams)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
