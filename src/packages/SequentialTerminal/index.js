import {h, app} from 'hyperapp';

const createTerminalView = (state, actions) => h('div', {
  class: 'sequential-terminal',
  oncreate: el => {
    el.querySelector('.terminal-input').focus();
  }
}, [
  h('div', {class: 'terminal-header'}, [
    h('div', {class: 'terminal-title'}, 'Sequential-OS Terminal'),
    h('div', {class: 'terminal-controls'}, [
      h('button', {
        onclick: () => actions.clearOutput()
      }, 'Clear'),
      h('button', {
        onclick: () => actions.showHistory()
      }, 'History')
    ])
  ]),
  h('div', {class: 'terminal-output'}, state.output.map((line, idx) =>
    h('div', {
      class: `terminal-line ${line.type}`,
      key: idx
    }, line.content)
  )),
  h('div', {class: 'terminal-input-container'}, [
    h('span', {class: 'terminal-prompt'}, `${state.cwd} $`),
    h('input', {
      type: 'text',
      class: 'terminal-input',
      value: state.input,
      oninput: e => actions.setInput(e.target.value),
      onkeydown: e => {
        if (e.key === 'Enter') {
          actions.executeCommand(state.input);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          actions.historyUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          actions.historyDown();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          actions.autocomplete(state.input);
        }
      }
    })
  ])
]);

const createApp = ($content, proc, win) => {
  const initialState = {
    input: '',
    output: [
      {type: 'info', content: 'Sequential-OS Terminal - Type "help" for commands'},
      {type: 'info', content: 'State Directory: ' + (proc.args.stateDir || '.sequential-machine')},
      {type: 'info', content: 'Workdir: ' + (proc.args.workdir || '.sequential-machine/work')}
    ],
    cwd: '/',
    history: [],
    historyIndex: -1
  };

  const actions = {
    setInput: input => ({input}),

    clearOutput: () => ({
      output: []
    }),

    historyUp: () => state => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          historyIndex: newIndex,
          input: state.history[state.history.length - 1 - newIndex]
        };
      }
      return state;
    },

    historyDown: () => state => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          historyIndex: newIndex,
          input: state.history[state.history.length - 1 - newIndex]
        };
      } else if (state.historyIndex === 0) {
        return {historyIndex: -1, input: ''};
      }
      return state;
    },

    showHistory: () => state => ({
      output: [
        ...state.output,
        {type: 'info', content: '--- Command History ---'},
        ...state.history.map(cmd => ({type: 'command', content: cmd}))
      ]
    }),

    autocomplete: input => state => {
      const commands = [
        'help', 'status', 'history', 'run', 'exec', 'checkout',
        'tags', 'tag', 'inspect', 'diff', 'rebuild', 'reset', 'clear', 'ls', 'cd', 'pwd', 'cat'
      ];
      const matches = commands.filter(cmd => cmd.startsWith(input));
      if (matches.length === 1) {
        return {input: matches[0] + ' '};
      } else if (matches.length > 1) {
        return {
          output: [
            ...state.output,
            {type: 'info', content: 'Matches: ' + matches.join(', ')}
          ]
        };
      }
      return state;
    },

    executeCommand: input => state => {
      if (!input.trim()) {
        return state;
      }

      const newOutput = [
        ...state.output,
        {type: 'command', content: `$ ${input}`}
      ];
      const newHistory = [...state.history, input];

      const parts = input.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      if (cmd === 'help') {
        return {
          output: [
            ...newOutput,
            {type: 'info', content: 'Sequential-OS Commands:'},
            {type: 'info', content: '  status - Show uncommitted changes'},
            {type: 'info', content: '  history - Show layer history'},
            {type: 'info', content: '  run <command> - Execute and capture'},
            {type: 'info', content: '  exec <command> - Execute without capture'},
            {type: 'info', content: '  checkout <ref> - Navigate to layer'},
            {type: 'info', content: '  tags - List all tags'},
            {type: 'info', content: '  tag <name> [ref] - Create tag'},
            {type: 'info', content: '  inspect <ref> - Show layer details'},
            {type: 'info', content: '  diff <ref1> <ref2> - Compare layers'},
            {type: 'info', content: '  rebuild - Reconstruct workdir'},
            {type: 'info', content: '  reset - Clear all state'},
            {type: 'info', content: 'Basic Shell:'},
            {type: 'info', content: '  ls [path] - List directory'},
            {type: 'info', content: '  cd <path> - Change directory'},
            {type: 'info', content: '  pwd - Print working directory'},
            {type: 'info', content: '  cat <file> - Show file contents'},
            {type: 'info', content: '  clear - Clear terminal'}
          ],
          input: '',
          history: newHistory,
          historyIndex: -1
        };
      }

      if (cmd === 'clear') {
        return {
          output: [],
          input: '',
          history: newHistory,
          historyIndex: -1
        };
      }

      if (cmd === 'pwd') {
        return {
          output: [...newOutput, {type: 'output', content: state.cwd}],
          input: '',
          history: newHistory,
          historyIndex: -1
        };
      }

      proc.request('/api/sequential-os/' + cmd, {
        method: 'GET'
      }).then(response => {
        const result = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        actions.addOutput({type: 'output', content: result});
      }).catch(error => {
        actions.addOutput({type: 'error', content: error.message});
      });

      return {
        output: newOutput,
        input: '',
        history: newHistory,
        historyIndex: -1
      };
    },

    addOutput: line => state => ({
      output: [...state.output, line]
    })
  };

  return app(initialState, actions, createTerminalView, $content);
};

export default (core, proc) => {
  proc.createWindow({
    id: 'SequentialTerminal',
    title: 'Sequential-OS Terminal',
    dimension: {width: 800, height: 600},
    position: {left: 100, top: 100}
  }).on('destroy', () => proc.destroy())
    .render($content => createApp($content, proc, this));
};
