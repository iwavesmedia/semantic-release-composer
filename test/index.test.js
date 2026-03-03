const { WritableStreamBuffer } = require('stream-buffers');
const fs = require('fs');
const childProcess = require('child_process');

const composerJsonContent = JSON.stringify({
  name: 'ambimax/some-composer-module',
  type: 'magento-module',
  homepage: 'https://www.ambimax.de',
  require: {
    'magento-hackathon/magento-composer-installer': '*',
  },
});

function setupBefore() {
  jest.resetModules();
  // eslint-disable-next-line global-require
  const plugin = require('../src/index');

  const context = {
    cwd: '.',
    env: {},
    stdout: new WritableStreamBuffer(),
    stderr: new WritableStreamBuffer(),
    logger: {
      log: jest.fn(),
      error: jest.fn(),
    },
    nextRelease: {
      version: '1.1.0',
    },
  };

  return { plugin, context };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('verify step', () => {
  it('verify exception when composer.json does not exist', async () => {
    expect.assertions(1);
    const { plugin, context } = setupBefore();
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(plugin.verifyConditions({}, context)).rejects.toThrow('./composer.json not found');
  });

  it('silently skip on missing composer.json', async () => {
    expect.assertions(1);
    const { plugin, context } = setupBefore();
    const pluginConfig = {
      skipOnMissingComposerJson: true,
    };
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    const result = await plugin.verifyConditions(pluginConfig, context);
    expect(result).toBe(true);
  });

  it('verify composer.json exists', async () => {
    expect.assertions(1);
    const { plugin, context } = setupBefore();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    const result = await plugin.verifyConditions(null, context);
    expect(result).toBe(true);
  });
});

describe('prepare step', () => {
  it('verify exception when composer.json does not exist', async () => {
    expect.assertions(1);
    const { plugin, context } = setupBefore();
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(plugin.prepare({}, context)).rejects.toThrow('./composer.json not found');
  });

  it('silently skip on missing composer.json', async () => {
    expect.assertions(2);
    const { plugin, context } = setupBefore();
    const pluginConfig = {
      skipOnMissingComposerJson: true,
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const fsReadMock = jest.spyOn(fs, 'readFileSync');
    const fsWriteMock = jest.spyOn(fs, 'writeFileSync');

    await plugin.prepare(pluginConfig, context);
    expect(fsReadMock).not.toHaveBeenCalled();
    expect(fsWriteMock).not.toHaveBeenCalled();
  });

  it('verify composer.json has right version', async () => {
    expect.assertions(1);
    const { plugin, context } = setupBefore();
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(composerJsonContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const finalJson = jest.spyOn(fs, 'writeFileSync');
    finalJson.mockImplementation();
    await plugin.prepare(null, context);

    expect(finalJson).toHaveBeenCalledWith(
      expect.stringContaining('composer.json'),
      expect.stringContaining('"version": "1.1.0"'),
    );
  });

  it('preserves trailing newline in composer.json', async () => {
    const { plugin, context } = setupBefore();
    const originalContent = '{\n    "name": "my/package",\n    "version": "1.0.0"\n}\n';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(originalContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await plugin.prepare(null, context);

    const writtenContent = writeMock.mock.calls[0][1];
    expect(writtenContent).toBe('{\n    "name": "my/package",\n    "version": "1.1.0"\n}\n');
  });

  it('preserves file without trailing newline', async () => {
    const { plugin, context } = setupBefore();
    const originalContent = '{\n    "name": "my/package",\n    "version": "1.0.0"\n}';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(originalContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await plugin.prepare(null, context);

    const writtenContent = writeMock.mock.calls[0][1];
    expect(writtenContent).toBe('{\n    "name": "my/package",\n    "version": "1.1.0"\n}');
  });

  it('preserves multiple trailing newlines', async () => {
    const { plugin, context } = setupBefore();
    const originalContent = '{\n    "name": "my/package",\n    "version": "1.0.0"\n}\n\n\n';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(originalContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await plugin.prepare(null, context);

    const writtenContent = writeMock.mock.calls[0][1];
    expect(writtenContent).toBe('{\n    "name": "my/package",\n    "version": "1.1.0"\n}\n\n\n');
  });

  it('only changes the version and preserves everything else', async () => {
    const { plugin, context } = setupBefore();
    const originalContent = '{\n  "name": "my/package",\n  "version": "0.5.0",\n  "description": "A test package",\n  "require": {\n    "php": "^7.4"\n  }\n}\n';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(originalContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await plugin.prepare(null, context);

    const writtenContent = writeMock.mock.calls[0][1];
    const expectedContent = '{\n  "name": "my/package",\n  "version": "1.1.0",\n  "description": "A test package",\n  "require": {\n    "php": "^7.4"\n  }\n}\n';
    expect(writtenContent).toBe(expectedContent);
  });

  it('falls back to JSON.stringify when no version key exists', async () => {
    const { plugin, context } = setupBefore();
    const originalContent = '{\n    "name": "my/package"\n}\n';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(originalContent);
    jest.spyOn(childProcess, 'execSync').mockReturnValue(true);

    const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await plugin.prepare(null, context);

    const writtenContent = writeMock.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.version).toBe('1.1.0');
    expect(parsed.name).toBe('my/package');
  });
});
