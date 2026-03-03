const fs = require('fs');
const childProcess = require('child_process');
const SemanticReleaseError = require('@semantic-release/error');

let verified;

async function verifyConditions(pluginConfig, context) {
  const { cwd, logger } = context;
  const composerJsonFile = `${cwd}/composer.json`;

  if (fs.existsSync(composerJsonFile)) {
    logger.log('composer.json found in %s', cwd);
  } else {
    logger.log(`${composerJsonFile} not found`);
    if (
      typeof pluginConfig.skipOnMissingComposerJson === 'undefined' ||
      !pluginConfig.skipOnMissingComposerJson
    ) {
      throw new SemanticReleaseError(`${composerJsonFile} not found`, 'EVERIFYCONDITIONS');
    }
  }

  verified = true;
  return true;
}

async function prepare(pluginConfig, context) {
  if (!verified) {
    await verifyConditions(pluginConfig, context);
  }

  const {
    cwd,
    nextRelease: { version },
    logger,
  } = context;

  const composerJsonFile = `${cwd}/composer.json`;

  if (!fs.existsSync(composerJsonFile)) {
    logger.log('composer.json not found: Silently skipping...');
    return;
  }

  logger.log('Write version %s to %s', version, composerJsonFile);

  let fileContent = fs.readFileSync(composerJsonFile, 'utf8');
  const versionRegex = /^(\s*"version"\s*:\s*)"[^"]*"/m;

  if (versionRegex.test(fileContent)) {
    fileContent = fileContent.replace(versionRegex, `$1"${version}"`);
  } else {
    const data = JSON.parse(fileContent || '{}');
    data.version = version;
    fileContent = JSON.stringify(data, null, 4);
  }

  fs.writeFileSync(composerJsonFile, fileContent);

  logger.log('Prepared composer.json');

  const composerLockFile = `${cwd}/composer.lock`;
  if (fs.existsSync(composerLockFile)) {
    // update lock file with new version
    logger.log('Updating version %s in %s ', version, composerLockFile);
    childProcess.execSync('composer update --lock');
  }
}

module.exports = { verifyConditions, prepare };
