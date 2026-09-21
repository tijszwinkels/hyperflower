# Install Hyperflower in Hyprsaver

Instructions for people and coding agents. These steps install a visual effect, not a lock screen or idle manager. Do not change idle deadlines, disable locking, or start background services as a side effect.

## 1. Inspect before changing anything

- Identify the checked-out repository and the intended user's home directory.
- Check for `hyprsaver` on PATH or at `~/.local/bin/hyprsaver`.
- Run `hyprsaver --version` and `hyprsaver --help` using the discovered executable.
- If missing, consult [the upstream installation instructions](https://github.com/maravexa/hyprsaver#readme). Obtain approval before installing packages. Do not pipe a remote script into a shell.
- Inspect `${XDG_CONFIG_HOME:-$HOME/.config}/hypr/hyprsaver.toml`, if present. Check for per-monitor overrides or alternate `--config` arguments in the user's launch command.

Hyprsaver 0.4.7 is the tested version. On another version, verify the paths, CLI options, and shader contract in its documentation first.

## 2. Copy the shader, preserving existing files

From the repository root, in Bash:

```bash
config_root="${XDG_CONFIG_HOME:-$HOME/.config}"
shader_dir="$config_root/hypr/hyprsaver/shaders"
mkdir -p "$shader_dir"
if [ -e "$shader_dir/hyperflower.frag" ]; then
  cp -p "$shader_dir/hyperflower.frag" "$shader_dir/hyperflower.frag.bak.$(date +%s)"
fi
cp hyperflower.frag "$shader_dir/hyperflower.frag"
```

Run `hyprsaver --list-shaders`; its user-shader list should include `hyperflower`.

**Authoring caveat:** keep `precision highp float;` immediately after `#version 320 es`. Hyprsaver 0.4.7's shader preprocessor stops reading the header at a comment or blank line; inserting one between these declarations can put injected uniforms before the precision declaration and fail compilation.

## 3. Validate before making it the default

These checks render offscreen without activating a desktop screensaver:

```bash
hyprsaver bench hyperflower --resolution 1920x1200 --monitors 1 --frames 30 --warmup 5
hyprsaver render-preview hyperflower --duration 2 --resolution 640x400 --fps 10 -o /tmp/hyperflower-preview.webp
```

Read the output: a benchmark may report shader compilation failures in its table even if the command exits successfully. Confirm it gives real timings, not a compile error. Inspect the generated preview.

For a windowed live test, with the user's approval:

```bash
hyprsaver --preview --shader hyperflower
```

Escape or Q closes the preview. For a real fullscreen screensaver, use `hyprsaver --shader hyperflower`; this may cover every monitor and should only be started when requested.

## 4. Select the default effect

Back up the existing TOML configuration before editing it. Change only the `shader` field in the existing `[general]` table, or create that table if absent:

```toml
[general]
shader = "hyperflower"
```

Do not paste a second `[general]` table into an existing file. Preserve palettes, frame rate, behavior, playlists, monitor settings, and unrelated options. A launch command that passes `--shader` explicitly can override this setting; inspect that command too.

For a new configuration, a reasonable starting point is:

```toml
[general]
shader = "hyperflower"
fps = 30
```

Hyperflower defines its own rainbow palette, so Hyprsaver palette choices do not alter it. Its native speed is the same cruising speed as the original widget.

Validate TOML syntax (Python 3.11+):

```bash
python3 - <<'PY'
import os, pathlib, tomllib
root = pathlib.Path(os.environ.get('XDG_CONFIG_HOME', pathlib.Path.home() / '.config'))
p = root / 'hypr/hyprsaver.toml'
config = tomllib.loads(p.read_text())
assert config['general']['shader'] == 'hyperflower'
print('Hyperflower selected; TOML syntax is valid.')
PY
```

Hyprsaver reads configuration on startup. No reboot or compositor reload is needed; an already-running screensaver may need to exit normally before the new default appears.

## Rollback

Restore the previous `general.shader` value, preserving any unrelated edits made since installation. If no prior config existed, remove only the configuration you created. Remove `hyperflower.frag` only if no remaining config or launcher references it; restore its backup if a previous file was replaced.

Report exactly what was tested. A headless shader test does not verify live idle activation, monitor coverage, input dismissal, or screen locking.
