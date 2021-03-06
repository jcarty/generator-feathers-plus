
const assert = require('yeoman-assert');
const cp = require('child_process');
const fs = require('fs-extra');
const helpers = require('yeoman-test');
const klawSync = require('klaw-sync');
const merge = require('lodash.merge');
const path = require('path');

const { resetForTest: resetSpecs } = require('../lib/specs');

const packageInstaller = 'npm'; // npm measured as faster than yarn for this
const tests = [
  /*
   Repo generator-old-vs-new contains app's generated with the same prompts
   using David's generator and the new generator. You can use various tools to compare the source
   between these to identify differences in the generated code.

   The `t#` were generated using David's generator. The `z#` using the new one.
   Matching app's have the same number, i.e. t1 and z1 were generated using the same prompts.

   The `z#` are copied to this test dir under names like app.test-expected.
   This test compares the currently generated source to e.g. app.test-expected which
   essentially is a comparision with the source produced by David's generator.

   `npm run mocha:code` will compare the source produced by the tests. Its very fast
   because it does not install the dependencies.
   `npm run mocha:tests` will run `npm test` for each test. Its very slow as it has to
   install dependencies.
   `npm test` runs both of the above.
   The tests stop running on the first assertion failure.
   */

  // t0, z0 Test scaffolding to execute multiple generate calls and check the final result.
  // Also test a missing specs.options is created.
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  { testName: 'scaffolding.test',
    specsChanges: [
      { generate: 'all', before: specs => delete specs.app.providers, merge: { app: { providers: ['primus'] } } },
      { generate: 'all', before: specs => delete specs.app.providers, merge: { app: { providers: ['rest'] } } },
      { generate: 'all', before: specs => delete specs.app.providers, merge: { app: { providers: ['rest', 'socketio'] } } },
      { generate: 'all', prompts: { confirmation: true } }
    ],
    compareDirs: true,
    execute: false,
  },

  // t01, z01 Test creation of app.
  //  generate app            # z-1, Project z-1, npm, src1, socketio (only)
    { testName: 'app.test' },

  // Test when .eslintrc.json file already exists
    { testName: 'app-eslintrc.test' },

  // t02, z02 (z01 ->) Test service creation without authentication scaffolding.
  // Also test any missing specs.options props are created.
  //* generate app            # z-1, Project z-1, npm, src1, socketio (only)
  //  generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth N, graphql Y
  //  generate service        # NeDB, nedb2, /nedb-2,                 auth N, graphql Y
    { testName: 'service.test' },

  // t03, z03 (z02 ->) Test middleware creation.
  //* generate app            # z-1, Project z-1, npm, src1, socketio (only)
  //* generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth N, graphql Y
  //* generate service        # NeDB, nedb2, /nedb-2,                 auth N, graphql Y
  //  generate middleware     # mw1, *
  //  generate middleware     # mw2, mw2
    { testName: 'middleware.test' },

  // t04, z04 (z02 ->) Test graphql endpoint creation.
  //* generate app            # z-1, Project z-1, npm, src1, socketio (only)
  //* generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth N, graphql Y
  //* generate service        # NeDB, nedb2, /nedb-2,                 auth N, graphql Y
  // z04 only
  //  Add schemas for nedb1 and nedb2
  //  Regenerate nedb1 and nedb2
  //  generate graphql        # service calls, /graphql,
    { testName: 'graphql.test' },

  // (z04 ->) Test graphql endpoint creation with authentication.
  //* generate app            # z-1, Project z-1, npm, src1, socketio (only)
  //  generate authentication # Local and Auth0, users1, Nedb, nedb://../data, graphql Y
  //* generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth Y, graphql Y
  //* generate service        # NeDB, nedb2, /nedb-2,                 auth Y, graphql Y
  // z04 only
  //  Add schemas for nedb1 and nedb2
  //  Regenerate nedb1 and nedb2
  //  generate graphql        # service calls, /graphql,
    { testName: 'graphql-auth.test' },

  // t05, z05 Test authentication scaffolding.
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //  generate authentication # Local and Auth0, users1, Nedb, nedb://../data, graphql Y
    { testName: 'authentication-1.test' },

  // t06, z06 (z05 ->) Test creation of authenticated service with auth scaffolding.
  //* generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //* generate authentication # Local and Auth0, users1, Nedb, nedb://../data, graphql Y
  //  generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth Y, graphql Y
    { testName: 'authentication-2.test' },

  // t07, z07 (z06 ->) Test creation of non-authenticated service with auth scaffolding.
  //* generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //* generate authentication # Local and Auth0, users1, Nedb, nedb://../data, graphql Y
  //* generate service        # NeDB, nedb1, /nedb-1, nedb://../data, auth Y, graphql Y
  //  generate service        # NeDB, nedb2, /nedb-2, nedb://../data, auth N, graphql Y
    { testName: 'authentication-3.test' },

  // t08, z08 Test everything together. Mainly used to test different adapters.
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //  generate authentication # Local+Auth0+Google+Facebook+GitHub,
  //                            users1, Nedb, /users-1, nedb://../data, auth Y, graphql N
  //  generate service        # NeDB, nedb1, /nedb-1, auth Y, graphql Y
  //  generate service        # NeDB, nedb2, /nedb-2, auth N, graphql Y
  //  generate middleware     # mw1, *
  //  generate middleware     # mw2, mw2
  // z08 only
  //  Add schemas for users1, nedb1 and nedb2 --> ADD BOTH schema.properties AND extensions <--
  //  Regenerate users1, nedb1 and nedb2
  //  generate graphql        # service calls, /graphql, auth N
    { testName: 'cumulative-1-nedb.test' },

  // t08, z08 Test everything together. Mainly used to test different adapters.
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //  generate authentication # Local+Auth0+Google+Facebook+GitHub,
  //                            users1, generic, auth Y, graphql N
  //  generate service        # NeDB, generic, /nedb-1, auth Y, graphql Y
  //  generate service        # NeDB, generic, /nedb-2, auth N, graphql Y
  //  generate middleware     # mw1, *
  //  generate middleware     # mw2, mw2
  // z08 only
  //  Add schemas for users1, nedb1 and nedb2 --> ADD BOTH schema.properties AND extensions <--
  //  Regenerate users1, nedb1 and nedb2
  //  generate graphql        # service calls, /graphql, auth N
    { testName: 'cumulative-1-generic.test' },

  // t08-memory, z08-memory The same as t08 & z08 but using @f/memory.
  // Service names remain nedb1 & nedb2.
    { testName: 'cumulative-1-memory.test' },

  // t08-mongo, z08-mongo The same as t08 & z08 but using @f/mongodb.
  // Service names remain nedb1 & nedb2; use default connection string.
    { testName: 'cumulative-1-mongo.test' },

  // t08-mongoose, z08-mongoose The same as t08 & z08 but using @f/mongoosedb.
  // Service names remain nedb1 & nedb2; use default connection string.
    { testName: 'cumulative-1-mongoose.test' },

  // The same as t08 & z08 but using options: { semicolons: false }
    { testName: 'cumulative-1-no-semicolons.test' },

  // t08-sequelize, z08-sequelize The same as t08 & z08 but using @f/sequelize & PostgreSQL.
  // Service names remain nedb1 & nedb2; use default connection string.
    { testName: 'cumulative-2-sequelize-services.test' },

  // The same as t08 & z08 but using options: { graphql: { strategy: 'batchloaders' } }
  // Service names remain nedb1 & nedb2; use default connection string.
    { testName: 'cumulative-2-nedb-batchloaders.test' },

  // Test switch from kebabCase naming of folders and files
  // Its tests TEST AUTHENTICATION and should be periodically run with dependency loading
    { testName: 'cumulative-2-test-auth.test' },

  // Test hook generation with associated tests
    { testName: 'cumulative-2-hooks.test' },

  // Test generating unit hook tests
    { testName: 'cumulative-2-test-hook-unit.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.app1' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb12' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.manual' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb1' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb2' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating integration hook tests
    { testName: 'cumulative-2-test-hook-integ.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.app1' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb12' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.manual' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb1' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb2' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating service tests
    { testName: 'cumulative-2-test-service.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'serviceUnit', serviceName: 'nedb1' } },
        { generate: 'test', prompts: { testType: 'serviceUnit', serviceName: 'nedb2' } },
        { generate: 'test', prompts: { testType: 'serviceInteg', serviceName: 'nedb1' } },
        { generate: 'test', prompts: { testType: 'serviceInteg', serviceName: 'users1' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating authentication tests
    { testName: 'cumulative-2-test-authentication.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'authBase' } },
        { generate: 'test', prompts: { testType: 'authServices' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // t21, z21 Test switching the user-entity
  // t21
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //  generate authentication # Local+Auth0+Google+Facebook+GitHub,
  //                            users1, Nedb, /users-1, nedb://../data, auth Y, graphql N
  //  generate service        # NeDB, nedb1, /nedb-1, auth Y
  // z21
  //  generate app            # z-1, Project z-1, npm, src1, REST and socketio
  //  generate authentication # Local+Auth0+Google+Facebook+GitHub,
  //                            nedb1, Nedb, /nedb-1, nedb://../data, auth Y, graphql Y
  //  generate authentication # Local+Auth0+Google+Facebook+GitHub,
  //                            users1, Nedb, /users-1, nedb://../data, auth Y, graphql N
  //  generate service        # NeDB, nedb1, /nedb-1, auth Y (line not needed in test as test regens whole app)
  { testName: 'regen-user-entity.test',
    specsChanges: [
      { generate: 'all', merge: {
          authentication: { entity: 'users1' },
          services: {
            nedb1: { isAuthEntity: false },
            users1: {
              name: 'users1',
              nameSingular: 'users1',
              subFolder: '',
              fileName: 'users-1',
              adapter: 'nedb',
              path: '/users-1',
              isAuthEntity: true,
              requiresAuth: true,
              graphql: false
            },
          }
        } },
    ]
  },

  // z22 Test that app.js does not require templates/src/_adapters/* unless they are currently being used.
  // Also tests that existing package.json, config/default.json & config/production.json contents are retained.
  //  generate app            # z-1, Project z-1, npm, src1, socketio (only)
  //  generate service        # MongoDB, nedb1, /nedb-1, mongodb://localhost:27017/z_1, auth N, graphql Y
  //  generate service        # NeDB,    nedb1, /nedb-1, nedb://../data,                auth N, graphql Y
    { testName: 'regen-adapters-1.test',
      specsChanges: [
        { generate: 'all', merge: {
            services: { nedb1: { adapter: 'nedb' } },
            connections: {
              'nedb': {
                database: 'nedb',
                adapter: 'nedb',
                connectionString: 'nedb://../data'
              }
            }
          } },
      ]
    },

  // test service in sub-folders
    { testName: 'name-space.test' },

  // test old and new service folder/file naming
    { testName: 'service-naming.test', /* execute: true */ },

  // .ts version of cconst logger = require('./logger')umulative-1-nedb.test
    { testName: 'ts-cumulative-1-nedb.test' },

  // .ts version of cumulative-1-generic.test
    { testName: 'ts-cumulative-1-generic.test' },

  // .ts version of cumulative-1-memory.test
    { testName: 'ts-cumulative-1-memory.test' },

  // .ts version of cumulative-1-mongo.test
    { testName: 'ts-cumulative-1-mongo.test' },

  // .ts version of cumulative-1-mongoose.test
    { testName: 'ts-cumulative-1-mongoose.test' },

  // .ts version of cumulative-2-sequelize-services.test
    { testName: 'ts-cumulative-2-sequelize-services.test' },

  // Test hook generation with associated tests
    { testName: 'ts-cumulative-2-hooks.test' },

  // Test generating unit hook tests
    { testName: 'ts-cumulative-2-test-hook-unit.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.app1' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb12' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.manual' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb1' } },
        { generate: 'test', prompts: { testType: 'hookUnit', hookName: 'hook.nedb2' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating integration hook tests
    { testName: 'ts-cumulative-2-test-hook-integ.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.app1' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb12' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.manual' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb1' } },
        { generate: 'test', prompts: { testType: 'hookInteg', hookName: 'hook.nedb2' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating service tests
    { testName: 'ts-cumulative-2-test-service.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'serviceUnit', serviceName: 'nedb1' } },
        { generate: 'test', prompts: { testType: 'serviceUnit', serviceName: 'nedb2' } },
        { generate: 'test', prompts: { testType: 'serviceInteg', serviceName: 'nedb1' } },
        { generate: 'test', prompts: { testType: 'serviceInteg', serviceName: 'users1' } },
      ],
      compareDirs: true,
      execute: false,
    },

  // Test generating authentication tests
    { testName: 'ts-cumulative-2-test-authentication.test',
      specsChanges: [
        { generate: 'test', prompts: { testType: 'authBase' } },
        { generate: 'test', prompts: { testType: 'authServices' } },
      ],
      compareDirs: true,
      execute: false,
    },


  // test service in sub-folders
    { testName: 'ts-name-space.test' },
];

let appDir;
const runJustThisTest = 'name-space.test' //null; //'cumulative-1-sequelize.test' //null;
const executeAll = false;

describe('generators-writing.test.js', function () {
  tests.forEach(({ testName, execute = false, specsChanges = [], compareDirs = true }) => {
    if (runJustThisTest && runJustThisTest !== testName) return;

    describe(testName, function () {
      it('writes code expected', () => {
        return runFirstGeneration(testName, { skipInstall: true })
          .then(dir => {

            // There is no second generation step
            if (!specsChanges.length) {
              return compareCode(dir, `${testName}-expected`, compareDirs);
            }

            // Generate on top of contents of working directory
            return runNextGenerator(dir, specsChanges, { skipInstall: true })
              .then(dir => {
                return compareCode(dir, `${testName}-expected`, compareDirs);
              });
          });
      });

      if (executeAll || execute) {
        it('runs test generated', () => {
          return runFirstGeneration(testName, { skipInstall: false })
            .then(dir => {

              // There is no second generation step
              if (!specsChanges.length) {
                return runExecute(dir);
              }

              // Generate on top of contents of working directory
              return runNextGenerator(dir, specsChanges, { skipInstall: false })
                .then(dir => runExecute(dir));

              function runExecute(dir) {
                return runGeneratedTests('starts and shows the index page')
                  .then(() => {
                    const pkg = require(path.join(dir, 'package.json'));

                    // Weak test that dependencies were added
                    assert.ok(pkg.devDependencies.mocha, 'Added mocha as a devDependency');
                  });
              }
            });
        });
      }
    });
  });
});

// Run the first generator
function runFirstGeneration (testName, withOptions) {
  //console.log('>runFirstGeneration', testName, withOptions);
  return helpers.run(path.join(__dirname, '..', 'generators', 'all'))
    .inTmpDir(dir => {
      appDir = dir;
      // specs.app.name must be 'z-1' not 'z1' as Feathers-generate app converts the project name
      // to kebab-case during the prompt.
      //console.log('288', path.join(__dirname, '..', 'test-expands', `${testName}-copy`), dir);
      fs.copySync(path.join(__dirname, '..', 'test-expands', `${testName}-copy`), dir);

      resetSpecs();
    })
    .withPrompts({
      confirmation: true,
      action: 'force' // force file overwrites
    })
    .withOptions(withOptions);
}

// Run subsequent generators
// Return working directory containing last generated app.
function runNextGenerator(dir, specsChanges, withOptions, index = 1) {
  //console.log('>runNextGenerator', dir);
  if (!specsChanges.length) return;
  const specsChg = specsChanges.shift();

  if (specsChg.prompts) {
    return doGenerate(specsChg);
  } else {
    return doSpecChange(specsChg);
  }

  function doGenerate(specsChg) {
    return helpers.run(path.join(__dirname, '..', 'generators', specsChg.generate))
      .inTmpDir(dirNext => {
        appDir = dirNext;
        console.log(`      ${index + 1} "generate ${specsChg.generate}" with ${JSON.stringify(specsChg.prompts).substr(0, 65)}`);

        //console.log('314', dir, dirNext);
        fs.copySync(dir, dirNext);

        resetSpecs();
      })
      .withPrompts(Object.assign({},
        specsChg.prompts,
        { action: 'force' }, // force file overwrites
      ))
      .withOptions(withOptions)
      .then(dir => {
        // There are no more generation steps
        if (!specsChanges.length) {
          return dir;
        }

        return runNextGenerator(dir, specsChanges, withOptions, ++index);
      });
  }

  function doSpecChange(specsChg) {
    return helpers.run(path.join(__dirname, '..', 'generators', 'all'))
      .inTmpDir(dirNext => {
        let nextJson;

        appDir = dirNext;
        console.log(`      ${index + 1} change specs ${JSON.stringify(specsChg.merge).substr(0, 65)}`);

        //console.log('314', dir, dirNext);
        fs.copySync(dir, dirNext);

        //console.log('317', path.join(dir, 'feathers-gen-specs.json'));
        const prevJson = fs.readJsonSync(path.join(dir, 'feathers-gen-specs.json'));
        if (specsChg.before) {
          specsChg.before(prevJson);
        }
        nextJson = specsChg.merge ? merge(prevJson, specsChg.merge) : prevJson;

        //console.log('322', path.join(dirNext, 'feathers-gen-specs.json'));
        fs.writeFileSync(path.join(dirNext, 'feathers-gen-specs.json'), JSON.stringify(nextJson, null, 2));

        resetSpecs();
      })
      .withPrompts({
        confirmation: true,
        action: 'force' // force file overwrites
      })
      .withOptions(withOptions)
      .then(dir => {
        // There are no more generation steps
        if (!specsChanges.length) {
          return dir;
        }

        return runNextGenerator(dir, specsChanges, withOptions, ++index);
      });
  }
}

// Run the 'test' script in package.json
function runGeneratedTests (expectedText) {
  // console.log('>runGeneratedTests');
  return runCommand(packageInstaller, ['test'], { cwd: appDir })
    .then(({ buffer }) => {
      if (buffer.indexOf(expectedText) === -1) {
        console.log(`\n\n===== runGeneratedTests. Expected "${expectedText}". Found:`);
        console.log(buffer);
      }

      assert.ok(buffer.indexOf(expectedText) !== -1,
        'Ran test with text: ' + expectedText);
    });
}

// Start a process and wait either for it to exit
// or to display a certain text
function runCommand (cmd, args, options, text) {
  console.log('..run shell command', cmd, args);
  return new Promise((resolve, reject) => {
    let buffer = '';

    function addToBuffer (data) {
      buffer += data;

      if (text && buffer.indexOf(text) !== -1) {
        resolve({ buffer, child });
      }
    }

    const child = cp.spawn(cmd, args, options);

    child.stdout.on('data', addToBuffer);
    child.stderr.on('data', addToBuffer);

    child.on('exit', status => {
      if (status !== 0) {
        return reject(new Error(buffer));
      }

      resolve({ buffer, child });
    });
  });
}

function compareCode (appDir, testDir, compareDirs) {
  // console.log('>compareCode', appDir, testDir, compareDirs);
  console.log('... comparing code');
  const appDirLen = appDir.length;
  const expectedDir = path.join(__dirname, '..', 'test-expands', testDir);

  const expectedPaths = getFileNames(expectedDir);
  const actualPaths = getFileNames(appDir);

  if (compareDirs === true) {
    assert.deepEqual(actualPaths.relativePaths, expectedPaths.relativePaths, 'Unexpected files in generated dir');
  }

  actualPaths.paths.forEach((actualPath, i) => {
    compare(i, actualPath.path.substr(appDirLen));
  });

  /*
  const expectedDirLen = expectedDir.length;
  expectedPaths.paths.forEach((expectedPath, i) => {
    compare(i, expectedPath.path.substr(expectedDirLen));
  });
  */

  function compare(i, fileName) {
    // console.log('compare files', fileName);
    let expected;

    //console.log('410', `${appDir}${fileName}`);
    const actual = fs.readFileSync(`${appDir}${fileName}`, 'utf8');

    try {
      //console.log('414', `${expectedDir}${fileName}`);
      expected = fs.readFileSync(`${expectedDir}${fileName}`, 'utf8');
    } catch (err) {
      console.log(actual);
      throw err;
    }

    if (actual !== expected) console.log(actual);
    // if (actual !== expected) console.log(expected);

    assert.equal(actual, expected, `Unexpected contents for file ${appDir}${fileName}`);
  }
}

function getFileNames (dir) {
  //console.log('>getFileNames', dir);
  const nodes = klawSync(dir, { nodir: true })
    .filter(obj => obj.path.indexOf('/node_modules/') === -1 && obj.path.indexOf('/data/') === -1);

  return {
    paths: nodes,
    relativePaths: nodes.map(path => path.path.replace(`${dir}/`, '')).sort()
  };
}
