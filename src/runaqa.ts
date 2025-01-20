import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as path from 'path'
import * as fs from 'fs'
import {ExecOptions} from '@actions/exec/lib/interfaces'

let tempDirectory = process.env['RUNNER_TEMP'] || ''
const IS_WINDOWS = process.platform === 'win32'
const IS_MACOS = process.platform === 'darwin'

if (!tempDirectory) {
  let baseLocation

  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\'
  } else if (IS_MACOS) {
    baseLocation = '/Users'
  } else {
    baseLocation = '/home'
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp')
}

/**
 * Runs aqa tests
 * @param  {string} version JDK Version being tested
 * @param  {string} jdksource Source for JDK
 * @param  {[string]} customizedSdkUrl Download link for JDK binaries
 * @param  {[string]} sdkdir Directory for SDK
 * @param  {[string]} buildList AQAvit Test suite
 * @param  {[string]} target  aqa test(s) to run
 * @param  {[string]} customTarget custom test(s) to run
 * @param  {[string]} aqatestsRepo Alternative aqatestRepo
 * @param  {[string]} openj9Repo Alternative openj9Repo
 * @param  {[string]} tkgRepo Alternative TKG repo
 * @param  {[string]} vendorTestParams Vendor provided test parameters
 * @param  {[string]} aqasystemtestsRepo Alternative AQA-systemtestRepo
 * @return {[null]}  null
 */
export async function runaqaTest(
  version: string,
  jdksource: string,
  customizedSdkUrl: string,
  sdkdir: string,
  buildList: string,
  target: string,
  customTarget: string,
  aqatestsRepo: string,
  openj9Repo: string,
  tkgRepo: string,
  vendorTestParams: string,
  aqasystemtestsRepo: string
): Promise<void> {

  await setupTestEnv(
    version,
    jdksource,
    customizedSdkUrl,
    sdkdir,
    buildList,
    target,
    aqatestsRepo,
    openj9Repo,
    tkgRepo,
    vendorTestParams,
    aqasystemtestsRepo
    );

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
      const customOption = `${target
        .substr(1)
        .toUpperCase()}_TARGET=${customTarget}`
      await exec.exec('make', [`${target}`, `${customOption}`], options)
    }
    else if (target.includes('-f parallelList.mk')) {
      await exec.exec(`make ${target}`);
   } else {
      await exec.exec('make', [`${target}`], options)
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
    else {
      core.setFailed('Unexpected error')
    }
  }
  if (myOutput.includes('FAILED test targets') === true) {
    core.setFailed('There are failed tests')
  }
}

/**
 * Read job.properties and reset TEST_JDK_HOME env variable.
 * @return {[null]}  null
 */
function resetJDKHomeFromProperties(): void {
  const jobProperties = `${process.env.GITHUB_WORKSPACE}/aqa-tests/job.properties`
  if (fs.existsSync(jobProperties)) {
    const lines = fs
      .readFileSync(jobProperties, 'utf-8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter(Boolean)
    for (const l of lines) {
      const regexp = /TEST_JDK_HOME=(.*)/
      const match = regexp.exec(l)
      if (match && match[1]) {
        process.env.TEST_JDK_HOME = match[1]
        core.info(`Reset TEST_JDK_HOME to ${process.env.TEST_JDK_HOME}`)
      }
    }
  }
}

/**
 * Sets javaHome on the runner. Raise exception if not able to be set.
 * @param  {string} version JDK version
 * @param  {string} jdksource [description]
 * @return {[string]}  javaHome    Java home
 */
function getTestJdkHome(version: string, jdksource: string): string {
  // Try JAVA_HOME first and then fall back to GITHUB actions default location
  let javaHome = process.env[`JAVA_HOME_${version}_X64`] as string
  if (javaHome === undefined) {
    javaHome = process.env['JAVA_HOME'] as string
  }
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
  if (javaHome === undefined) {
    // exit with error if JDK cannot be found
    core.setFailed('JDK could not be found')
  }
  return javaHome
}

/**
 * This function is an alternative of extra install step in workflow or alternative install action. This could also be implemented as github action
 * @return {[null]}  null
 */
async function installPlatformDependencies(): Promise<void> {
  if (IS_WINDOWS) {
    const cygwinPath = 'C:\\cygwin64'
    try {
      if (!fs.existsSync(cygwinPath)) {
        core.info(`if the cygwin exist?`)
        await io.mkdirP('C:\\cygwin64')
        await io.mkdirP('C:\\cygwin_packages')
        await tc.downloadTool(
          'https://cygwin.com/setup-x86_64.exe',
          'C:\\temp\\cygwin.exe'
        )
        await exec.exec(`C:\\temp\\cygwin.exe  --packages wget,bsdtar,rsync,gnupg,git,autoconf,make,gcc-core,mingw64-x86_64-gcc-core,unzip,zip,cpio,curl,grep,perl --quiet-mode --download --local-install
        --delete-orphans --site  https://mirrors.kernel.org/sourceware/cygwin/
        --local-package-dir "C:\\cygwin_packages"
        --root "C:\\cygwin64"`)
        await exec.exec(
          `C:/cygwin64/bin/git config --system core.autocrlf false`
        )
        core.addPath(`C:\\cygwin64\\bin`)
      }
    } catch (error) {
      if (error instanceof Error) {
        core.warning(error.message)
      }
      else {
        core.warning('Unexpected error')
      }
    }
    const antContribFile = await tc.downloadTool(
      `https://sourceforge.net/projects/ant-contrib/files/ant-contrib/ant-contrib-1.0b2/ant-contrib-1.0b2-bin.zip/download`
    )
    await tc.extractZip(`${antContribFile}`, `${tempDirectory}`)
    await io.cp(
      `${tempDirectory}/ant-contrib/lib/ant-contrib.jar`,
      `${process.env.ANT_HOME}\\lib`
    )
  } else if (IS_MACOS) {
    await exec.exec('brew install ant-contrib')
    await exec.exec('sudo sysctl -w kern.sysv.shmall=655360')
    await exec.exec('sudo sysctl -w kern.sysv.shmmax=125839605760')
  } else {
    if (fs.existsSync('/usr/bin/apt-get')) {
      // Debian Based
      await exec.exec('sudo apt-get update')
      await exec.exec('sudo apt-get install ant-contrib -y')
    } else if (fs.existsSync('/usr/bin/yum')) {
      // RPM Based
      await exec.exec('sudo yum update -y')
      const antContribFile = await tc.downloadTool(
        `https://sourceforge.net/projects/ant-contrib/files/ant-contrib/ant-contrib-1.0b2/ant-contrib-1.0b2-bin.zip/download`
      )
      await tc.extractZip(`${antContribFile}`, `${tempDirectory}`)
      await io.cp(
        `${tempDirectory}/ant-contrib/lib/ant-contrib.jar`,
        `${process.env.ANT_HOME}\\lib`
      )
    } else if (fs.existsSync('/sbin/apk')) {
      // Alpine Based
      await exec.exec('apk update')
      const antContribFile = await tc.downloadTool(
        `https://sourceforge.net/projects/ant-contrib/files/ant-contrib/ant-contrib-1.0b2/ant-contrib-1.0b2-bin.zip/download`
      )
      await tc.extractZip(`${antContribFile}`, `${tempDirectory}`)
      await io.cp(
        `${tempDirectory}/ant-contrib/lib/ant-contrib.jar`,
        `${process.env.ANT_HOME}\\lib`
      )
    }
    // environment
    if ('RUNNER_USER' in process.env) {
      process.env['LOGNAME'] = process.env['RUNNER_USER']
    } else {
      core.warning(
        'RUNNER_USER is not the GitHub Actions environment variables shell script. Container is configured differently. Please check the updated lists of environment variables.'
      )
    }

    if (fs.existsSync('/usr/bin/apt-get')) {
      // Force stop apport.service
      try {
        const exitCode = await exec.exec('sudo', ['systemctl', 'stop', 'apport.service', '--quiet'])
      } catch (err) {
        console.error("Error stopping service", err)
      }
    }
  }
}

/**
 * set required SPEC env variable based on OS type.
 * @return {[null]} null     [description]
 */
function setSpec(): void {
  if (IS_WINDOWS) {
    process.env['SPEC'] = 'win_x86-64_cmprssptrs'
  } else if (IS_MACOS) {
    process.env['SPEC'] = 'osx_x86-64_cmprssptrs'
  } else {
    process.env['SPEC'] = 'linux_x86-64_cmprssptrs'
  }
}

/**
 * Installs aqa-test repository onto the runner.
 * @param  {string} version JDK version
 * @param  {[string]} buildList [description]
 * @param  {[string]} aqatestsRepo Alternative aqatestRepo
 * @return {[null]} null
 */
async function getAqaTestsRepo(aqatestsRepo: string, version: string, buildList: string): Promise<void> {
  let repoBranch = ['adoptium/aqa-tests', 'master']
  if (aqatestsRepo.length !== 0) {
    repoBranch = parseRepoBranch(aqatestsRepo)
  }
  await exec.exec(
    `git clone --depth 1 -b ${repoBranch[1]} https://github.com/${repoBranch[0]}.git`
  )
  process.chdir('aqa-tests')
  // workaround until TKG can download the artifacts required for Windows
  if (IS_WINDOWS && buildList != '') {
    if (buildList === 'system'){
      process.chdir('system')
      await exec.exec(`git clone -q https://github.com/adoptium/aqa-systemtest.git`)  // points to master
      await exec.exec(`git clone -q https://github.com/adoptium/STF.git`) // points to master
      process.chdir('../')
    }
    if (buildList === 'openjdk' && version != '') {
      process.chdir('openjdk')
      // Shallow clone the adoptium JDK version - quietly - if there is a reference repo obtain objects from there - destination is openjdk-jdk
      await exec.exec(`git clone --depth 1 -q --reference-if-able ${process.env.GITHUB_WORKSPACE}/openjdk_cache https://github.com/adoptium/jdk${version}.git openjdk-jdk`)
      process.chdir('../')
    }
  }
}

/**
 * Sets the system test repo and branch env vars
 * @param  {[string]} aqasystemtestsRepo Repo containing aqa-systemtest project repo and branch
 * @return {[null]} null
 */
function getAqaSystemTestsRepo(aqasystemtestsRepo: string): void {
  const repoBranch = parseRepoBranch(aqasystemtestsRepo)
  process.env.ADOPTOPENJDK_SYSTEMTEST_REPO = repoBranch[0]
  process.env.ADOPTOPENJDK_SYSTEMTEST_BRANCH = repoBranch[1]
}

/**
 * Executes ./get.sh with any additional parameters supplied
 * @param  {string} jdksource [description]
 * @param  {[string]} customizedSdkUrl Download Link for JDK binaries
 * @param  {[string]} sdkdir Directory for SDK
 * @param  {[string]} openj9Repo Alternative openJ9repo
 * @param  {[string]} tkgRepo Alternative TKG
 * @param  {[string]} vendorTestParams Vendor supplied test parameters
 * @return {[null]}  null
 */
async function runGetSh(
  tkgRepo: string,
  openj9Repo: string,
  vendorTestParams: string,
  jdksource: string,
  customizedSdkUrl: string,
  sdkdir: string
): Promise<void> {
  let parameters = ''
  if (tkgRepo.length !== 0) {
    const repoBranch = parseRepoBranch(tkgRepo)
    parameters += `--tkg_branch ${repoBranch[1]} --tkg_repo https://github.com/${repoBranch[0]}.git`
  }
  if (openj9Repo.length !== 0) {
    const repoBranch = parseRepoBranch(openj9Repo)
    parameters += ` --openj9_branch ${repoBranch[1]} --openj9_repo https://github.com/${repoBranch[0]}.git`
  }
  if (jdksource.length !== 0) {
    parameters += ` --sdk_resource ${jdksource}`
  }
  if (customizedSdkUrl.length !== 0) {
    parameters += ` --customizedURL ${customizedSdkUrl}`
  }
  if (sdkdir.length !== 0) {
    parameters += ` --sdkdir ${sdkdir}`
  }
  if (IS_WINDOWS) {
    await exec.exec(`bash ./get.sh ${parameters} ${vendorTestParams}`)
  } else {
    await exec.exec(`./get.sh ${parameters} ${vendorTestParams}`)
  }
}

/**
 * Sets up enviroment to generate parallelList.mk
 * @param  {string} version JDK Version being tested
 * @param  {string} jdksource Source for JDK
 * @param  {[string]} customizedSdkUrl Download link for JDK binaries
 * @param  {[string]} sdkdir Directory for SDK
 * @param  {[string]} buildList AQAvit Test suite
 * @param  {[string]} target  test(s) to run
 * @param  {[string]} aqatestsRepo Alternative aqatestRepo
 * @param  {[string]} openj9Repo Alternative openj9Repo
 * @param  {[string]} tkgRepo Alternative TKG repo
 * @param  {[string]} vendorTestParams Vendor provided test parameters
 * @param  {[string]} aqasystemtestsRepo Alternative AQA-systemtestRepo
 * @return {[null]}  null
 */
export async function setupParallelEnv(
  version: string,
  jdksource: string,
  customizedSdkUrl: string,
  sdkdir: string,
  buildList: string,
  target: string,
  aqatestsRepo: string,
  openj9Repo: string,
  tkgRepo: string,
  vendorTestParams: string,
  aqasystemtestsRepo: string,
  numMachines: string
): Promise<void> {

  await setupTestEnv(version, jdksource, customizedSdkUrl, sdkdir, buildList, target, aqatestsRepo, openj9Repo, tkgRepo, vendorTestParams, aqasystemtestsRepo);
  process.chdir('TKG');
  process.env.PARALLEL_OPTIONS = `PARALLEL_OPTIONS=TEST=${target} TEST_TIME= NUM_MACHINES=${numMachines}`;
  await exec.exec(`make genParallelList ${process.env.PARALLEL_OPTIONS}`);

}

/**
 * Sets required env variables.
 * @param  {string} version JDK Version being tested
 * @param  {string} jdksource Source for JDK
 * @param  {[string]} sdkdir Directory for SDK
 * @param  {[string]} buildList AQAvit Test suite
 * @return {null}  null
 */
function setupEnvVariables(version: string, jdksource: string, buildList: string, sdkdir: string): void {
  setSpec();
  process.env.BUILD_LIST = buildList;
  if ((jdksource === 'upstream' ||
      jdksource === 'github-hosted' ||
      jdksource === 'install-jdk') &&
      !('TEST_JDK_HOME' in process.env)) {
      process.env.TEST_JDK_HOME = getTestJdkHome(version, jdksource);
  }
  if (!('TEST_JDK_HOME' in process.env)) {
      process.env.TEST_JDK_HOME = `${sdkdir}/jdkbinary/j2sdk-image`;
  }
}

/**
 * Sets up the test environment on the runner.
 * @param  {string} version JDK Version being tested
 * @param  {string} jdksource Source for JDK
 * @param  {[string]} customizedSdkUrl Download link for JDK binaries
 * @param  {[string]} sdkdir Directory for SDK
 * @param  {[string]} buildList AQAvit Test suite
 * @param  {[string]} aqatestsRepo Alternative aqatestRepo
 * @param  {[string]} openj9Repo Alternative openj9Repo
 * @param  {[string]} tkgRepo Alternative TKG repo
 * @param  {[string]} vendorTestParams Vendor provided test parameters
 * @param  {[string]} aqasystemtestsRepo Alternative AQA-systemtestRepo
 * @return {null}  null
 */
async function setupTestEnv(
  version: string,
  jdksource: string,
  customizedSdkUrl: string,
  sdkdir: string,
  buildList: string,
  target: string,
  aqatestsRepo: string,
  openj9Repo: string,
  tkgRepo: string,
  vendorTestParams: string,
  aqasystemtestsRepo: string
  ):  Promise<void> {
    await installPlatformDependencies();
    setupEnvVariables(version, jdksource, buildList, sdkdir);
    await getAqaTestsRepo(aqatestsRepo, version, buildList);
    await runGetSh(tkgRepo, openj9Repo, vendorTestParams, jdksource, customizedSdkUrl, sdkdir);
    resetJDKHomeFromProperties();

    // parallelList must be in TKG
    if (target.includes('-f parallelList.mk')) {
      moveParallelListToTKG();
    }

    // Get Dependencies, using /*zip*/dependents.zip to avoid loop every available files
    let dependents = await tc.downloadTool('https://ci.adoptopenjdk.net/view/all/job/test.getDependency/lastSuccessfulBuild/artifact//*zip*/dependents.zip');
    await exec.exec(`unzip -j ${dependents} -d ${process.env.GITHUB_WORKSPACE}/aqa-tests/TKG/lib`);
    if (buildList.includes('system')) {
        if (aqasystemtestsRepo && aqasystemtestsRepo.length !== 0) {
            getAqaSystemTestsRepo(aqasystemtestsRepo);
        }
        dependents = await tc.downloadTool('https://ci.adoptopenjdk.net/view/all/job/systemtest.getDependency/lastSuccessfulBuild/artifact/*zip*/dependents.zip');
        // System.dependency has different levels of archive structures archive/systemtest_prereqs/*.*
        // None of io.mv, io.cp and exec.exec can mv directories as expected (mv archive/ ./). Move subfolder systemtest_prereqs instead.
        const dependentPath = await tc.extractZip(dependents, `${process.env.GITHUB_WORKSPACE}/`);
        await io.mv(`${dependentPath}/archive/systemtest_prereqs`, `${process.env.GITHUB_WORKSPACE}/aqa-tests`);
        await io.rmRF(`${dependentPath}/archive`);
    }
}

/**
 * Moves the parallelList to TKG directory
 * @return {null}  null
 */
async function moveParallelListToTKG() {
  if (IS_WINDOWS) {
    await io.cp(
      `${process.env.GITHUB_WORKSPACE}\\parallelList.mk`,
      `${process.env.GITHUB_WORKSPACE}\\aqa-tests\\TKG\\parallelList.mk`
    )
  } else {
    await io.cp(
      `${process.env.GITHUB_WORKSPACE}/parallelList.mk`,
      `${process.env.GITHUB_WORKSPACE}/aqa-tests/TKG/parallelList.mk`
    )
  }
}

/**
 * Splits the repo branch to obtain project name
 * @param  {[string]} repoBranch repository branch to split upon
 * @return {[string[]]} Array containing parsed string or error message.
 */
function parseRepoBranch(repoBranch: string): string[] {
  const tempRepo = repoBranch.replace(/\s/g, '')
  const slashIndexCheck = tempRepo.indexOf('/')
  const colonIndexCheck = tempRepo.indexOf(':')
  if (
    slashIndexCheck > 0 &&
    colonIndexCheck > 0 &&
    slashIndexCheck < colonIndexCheck
  ) {
    return tempRepo.split(':')
  } else {
    core.warning(
      "Error in string parameter format. Required form: 'octocat/projectname:branch' "
    )
    return []
  }
}