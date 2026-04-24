import {h, app} from 'hyperapp';

const FileTree = ({files, onSelect, onRefresh}) =>
  h('div', {class: 'file-tree'}, [
    h('div', {class: 'file-tree-header'}, [
      h('span', {}, 'Files'),
      h('button', {onclick: onRefresh}, 'Refresh')
    ]),
    h('div', {class: 'file-tree-list'}, files.map(file =>
      h('div', {
        class: `file-item ${file.isDirectory ? 'directory' : 'file'}`,
        onclick: () => onSelect(file)
      }, [
        h('span', {class: 'file-icon'}, file.isDirectory ? '📁' : '📄'),
        h('span', {class: 'file-name'}, file.filename)
      ])
    ))
  ]);

const FileInspector = ({file, content, onChange}) =>
  h('div', {class: 'file-inspector'}, [
    h('div', {class: 'inspector-header'}, [
      h('span', {}, file ? file.filename : 'No file selected'),
      file && h('div', {class: 'file-meta'}, [
        h('span', {}, `Size: ${file.size} bytes`),
        h('span', {}, `Modified: ${file.stat?.mtime || 'N/A'}`)
      ])
    ]),
    file && !file.isDirectory && h('textarea', {
      class: 'file-content',
      value: content,
      oninput: e => onChange(e.target.value)
    })
  ]);

const LayerHistory = ({layers, onCheckout}) =>
  h('div', {class: 'layer-history'}, [
    h('div', {class: 'layer-header'}, 'Layer History'),
    h('div', {class: 'layer-list'}, layers.map((layer, idx) =>
      h('div', {
        class: 'layer-item',
        key: idx
      }, [
        h('div', {class: 'layer-hash'}, layer.short),
        h('div', {class: 'layer-instruction'}, layer.instruction),
        h('div', {class: 'layer-time'}, new Date(layer.time).toLocaleString()),
        h('button', {
          onclick: () => onCheckout(layer.hash)
        }, 'Checkout')
      ])
    ))
  ]);

const DebugConsole = ({logs}) =>
  h('div', {class: 'debug-console'}, [
    h('div', {class: 'console-header'}, 'Debug Console'),
    h('div', {class: 'console-output'}, logs.map((log, idx) =>
      h('div', {
        class: `console-line ${log.level}`,
        key: idx
      }, `[${log.level}] ${log.message}`)
    ))
  ]);

const createView = (state, actions) => h('div', {class: 'filesystem-debugger'}, [
  h('div', {class: 'debugger-toolbar'}, [
    h('button', {onclick: actions.loadFiles}, 'Load Files'),
    h('button', {onclick: actions.loadHistory}, 'Load History'),
    h('button', {onclick: actions.runStatus}, 'Status'),
    h('select', {
      onchange: e => actions.setMountpoint(e.target.value)
    }, [
      h('option', {value: 'sequential-machine'}, 'Sequential-OS'),
      h('option', {value: 'osjs'}, 'OS.js')
    ])
  ]),
  h('div', {class: 'debugger-main'}, [
    h('div', {class: 'debugger-left'}, [
      FileTree({
        files: state.files,
        onSelect: actions.selectFile,
        onRefresh: actions.loadFiles
      }),
      LayerHistory({
        layers: state.layers,
        onCheckout: actions.checkoutLayer
      })
    ]),
    h('div', {class: 'debugger-right'}, [
      FileInspector({
        file: state.selectedFile,
        content: state.fileContent,
        onChange: actions.setFileContent
      }),
      DebugConsole({
        logs: state.logs
      })
    ])
  ])
]);

const createApp = ($content, proc) => {
  const initialState = {
    files: [],
    selectedFile: null,
    fileContent: '',
    layers: [],
    logs: [],
    mountpoint: 'sequential-machine',
    currentPath: '/'
  };

  const actions = {
    setMountpoint: mountpoint => ({mountpoint}),

    addLog: (level, message) => state => ({
      logs: [...state.logs, {level, message, time: Date.now()}]
    }),

    loadFiles: () => (state, actions) => {
      actions.addLog('info', `Loading files from ${state.mountpoint}:${state.currentPath}`);

      proc.request('/vfs/readdir', {
        method: 'POST',
        body: JSON.stringify({
          path: `${state.mountpoint}:${state.currentPath}`
        })
      }).then(files => {
        actions.setFiles(files);
        actions.addLog('success', `Loaded ${files.length} files`);
      }).catch(error => {
        actions.addLog('error', `Failed to load files: ${error.message}`);
      });
    },

    setFiles: files => ({files}),

    selectFile: file => (state, actions) => {
      if (file.isDirectory) {
        const newPath = state.currentPath === '/'
          ? `/${file.filename}`
          : `${state.currentPath}/${file.filename}`;

        actions.setCurrentPath(newPath);
        actions.loadFiles();
        return {selectedFile: file};
      }

      actions.addLog('info', `Loading file: ${file.filename}`);

      proc.request('/vfs/readfile', {
        method: 'POST',
        body: JSON.stringify({
          path: `${state.mountpoint}:${file.path}`
        })
      }).then(response => {
        const content = response.body ? new TextDecoder().decode(response.body) : '';
        actions.setFileContent(content);
        actions.addLog('success', `Loaded file: ${file.filename}`);
      }).catch(error => {
        actions.addLog('error', `Failed to load file: ${error.message}`);
      });

      return {selectedFile: file};
    },

    setCurrentPath: currentPath => ({currentPath}),

    setFileContent: fileContent => ({fileContent}),

    loadHistory: () => (state, actions) => {
      actions.addLog('info', 'Loading layer history');

      proc.request('/api/sequential-os/history').then(layers => {
        actions.setLayers(layers);
        actions.addLog('success', `Loaded ${layers.length} layers`);
      }).catch(error => {
        actions.addLog('error', `Failed to load history: ${error.message}`);
      });
    },

    setLayers: layers => ({layers}),

    checkoutLayer: hash => (state, actions) => {
      actions.addLog('info', `Checking out layer: ${hash}`);

      proc.request('/api/sequential-os/checkout', {
        method: 'POST',
        body: JSON.stringify({ref: hash})
      }).then(() => {
        actions.addLog('success', `Checked out layer: ${hash}`);
        actions.loadFiles();
      }).catch(error => {
        actions.addLog('error', `Failed to checkout: ${error.message}`);
      });
    },

    runStatus: () => (state, actions) => {
      actions.addLog('info', 'Checking Sequential-OS status');

      proc.request('/api/sequential-os/status').then(status => {
        const changes = status.added.length + status.modified.length + status.deleted.length;
        actions.addLog('success', `Status: ${changes} changes (${status.added.length} added, ${status.modified.length} modified, ${status.deleted.length} deleted)`);
      }).catch(error => {
        actions.addLog('error', `Failed to get status: ${error.message}`);
      });
    }
  };

  return app(initialState, actions, createView, $content);
};

export default (core, proc) => {
  proc.createWindow({
    id: 'FileSystemDebugger',
    title: 'Filesystem Debugger',
    dimension: {width: 1200, height: 800},
    position: {left: 50, top: 50}
  }).on('destroy', () => proc.destroy())
    .render($content => createApp($content, proc));
};
