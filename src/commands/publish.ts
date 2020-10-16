import * as semver from "semver";
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { CancellationTokenSource, ExtensionContext, ProgressLocation, window, workspace } from "vscode";
import { Faraday } from "../faraday";
import { warnNotFaradayModule } from "../shared";

export async function publish(faraday: Faraday, context: ExtensionContext) {
  if (workspace.workspaceFolders?.length != 1) {
    return warnNotFaradayModule()
  }

  const platforms = await pickPlatforms(context)
  if (platforms == undefined) return

  const mode = await pickPublishMode(context)
  if (mode == undefined) return

  const module = workspace.workspaceFolders[0].uri.fsPath
  const pubspecPath = path.join(module, 'pubspec.yaml')
  const file = fs.readFileSync(pubspecPath, 'utf8')
  const document = yaml.parse(file)

  const oldVersion = document['version']
  const version = await pickVersionIncrementType(oldVersion, mode == 'Release')
  if (version == undefined || version == null) return

  fs.writeFileSync(pubspecPath, file.replace(`version: ${oldVersion}`, `version: ${version}`))

  window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title: `publishing ${document['name']} mode: ${mode.toLowerCase()} version: ${version} ...` }, async (_, token) => {
    try {
      await faraday.tag(module, platforms, mode == 'Release', token)
      window.showInformationMessage('faraday publish succeed.')
    } catch (e) {
      window.showErrorMessage(`faraday publish new version failed. ${e}`);
    }
  })
}

async function pickVersionIncrementType(version: string, isRelease: boolean): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    const quickPick = window.createQuickPick();

    const dev = semver.inc(version, 'prerelease', { includePrerelease: true }, 'dev',)
    const patch = semver.inc(version, 'patch')
    const minor = semver.inc(version, 'minor')
    const major = semver.inc(version, 'major')

    quickPick.title = `Select Version Increment Type`;

    var items = [{
      label: 'None',
      detail: `use ${version}`,
      picked: true
    },
    {
      label: 'Patch',
      detail: `when you make backwards compatible bug fixes [${patch}]`,
    },
    {
      label: 'Minor',
      detail: `when you add functionality in a backwards compatible manner [${minor}]`,
    },
    {
      label: 'Major',
      detail: `when you make incompatible API changes or many many features included [${major}]`,
    }]

    if (!isRelease) {
      items = [{
        label: 'Development',
        detail: `when you make a build to QA or tester [${dev}]`
      }, {
        label: 'Custom',
        detail: 'input version'
      }]
    }

    quickPick.items = items
    quickPick.onDidChangeSelection(async selection => {
      quickPick.hide();
      const selected = selection[0].label
      if (selected === 'Custom') {
        resolve(inputVersion(version))
      } else {
        switch (selected) {
          case 'Development':
            resolve(dev)
            break
          case 'Patch':
            resolve(patch)
            break
          case 'Minor':
            resolve(minor)
            break
          case 'Major':
            resolve(major)
            break
          case 'None':
            resolve(version)
            break
          default:
            resolve(undefined)
        }
      }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  })
}

async function inputVersion(version: string) {
  return window.showInputBox({
    placeHolder: 'version', validateInput: (v) => {
      if (semver.valid(v) == null) {
        return `${v} is not valid semantic version`
      }
      if (semver.lt(v, version)) {
        return `new version (${v}) must grate than ${version}`
      }
      return null
    }
  })
}

async function pickPublishMode(context: ExtensionContext): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    const quickPick = window.createQuickPick()
    quickPick.title = 'Select Publish Mode'
    quickPick.items = [{
      label: 'Debug',
      picked: true
    }, {
      label: 'Release',
    }]
    quickPick.onDidChangeSelection((item) => {
      if (item == undefined) {
        resolve(undefined)
      } else {
        resolve(item[0].label)
      }
    })
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  })
}

async function pickPlatforms(context: ExtensionContext): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    const quickPick = window.createQuickPick()
    quickPick.title = 'Select Release Platforms'
    quickPick.items = [
      {
        label: 'iOS',
        picked: true
      },
      {
        label: 'Android'
      },
      {
        label: 'Both',
        detail: 'iOS and Android'
      }]
    quickPick.onDidChangeSelection((item) => {
      if (item == undefined) {
        resolve(undefined)
      } else {
        resolve(item[0].label == 'Both' ? 'ios,android' : item[0].label.toLowerCase())
      }
    })
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  })
}