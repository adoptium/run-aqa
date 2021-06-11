# RunAQA tests

An action to run [AQA tests](https://github.com/adoptium/aqa-tests) with specific JDK on specific platform

## Usage

See [action.yml](https://github.com/adoptium/run-aqa/blob/master/action.yml)

## Default upstream action build JDK: run openjdk test _jdk_math against upstream action build JDK

```
    steps:
    - uses: actions/checkout@v1
     - name: Build Openj9 JDK
       id: buildOpenj9
       uses: eclipse/build-openj9@v1
       with:
         version: '8'
    - name: AQA
      uses: adoptium/run-aqa@v1
      env:
         TEST_JDK_HOME: ${{ steps.buildOpenj9.outputs.BuildOpenJ9JDK }}
      with: 
        build_list: 'openjdk'
        target: '_jdk_math'
```
You can also:
  - run functional, external, system, perf tests
  - run different level target

## Customized JDK
### run openjdk test _jdk_math against customized JDK, jdk setup by [actions/setup-java](https://github.com/actions/setup-java)

```
    - uses: actions/setup-java@v1
      with:
        java-version: '11' # The JDK version to make available on the path.
    - name: AQA
      uses: adoptium/run-aqa@v1
      with: 
        version: '11'
        jdksource: 'customized'
        build_list: 'openjdk'
        target: '_jdk_math'
 ```
### run openjdk test _jdk_math against customized JDK, jdk installed by [AdoptOpenJDK/install-jdk](https://github.com/AdoptOpenJDK/install-jdk) using JDKs are downloaded from AdoptOpenJDK

```
    - uses: AdoptOpenJDK/install-jdk@v1
      with:
        version: '11'
        targets: 'JDK_11'
        impl: 'openj9'
    - name: AQA
      uses: adoptium/run-aqa@v1
      with: 
        version: '11'
        jdksource: 'customized'
        build_list: 'openjdk'
        target: '_jdk_math'
 ```

## Github-hosted JDK: run openjdk test _jdk_math against installed JDK on Github-hosted virtual machine

```
    steps:
    - uses: actions/checkout@v1
    - name: AQA
      uses: adoptium/run-aqa@v1
      with: 
        version: '11'
        jdksource: 'github-hosted'
        build_list: 'openjdk'
        target: '_jdk_math'
```

## Work with [upload-artifact](https://github.com/actions/upload-artifact) to upload test outputs if there are test failures

```
    - uses: actions/upload-artifact@v2-preview
      if: failure()
      with:
        name: test_output
        path: ./**/test_output_*/
```

## Configuration:

| Parameter | Default |
| ------ | ------ |
| version | 8 |
| build_list | openjdk |
| target | _jdk_math |
| custom_target |  |
| jdksource | upstream |
| openjdk_testRepo | aqa-tests:master |
| tkg_Repo | TKG:master |

### version
The Java version that tests are running against (Supported values are: 8, 9, 10, 11, 12, 13, ...)
By default, this action will run against upstream jdk build action installed JDK. Specifying this parameter is required when jdksource is not `upstream`.

### build_list
Test category. The values are openjdk, functional, system, perf, external.

### target
Specific testcase name or different test level under build_list

### custom_target
Set customized testcase when any custom target is selected(e.g. jdk_custom, langtools_custom, etc) , path to the test class to execute

### jdksource
THe source of test against JDK. Default is `upstream`. Supported value is [`upstream`, `install-jdk`, `github-hosted`]
  - upstream: JDK built by buildjdk action
  - install-jdk: JDK installed by [AdoptOpenJDK/install-jdk](https://github.com/AdoptOpenJDK/install-jdk) | [actions/setup-java](https://github.com/actions/setup-java)
  - github-hosted : pre-installed JDK on github-hosted environment

### aqa_testRepo
aqa-tests git repo, that holds the definitions for the AQA test suite. Parameter can be set to use developer's personal repo. 

### tkg_Repo
TKG git repo, the underlying framework for the AQA test suite. Parameter can be set to use developer's personal repo.
