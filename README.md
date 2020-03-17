# RunAQA tests

An action to run [AQA tests](https://github.com/AdoptOpenJDK/openjdk-tests) with specific JDK on specific platform

## Usage

See [action.yml](https://github.com/AdoptOpenJDK/run-aqa/blob/master/action.yml)

## Default JDK: run openjdk test _jdk_math against default JDK on Github hosted virtual machine

```
    steps:
    - uses: actions/checkout@v1
    - name: AQA
      uses: AdoptOpenJDK/run-aqa@v1
      with: 
        build_list: 'openjdk'
        target: '_jdk_math'
```
You can also:
  - run functional, external, system, perf tests
  - run different level target
  - run against different JDK on Github hosted virtual machine
     ```version: '13' ```

## Customized JDK
### run openjdk test _jdk_math against customized JDK, work with [actions/setup-java](https://github.com/actions/setup-java)

```
    - uses: actions/setup-java@v1
      with:
        java-version: '11' # The JDK version to make available on the path.
    - name: AQA
      uses: AdoptOpenJDK/run-aqa@v1
      with: 
        version: '11'
        jdksource: 'customized'
        build_list: 'openjdk'
        target: '_jdk_math'
 ```
### run openjdk test _jdk_math against customized JDK, work with [AdoptOpenJDK/install-jdk](https://github.com/AdoptOpenJDK/install-jdk) using JDKs are downloaded from AdoptOpenJDK

```
    - uses: AdoptOpenJDK/install-jdk@v1
      with:
        version: '11'
        architecture: x64
        targets: 'JDK_11'
        impl: 'openj9'
    - name: AQA
      uses: AdoptOpenJDK/run-aqa@v1
      with: 
        version: '11'
        jdksource: 'customized'
        build_list: 'openjdk'
        target: '_jdk_math'
 ```

## Work with [upload-artifact](https://github.com/actions/upload-artifact) to upload testoutput if there are test failures

```
    - name: AQA
      uses: AdoptOpenJDK/run-aqa@v1
      with: 
        version: '11'
        build_list: 'openjdk'
        target: '_jdk_math
    - uses: actions/upload-artifact@v1
      if: failure()
      with:
        name: test_output
        path: ./openjdk-tests/TKG/TKG_test_output/
```
## Configuration:

| Parameter | Default |
| ------ | ------ |
| version | 8 |
| build_list | openjdk |
| target | jdk_math |
| jdksource |  |

### version
The Java version that tests are running against (Supported values are: 8, 9, 10, 11, 12, 13, ...)
By default, this action will run against JKD8 installed on github action hosted virtual machine. Alternatively, a version be specified explicitly.

The version key should be set accordingly for custom downloads since it is used to cache JDKs which are used multiple times during the workflow.


### build_list
Test category. The values are openjdk, functional, system, perf, external.

### target
Specific testcase name or different test level under build_list

### jdksource
Customized JDK installed with [actions/setup-java](https://github.com/actions/setup-java) or [AdoptOpenJDK/install-jdk](https://github.com/AdoptOpenJDK/install-jdk)
