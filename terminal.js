(function () {

  /* ── FILESYSTEM ───────────────────────────────────────────────────
     Dot-prefix names are hidden files — only shown with ls -a or ls -al.
     Add new dirs/files here. Every path must also be listed as a
     child of its parent directory.
  ─────────────────────────────────────────────────────────────────── */
  var FS = {
    '~': {
      type: 'dir',
      children: ['kennethgharper']
    },
    '~/kennethgharper': {
      type: 'dir',
      children: ['catme.txt', '.wip']
    },
    '~/kennethgharper/catme.txt': {
      type: 'file',
      content: [
        '',
        'Hey! Welcome to my website, take a look around.',
        '',
        'flag{ch1ck3n}',
        ''
      ]
    },
    '~/kennethgharper/.wip': {
      type: 'file',
      content: [
        '',
        'not ready yet, being worked on.',
        'find the flags. submit them. see what unlocks.',
        'but it/s not ready. Just a hint for what is to come.',
        '',
        '  /unlock',
        ''
      ]
    }
  };

  /* ── STATE ────────────────────────────────────────────────────────*/
  var term    = document.getElementById('term');
  var hi      = document.getElementById('hi');
  var cwd     = '~';
  var history = [];
  var histIdx = -1;

  /* ── FLAG PARSING ─────────────────────────────────────────────────
     Splits args into flags (e.g. -al) and operands (paths etc).
     Returns { flags: Set, operands: [] }
     Supports any combo of single-char flags: -a, -l, -al, -la, etc.
  ─────────────────────────────────────────────────────────────────── */
  function parseArgs(args) {
    var flags    = new Set();
    var operands = [];
    args.forEach(function (a) {
      if (a.charAt(0) === '-' && a.length > 1) {
        a.slice(1).split('').forEach(function (ch) { flags.add(ch); });
      } else {
        operands.push(a);
      }
    });
    return { flags: flags, operands: operands };
  }

  /* ── PATH RESOLUTION ──────────────────────────────────────────────*/
  function resolvePath(p) {
    if (!p || p === '~') return '~';
    if (p === '..') {
      if (cwd === '~') return '~';
      var pts = cwd.split('/');
      pts.pop();
      return pts.join('/') || '~';
    }
    if (p.startsWith('~/')) return p;
    if (cwd === '~') return '~/' + p;
    return cwd + '/' + p;
  }

  /* ── PROMPT HTML ──────────────────────────────────────────────────*/
  function ps1html() {
    return '<span class="ps1-user">guest</span>'
         + '@<span class="ps1-host">kennethgharper</span>'
         + ':<span class="ps1-path">' + cwd + '</span>$ ';
  }

  /* ── INPUT LINE ELEMENTS ──────────────────────────────────────────*/
  var inputLine, beforeCursor, cursorEl, afterCursor;

  function buildInputLine() {
    inputLine             = document.createElement('div');
    inputLine.className   = 'input-line';
    inputLine.innerHTML   = ps1html();
    beforeCursor          = document.createElement('span');
    cursorEl              = document.createElement('span');
    cursorEl.className    = 'cursor';
    cursorEl.textContent  = ' ';
    afterCursor           = document.createElement('span');
    inputLine.appendChild(beforeCursor);
    inputLine.appendChild(cursorEl);
    inputLine.appendChild(afterCursor);
    term.appendChild(inputLine);
    term.scrollTop = term.scrollHeight;
  }

  function rebuildPrompt() {
    inputLine.innerHTML  = ps1html();
    beforeCursor         = document.createElement('span');
    cursorEl             = document.createElement('span');
    cursorEl.className   = 'cursor';
    cursorEl.textContent = ' ';
    afterCursor          = document.createElement('span');
    inputLine.appendChild(beforeCursor);
    inputLine.appendChild(cursorEl);
    inputLine.appendChild(afterCursor);
  }

  function updateCursor() {
    var val = hi.value;
    var pos = hi.selectionStart !== undefined ? hi.selectionStart : val.length;
    beforeCursor.textContent = val.slice(0, pos);
    cursorEl.textContent     = val[pos] || ' ';
    afterCursor.textContent  = val.slice(pos + 1);
    term.scrollTop = term.scrollHeight;
  }

  /* ── OUTPUT ───────────────────────────────────────────────────────*/
  function printLine(text, cls) {
    var el         = document.createElement('div');
    el.className   = cls || 'out';
    el.textContent = text;
    term.insertBefore(el, inputLine);
    term.scrollTop = term.scrollHeight;
  }

  /* ── TAB COMPLETION ───────────────────────────────────────────────*/
  function tabComplete() {
    var val   = hi.value;
    var parts = val.trimStart().split(/\s+/);
    if (parts.length < 2) return;
    var partial = parts[parts.length - 1];
    if (partial.charAt(0) === '-') return;    // don't complete flags
    var base    = partial.includes('/') ? partial.slice(0, partial.lastIndexOf('/') + 1) : '';
    var stub    = partial.slice(base.length);
    var dir     = resolvePath(base || cwd);
    var node    = FS[dir] || FS[cwd];
    if (!node || node.type !== 'dir') return;

    var matches = node.children.filter(function (c) {
      return c.indexOf(stub) === 0 && c.charAt(0) !== '.';  // don't tab-complete hidden files
    });
    if (matches.length === 1) {
      parts[parts.length - 1] = base + matches[0];
      hi.value = parts.join(' ');
      updateCursor();
    } else if (matches.length > 1) {
      printLine(matches.join('  '));
    }
  }

  /* ── COMMANDS ─────────────────────────────────────────────────────
     Add new commands here as properties of CMDS.
     Each receives the raw args array (everything after the command).
     Use parseArgs(args) to split flags from operands inside each cmd.
  ─────────────────────────────────────────────────────────────────── */
  var CMDS = {

    help: function () {
      printLine('available commands: ls  cd  cat  pwd  clear  whoami  help');
    },

    whoami: function () {
      printLine('guest');
    },

    pwd: function () {
      printLine(cwd.replace('~', '/home/guest'));
    },

    clear: function () {
      Array.from(term.children).forEach(function (c) {
        if (c !== inputLine && c !== hi) c.remove();
      });
    },

    ls: function (args) {
      var parsed  = parseArgs(args);
      var showAll = parsed.flags.has('a');    // -a: show hidden dot-files
      var longFmt = parsed.flags.has('l');    // -l: long listing format
      var target  = parsed.operands[0] ? resolvePath(parsed.operands[0]) : cwd;
      var node    = FS[target];

      if (!node) {
        printLine("ls: cannot access '" + (parsed.operands[0] || '.') + "': No such file or directory", 'err');
        return;
      }

      if (node.type === 'file') {
        if (longFmt) {
          printLine('-rw-r--r--  ' + target.split('/').pop());
        } else {
          printLine(target.split('/').pop());
        }
        return;
      }

      // filter hidden files unless -a
      var entries = node.children.filter(function (c) {
        return showAll || c.charAt(0) !== '.';
      });

      // prepend . and .. when -a is set
      if (showAll) entries = ['.', '..'].concat(entries);

      if (!longFmt) {
        printLine(entries.join('  '));
      } else {
        entries.forEach(function (name) {
          if (name === '.' || name === '..') {
            printLine('drwxr-xr-x  ' + name);
            return;
          }
          var childPath = (target === '~' ? '~/' : target + '/') + name;
          var child     = FS[childPath];
          var isDir     = child && child.type === 'dir';
          printLine((isDir ? 'drwxr-xr-x' : '-rw-r--r--') + '  ' + name);
        });
      }
    },

    cd: function (args) {
      var parsed = parseArgs(args);
      var dest   = parsed.operands[0] || '~';
      var target = resolvePath(dest);
      if (!FS[target]) {
        printLine('bash: cd: ' + dest + ': No such file or directory', 'err');
        return;
      }
      if (FS[target].type === 'file') {
        printLine('bash: cd: ' + dest + ': Not a directory', 'err');
        return;
      }
      cwd = target;
      rebuildPrompt();
    },

    cat: function (args) {
      var parsed = parseArgs(args);
      if (!parsed.operands[0]) { printLine('cat: missing operand', 'err'); return; }
      var target = resolvePath(parsed.operands[0]);
      var node   = FS[target];
      if (!node) {
        printLine('cat: ' + parsed.operands[0] + ': No such file or directory', 'err');
        return;
      }
      if (node.type === 'dir') {
        printLine('cat: ' + parsed.operands[0] + ': Is a directory', 'err');
        return;
      }
      node.content.forEach(function (line) {
        printLine(line, line.startsWith('flag{') ? 'flag' : 'out');
      });
    }

  };

  /* ── COMMAND RUNNER ───────────────────────────────────────────────*/
  function run(raw) {
    if (raw.trim()) {
      history.unshift(raw);
      histIdx = -1;
    }

    var safe  = raw.replace(/[<>&]/g, '');
    var parts = safe.trim().split(/\s+/);
    var cmd   = (parts[0] || '').toLowerCase();
    var args  = parts.slice(1);

    var committed       = document.createElement('div');
    committed.className = 'committed';
    committed.innerHTML = ps1html()
      + '<span>' + raw.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
    term.insertBefore(committed, inputLine);

    hi.value = '';
    rebuildPrompt();

    if (cmd) {
      if (CMDS[cmd]) {
        CMDS[cmd](args);
      } else {
        printLine('bash: ' + cmd + ': command not found', 'err');
      }
    }

    term.scrollTop = term.scrollHeight;
    hi.focus();
  }

  /* ── EVENT LISTENERS ──────────────────────────────────────────────*/
  hi.addEventListener('input', updateCursor);

  hi.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      run(hi.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        histIdx++;
        hi.value = history[histIdx];
        setTimeout(updateCursor, 0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        hi.value = history[histIdx];
      } else {
        histIdx  = -1;
        hi.value = '';
      }
      setTimeout(updateCursor, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      tabComplete();
    } else {
      setTimeout(updateCursor, 0);
    }
  });

  term.addEventListener('click', function () { hi.focus(); });

  /* ── INIT ─────────────────────────────────────────────────────────*/
  buildInputLine();
  hi.focus();

})();