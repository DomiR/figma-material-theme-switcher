// This file holds the main code for the plugin. It has access to the *document*.
// You can access browser APIs such as the network by creating a UI which contains
// a full browser environment (see documentation).
async function main() {
  if (figma.command === 'openSwitcher') {
    // This shows the HTML page in "ui.html".
    console.log('running 1.0.1')
    figma.showUI(__html__, {height: 70, width: 70})
  } else if (figma.command === 'saveFromTeamLibrary') {
    await TeamColorsManager.saveTeamStyleKeysToStorage()
    figma.notify('Saved team colors to storage', {timeout: 2000})
    figma.closePlugin();
  } else if (figma.command === 'loadFromTeamLibrary') {
    await TeamColorsManager.loadTeamStyles()
    figma.notify('Loaded team colors to storage', {timeout: 2000})
    figma.closePlugin();
  }
}

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = msg => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === 'dark') {
    replaceAllStyles('dark')
  } else if (msg.type === 'light') {
    replaceAllStyles('light')
  } else if (msg.type === 'save') {
    TeamColorsManager.saveTeamStyleKeysToStorage()
  } else if (msg.type === 'load') {
    TeamColorsManager.loadTeamStyles()
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  //figma.closePlugin();
};

async function replaceAllStyles(mode: 'light' | 'dark') {
  const localStyles = figma.getLocalPaintStyles()
  console.log('styles', localStyles)
  const teamStyles: any[] = await TeamColorsManager.loadTeamStylesFromStorage();
  const styleManager = new StyleManager([...localStyles, ...teamStyles])

  for (let i = 0; i < figma.currentPage.selection.length; i++) {
      try {
        replaceNodes(mode, styleManager,[figma.currentPage.selection[i]] )
      } catch (err) {
        const error = (err as Error).toString()
        figma.notify(error)
      }
  }
}

function replaceNodes(mode: 'light' | 'dark', styleManager: StyleManager, nodes: Array<any>): void {
  for (const node of nodes) {
    console.log('processing node', node.name, node.type, node)
    const backgroundStyleName = styleManager.getStyleNameById(node.backgroundStyleId)
    const fillStyleName = styleManager.getStyleNameById(node.fillStyleId)
    const strokeStyleName = styleManager.getStyleNameById(node.strokeStyleId)
    console.log('fillStyleName', fillStyleName)
    console.log('strokeStyleName', strokeStyleName)
    console.log('backgroundStyleName', backgroundStyleName)
    console.log('-----')
    if (fillStyleName != null) {
      const replacedColorStyleName = Replacer.replace(fillStyleName, mode)
      const replacedFillStyleId = styleManager.getStyleIdByName(replacedColorStyleName)
      if (replacedFillStyleId != null) {
        node.fillStyleId = replacedFillStyleId
      }
    }

    if (strokeStyleName != null) {
      const replacedStrokeColorStyleName = Replacer.replace(strokeStyleName, mode)
      const replacedStrokeStyleId = styleManager.getStyleIdByName(replacedStrokeColorStyleName)
      if (replacedStrokeStyleId != null) {
        node.strokeStyleId = replacedStrokeStyleId
      }
    }

    if (backgroundStyleName != null) {
      const replacedBackgroundStyleName = Replacer.replace(backgroundStyleName, mode)
      const replacedBackgroundStyleId = styleManager.getStyleIdByName(replacedBackgroundStyleName)
      if (replacedBackgroundStyleId != null) {
        node.backgroundStyleId = replacedBackgroundStyleId
      }
    }

    if (node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'PAGE') {
      replaceNodes(mode, styleManager, node.children)
    }
  }
}

class TeamColorsManager {
  static key: string = "themeSwitcher.teamColorKeys"
  static styles: string = "themeSwitcher.teamColorStyles"

  static async saveTeamStyleKeysToStorage(): Promise<boolean> {
    if (figma.getLocalPaintStyles().length != 0) {
      await figma.clientStorage.setAsync(this.key, figma.getLocalPaintStyles().map(a => a.key))
      return true
    }
    return false
  }

  static async loadTeamStyles(): Promise<Array<BaseStyle>> {
    const teamColorKeys = await figma.clientStorage.getAsync(this.key)
    if (!teamColorKeys) {
      console.log("The team colors were not found. Please run 'save' on the styles page before run any replace commands.")
      return []
    }

    console.log('start loading: ', teamColorKeys.length, ' keys')
    const teamStylesResults = await Promise.all(teamColorKeys.map((k: string) => figma.importStyleByKeyAsync(k).catch(_e => null)))
    const teamStyles = teamStylesResults.filter(s => s != null)
    console.log('loaded team: ', teamStyles)
    const styles = teamStyles.map(a => ({id: a.id, name: a.name}))
    await figma.clientStorage.setAsync(this.styles, JSON.stringify(styles))
    return teamStyles
  }

  static async loadTeamStylesFromStorage(): Promise<Array<BaseStyle>> {
    const teamColors = await figma.clientStorage.getAsync(this.styles)
    if (!teamColors) {
      console.log("The team colors were not found. Please run 'save' on the styles page before run any replace commands.")
      return []
    }
    console.log('loaded team: ', teamColors)
    return JSON.parse(teamColors)
  }
}


class StyleManager {
  styles: Array<BaseStyle>

  constructor(styles: Array<BaseStyle>) {
    this.styles = styles
  }

  getStyleNameById(currentStyleId: string): string | null {
    let style = this.styles.find(style => style.id == currentStyleId)
    return (style != undefined) ? style.name : null
  }

  getStyleIdByName(replacedColorStyleName: string): string | null {
    let style = this.styles.find(style => style.name == replacedColorStyleName)
    return (style != undefined) ? style.id : null
  }
}

const Mode = {
  Dark: 'dark',
  Light: 'light',
  Elevated: 'elevated',
}

class Replacer {
  static replace(name: string, to: string): string {
    const keywords = Object.keys(Mode).map((key) => (Mode as any)[key])
    for (let from of keywords) {
      if (name.match(from)) {
        return name.replace(from, to)
      }
      const capitalizedFrom = this.capitalize(from)
      if (name.match(capitalizedFrom)) {
        return name.replace(capitalizedFrom, this.capitalize(to))
      }
    }
    return name
  }

  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.toLowerCase().slice(1)
  }
}

main()